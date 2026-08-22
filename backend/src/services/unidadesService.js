import { pool } from '../db/index.js';

export async function listarUnidades() {
  const result = await pool.query('SELECT * FROM unidades ORDER BY sigla');
  return result.rows;
}

export async function listarUnidadesAtivas() {
  const result = await pool.query('SELECT * FROM unidades WHERE ativo = true ORDER BY sigla');
  return result.rows;
}

export async function criarUnidade(dados) {
  const { nome, sigla } = dados;
  const result = await pool.query(`
    INSERT INTO unidades (nome, sigla) VALUES ($1, $2) RETURNING *
  `, [nome, (sigla || '').toUpperCase()]);
  return result.rows[0];
}

export async function atualizarUnidade(id, dados) {
  const { nome, sigla, ativo } = dados;
  const result = await pool.query(`
    UPDATE unidades SET nome = $1, sigla = $2, ativo = $3, atualizado_em = CURRENT_TIMESTAMP
    WHERE id = $4 RETURNING *
  `, [nome, (sigla || '').toUpperCase(), ativo !== false, id]);
  return result.rowCount > 0 ? result.rows[0] : null;
}

export async function deletarUnidade(id) {
  const result = await pool.query('DELETE FROM unidades WHERE id = $1', [id]);
  return result.rowCount > 0;
}
