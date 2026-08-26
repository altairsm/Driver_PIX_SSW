import { pool } from '../db/index.js';

export async function calcularPagamentos(inicio, fim, unidade) {
  const unidadeClause = unidade ? `AND v455.unidade_receptora = $3` : '';
  const params = unidade ? [inicio, fim, unidade] : [inicio, fim];

  const query = `
    WITH entregas_periodo AS (
      SELECT
        r.motorista_cpf,
        r.motorista_nome,
        c.ctrc,
        c.cidade_entrega,
        c.id_romaneio,
        COALESCE(c.frete_ctrc, 0) AS frete_ctrc,
        COALESCE(pc.valor_entrega, 0) AS valor_despesa,
        v455.unidade_receptora
      FROM ssw_ctrcs c
      JOIN ssw_romaneios r ON r.id_romaneio = c.id_romaneio
      LEFT JOIN LATERAL (
        SELECT valor_entrega FROM tabela_preco_cidade pc
        WHERE LOWER(pc.cidade) = LOWER(TRIM(SPLIT_PART(c.cidade_entrega, '/', 1)))
           OR LOWER(pc.cidade) = LOWER(TRIM(c.cidade_entrega))
        LIMIT 1
      ) pc ON true
      LEFT JOIN ssw_455 v455 ON v455.ctrc_normalizado = REPLACE(c.ctrc, ' ', '')
      WHERE c.ocorrencia_data BETWEEN $1::date AND $2::date
        AND EXISTS (SELECT 1 FROM ocorrencia_catalogo oc WHERE oc.finalizadora = true AND UPPER(c.ocorrencia) LIKE UPPER(oc.descricao) || '%')
        ${unidadeClause}
    ),
    resumo_motorista AS (
      SELECT
        motorista_cpf,
        motorista_nome,
        COUNT(*) AS total_ctrcs,
        COUNT(DISTINCT id_romaneio) AS total_romaneios,
        SUM(frete_ctrc) AS receita_total,
        SUM(valor_despesa) AS despesa_total
      FROM entregas_periodo
      GROUP BY motorista_cpf, motorista_nome
    ),
    adiantamentos AS (
      SELECT
        motorista_cpf,
        COALESCE(SUM(valor_solicitado), 0)::numeric(10,2) AS total_adiantado,
        COALESCE(SUM(valor_solicitado) FILTER (WHERE pix_enviado = true), 0)::numeric(10,2) AS total_adiantado_pix,
        COALESCE(SUM(valor_solicitado) FILTER (WHERE pix_enviado = false OR pix_enviado IS NULL), 0)::numeric(10,2) AS total_adiantado_nao_pix
      FROM solicitacoes_pagamento
      WHERE status = 'aprovado'
        AND aprovado_em::date BETWEEN $1::date AND $2::date
      GROUP BY motorista_cpf
    )
    SELECT
      m.cpf,
      m.nome,
      COALESCE(rm.total_ctrcs, 0) AS total_ctrcs,
      COALESCE(rm.total_romaneios, 0) AS total_romaneios,
      COALESCE(rm.receita_total, 0)::numeric(10,2) AS receita_total,
      COALESCE(rm.despesa_total, 0)::numeric(10,2) AS despesa_total,
      GREATEST(COALESCE(rm.despesa_total, 0) - COALESCE(a.total_adiantado_nao_pix, 0), 0)::numeric(10,2) AS total_pagar,
      COALESCE(a.total_adiantado, 0)::numeric(10,2) AS total_adiantado,
      COALESCE(a.total_adiantado_pix, 0)::numeric(10,2) AS total_adiantado_pix
    FROM motoristas m
    LEFT JOIN resumo_motorista rm ON rm.motorista_cpf = m.cpf
    LEFT JOIN adiantamentos a ON a.motorista_cpf = m.cpf
    WHERE rm.motorista_cpf IS NOT NULL
    ORDER BY m.nome;
  `;

  const result = await pool.query(query, params);
  return result.rows;
}

export async function confirmarPagamento(cpf, periodo) {
  const { inicio, fim } = periodo;

  const { rows: [driver] } = await pool.query(
    `SELECT nome FROM motoristas WHERE cpf = $1`,
    [cpf]
  );

  const { rows: [totalRow] } = await pool.query(`
    SELECT COUNT(*)::int AS total_ctrcs,
           COALESCE(SUM(c.frete_ctrc), 0)::numeric(10,2) AS receita,
           COALESCE(SUM(pc.valor_entrega), 0)::numeric(10,2) AS despesa
    FROM ssw_ctrcs c
    JOIN ssw_romaneios r ON r.id_romaneio = c.id_romaneio
    LEFT JOIN LATERAL (
      SELECT valor_entrega FROM tabela_preco_cidade pc
      WHERE LOWER(pc.cidade) = LOWER(TRIM(SPLIT_PART(c.cidade_entrega, '/', 1)))
         OR LOWER(pc.cidade) = LOWER(TRIM(c.cidade_entrega))
      LIMIT 1
    ) pc ON true
    WHERE r.motorista_cpf = $1
      AND c.ocorrencia_data BETWEEN $2::date AND $3::date
      AND EXISTS (SELECT 1 FROM ocorrencia_catalogo oc WHERE oc.finalizadora = true AND UPPER(c.ocorrencia) LIKE UPPER(oc.descricao) || '%')
  `, [cpf, inicio, fim]);

  const { rows: [adiantadoRow] } = await pool.query(`
    SELECT
      COALESCE(SUM(valor_solicitado), 0)::numeric(10,2) AS total_adiantado,
      COALESCE(SUM(valor_solicitado) FILTER (WHERE pix_enviado = true), 0)::numeric(10,2) AS total_adiantado_pix,
      COALESCE(SUM(valor_solicitado) FILTER (WHERE pix_enviado = false OR pix_enviado IS NULL), 0)::numeric(10,2) AS total_adiantado_nao_pix
    FROM solicitacoes_pagamento
    WHERE motorista_cpf = $1
      AND status = 'aprovado'
      AND aprovado_em::date BETWEEN $2::date AND $3::date
  `, [cpf, inicio, fim]);

  const receita = parseFloat(totalRow?.receita) || 0;
  const despesa = parseFloat(totalRow?.despesa) || 0;
  const adiantado = parseFloat(adiantadoRow?.total_adiantado) || 0;
  const adiantadoNaoPix = parseFloat(adiantadoRow?.total_adiantado_nao_pix) || 0;
  const totalPagar = Math.max(despesa - adiantadoNaoPix, 0);

  const payload = {
    cpf,
    nome: driver?.nome || '',
    quinzena_inicio: inicio,
    quinzena_fim: fim,
    total_ctrcs: totalRow?.total_ctrcs || 0,
    receita,
    despesa,
    total_pagar: totalPagar,
    total_adiantado: adiantado,
    total_adiantado_pix: parseFloat(adiantadoRow?.total_adiantado_pix) || 0,
    data_pagamento: new Date().toISOString().slice(0, 10),
  };

  try {
    const res = await fetch('https://webhook.sactudo.com.br/webhook/Driver_Pix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`Webhook responded with ${res.status}: ${await res.text().catch(() => '')}`);
    }
  } catch (err) {
    console.error('Webhook error:', err.message);
  }

  return payload;
}

export async function listarMotoristas() {
  const result = await pool.query(`
    SELECT cpf, nome, telefone, pix_tipo, cnpj_mei, bonus_d0, leu_regras, email, role, pre_aprovado, unidade, tipo
    FROM motoristas
    ORDER BY nome
  `);
  return result.rows;
}

export async function getQuinzenasAdmin() {
  const result = await pool.query(`
    SELECT DISTINCT
      CASE
        WHEN EXTRACT(DAY FROM c.ocorrencia_data) <= 15 THEN
          date_trunc('month', c.ocorrencia_data)::date
        ELSE
          (date_trunc('month', c.ocorrencia_data) + INTERVAL '15 days')::date
      END AS inicio,
      CASE
        WHEN EXTRACT(DAY FROM c.ocorrencia_data) <= 15 THEN
          (date_trunc('month', c.ocorrencia_data) + INTERVAL '14 days')::date
        ELSE
          (date_trunc('month', c.ocorrencia_data) + INTERVAL '1 month' - INTERVAL '1 day')::date
      END AS fim
    FROM ssw_ctrcs c
    WHERE c.ocorrencia_data IS NOT NULL
    ORDER BY inicio DESC
  `);
  return result.rows;
}

export async function criarMotorista(dados) {
  const { cpf, nome, telefone, pix_tipo, cnpj_mei, bonus_d0, email, role, pre_aprovado, unidade, tipo } = dados;
  await pool.query(`
    INSERT INTO motoristas (cpf, nome, telefone, pix_tipo, cnpj_mei, bonus_d0, email, role, pre_aprovado, unidade, tipo)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (cpf) DO UPDATE SET
      nome = EXCLUDED.nome,
      telefone = EXCLUDED.telefone,
      pix_tipo = EXCLUDED.pix_tipo,
      cnpj_mei = EXCLUDED.cnpj_mei,
      bonus_d0 = EXCLUDED.bonus_d0,
      email = COALESCE(EXCLUDED.email, motoristas.email),
      role = COALESCE(EXCLUDED.role, motoristas.role),
      pre_aprovado = EXCLUDED.pre_aprovado,
      unidade = EXCLUDED.unidade,
      tipo = EXCLUDED.tipo
  `, [cpf, nome, telefone || null, pix_tipo || 'CPF', cnpj_mei || null, bonus_d0 ?? 0, email || null, role || 'motorista', pre_aprovado ?? false, unidade || null, tipo || 'funcionario']);
  return { cpf, nome, telefone, pix_tipo, cnpj_mei, bonus_d0, email, role, pre_aprovado, unidade, tipo };
}

export async function atualizarMotorista(cpf, dados) {
  const { nome, telefone, pix_tipo, cnpj_mei, bonus_d0, email, role, pre_aprovado, unidade, tipo } = dados;
  const result = await pool.query(`
    UPDATE motoristas
    SET nome = $1, telefone = $2, pix_tipo = $3, cnpj_mei = $4, bonus_d0 = $5, email = $6, role = $7, pre_aprovado = $8, unidade = $9, tipo = $10
    WHERE cpf = $11
  `, [nome, telefone || null, pix_tipo || 'CPF', cnpj_mei || null, bonus_d0 ?? 0, email || null, role || 'motorista', pre_aprovado ?? false, unidade || null, tipo || 'funcionario', cpf]);
  return result.rowCount > 0;
}

export async function deletarMotorista(cpf) {
  await pool.query(`DELETE FROM ssw_romaneios WHERE motorista_cpf = $1`, [cpf]);
  const result = await pool.query(`DELETE FROM motoristas WHERE cpf = $1`, [cpf]);
  return result.rowCount > 0;
}

export async function getCidadesSemPreco(inicio, fim) {
  const query = `
    SELECT
      c.ctrc,
      c.cidade_entrega,
      c.ocorrencia_data,
      c.frete_ctrc,
      r.motorista_cpf,
      r.motorista_nome,
      r.id_romaneio
    FROM ssw_ctrcs c
    JOIN ssw_romaneios r ON r.id_romaneio = c.id_romaneio
    LEFT JOIN LATERAL (
      SELECT cidade FROM tabela_preco_cidade pc
      WHERE LOWER(pc.cidade) = LOWER(TRIM(SPLIT_PART(c.cidade_entrega, '/', 1)))
         OR LOWER(pc.cidade) = LOWER(TRIM(c.cidade_entrega))
      LIMIT 1
    ) pc ON true
    WHERE pc.cidade IS NULL
      AND EXISTS (SELECT 1 FROM ocorrencia_catalogo oc WHERE oc.finalizadora = true AND UPPER(c.ocorrencia) LIKE UPPER(oc.descricao) || '%')
      AND ($1::date IS NULL OR c.ocorrencia_data >= $1::date)
      AND ($2::date IS NULL OR c.ocorrencia_data <= $2::date)
    ORDER BY c.cidade_entrega, c.ocorrencia_data DESC
  `;
  const result = await pool.query(query, [inicio || null, fim || null]);
  const ctrcs = result.rows;

  const cidadesMap = new Map();
  for (const row of ctrcs) {
    const cidade = (row.cidade_entrega || '').trim();
    if (!cidadesMap.has(cidade)) {
      cidadesMap.set(cidade, { cidade, total: 0, frete_total: 0 });
    }
    const entry = cidadesMap.get(cidade);
    entry.total++;
    entry.frete_total += Number(row.frete_ctrc) || 0;
  }

  return {
    ctrcs,
    total: ctrcs.length,
    cidades_unicas: [...cidadesMap.values()].sort((a, b) => b.total - a.total),
  };
}

export async function getCtrcsParados(unidade) {
  const params = [];
  const conditions = [];

  if (unidade) { params.push(unidade); conditions.push(`c.unidade_receptora = $${params.length}`); }

  const where = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

  const result = await pool.query(`
    SELECT
      cidade_entrega,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE (CURRENT_DATE - data_emissao) <= 3)::int AS ate_3_dias,
      COUNT(*) FILTER (WHERE (CURRENT_DATE - data_emissao) BETWEEN 4 AND 7)::int AS de_4_a_7,
      COUNT(*) FILTER (WHERE (CURRENT_DATE - data_emissao) BETWEEN 8 AND 15)::int AS de_8_a_15,
      COUNT(*) FILTER (WHERE (CURRENT_DATE - data_emissao) BETWEEN 16 AND 30)::int AS de_16_a_30,
      COUNT(*) FILTER (WHERE (CURRENT_DATE - data_emissao) > 30)::int AS mais_30
    FROM ssw_ctrcs c
    WHERE NOT EXISTS (
      SELECT 1 FROM ocorrencia_catalogo oc
      WHERE oc.finalizadora = true
        AND UPPER(c.ocorrencia) LIKE UPPER(oc.descricao) || '%'
    )
    ${where}
    GROUP BY cidade_entrega
    ORDER BY total DESC
  `, params);
  return result.rows;
}

export async function getCtrcsParadosDetalhado(unidade) {
  const params = [];
  const conditions = [];

  if (unidade) { params.push(unidade); conditions.push(`c.unidade_receptora = $${params.length}`); }

  const where = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

  const result = await pool.query(`
    SELECT
      v.numero_nota_fiscal AS nf,
      c.ctrc,
      COALESCE(p.nome_simplificado, v.cliente_pagador, c.remetente) AS cliente_pagador,
      to_char(c.data_emissao, 'YYYY-MM-DD') AS data_emissao,
      to_char(v.previsao_entrega, 'YYYY-MM-DD') AS previsao_entrega,
      CASE
        WHEN v.previsao_entrega < CURRENT_DATE THEN 'Vencido'
        WHEN v.previsao_entrega = CURRENT_DATE THEN 'Vence hoje'
        WHEN v.previsao_entrega IS NULL THEN 'Sem previsão'
        ELSE 'A Vencer'
      END AS status_prazo,
      COALESCE(oc.resumo, 'Na filial') AS resumo_ocorrencia,
      c.ocorrencia,
      c.cidade_entrega,
      c.unidade_receptora,
      v.cubagem_m3,
      v.valor_mercadoria,
      v.setor_destino,
      v.tipo_baixa,
      (CURRENT_DATE - c.data_emissao) AS dias_parados
    FROM ssw_ctrcs c
    LEFT JOIN ssw_455 v ON REPLACE(c.ctrc, ' ', '') = v.ctrc_normalizado
    LEFT JOIN pagadores p ON p.cnpj = v.cnpj_pagador
    LEFT JOIN ocorrencia_catalogo oc ON oc.codigo = v.codigo_ocorrencia
      OR (v.codigo_ocorrencia IS NULL AND UPPER(c.ocorrencia) LIKE UPPER(oc.descricao) || '%')
    WHERE NOT EXISTS (
      SELECT 1 FROM ocorrencia_catalogo oc2
      WHERE oc2.finalizadora = true
        AND UPPER(c.ocorrencia) LIKE UPPER(oc2.descricao) || '%'
    )
    ${where}
    ORDER BY c.data_emissao ASC
  `, params);
  return result.rows;
}
