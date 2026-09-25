import { pool } from '../db/index.js';

const RELACIONAMENTO_CELULAR_LOCK = 8675309;

export async function bloquearRelacoesCelulares(client) {
  await client.query('SELECT pg_advisory_xact_lock($1)', [RELACIONAMENTO_CELULAR_LOCK]);
}

function criarErro(message, status, code, extra = {}) {
  return Object.assign(new Error(message), { status, code, ...extra });
}

function parsePositiveInteger(valor) {
  if (typeof valor === 'number') {
    return Number.isSafeInteger(valor) && valor > 0 ? valor : null;
  }
  const raw = String(valor ?? '').trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizarNumeroCelular(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

function validarNumero(numero) {
  if (!numero) {
    throw criarErro('O número do celular é obrigatório', 400);
  }
  if (numero.length < 10 || numero.length > 20) {
    throw criarErro('Informe um número de celular válido', 400);
  }
}

function validarNome(nome) {
  const valor = String(nome || '').trim();
  if (!valor) {
    throw criarErro('O nome do celular é obrigatório', 400);
  }
  if (valor.length > 200) {
    throw criarErro('O nome do celular deve ter no máximo 200 caracteres', 400);
  }
  return valor;
}

function traduzirDuplicado(err, numero) {
  if (err.code === '23505') {
    return criarErro('Já existe um celular cadastrado com este número', 409, 'CELULAR_DUPLICADO', { numero });
  }
  return err;
}

export async function listarCelulares() {
  const result = await pool.query(`
    SELECT
      c.id,
      c.numero,
      c.nome,
      c.criado_em,
      c.atualizado_em,
      m.cpf AS motorista_cpf,
      m.nome AS motorista_nome
    FROM celulares c
    LEFT JOIN motoristas m ON m.celular_id = c.id
    ORDER BY c.atualizado_em DESC, c.id DESC
  `);
  return result.rows;
}

export async function criarCelular(dados) {
  const numero = normalizarNumeroCelular(dados?.numero);
  const nome = validarNome(dados?.nome);
  validarNumero(numero);

  try {
    const result = await pool.query(`
      INSERT INTO celulares (numero, nome)
      VALUES ($1, $2)
      RETURNING id, numero, nome, criado_em, atualizado_em
    `, [numero, nome]);
    return result.rows[0];
  } catch (err) {
    throw traduzirDuplicado(err, numero);
  }
}

export async function obterOuCriarCelularPorNumero(client, valor) {
  const raw = String(valor ?? '').trim();
  if (!raw) return null;
  const numero = normalizarNumeroCelular(raw);
  validarNumero(numero);

  const result = await client.query(`
    INSERT INTO celulares (numero, nome)
    VALUES ($1, $2)
    ON CONFLICT (numero) DO UPDATE SET numero = EXCLUDED.numero
    RETURNING id, numero, nome
  `, [numero, `Celular ${numero}`]);

  return result.rows[0];
}

export async function aplicarCelularAoMotorista(client, cpf, celularId, opcoes = {}) {
  const { forcarTransferencia = false, provided = true } = opcoes;
  if (!provided) return { changed: false };

  const semCelular = celularId === null || celularId === undefined || celularId === '';
  const id = semCelular ? null : parsePositiveInteger(celularId);

  if (!semCelular && id === null) {
    throw criarErro('Celular inválido', 400);
  }

  await bloquearRelacoesCelulares(client);

  const driverResult = await client.query(`
    SELECT cpf, celular_id, telefone, celular_atualizado_em
    FROM motoristas
    WHERE cpf = $1
    FOR UPDATE
  `, [cpf]);

  if (driverResult.rowCount === 0) {
    throw criarErro('Motorista não encontrado', 404);
  }

  const driver = driverResult.rows[0];
  const numeroAtual = normalizarNumeroCelular(driver.telefone);

  if (id === null) {
    if (driver.celular_id === null && !numeroAtual) return { changed: false };
    await client.query(`
      UPDATE motoristas
      SET celular_id = NULL,
          telefone = NULL,
          celular_atualizado_em = CURRENT_TIMESTAMP
      WHERE cpf = $1
    `, [cpf]);
    return { changed: true };
  }

  const celularResult = await client.query(`
    SELECT id, numero, nome
    FROM celulares
    WHERE id = $1
    FOR UPDATE
  `, [id]);

  if (celularResult.rowCount === 0) {
    throw criarErro('Celular não encontrado', 404);
  }

  const celular = celularResult.rows[0];
  const ownersResult = await client.query(`
    SELECT cpf, nome, celular_id, telefone
    FROM motoristas
    WHERE cpf <> $1
      AND (
        celular_id = $2
        OR (
          celular_id IS NULL
          AND regexp_replace(COALESCE(telefone, ''), '[^0-9]', '', 'g') = $3
        )
      )
    FOR UPDATE
  `, [cpf, id, celular.numero]);

  if (ownersResult.rowCount > 0) {
    if (!forcarTransferencia) {
      const owner = ownersResult.rows[0];
      throw criarErro('Este celular já está vinculado a outro motorista', 409, 'CELULAR_EM_USO', {
        conflict: {
          cpf: owner.cpf,
          nome: owner.nome,
          numero: celular.numero,
          celular_nome: celular.nome,
          owners: ownersResult.rows.map((item) => ({ cpf: item.cpf, nome: item.nome })),
        },
      });
    }

    for (const owner of ownersResult.rows) {
      await client.query(`
        UPDATE motoristas
        SET celular_id = NULL,
            telefone = NULL,
            celular_atualizado_em = CURRENT_TIMESTAMP
        WHERE cpf = $1
      `, [owner.cpf]);
    }
  }

  const numeroMudou = numeroAtual !== celular.numero;
  const vinculoMudou = driver.celular_id !== id;
  if (!numeroMudou && !vinculoMudou) return { changed: false };

  await client.query(`
    UPDATE motoristas
    SET celular_id = $1,
        telefone = $2,
        celular_atualizado_em = CASE
          WHEN $3::boolean THEN CURRENT_TIMESTAMP
          ELSE celular_atualizado_em
        END
    WHERE cpf = $4
  `, [id, celular.numero, numeroMudou || vinculoMudou, cpf]);

  return { changed: true };
}

export async function atualizarCelular(id, dados) {
  const celularId = parsePositiveInteger(id);
  if (celularId === null) {
    throw criarErro('Celular inválido', 400);
  }

  const numero = normalizarNumeroCelular(dados?.numero);
  const nome = validarNome(dados?.nome);
  validarNumero(numero);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await bloquearRelacoesCelulares(client);

    const currentResult = await client.query(`
      SELECT id, numero
      FROM celulares
      WHERE id = $1
      FOR UPDATE
    `, [celularId]);

    if (currentResult.rowCount === 0) {
      throw criarErro('Celular não encontrado', 404);
    }

    const current = currentResult.rows[0];
    if (numero !== current.numero) {
      const duplicate = await client.query(`
        SELECT id FROM celulares WHERE numero = $1 AND id <> $2
      `, [numero, celularId]);
      if (duplicate.rowCount > 0) {
        throw criarErro('Já existe um celular cadastrado com este número', 409, 'CELULAR_DUPLICADO', { numero });
      }
    }

    const result = await client.query(`
      UPDATE celulares
      SET numero = $1,
          nome = $2,
          atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, numero, nome, criado_em, atualizado_em
    `, [numero, nome, celularId]);

    if (numero !== current.numero) {
      await client.query(`
        UPDATE motoristas
        SET telefone = $1,
            celular_atualizado_em = CURRENT_TIMESTAMP
        WHERE celular_id = $2
      `, [numero, celularId]);
    }

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw traduzirDuplicado(err, numero);
  } finally {
    client.release();
  }
}

export async function deletarCelular(id) {
  const celularId = parsePositiveInteger(id);
  if (celularId === null) {
    throw criarErro('Celular inválido', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await bloquearRelacoesCelulares(client);
    const result = await client.query(`
      SELECT id FROM celulares WHERE id = $1 FOR UPDATE
    `, [celularId]);
    if (result.rowCount === 0) {
      throw criarErro('Celular não encontrado', 404);
    }

    const owner = await client.query(`
      SELECT cpf, nome FROM motoristas WHERE celular_id = $1 LIMIT 1
    `, [celularId]);
    if (owner.rowCount > 0) {
      throw criarErro('O celular está vinculado a um motorista e não pode ser excluído', 409, 'CELULAR_EM_USO', {
        conflict: { cpf: owner.rows[0].cpf, nome: owner.rows[0].nome },
      });
    }

    await client.query('DELETE FROM celulares WHERE id = $1', [celularId]);
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
