import { pool } from '../db/index.js';

const NOT_FINALIZADA = `
  AND NOT EXISTS (
    SELECT 1 FROM ocorrencia_catalogo oc
    WHERE oc.finalizadora = true
      AND (oc.codigo = v.codigo_ocorrencia
           OR (v.codigo_ocorrencia IS NULL AND UPPER(v.ocorrencia) LIKE UPPER(oc.descricao) || '%'))
  )
`;

export async function getRede(inicio, fim, unidade, cliente) {
  const conditions = ['v.data_ultima_ocorrencia BETWEEN $1::date AND $2::date'];
  const params = [inicio, fim];

  if (unidade) {
    params.push(unidade);
    conditions.push(`v.unidade_receptora = $${params.length}`);
  }
  if (cliente) {
    params.push(cliente);
    conditions.push(`COALESCE(pag.nome_simplificado, v.cliente_pagador) = $${params.length}`);
  }

  const filtroBase = conditions.join('\n  AND ') + NOT_FINALIZADA;

  const { rows: [row] } = await pool.query(`
    WITH base AS (
      SELECT
        v.unidade_receptora,
        COALESCE(pag.nome_simplificado, v.cliente_pagador) AS cliente,
        COALESCE(NULLIF(TRIM(v.setor_destino), ''), 'Sem setor') AS setor,
        COALESCE(v.valor_frete, 0) AS valor_frete,
        COALESCE(v.peso_real, 0) AS peso_real,
        COALESCE(v.volumes, 0) AS volumes
      FROM ssw_455 v
      JOIN pagadores pag ON pag.cnpj = v.cnpj_pagador AND pag.ativo = true
      WHERE ${filtroBase}
    ),
    uni_nodes AS (
      SELECT b.unidade_receptora AS id, un.nome AS label,
        COUNT(*)::int AS ctrcs,
        COALESCE(SUM(b.valor_frete),0)::numeric(12,2) AS valor_frete,
        COALESCE(SUM(b.peso_real),0)::numeric(12,3) AS peso,
        COALESCE(SUM(b.volumes),0)::int AS volumes
      FROM base b
      JOIN unidades un ON un.sigla = b.unidade_receptora AND un.ativo = true
      GROUP BY b.unidade_receptora, un.nome
    ),
    cli_nodes AS (
      SELECT b.cliente AS id, b.cliente AS label,
        COUNT(*)::int AS ctrcs,
        COALESCE(SUM(b.valor_frete),0)::numeric(12,2) AS valor_frete,
        COALESCE(SUM(b.peso_real),0)::numeric(12,3) AS peso,
        COALESCE(SUM(b.volumes),0)::int AS volumes
      FROM base b
      GROUP BY b.cliente
    ),
    set_nodes AS (
      SELECT b.setor AS id, b.setor AS label,
        COUNT(*)::int AS ctrcs,
        COALESCE(SUM(b.valor_frete),0)::numeric(12,2) AS valor_frete,
        COALESCE(SUM(b.peso_real),0)::numeric(12,3) AS peso,
        COALESCE(SUM(b.volumes),0)::int AS volumes
      FROM base b
      GROUP BY b.setor
    ),
    e_uc AS (
      SELECT b.unidade_receptora AS source, b.cliente AS target,
        COUNT(*)::int AS ctrcs,
        COALESCE(SUM(b.valor_frete),0)::numeric(12,2) AS valor_frete
      FROM base b
      GROUP BY b.unidade_receptora, b.cliente
    ),
    e_cs AS (
      SELECT b.cliente AS source, b.setor AS target,
        COUNT(*)::int AS ctrcs,
        COALESCE(SUM(b.valor_frete),0)::numeric(12,2) AS valor_frete
      FROM base b
      GROUP BY b.cliente, b.setor
    ),
    e_us AS (
      SELECT b.unidade_receptora AS source, b.setor AS target,
        COUNT(*)::int AS ctrcs,
        COALESCE(SUM(b.valor_frete),0)::numeric(12,2) AS valor_frete
      FROM base b
      GROUP BY b.unidade_receptora, b.setor
    )
    SELECT
      (SELECT COALESCE(json_agg(t), '[]'::json) FROM uni_nodes t) AS unidades,
      (SELECT COALESCE(json_agg(t), '[]'::json) FROM cli_nodes t) AS clientes,
      (SELECT COALESCE(json_agg(t), '[]'::json) FROM set_nodes t) AS setores,
      (SELECT COALESCE(json_agg(t), '[]'::json) FROM e_uc t) AS uc,
      (SELECT COALESCE(json_agg(t), '[]'::json) FROM e_cs t) AS cs,
      (SELECT COALESCE(json_agg(t), '[]'::json) FROM e_us t) AS us
  `, params);

  return row;
}

export async function getRedePeriodo() {
  const { rows: [row] } = await pool.query(`
    SELECT MAX(v.data_ultima_ocorrencia)::date AS fim
    FROM ssw_455 v
    WHERE NOT EXISTS (
      SELECT 1 FROM ocorrencia_catalogo oc
      WHERE oc.finalizadora = true
        AND (oc.codigo = v.codigo_ocorrencia
             OR (v.codigo_ocorrencia IS NULL AND UPPER(v.ocorrencia) LIKE UPPER(oc.descricao) || '%'))
    )
  `);
  return row && row.fim ? { fim: row.fim, inicio: null } : { fim: null, inicio: null };
}
