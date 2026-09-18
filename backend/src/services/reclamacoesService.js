import { pool } from '../db/index.js';
import XLSX from 'xlsx';

const ASSUNTOS_FILTRO = ['acareacao', 'comprovante de entrega'];

function normalizarAssunto(a) {
  return String(a || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function limparCte(v) {
  const s = String(v || '').trim();
  if (!s || s === '-' || s === 'CTE -' || s === 'CTE-') return null;
  return s;
}

export async function uploadReclamacoes(fileBuffer, fileName) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', raw: true });
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  const resultado = {
    total_lidas: rows.length,
    filtradas: 0,
    importadas: 0,
    atualizadas: 0,
    com_motorista: 0,
    cte_pendente: 0,
    cte_nao_encontrado: 0,
    erros: [],
  };

  const matriculasAfetadas = new Set();
  const ctesNaoEncontrados = [];

  for (const row of rows) {
    const assuntoRaw = String(row['ASSUNTO'] || row['Assunto'] || '').trim();
    const assuntoNorm = normalizarAssunto(assuntoRaw);

    if (!ASSUNTOS_FILTRO.includes(assuntoNorm)) continue;
    resultado.filtradas++;

    const ticketId = String(row['TICKET ID'] || row['Ticket ID'] || row['ticket_id'] || '').trim();
    const dataCriacao = String(row['DATA CRIAÇÃO DO TICKET'] || row['Data Criação'] || row['data_criacao'] || '').trim();
    const statusOrig = String(row['STATUS'] || row['Status'] || row['status'] || '').trim();
    const cteRaw = String(row['CTE'] || row['Cte'] || row['cte'] || '').trim();

    const cte = limparCte(cteRaw);
    const dataParsed = parseDataBr(dataCriacao);

    try {
      let matricula = null;

      if (cte) {
        const match = await pool.query(`
          SELECT "OperadorMatricula"::bigint AS matricula
          FROM relatorioentrega_export
          WHERE "NCTE" = $1
            AND LOWER("Evento") = 'entrega'
          LIMIT 1
        `, [cte]);

        if (match.rows.length > 0) {
          matricula = match.rows[0].matricula;
          if (matricula) matriculasAfetadas.add(matricula);
        }
      }

      if (ticketId) {
        const upd = await pool.query(`
          UPDATE acareacaojad
          SET status_original = $2,
              importado_em = CURRENT_TIMESTAMP
          WHERE ticket_id = $1
        `, [ticketId, statusOrig]);
        if (upd.rowCount > 0) {
          resultado.atualizadas++;
          continue;
        }
      }

      await pool.query(`
        INSERT INTO acareacaojad (ticket_id, "OperadorMatricula", "NCTE", assunto, motivo, status_original, data_criacao)
        VALUES ($1, $2, $3, $4, $5, $6, $7::date)
        ON CONFLICT (ticket_id) DO NOTHING
      `, [
        ticketId || null,
        matricula,
        cte,
        assuntoRaw,
        `Ticket ${ticketId} - ${assuntoRaw}`,
        statusOrig,
        dataParsed,
      ]);

      resultado.importadas++;

      if (cte && matricula) {
        resultado.com_motorista++;
      } else if (!cte) {
        resultado.cte_pendente++;
      } else {
        resultado.cte_nao_encontrado++;
        if (cte) ctesNaoEncontrados.push(cte);
      }
    } catch (err) {
      resultado.erros.push(`Ticket ${ticketId}: ${err.message}`);
    }
  }

  // Resolver matrículas pendentes antes de notificar
  if (ctesNaoEncontrados.length > 0) {
    await atualizarMatriculasPendentes();
    const { rows } = await pool.query(`
      SELECT DISTINCT "OperadorMatricula"::bigint AS matricula
      FROM acareacaojad
      WHERE "NCTE" = ANY($1::text[])
        AND "OperadorMatricula" IS NOT NULL
        AND "OperadorMatricula" != 0
    `, [ctesNaoEncontrados]);
    rows.forEach(r => { if (r.matricula) matriculasAfetadas.add(r.matricula); });
  }

  return resultado;
}

function parseDataBr(str) {
  if (!str) return new Date().toISOString().split('T')[0];
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return str.slice(0, 10);
}

export async function atualizarMatriculasPendentes() {
  const result = await pool.query(`
    UPDATE acareacaojad a
    SET "OperadorMatricula" = (
      SELECT r."OperadorMatricula"::bigint
      FROM relatorioentrega_export r
      WHERE r."NCTE" = a."NCTE"
        AND LOWER(r."Evento") = 'entrega'
      LIMIT 1
    )
    WHERE (a."OperadorMatricula" IS NULL OR a."OperadorMatricula" = 0)
      AND a."NCTE" IS NOT NULL
  `);
  return result.rowCount || 0;
}

export async function getQuinzenasReclamacoes() {
  const result = await pool.query(`
    SELECT DISTINCT
      CASE
        WHEN EXTRACT(DAY FROM a.data_criacao) <= 15 THEN
          date_trunc('month', a.data_criacao)::date
        ELSE
          (date_trunc('month', a.data_criacao) + INTERVAL '15 days')::date
      END AS inicio,
      CASE
        WHEN EXTRACT(DAY FROM a.data_criacao) <= 15 THEN
          (date_trunc('month', a.data_criacao) + INTERVAL '14 days')::date
        ELSE
          (date_trunc('month', a.data_criacao) + INTERVAL '1 month' - INTERVAL '1 day')::date
      END AS fim
    FROM acareacaojad a
    WHERE a.data_criacao IS NOT NULL
    ORDER BY inicio DESC
  `);
  return result.rows;
}

export async function listarReclamacoes(inicio, fim) {
  const atualizadas = await atualizarMatriculasPendentes();

  let whereClause = '';
  const params = [];

  if (inicio && fim) {
    params.push(inicio, fim);
    whereClause = `WHERE a.data_criacao BETWEEN $1::date AND $2::date`;
  }

  const query = `
    SELECT
      a.id,
      a.ticket_id,
      a."NCTE" AS cte,
      a.assunto,
      a.status_original,
      a.data_criacao,
      a."OperadorMatricula"::bigint AS matricula,
      m.nome_completo AS motorista_nome
    FROM acareacaojad a
    LEFT JOIN matriculos_jad m ON m."OperadorMatricula"::bigint = a."OperadorMatricula"
    ${whereClause}
    ORDER BY
      CASE WHEN a."NCTE" IS NULL OR a."OperadorMatricula" IS NULL OR a."OperadorMatricula" = 0 THEN 0 ELSE 1 END,
      a.data_criacao DESC,
      a.id DESC
  `;
  const result = await pool.query(query, params);
  return { rows: result.rows, atualizadas };
}

export async function atualizarCte(id, cte) {
  const cteLimpo = limparCte(cte);
  let matricula = null;

  if (cteLimpo) {
    const match = await pool.query(`
      SELECT "OperadorMatricula"::bigint AS matricula
      FROM relatorioentrega_export
      WHERE "NCTE" = $1
        AND LOWER("Evento") = 'entrega'
      LIMIT 1
    `, [cteLimpo]);
    if (match.rows.length > 0) {
      matricula = match.rows[0].matricula;
    }
  }

  await pool.query(`
    UPDATE acareacaojad
    SET "NCTE" = $1, "OperadorMatricula" = $2
    WHERE id = $3
  `, [cteLimpo, matricula, id]);

  return { id, cte: cteLimpo, matricula };
}

export async function atualizarMotorista(id, matricula) {
  const matInt = matricula ? parseInt(matricula, 10) : null;
  if (matInt && isNaN(matInt)) {
    throw new Error('Matrícula inválida');
  }
  const result = await pool.query(`
    UPDATE acareacaojad
    SET "OperadorMatricula" = $1
    WHERE id = $2
  `, [matInt, id]);
  return { id, matricula: matInt, atualizado: result.rowCount > 0 };
}

export async function vincularMotoristaPorCte(id) {
  const result = await pool.query(`
    UPDATE acareacaojad a
    SET "OperadorMatricula" = (
      SELECT r."OperadorMatricula"::bigint
      FROM relatorioentrega_export r
      WHERE r."NCTE" = a."NCTE"
        AND LOWER(r."Evento") = 'entrega'
      LIMIT 1
    )
    WHERE a.id = $1
      AND a."NCTE" IS NOT NULL
    RETURNING a.id, a."OperadorMatricula" AS matricula
  `, [id]);
  return result.rows[0] || null;
}

export async function vincularTodosPendentes() {
  const result = await pool.query(`
    UPDATE acareacaojad a
    SET "OperadorMatricula" = (
      SELECT r."OperadorMatricula"::bigint
      FROM relatorioentrega_export r
      WHERE r."NCTE" = a."NCTE"
        AND LOWER(r."Evento") = 'entrega'
      LIMIT 1
    )
    WHERE (a."OperadorMatricula" IS NULL OR a."OperadorMatricula" = 0)
      AND a."NCTE" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM relatorioentrega_export r2
        WHERE r2."NCTE" = a."NCTE"
          AND LOWER(r2."Evento") = 'entrega'
      )
    RETURNING id
  `);
  return { atualizados: result.rowCount };
}

export async function deletarReclamacao(id) {
  const result = await pool.query(`DELETE FROM acareacaojad WHERE id = $1`, [id]);
  return result.rowCount > 0;
}

export async function listarReclamacoesSemMotorista() {
  const result = await pool.query(`
    SELECT
      a.id,
      a.ticket_id,
      a."NCTE" AS cte,
      a.assunto,
      a.status_original,
      a.data_criacao,
      CASE
        WHEN a."NCTE" IS NULL THEN 'CTE pendente'
        WHEN a."OperadorMatricula" IS NULL OR a."OperadorMatricula" = 0 THEN 'CTE não encontrado'
        ELSE 'ok'
      END AS situacao
    FROM acareacaojad a
    WHERE (a."OperadorMatricula" IS NULL OR a."OperadorMatricula" = 0)
    ORDER BY a.data_criacao DESC
  `);
  return result.rows;
}