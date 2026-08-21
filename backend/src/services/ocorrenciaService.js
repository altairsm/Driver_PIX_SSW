import { pool } from '../db/index.js';

export async function listarOcorrencias() {
  const result = await pool.query(`
    SELECT o.*,
      (SELECT COUNT(*)::int FROM ssw_ctrcs c WHERE UPPER(c.ocorrencia) LIKE UPPER(o.descricao) || '%') AS usos_ctrcs,
      (SELECT COUNT(*)::int FROM ssw_455 v WHERE UPPER(v.ocorrencia) LIKE UPPER(o.descricao) || '%') AS usos_455
    FROM ocorrencia_catalogo o
    ORDER BY o.finalizadora DESC, o.descricao
  `);
  return result.rows;
}

export async function criarOcorrencia(dados) {
  const { codigo, descricao, finalizadora } = dados;
  if (!descricao) throw new Error('Descricao obrigatoria');
  const result = await pool.query(`
    INSERT INTO ocorrencia_catalogo (codigo, descricao, finalizadora)
    VALUES ($1, $2, $3)
    RETURNING *
  `, [codigo || null, descricao.trim().toUpperCase(), finalizadora === true]);
  return result.rows[0];
}

export async function atualizarOcorrencia(id, dados) {
  const { codigo, descricao, finalizadora } = dados;
  const result = await pool.query(`
    UPDATE ocorrencia_catalogo
    SET codigo = $1, descricao = $2, finalizadora = $3
    WHERE id = $4
    RETURNING *
  `, [codigo || null, (descricao || '').trim().toUpperCase(), finalizadora === true, id]);
  return result.rowCount > 0 ? result.rows[0] : null;
}

export async function deletarOcorrencia(id) {
  const result = await pool.query('DELETE FROM ocorrencia_catalogo WHERE id = $1', [id]);
  return result.rowCount > 0;
}

export async function getOcorrenciasFinalizadoras() {
  const result = await pool.query(
    `SELECT descricao FROM ocorrencia_catalogo WHERE finalizadora = true`
  );
  return result.rows.map(r => r.descricao);
}
