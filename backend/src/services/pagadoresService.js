import { pool } from '../db/index.js';

export async function listarPagadores() {
  const result = await pool.query(`
    SELECT p.*
    FROM pagadores p
    ORDER BY p.razao_social
  `);
  return result.rows;
}

export async function criarPagador(dados) {
  const { cnpj, razao_social, nome_simplificado } = dados;
  const cnpjLimpo = (cnpj || '').replace(/\D/g, '');
  const result = await pool.query(`
    INSERT INTO pagadores (cnpj, razao_social, nome_simplificado)
    VALUES ($1, $2, $3)
    RETURNING *
  `, [cnpjLimpo, razao_social, nome_simplificado || razao_social]);
  return result.rows[0];
}

export async function atualizarPagador(id, dados) {
  const { cnpj, razao_social, nome_simplificado, ativo } = dados;
  const cnpjLimpo = (cnpj || '').replace(/\D/g, '');
  const result = await pool.query(`
    UPDATE pagadores
    SET cnpj = $1, razao_social = $2, nome_simplificado = $3, ativo = $4, atualizado_em = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *
  `, [cnpjLimpo, razao_social, nome_simplificado || razao_social, ativo !== false, id]);
  return result.rowCount > 0 ? result.rows[0] : null;
}

export async function deletarPagador(id) {
  const result = await pool.query('DELETE FROM pagadores WHERE id = $1', [id]);
  return result.rowCount > 0;
}

export async function resumoPagador(cnpj, inicio, fim) {
  const cnpjLimpo = (cnpj || '').replace(/\D/g, '');

  const { rows: [info] } = await pool.query(`
    SELECT razao_social, nome_simplificado FROM pagadores WHERE cnpj = $1
  `, [cnpjLimpo]);

  const query = `
    SELECT
      COUNT(*) AS total_entregas,
      COALESCE(SUM(valor_frete), 0)::numeric(10,2) AS frete_total,
      COALESCE(SUM(peso_real), 0)::numeric(10,3) AS peso_total,
      COALESCE(SUM(volumes), 0)::int AS volumes_total,
      COALESCE(AVG(valor_frete), 0)::numeric(10,2) AS frete_medio,
      COUNT(DISTINCT unidade_receptora)::int AS unidades_envolvidas
    FROM ssw_455
    WHERE cnpj_pagador = $1
      AND ($2::date IS NULL OR data_emissao >= $2::date)
      AND ($3::date IS NULL OR data_emissao <= $3::date)
  `;

  const { rows: [resumo] } = await pool.query(query, [cnpjLimpo, inicio || null, fim || null]);

  const { rows: porUnidade } = await pool.query(`
    SELECT
      unidade_receptora,
      COUNT(*) AS total_entregas,
      COALESCE(SUM(valor_frete), 0)::numeric(10,2) AS frete_total,
      COALESCE(SUM(peso_real), 0)::numeric(10,3) AS peso_total
    FROM ssw_455
    WHERE cnpj_pagador = $1
      AND ($2::date IS NULL OR data_emissao >= $2::date)
      AND ($3::date IS NULL OR data_emissao <= $3::date)
    GROUP BY unidade_receptora
    ORDER BY frete_total DESC
  `, [cnpjLimpo, inicio || null, fim || null]);

  const { rows: porCidade } = await pool.query(`
    SELECT
      cidade_entrega,
      uf_entrega,
      COUNT(*) AS total_entregas,
      COALESCE(SUM(valor_frete), 0)::numeric(10,2) AS frete_total
    FROM ssw_455
    WHERE cnpj_pagador = $1
      AND ($2::date IS NULL OR data_emissao >= $2::date)
      AND ($3::date IS NULL OR data_emissao <= $3::date)
    GROUP BY cidade_entrega, uf_entrega
    ORDER BY frete_total DESC
    LIMIT 20
  `, [cnpjLimpo, inicio || null, fim || null]);

  return {
    pagador: info,
    resumo: resumo || {},
    por_unidade: porUnidade,
    por_cidade: porCidade,
  };
}
