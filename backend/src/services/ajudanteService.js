import { pool } from '../db/index.js';

export async function listarAjudantes(unidade = null) {
  const params = [];
  let where = '';
  if (unidade) {
    params.push(unidade);
    where = 'WHERE unidade = $1';
  }
  const result = await pool.query(`
    SELECT codigo, nome, observacao, celular, unidade, tipo
    FROM ajudantes
    ${where}
    ORDER BY nome
  `, params);
  return result.rows;
}

export async function criarAjudante(dados) {
  const { codigo, nome, observacao, celular, unidade, tipo } = dados;
  const cod = (codigo || '').trim();
  if (!cod || !nome) {
    const err = new Error('Código e Nome são obrigatórios');
    err.status = 400;
    throw err;
  }
  await pool.query(`
    INSERT INTO ajudantes (codigo, nome, observacao, celular, unidade, tipo)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (codigo) DO UPDATE SET
      nome = EXCLUDED.nome,
      observacao = EXCLUDED.observacao,
      celular = EXCLUDED.celular,
      unidade = EXCLUDED.unidade,
      tipo = EXCLUDED.tipo
  `, [cod, nome, observacao || null, celular || null, unidade || null, tipo || 'funcionario']);
  return { codigo: cod, nome, observacao, celular, unidade, tipo: tipo || 'funcionario' };
}

export async function atualizarAjudante(codigo, dados) {
  const { nome, observacao, celular, unidade, tipo } = dados;
  const result = await pool.query(`
    UPDATE ajudantes
    SET nome = $1, observacao = $2, celular = $3, unidade = $4, tipo = $5
    WHERE codigo = $6
  `, [nome, observacao || null, celular || null, unidade || null, tipo || 'funcionario', codigo]);
  return result.rowCount > 0;
}

export async function deletarAjudante(codigo) {
  await pool.query('DELETE FROM ssw_romaneio_ajudantes WHERE ajudante_codigo = $1', [codigo]);
  const result = await pool.query('DELETE FROM ajudantes WHERE codigo = $1', [codigo]);
  return result.rowCount > 0;
}
