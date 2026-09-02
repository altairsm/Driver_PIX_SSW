import { pool } from '../db/index.js';
import { getConfig } from './configuracaoService.js';
import { notificarAdiantamentoAutomatico } from './emailService.js';

const APP_USAGE_OCCURRENCE_CODES = Object.freeze(['01', '03', '10', '11', '13', '38', '60']);
const APP_USAGE_CODE_FILTER = (paramPosition) => `LPAD(TRIM(COALESCE(v.codigo_ocorrencia, '')), 2, '0') = ANY($${paramPosition}::text[])`;

export async function getDriverData(cpf) {
  const result = await pool.query(`
    SELECT cpf, nome, telefone, leu_regras, cnpj_mei, pix_tipo, bonus_d0, pre_aprovado
    FROM motoristas
    WHERE cpf = $1
  `, [cpf]);
  return result.rows[0] || null;
}

export async function getDriverDashboard(cpf, inicio, fim) {
  const query = `
    SELECT
      COUNT(*) AS total_ctrcs,
      COUNT(DISTINCT c.id_romaneio) AS total_romaneios,
      COALESCE(SUM(pc.valor_entrega), 0)::numeric(10,2) AS receita_total
    FROM ssw_ctrcs c
    JOIN ssw_romaneios r ON r.id_romaneio = c.id_romaneio
    LEFT JOIN LATERAL (
      SELECT valor_entrega FROM tabela_preco_cidade pc
      WHERE LOWER(pc.cidade) = LOWER(TRIM(SPLIT_PART(c.cidade_entrega, '/', 1)))
         OR LOWER(pc.cidade) = LOWER(TRIM(c.cidade_entrega))
      ORDER BY (pc.unidade = COALESCE(c.unidade_receptora, '')) DESC, pc.unidade
      LIMIT 1
    ) pc ON true
    WHERE r.motorista_cpf = $1
      AND c.ocorrencia_data BETWEEN $2::date AND $3::date
      AND EXISTS (SELECT 1 FROM ocorrencia_catalogo oc WHERE oc.finalizadora = true AND UPPER(c.ocorrencia) LIKE UPPER(oc.descricao) || '%')
  `;

  const result = await pool.query(query, [cpf, inicio, fim]);
  return result.rows[0] || { total_ctrcs: 0, total_romaneios: 0, receita_total: 0 };
}

export async function getDriverRomaneios(cpf, inicio, fim) {
  const result = await pool.query(`
    SELECT
      r.id_romaneio,
      r.data_emissao,
      r.situacao,
      COUNT(c.ctrc) AS ctrcs_vinculados,
      COALESCE(SUM(pc.valor_entrega), 0)::numeric(10,2) AS valor_total,
      (SELECT json_build_object('status', sp.status, 'pix_enviado', sp.pix_enviado) FROM solicitacoes_pagamento sp
       WHERE sp.motorista_cpf = r.motorista_cpf AND sp.id_romaneio = r.id_romaneio
       LIMIT 1) AS solicitacao_info
    FROM ssw_romaneios r
    LEFT JOIN ssw_ctrcs c ON c.id_romaneio = r.id_romaneio
      AND EXISTS (SELECT 1 FROM ocorrencia_catalogo oc WHERE oc.finalizadora = true AND UPPER(c.ocorrencia) LIKE UPPER(oc.descricao) || '%')
    LEFT JOIN LATERAL (
      SELECT valor_entrega FROM tabela_preco_cidade pc
      WHERE LOWER(pc.cidade) = LOWER(TRIM(SPLIT_PART(c.cidade_entrega, '/', 1)))
         OR LOWER(pc.cidade) = LOWER(TRIM(c.cidade_entrega))
      ORDER BY (pc.unidade = COALESCE(c.unidade_receptora, '')) DESC, pc.unidade
      LIMIT 1
    ) pc ON true
    WHERE r.motorista_cpf = $1
      AND c.ocorrencia_data BETWEEN $2::date AND $3::date
    GROUP BY r.id_romaneio, r.data_emissao, r.situacao, r.motorista_cpf
    ORDER BY r.data_emissao DESC NULLS LAST
  `, [cpf, inicio, fim]);

  return result.rows;
}

export async function getDriverRomaneioDetalhes(cpf, idRomaneio, inicio, fim) {
  const result = await pool.query(`
    SELECT
      c.cidade_entrega,
      c.bairro,
      COUNT(*)::int AS quantidade,
      COALESCE(SUM(pc.valor_entrega), 0)::numeric(10,2) AS valor_total
    FROM ssw_ctrcs c
    LEFT JOIN LATERAL (
      SELECT valor_entrega FROM tabela_preco_cidade pc
      WHERE LOWER(pc.cidade) = LOWER(TRIM(SPLIT_PART(c.cidade_entrega, '/', 1)))
         OR LOWER(pc.cidade) = LOWER(TRIM(c.cidade_entrega))
      ORDER BY (pc.unidade = COALESCE(c.unidade_receptora, '')) DESC, pc.unidade
      LIMIT 1
    ) pc ON true
    WHERE c.id_romaneio = $1
      AND EXISTS (SELECT 1 FROM ssw_romaneios WHERE id_romaneio = c.id_romaneio AND motorista_cpf = $2)
      AND EXISTS (SELECT 1 FROM ocorrencia_catalogo oc WHERE oc.finalizadora = true AND UPPER(c.ocorrencia) LIKE UPPER(oc.descricao) || '%')
      AND c.ocorrencia_data BETWEEN $3::date AND $4::date
    GROUP BY c.cidade_entrega, c.bairro
    ORDER BY c.cidade_entrega, c.bairro
  `, [idRomaneio, cpf, inicio, fim]);

  return result.rows;
}

export async function getQuinzenasDisponiveis(cpf) {
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
    JOIN ssw_romaneios r ON r.id_romaneio = c.id_romaneio
    WHERE r.motorista_cpf = $1
      AND c.ocorrencia_data IS NOT NULL
    ORDER BY inicio DESC
  `, [cpf]);
  return result.rows;
}

export async function getProdutividade(cpf, inicio, fim) {
  const result = await pool.query(`
    SELECT
      c.ocorrencia_data AS data,
      COUNT(*) AS ctrcs,
      SUM(c.qtde_vol) AS volumes,
      SUM(c.peso_calculo) AS peso_total,
      COALESCE(SUM(pc.valor_entrega), 0)::numeric(10,2) AS valor_total
    FROM ssw_ctrcs c
    JOIN ssw_romaneios r ON r.id_romaneio = c.id_romaneio
    LEFT JOIN LATERAL (
      SELECT valor_entrega FROM tabela_preco_cidade pc
      WHERE LOWER(pc.cidade) = LOWER(TRIM(SPLIT_PART(c.cidade_entrega, '/', 1)))
         OR LOWER(pc.cidade) = LOWER(TRIM(c.cidade_entrega))
      ORDER BY (pc.unidade = COALESCE(c.unidade_receptora, '')) DESC, pc.unidade
      LIMIT 1
    ) pc ON true
    WHERE r.motorista_cpf = $1
      AND c.ocorrencia_data >= $2::date
      AND c.ocorrencia_data <= $3::date
      AND EXISTS (SELECT 1 FROM ocorrencia_catalogo oc WHERE oc.finalizadora = true AND UPPER(c.ocorrencia) LIKE UPPER(oc.descricao) || '%')
    GROUP BY c.ocorrencia_data
    ORDER BY c.ocorrencia_data
  `, [cpf, inicio, fim]);
  return result.rows;
}

export async function getEficiencia(cpf) {
  const result = await pool.query(`
    SELECT
      CASE
        WHEN EXISTS (SELECT 1 FROM ocorrencia_catalogo oc WHERE oc.finalizadora = true AND UPPER(c.ocorrencia) LIKE UPPER(oc.descricao) || '%') THEN 'entrega'
        ELSE 'insucesso'
      END AS evento,
      COUNT(*) AS quantidade
    FROM ssw_ctrcs c
    JOIN ssw_romaneios r ON r.id_romaneio = c.id_romaneio
    WHERE r.motorista_cpf = $1
      AND c.ocorrencia_data >= (CURRENT_DATE - INTERVAL '30 days')::date
    GROUP BY CASE
      WHEN EXISTS (SELECT 1 FROM ocorrencia_catalogo oc WHERE oc.finalizadora = true AND UPPER(c.ocorrencia) LIKE UPPER(oc.descricao) || '%') THEN 'entrega'
      ELSE 'insucesso'
    END
    ORDER BY quantidade DESC
  `, [cpf]);
  return result.rows;
}

export async function solicitarPagamento(cpf, idRomaneio) {
  const config = await getConfig();

  const { rows: romaneio } = await pool.query(`
    SELECT r.id_romaneio, r.motorista_cpf
    FROM ssw_romaneios r
    WHERE r.id_romaneio = $1 AND r.motorista_cpf = $2
  `, [idRomaneio, cpf]);

  if (romaneio.length === 0) {
    return { success: false, motivo: 'Romaneio não encontrado ou não pertence a este motorista' };
  }

  const { rows: solicitacaoExistente } = await pool.query(`
    SELECT status FROM solicitacoes_pagamento
    WHERE motorista_cpf = $1 AND id_romaneio = $2
  `, [cpf, idRomaneio]);

  if (solicitacaoExistente.length > 0) {
    const st = solicitacaoExistente[0].status;
    if (st === 'aprovado') {
      return { success: false, motivo: 'Este romaneio já teve o adiantamento aprovado' };
    }
    if (st === 'pendente') {
      return { success: false, motivo: 'Já existe uma solicitação pendente para este romaneio' };
    }
  }

  const { rows: entregas } = await pool.query(`
    SELECT COALESCE(SUM(pc.valor_entrega), 0)::numeric(10,2) AS valor_entregas
    FROM ssw_ctrcs c
    LEFT JOIN LATERAL (
      SELECT valor_entrega FROM tabela_preco_cidade pc
      WHERE LOWER(pc.cidade) = LOWER(TRIM(SPLIT_PART(c.cidade_entrega, '/', 1)))
         OR LOWER(pc.cidade) = LOWER(TRIM(c.cidade_entrega))
      ORDER BY (pc.unidade = COALESCE(c.unidade_receptora, '')) DESC, pc.unidade
      LIMIT 1
    ) pc ON true
    WHERE c.id_romaneio = $1
      AND EXISTS (SELECT 1 FROM ocorrencia_catalogo oc WHERE oc.finalizadora = true AND UPPER(c.ocorrencia) LIKE UPPER(oc.descricao) || '%')
  `, [idRomaneio]);

  const valorEntregas = Number(entregas[0]?.valor_entregas) || 0;
  if (valorEntregas <= 0) {
    return { success: false, motivo: 'Este romaneio não possui entregas realizadas para adiantamento' };
  }

  const valorLiquido = Math.round(valorEntregas * 50) / 100;

  const { rows: motoristaRow } = await pool.query(`
    SELECT cpf, nome, email, pre_aprovado FROM motoristas WHERE cpf = $1
  `, [cpf]);
  const motorista = motoristaRow[0];

  const { rows: taxaRow } = await pool.query(`
    SELECT taxa FROM taxas_adiantamento WHERE dias_ate_fechamento = $1
  `, [14]);
  const taxaAplicada = Number(taxaRow[0]?.taxa) || 0;

  const isPreAprovado = motorista?.pre_aprovado === true;

  if (isPreAprovado) {
    try {
      const { rows: [solicitacao] } = await pool.query(`
        INSERT INTO solicitacoes_pagamento (motorista_cpf, id_romaneio, valor_solicitado, valor_liquido, taxa_aplicada, status, pix_enviado, pix_enviado_em, aprovado_em)
        VALUES ($1, $2, $3, $4, $5, 'aprovado', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (motorista_cpf, id_romaneio) DO NOTHING
        RETURNING id
      `, [cpf, idRomaneio, valorLiquido, valorLiquido, taxaAplicada]);

      if (solicitacao) {
        try {
          await fetch('https://webhook.sactudo.com.br/webhook/Driver_Pix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cpf,
              nome: motorista?.nome || '',
              tipo: 'adiantamento',
              id_romaneio: idRomaneio,
              valor: valorLiquido,
              data: new Date().toISOString(),
            }),
          });
        } catch (err) {
          console.error('Webhook PIX adiantamento error:', err.message);
        }

        notificarAdiantamentoAutomatico(motorista, valorLiquido, idRomaneio).catch(() => {});
      }

      return { success: true, motivo: `Adiantamento aprovado automaticamente: R$ ${valorLiquido.toFixed(2)} (50% de R$ ${valorEntregas.toFixed(2)}). PIX enviado!`, auto_aprovado: true, valor_liquido: valorLiquido };
    } catch (err) {
      if (err.code === '23505') {
        return { success: false, motivo: 'Solicitação já existe para este romaneio' };
      }
      throw err;
    }
  }

  const { rows: eficienciaData } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM ocorrencia_catalogo oc WHERE oc.finalizadora = true AND UPPER(c.ocorrencia) LIKE UPPER(oc.descricao) || '%'
      )) AS entregas,
      COUNT(*) AS total
    FROM ssw_ctrcs c
    JOIN ssw_romaneios r ON r.id_romaneio = c.id_romaneio
    WHERE r.motorista_cpf = $1
      AND c.ocorrencia_data >= (CURRENT_DATE - INTERVAL '30 days')::date
  `, [cpf]);

  const ef = eficienciaData[0];
  const pctEf = ef.total > 0 ? Math.round((Number(ef.entregas) / Number(ef.total)) * 100) : 0;

  if (pctEf < Number(config.eficiencia_minima_adiantamento)) {
    return { success: false, motivo: `Eficiência abaixo de ${config.eficiencia_minima_adiantamento}% nos últimos 30 dias` };
  }

  try {
    await pool.query(`
      INSERT INTO solicitacoes_pagamento (motorista_cpf, id_romaneio, valor_solicitado, valor_liquido, taxa_aplicada, status)
      VALUES ($1, $2, $3, $4, $5, 'pendente')
    `, [cpf, idRomaneio, valorLiquido, valorLiquido, taxaAplicada]);
    return { success: true, motivo: `Solicitação registrada: R$ ${valorLiquido.toFixed(2)} (50% de R$ ${valorEntregas.toFixed(2)}). Aguardando aprovação do administrador.` };
  } catch (err) {
    if (err.code === '23505') {
      return { success: false, motivo: 'Solicitação já existe para este romaneio' };
    }
    throw err;
  }
}

export async function getDriverDados(cpf) {
  return getDriverData(cpf);
}

export async function atualizarDriverDados(cpf, dados) {
  const { cnpj_mei, telefone, pix_tipo } = dados;
  await pool.query(`
    UPDATE motoristas
    SET cnpj_mei = $1, telefone = $2, pix_tipo = $3
    WHERE cpf = $4
  `, [cnpj_mei || null, telefone || null, pix_tipo, cpf]);
  return { success: true };
}

export async function confirmarRegras(cpf) {
  await pool.query(`
    UPDATE motoristas SET leu_regras = true WHERE cpf = $1
  `, [cpf]);
  return { success: true };
}

export async function getAppUsage(cpf, inicio, fim) {
  const result = await pool.query(`
    SELECT
      v.origem_ocorrencia AS origem,
      COUNT(*)::int AS quantidade
    FROM ssw_455 v
    JOIN ssw_ctrcs c ON c.ctrc = v.ctrc_normalizado
    JOIN ssw_romaneios r ON r.id_romaneio = c.id_romaneio
    WHERE r.motorista_cpf = $1
      AND c.ocorrencia_data BETWEEN $2::date AND $3::date
      AND ${APP_USAGE_CODE_FILTER(4)}
    GROUP BY v.origem_ocorrencia
    ORDER BY v.origem_ocorrencia
  `, [cpf, inicio, fim, APP_USAGE_OCCURRENCE_CODES]);

  const rows = result.rows;
  const total = rows.reduce((s, r) => s + r.quantidade, 0);
  const app = rows.find(r => r.origem === 'APP')?.quantidade || 0;
  const base = rows.find(r => r.origem === 'BASE')?.quantidade || 0;

  return {
    origens: rows,
    total,
    total_app: app,
    total_base: base,
    pct_app: total > 0 ? Number(((app / total) * 100).toFixed(1)) : 0,
  };
}

export async function getBonusD0(cpf, inicio, fim) {
  const { rows: [{ bonus_d0: valorUnitario = 0 } = {}] } = await pool.query(`
    SELECT bonus_d0 FROM motoristas WHERE cpf = $1
  `, [cpf]);

  const result = await pool.query(`
    SELECT
      c.ocorrencia_data AS data,
      COUNT(*)::int AS entregas_d0,
      (COUNT(*) * $4::numeric)::numeric(10,2) AS valor_total
    FROM ssw_ctrcs c
    JOIN ssw_romaneios r ON r.id_romaneio = c.id_romaneio
    WHERE r.motorista_cpf = $1
      AND EXISTS (SELECT 1 FROM ocorrencia_catalogo oc WHERE oc.finalizadora = true AND UPPER(c.ocorrencia) LIKE UPPER(oc.descricao) || '%')
      AND c.ocorrencia_data = c.data_emissao
      AND c.ocorrencia_data >= $2::date
      AND c.ocorrencia_data <= $3::date
    GROUP BY c.ocorrencia_data
    ORDER BY c.ocorrencia_data
  `, [cpf, inicio, fim, valorUnitario]);

  const dias = result.rows;
  const totalEntregas = dias.reduce((s, d) => s + Number(d.entregas_d0), 0);
  const totalBonus = dias.reduce((s, d) => s + Number(d.valor_total), 0);

  return {
    dias,
    total_entregas: totalEntregas,
    total_bonus: totalBonus,
    valor_unitario: Number(valorUnitario),
  };
}

export async function getEficienciaTodos(inicio, fim, tipo, unidade) {
  const params = [];
  const conditions = [];

  const dataInicio = inicio || `(CURRENT_DATE - INTERVAL '30 days')::date`;
  const dataFim = fim || `CURRENT_DATE::date`;

  if (inicio) { params.push(inicio); }
  if (fim) { params.push(fim); }
  if (tipo) { params.push(tipo); conditions.push(`m.tipo = $${params.length}`); }
  if (unidade) { params.push(unidade); conditions.push(`c.unidade_receptora = $${params.length}`); }

  const whereTipo = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  const dateFilter = (col) => {
    if (inicio && fim) return `${col} >= $1 AND ${col} <= $2`;
    if (inicio) return `${col} >= $1`;
    if (fim) return `${col} <= $1`;
    return `${col} >= (CURRENT_DATE - INTERVAL '30 days')::date`;
  };

  const result = await pool.query(`
    SELECT
      r.motorista_cpf AS cpf,
      r.motorista_nome AS nome,
      m.tipo,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM ocorrencia_catalogo oc WHERE oc.finalizadora = true AND UPPER(c.ocorrencia) LIKE UPPER(oc.descricao) || '%'
      ))::int AS entregas,
      COUNT(*)::int AS total,
      ROUND(COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM ocorrencia_catalogo oc WHERE oc.finalizadora = true AND UPPER(c.ocorrencia) LIKE UPPER(oc.descricao) || '%'
      )) * 100.0 / NULLIF(COUNT(*), 0), 2)::numeric(5,2) AS pct_eficiencia
    FROM ssw_ctrcs c
    JOIN ssw_romaneios r ON r.id_romaneio = c.id_romaneio
    JOIN motoristas m ON m.cpf = r.motorista_cpf
    WHERE ${dateFilter('c.ocorrencia_data')} ${whereTipo}
    GROUP BY r.motorista_cpf, r.motorista_nome, m.tipo
    ORDER BY pct_eficiencia DESC
  `, params);
  return result.rows;
}

export async function getAppUsageTodos(inicio, fim, tipo, unidade) {
  const params = [];
  const conditions = [];

  if (inicio) { params.push(inicio); }
  if (fim) { params.push(fim); }
  if (tipo) { params.push(tipo); conditions.push(`m.tipo = $${params.length}`); }
  if (unidade) { params.push(unidade); conditions.push(`v.unidade_receptora = $${params.length}`); }

  const occurrenceCodesParam = params.length + 1;
  params.push(APP_USAGE_OCCURRENCE_CODES);
  const occurrenceCodeFilter = APP_USAGE_CODE_FILTER(occurrenceCodesParam);
  const whereTipo = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  const dateFilter = (col) => {
    if (inicio && fim) return `${col} >= $1 AND ${col} <= $2`;
    if (inicio) return `${col} >= $1`;
    if (fim) return `${col} <= $1`;
    return `${col} >= (CURRENT_DATE - INTERVAL '30 days')::date`;
  };

  const result = await pool.query(`
    SELECT
      r.motorista_cpf AS cpf,
      r.motorista_nome AS nome,
      m.tipo,
      COUNT(*) FILTER (WHERE v.origem_ocorrencia = 'APP')::int AS app,
      COUNT(*) FILTER (WHERE v.origem_ocorrencia = 'BASE')::int AS base,
      COUNT(*) FILTER (WHERE v.origem_ocorrencia = 'SSW')::int AS ssw,
      COUNT(*)::int AS total,
      ROUND(COUNT(*) FILTER (WHERE v.origem_ocorrencia = 'APP') * 100.0 / NULLIF(COUNT(*), 0), 1)::numeric(5,1) AS pct_app
    FROM ssw_455 v
    JOIN ssw_ctrcs c ON c.ctrc = v.ctrc_normalizado
    JOIN ssw_romaneios r ON r.id_romaneio = c.id_romaneio
    JOIN motoristas m ON m.cpf = r.motorista_cpf
    WHERE ${dateFilter('c.ocorrencia_data')} ${whereTipo}
      AND ${occurrenceCodeFilter}
    GROUP BY r.motorista_cpf, r.motorista_nome, m.tipo
    ORDER BY pct_app DESC
  `, params);
  return result.rows;
}

export async function getAppUsageAjudantes(inicio, fim, tipo, unidade) {
  const params = [];
  const conditions = [];
  if (inicio) { params.push(inicio); }
  if (fim) { params.push(fim); }
  if (tipo) { params.push(tipo); conditions.push(`a.tipo = $${params.length}`); }
  if (unidade) { params.push(unidade); conditions.push(`v.unidade_receptora = $${params.length}`); }

  const occurrenceCodesParam = params.length + 1;
  params.push(APP_USAGE_OCCURRENCE_CODES);
  const occurrenceCodeFilter = APP_USAGE_CODE_FILTER(occurrenceCodesParam);
  const whereTipo = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  const dateFilter = (col) => {
    if (inicio && fim) return `${col} >= $1 AND ${col} <= $2`;
    if (inicio) return `${col} >= $1`;
    if (fim) return `${col} <= $1`;
    return `${col} >= (CURRENT_DATE - INTERVAL '30 days')::date`;
  };

  const result = await pool.query(`
    SELECT
      r.ajudante_codigo AS codigo,
      a.nome,
      a.tipo,
      COUNT(*) FILTER (WHERE v.origem_ocorrencia = 'APP')::int AS app,
      COUNT(*) FILTER (WHERE v.origem_ocorrencia = 'BASE')::int AS base,
      COUNT(*) FILTER (WHERE v.origem_ocorrencia = 'SSW')::int AS ssw,
      COUNT(*)::int AS total,
      ROUND(COUNT(*) FILTER (WHERE v.origem_ocorrencia = 'APP') * 100.0 / NULLIF(COUNT(*), 0), 1)::numeric(5,1) AS pct_app
    FROM ssw_455 v
    JOIN ssw_ctrcs c ON c.ctrc = v.ctrc_normalizado
    JOIN ssw_romaneios r ON r.id_romaneio = c.id_romaneio
    JOIN ajudantes a ON a.codigo = r.ajudante_codigo
    WHERE ${dateFilter('c.ocorrencia_data')} ${whereTipo}
      AND ${occurrenceCodeFilter}
    GROUP BY r.ajudante_codigo, a.nome, a.tipo
    ORDER BY pct_app DESC
  `, params);
  return result.rows;
}

export async function getEscoamento(inicio, fim, unidade) {
  const params = [];
  const conditions = [];
  if (inicio) { params.push(inicio); conditions.push(`v.data_ultima_ocorrencia >= $${params.length}::date`); }
  if (fim) { params.push(fim); conditions.push(`v.data_ultima_ocorrencia <= $${params.length}::date`); }
  if (unidade) { params.push(unidade); conditions.push(`v.unidade_receptora = $${params.length}`); }
  const where = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

  const result = await pool.query(`
    SELECT
      COALESCE(p.nome_simplificado, v.cliente_pagador) AS cliente,
      to_char(v.data_ultima_ocorrencia, 'YYYY-MM-DD') AS dia,
      COUNT(*) FILTER (WHERE v.data_ultima_ocorrencia < v.previsao_entrega)::int AS antecipada,
      COUNT(*) FILTER (WHERE v.data_ultima_ocorrencia = v.previsao_entrega)::int AS no_dia,
      COUNT(*) FILTER (WHERE v.data_ultima_ocorrencia > v.previsao_entrega)::int AS vencida,
      COUNT(*)::int AS total
    FROM ssw_455 v
    JOIN pagadores p ON p.cnpj = v.cnpj_pagador
    WHERE v.codigo_ocorrencia = '01'
      AND v.previsao_entrega IS NOT NULL
      AND v.data_ultima_ocorrencia IS NOT NULL
      AND p.ativo = true
      ${where}
    GROUP BY cliente, dia
    ORDER BY cliente, dia
  `, params);
  return result.rows;
}
