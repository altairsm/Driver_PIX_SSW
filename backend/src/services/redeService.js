import { pool } from '../db/index.js';

export async function getRede(inicio, fim, unidade) {
  const uc = unidade ? `AND v.unidade_receptora = $3` : '';
  const p = unidade ? [inicio, fim, unidade] : [inicio, fim];

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
      JOIN pagadores pag ON pag.cnpj = v.cnpj_pagador
      WHERE v.data_ultima_ocorrencia BETWEEN $1::date AND $2::date
        ${uc}
    ),
    uni_nodes AS (
      SELECT b.unidade_receptora AS id, un.nome AS label,
        COUNT(*)::int AS ctrcs,
        COALESCE(SUM(b.valor_frete),0)::numeric(12,2) AS valor_frete,
        COALESCE(SUM(b.peso_real),0)::numeric(12,3) AS peso,
        COALESCE(SUM(b.volumes),0)::int AS volumes
      FROM base b
      LEFT JOIN unidades un ON un.sigla = b.unidade_receptora
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
  `, p);

  return row;
}
