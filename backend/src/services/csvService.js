import { pool } from '../db/index.js';
import { parse } from 'csv-parse/sync';
import fs from 'fs';

function parseBrDate(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  if (!s) return null;
  const m4 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m4) return `${m4[3]}-${m4[2]}-${m4[1]}`;
  const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (m2) {
    const yy = parseInt(m2[3]);
    const year = yy < 50 ? 2000 + yy : 1900 + yy;
    return `${year}-${m2[2]}-${m2[1]}`;
  }
  return s;
}

function normalizarUnidadeOcorrencia(value) {
  const unidade = String(value ?? '').trim();
  if (!unidade) return null;
  return unidade.replace(/^NCR\s*-\s*/i, '').trim() || null;
}

export function parseCSV(filePath, fromLine = 1) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const normalized = raw.replace(/^\uFEFF/, '');
  const records = parse(normalized, {
    delimiter: ';',
    columns: true,
    skip_empty_lines: true,
    relaxColumnCount: true,
    bom: true,
    from_line: fromLine,
  });
  return records;
}

export async function importarSsw036(rows) {
  let erros = 0;

  const motoristaCpfSet = new Set();
  const motoristaPorCpf = new Map();
  const ajudanteMap = new Map();
  const novosAjudantes = [];
  const romaneioSet = new Set();
  const romaneioPorId = new Map();
  const fretePorRomaneio = new Map();
  const ctrcRows = [];

  const { rows: ajudantesExistentes } = await pool.query('SELECT codigo, nome FROM ajudantes');
  const dbAjudanteMap = new Map();
  for (const a of ajudantesExistentes) dbAjudanteMap.set(a.nome.toUpperCase(), a.codigo);

  for (const row of rows) {
    try {
      const cpf = String(row['CPF DO MOTORISTA'] || '').replace(/\D/g, '').slice(0, 11);
      const nomeMotorista = (row['MOTORISTA'] || '').trim();
      const idRomaneio = (row['ROMANEIO'] || '').trim();
      const ctrc = (row['CTRC'] || '').trim();
      const ocorrencia = (row['DESC OCORR CTRC'] || '').trim();
      const ocorrenciaData = parseBrDate(row['DATA OCORR CTRC']);
      const ocorrenciaHora = row['HORA OCORR CTRC'] || null;

      if (!cpf || !idRomaneio || !ctrc) {
        erros++;
        continue;
      }

      if (!motoristaCpfSet.has(cpf)) {
        motoristaCpfSet.add(cpf);
        motoristaPorCpf.set(cpf, nomeMotorista);
      }

      const id = `${idRomaneio}|${ctrc}`;

      const ajudCodigos = [];
      for (const col of ['AJUDANTE', 'AJUDANTE_2', 'AJUDANTE_3']) {
        const nome = (row[col] || '').trim();
        if (!nome) { ajudCodigos.push(null); continue; }
        const chave = nome.toUpperCase();
        let codigo = ajudanteMap.get(chave);
        if (codigo === undefined) {
          const existente = dbAjudanteMap.get(chave);
          if (existente) {
            codigo = existente;
          } else {
            let hash = 0;
            for (let i = 0; i < nome.length; i++) {
              hash = ((hash << 5) - hash + nome.charCodeAt(i)) | 0;
            }
            codigo = String(Math.abs(hash));
            dbAjudanteMap.set(chave, codigo);
            novosAjudantes.push([codigo, nome]);
          }
          ajudanteMap.set(chave, codigo);
        }
        ajudCodigos.push(codigo);
      }

      const freteStr = (row['FRETE CTRC'] || '0').replace(/\./g, '').replace(',', '.');
      const freteVal = parseFloat(freteStr) || 0;
      fretePorRomaneio.set(idRomaneio, (fretePorRomaneio.get(idRomaneio) || 0) + freteVal);

      if (!romaneioSet.has(idRomaneio)) {
        romaneioSet.add(idRomaneio);
        romaneioPorId.set(idRomaneio, {
          motorista_cpf: cpf,
          motorista_nome: nomeMotorista,
          data_emissao: parseBrDate(row['DATA EMISSAO']) || '',
          situacao: row['SITUACAO'] || '',
          placa: row['PLACA'] || '',
          ajudante_codigo: ajudCodigos[0] || '',
          ajudante_2_codigo: ajudCodigos[1] || '',
          ajudante_3_codigo: ajudCodigos[2] || '',
        });
      } else {
        const r = romaneioPorId.get(idRomaneio);
        r.situacao = row['SITUACAO'] || '';
        r.placa = row['PLACA'] || '';
        r.ajudante_codigo = ajudCodigos[0] || '';
        r.ajudante_2_codigo = ajudCodigos[1] || '';
        r.ajudante_3_codigo = ajudCodigos[2] || '';
      }

      const pesoSStr = (row['PESO CALCULO'] || '0').replace(/\./g, '').replace(',', '.');
      const qtdeStr = (row['QTDE VOL'] || '0').replace(/\D/g, '') || '0';

      ctrcRows.push([
        id,
        ctrc,
        idRomaneio,
        (row['CIDADE_ENTREGA'] || '').trim(),
        (row['CEP ENTREGA'] || '').replace(/\D/g, ''),
        (row['BAIRRO'] || '').trim(),
        (row['LOCAL DE ENTREGA'] || '').trim(),
        String(parseFloat(pesoSStr) || 0),
        String(parseFloat(freteStr) || 0),
        String(parseInt(qtdeStr) || 0),
        parseBrDate(row['DATA EMISSAO']) || '',
        ocorrencia,
        ocorrenciaData || '',
        ocorrenciaHora || '',
        idRomaneio.slice(0, 3).toUpperCase() || '',
      ]);
    } catch (err) {
      console.error('Erro ao processar linha SSW 036:', err.message, JSON.stringify(row).slice(0, 200));
      erros++;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (motoristaCpfSet.size > 0) {
      const cpfs = [...motoristaCpfSet];
      await client.query(`
        INSERT INTO motoristas (cpf, nome)
        SELECT v.c1, v.c2
        FROM unnest($1::text[], $2::text[]) AS v(c1, c2)
        WHERE NULLIF(v.c1, '') IS NOT NULL
        ON CONFLICT (cpf) DO UPDATE SET nome = EXCLUDED.nome
      `, [cpfs, cpfs.map(c => motoristaPorCpf.get(c) || '')]);
    }

    if (novosAjudantes.length > 0) {
      await client.query(`
        INSERT INTO ajudantes (codigo, nome)
        SELECT v.c1, v.c2
        FROM unnest($1::text[], $2::text[]) AS v(c1, c2)
        WHERE NULLIF(v.c1, '') IS NOT NULL
        ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome
      `, [novosAjudantes.map(a => a[0]), novosAjudantes.map(a => a[1])]);
    }

    if (romaneioPorId.size > 0) {
      const rs = [...romaneioPorId.entries()];
      await client.query(`
        INSERT INTO ssw_romaneios (
          id_romaneio, motorista_cpf, motorista_nome, data_emissao, situacao, placa,
          ajudante_codigo, ajudante_2_codigo, ajudante_3_codigo
        )
        SELECT v.c1, v.c2, v.c3, NULLIF(v.c4, '')::date, NULLIF(v.c5, ''), NULLIF(v.c6, ''),
               NULLIF(v.c7, ''), NULLIF(v.c8, ''), NULLIF(v.c9, '')
        FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[],
                    $7::text[], $8::text[], $9::text[]) AS v(c1, c2, c3, c4, c5, c6, c7, c8, c9)
        ON CONFLICT (id_romaneio) DO UPDATE SET
          situacao = EXCLUDED.situacao,
          placa = EXCLUDED.placa,
          ajudante_codigo = EXCLUDED.ajudante_codigo,
          ajudante_2_codigo = EXCLUDED.ajudante_2_codigo,
          ajudante_3_codigo = EXCLUDED.ajudante_3_codigo
      `, [
        rs.map(r => r[0]),
        rs.map(r => r[1].motorista_cpf),
        rs.map(r => r[1].motorista_nome),
        rs.map(r => r[1].data_emissao),
        rs.map(r => r[1].situacao),
        rs.map(r => r[1].placa),
        rs.map(r => r[1].ajudante_codigo),
        rs.map(r => r[1].ajudante_2_codigo),
        rs.map(r => r[1].ajudante_3_codigo),
      ]);
    }

    if (ctrcRows.length > 0) {
      await client.query(`
        INSERT INTO ssw_ctrcs (
          id, ctrc, id_romaneio, cidade_entrega, cep, bairro, local_entrega,
          peso_calculo, frete_ctrc, qtde_vol, data_emissao,
          ocorrencia, ocorrencia_data, ocorrencia_hora, unidade_receptora
        )
        SELECT v.c1, v.c2, v.c3, NULLIF(v.c4, ''), NULLIF(v.c5, ''), NULLIF(v.c6, ''), NULLIF(v.c7, ''),
               COALESCE(NULLIF(v.c8, '')::numeric, 0),
               COALESCE(NULLIF(v.c9, '')::numeric, 0),
               COALESCE(NULLIF(v.c10, '')::int, 0),
               NULLIF(v.c11, '')::date,
               NULLIF(v.c12, ''), NULLIF(v.c13, '')::date, NULLIF(v.c14, ''), NULLIF(v.c15, '')
        FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[],
                    $8::text[], $9::text[], $10::text[], $11::text[], $12::text[], $13::text[], $14::text[], $15::text[])
              AS v(c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15)
        ON CONFLICT (id) DO UPDATE SET
          cidade_entrega = COALESCE(EXCLUDED.cidade_entrega, ssw_ctrcs.cidade_entrega),
          cep = COALESCE(EXCLUDED.cep, ssw_ctrcs.cep),
          bairro = COALESCE(EXCLUDED.bairro, ssw_ctrcs.bairro),
          unidade_receptora = COALESCE(NULLIF(EXCLUDED.unidade_receptora, ''), ssw_ctrcs.unidade_receptora),
          ocorrencia = EXCLUDED.ocorrencia,
          ocorrencia_data = EXCLUDED.ocorrencia_data,
          ocorrencia_hora = EXCLUDED.ocorrencia_hora
      `, ctrcRows[0].map((_, i) => ctrcRows.map(r => r[i])));
    }

    if (fretePorRomaneio.size > 0) {
      await client.query(`
        UPDATE ssw_romaneios r
        SET total_frete = NULLIF(s.c2, '')::numeric
        FROM unnest($1::text[], $2::text[]) AS s(c1, c2)
        WHERE r.id_romaneio = s.c1
      `, [[...fretePorRomaneio.keys()], [...fretePorRomaneio.values()].map(v => String(v))]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return {
    motoristas: motoristaCpfSet.size,
    romaneios: romaneioSet.size,
    ctrcs: ctrcRows.length,
    erros,
  };
}

function classificarOrigem(texto) {
  const t = (texto || '').toUpperCase();
  if (t.includes('SSWMOBILE')) return 'APP';
  if (t.includes('OPC 038')) return 'BASE';
  return 'SSW';
}

export async function importarSsw455(rows) {
  let erros = 0;
  let atualizados_ctrcs = 0;
  let pagadores_cadastrados = 0;
  const ssw455Rows = [];
  const pagadoresMap = new Map();
  const ctrcUnidadeUpdates = [];

  for (const row of rows) {
    try {
      const ctrc = (row['Serie/Numero CTRC'] || '').trim();
      if (!ctrc) { erros++; continue; }

      const ctrcNormalizado = ctrc.replace(/\s+/g, '');
      const controleDuplicidade = `455|${ctrcNormalizado}`;

      const dataEmissao = parseBrDate(row['Data de Emissao']) || '';
      const dataBaixa = parseBrDate(row['Data da Liquidacao']) || '';

      const cnpjPagador = (row['CNPJ Pagador'] || '').replace(/\D/g, '');
      const clientePagador = (row['Cliente Pagador'] || '').trim();
      const unidadeReceptora = (row['Unidade Receptora'] || '').trim();
      const cidadeEntrega = (row['Cidade de Entrega'] || '').trim();
      const ufEntrega = (row['UF de Entrega'] || '').trim();
      const cepEntrega = (row['CEP de Entrega'] || '').replace(/\D/g, '');
      const pesoReal = parseFloat((row['Peso Real em Kg'] || '0').replace(/\./g, '').replace(',', '.')) || 0;
      const volumes = parseInt((row['Quantidade de Volumes'] || '0').replace(/\D/g, '') || '0') || 0;
      const valorFrete = parseFloat((row['Valor do Frete'] || '0').replace(/\./g, '').replace(',', '.')) || 0;
      const tipoFrete = (row['Tipo do Frete'] || '').trim();
      const ocorrencia = (row['Descricao da Ultima Ocorrencia'] || '').trim();
      const codigoOcorrencia = (row['Codigo da Ultima Ocorrencia'] || '').trim().padStart(2, '0');
      const serieNumeroCte = (row['Serie/Numero CT-e'] || '').trim();
      const numeroNotaFiscal = (row['Numero da Nota Fiscal'] || '').trim();
      const previsaoEntrega = parseBrDate(row['Previsao de Entrega']) || '';
      const dataUltimaOcorrencia = parseBrDate(row['Data da Ultima Ocorrencia']) || '';
      const unidadeUltimaOcorrencia = normalizarUnidadeOcorrencia(row['Unidade da Ultima Ocorrencia']) || '';
      const cubagemM3 = parseFloat((row['Cubagem em m3'] || '0').replace(/\./g, '').replace(',', '.')) || 0;
      const tipoBaixa = (row['Tipo de Baixa'] || '').trim();
      const valorMercadoria = parseFloat((row['Valor da Mercadoria'] || '0').replace(/\./g, '').replace(',', '.')) || 0;
      const setorDestino = (row['Setor de Destino'] || '').trim();
      const origemOcorrencia = classificarOrigem(ocorrencia);

      ssw455Rows.push([
        ctrc, ctrcNormalizado, serieNumeroCte, dataEmissao,
        cnpjPagador, clientePagador, unidadeReceptora,
        cidadeEntrega, ufEntrega, cepEntrega,
        String(pesoReal), String(volumes), String(valorFrete), tipoFrete,
        dataBaixa, ocorrencia, controleDuplicidade,
        numeroNotaFiscal, previsaoEntrega, dataUltimaOcorrencia,
        unidadeUltimaOcorrencia, String(cubagemM3), tipoBaixa, String(valorMercadoria), setorDestino,
        codigoOcorrencia, origemOcorrencia,
      ]);

      if (cnpjPagador && !pagadoresMap.has(cnpjPagador)) {
        pagadoresMap.set(cnpjPagador, [cnpjPagador, clientePagador, clientePagador]);
      }

      if (unidadeReceptora) {
        ctrcUnidadeUpdates.push([unidadeReceptora, ctrcNormalizado]);
      }
    } catch (err) {
      console.error('Erro ao processar linha SSW 455:', err.message, JSON.stringify(row).slice(0, 200));
      erros++;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (ssw455Rows.length > 0) {
      await client.query(`
        INSERT INTO ssw_455 (
          ctrc, ctrc_normalizado, serie_numero_cte, data_emissao,
          cnpj_pagador, cliente_pagador, unidade_receptora,
          cidade_entrega, uf_entrega, cep_entrega,
          peso_real, volumes, valor_frete, tipo_frete,
          data_baixa, ocorrencia, controle_duplicidade,
          numero_nota_fiscal, previsao_entrega, data_ultima_ocorrencia,
          unidade_ultima_ocorrencia, cubagem_m3, tipo_baixa, valor_mercadoria, setor_destino,
          codigo_ocorrencia, origem_ocorrencia
        )
        SELECT v.c1, v.c2, NULLIF(v.c3, ''), NULLIF(v.c4, '')::date,
               NULLIF(v.c5, ''), NULLIF(v.c6, ''), NULLIF(v.c7, ''),
               NULLIF(v.c8, ''), NULLIF(v.c9, ''), NULLIF(v.c10, ''),
               COALESCE(NULLIF(v.c11, '')::numeric, 0), COALESCE(NULLIF(v.c12, '')::int, 0),
               COALESCE(NULLIF(v.c13, '')::numeric, 0), NULLIF(v.c14, ''),
               NULLIF(v.c15, '')::date, NULLIF(v.c16, ''), v.c17,
               NULLIF(v.c18, ''), NULLIF(v.c19, '')::date, NULLIF(v.c20, '')::date,
               NULLIF(v.c21, ''), COALESCE(NULLIF(v.c22, '')::numeric, 0), NULLIF(v.c23, ''),
               COALESCE(NULLIF(v.c24, '')::numeric, 0), NULLIF(v.c25, ''),
               NULLIF(v.c26, ''), NULLIF(v.c27, '')
        FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[],
                    $7::text[], $8::text[], $9::text[], $10::text[], $11::text[], $12::text[],
                    $13::text[], $14::text[], $15::text[], $16::text[], $17::text[], $18::text[],
                    $19::text[], $20::text[], $21::text[], $22::text[], $23::text[], $24::text[],
                    $25::text[], $26::text[], $27::text[])
              AS v(c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17,
                   c18, c19, c20, c21, c22, c23, c24, c25, c26, c27)
        ON CONFLICT ("controle_duplicidade") DO UPDATE SET
          unidade_receptora = EXCLUDED.unidade_receptora,
          ocorrencia = CASE WHEN EXCLUDED.data_ultima_ocorrencia >= ssw_455.data_ultima_ocorrencia OR ssw_455.data_ultima_ocorrencia IS NULL THEN EXCLUDED.ocorrencia ELSE ssw_455.ocorrencia END,
          data_baixa = EXCLUDED.data_baixa,
          valor_frete = EXCLUDED.valor_frete,
          numero_nota_fiscal = EXCLUDED.numero_nota_fiscal,
          previsao_entrega = EXCLUDED.previsao_entrega,
          data_ultima_ocorrencia = CASE WHEN EXCLUDED.data_ultima_ocorrencia >= ssw_455.data_ultima_ocorrencia OR ssw_455.data_ultima_ocorrencia IS NULL THEN EXCLUDED.data_ultima_ocorrencia ELSE ssw_455.data_ultima_ocorrencia END,
          unidade_ultima_ocorrencia = CASE
            WHEN EXCLUDED.data_ultima_ocorrencia >= ssw_455.data_ultima_ocorrencia OR ssw_455.data_ultima_ocorrencia IS NULL
              THEN COALESCE(EXCLUDED.unidade_ultima_ocorrencia, ssw_455.unidade_ultima_ocorrencia)
            ELSE ssw_455.unidade_ultima_ocorrencia
          END,
          cubagem_m3 = EXCLUDED.cubagem_m3,
          tipo_baixa = EXCLUDED.tipo_baixa,
          valor_mercadoria = EXCLUDED.valor_mercadoria,
          setor_destino = EXCLUDED.setor_destino,
          codigo_ocorrencia = CASE WHEN EXCLUDED.data_ultima_ocorrencia >= ssw_455.data_ultima_ocorrencia OR ssw_455.data_ultima_ocorrencia IS NULL THEN EXCLUDED.codigo_ocorrencia ELSE ssw_455.codigo_ocorrencia END,
          origem_ocorrencia = CASE WHEN EXCLUDED.data_ultima_ocorrencia >= ssw_455.data_ultima_ocorrencia OR ssw_455.data_ultima_ocorrencia IS NULL THEN EXCLUDED.origem_ocorrencia ELSE ssw_455.origem_ocorrencia END
      `, ssw455Rows[0].map((_, i) => ssw455Rows.map(r => r[i])));
    }

    if (pagadoresMap.size > 0) {
      const pagadores = [...pagadoresMap.values()];
      const { rowCount } = await client.query(`
        INSERT INTO pagadores (cnpj, razao_social, nome_simplificado)
        SELECT v.c1, v.c2, v.c3
        FROM unnest($1::text[], $2::text[], $3::text[]) AS v(c1, c2, c3)
        WHERE NULLIF(v.c1, '') IS NOT NULL
        ON CONFLICT (cnpj) DO UPDATE SET
          razao_social = EXCLUDED.razao_social
          WHERE pagadores.razao_social IS NULL OR pagadores.razao_social = ''
      `, [
        pagadores.map(p => p[0]),
        pagadores.map(p => p[1]),
        pagadores.map(p => p[2]),
      ]);
      if (rowCount > 0) pagadores_cadastrados = rowCount;
    }

    if (ctrcUnidadeUpdates.length > 0) {
      const { rowCount } = await client.query(`
        UPDATE ssw_ctrcs SET unidade_receptora = s.c1
        FROM unnest($1::text[], $2::text[]) AS s(c1, c2)
        WHERE REPLACE(ctrc, ' ', '') = s.c2 AND NULLIF(s.c1, '') IS NOT NULL
      `, [
        ctrcUnidadeUpdates.map(u => u[0]),
        ctrcUnidadeUpdates.map(u => u[1]),
      ]);
      if (rowCount > 0) atualizados_ctrcs = rowCount;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { importados: ssw455Rows.length, erros, atualizados_ctrcs, pagadores_cadastrados };
}

export async function importarSsw930(rows) {
  let atualizados = 0;
  let erros = 0;
  let ignorados = 0;
  const naoEncontrados = [];
  const ctrcsVistos = new Map();

  for (const row of rows) {
    try {
      const ctrc = (row['CTRC'] || '').trim();
      if (!ctrc) { erros++; continue; }

      const ctrcNormalizado = ctrc.replace(/\s+/g, '');
      const dataOcor = parseBrDate(row['DATA_OCOR']);
      const horaOcor = (row['HORA_OCOR'] || '').trim();
      const codOcor = (row['COD_OCOR'] || '').trim().padStart(2, '0');
      const descrOcor = (row['DESCRICAO_OCOR'] || '').trim();
      const complementoOcor = (row['COMPLEMENTO_OCOR'] || '').trim();
      const unidadeUltimaOcorrencia = normalizarUnidadeOcorrencia(row['UNID_OCOR']);
      const dataEntrega = parseBrDate(row['DATA_ENTREGA']);
      const cnpjPagador = (row['CNPJ_PAGADOR'] || '').replace(/\D/g, '');
      const nomePagador = (row['NOME_PAGADOR'] || '').trim();

      if (!dataOcor) { erros++; continue; }

      const chave = `${ctrcNormalizado}|${dataOcor}|${horaOcor}`;
      const existente = ctrcsVistos.get(ctrcNormalizado);

      if (existente) {
        const cmpData = dataOcor.localeCompare(existente.dataOcor);
        const cmpHora = horaOcor.localeCompare(existente.horaOcor);
        if (cmpData > 0 || (cmpData === 0 && cmpHora > 0)) {
          ctrcsVistos.set(ctrcNormalizado, { dataOcor, horaOcor, codOcor, descrOcor, complementoOcor, unidadeUltimaOcorrencia, dataEntrega, cnpjPagador, nomePagador, ctrc });
        }
      } else {
        ctrcsVistos.set(ctrcNormalizado, { dataOcor, horaOcor, codOcor, descrOcor, complementoOcor, unidadeUltimaOcorrencia, dataEntrega, cnpjPagador, nomePagador, ctrc });
      }
    } catch (err) {
      console.error('Erro ao processar linha SSW 930:', err.message);
      erros++;
    }
  }

  for (const [ctrcNorm, info] of ctrcsVistos) {
    try {
      const origem = info.complementoOcor ? classificarOrigem(info.complementoOcor) : null;
      const { rowCount } = await pool.query(`
        UPDATE ssw_455 SET
          data_ultima_ocorrencia = $1::date,
          codigo_ocorrencia = $2,
          unidade_ultima_ocorrencia = COALESCE($3, unidade_ultima_ocorrencia),
          origem_ocorrencia = CASE WHEN $4::text IS NOT NULL THEN $5 ELSE origem_ocorrencia END,
          ocorrencia = $7
        WHERE ctrc_normalizado = $6
          AND ($1::date >= data_ultima_ocorrencia OR data_ultima_ocorrencia IS NULL)
      `, [info.dataOcor, info.codOcor, info.unidadeUltimaOcorrencia, info.complementoOcor || null, origem, ctrcNorm, info.complementoOcor || info.descrOcor]);

      if (rowCount > 0) {
        atualizados++;
      } else {
        const { rows: existe } = await pool.query(
          'SELECT 1 FROM ssw_455 WHERE ctrc_normalizado = $1',
          [ctrcNorm]
        );
        if (existe.length === 0) {
          naoEncontrados.push({ ctrc: info.ctrc, cnpj_pagador: info.cnpjPagador, cliente_pagador: info.nomePagador });
        } else {
          ignorados++;
        }
      }
    } catch (err) {
      console.error(`Erro ao atualizar CTRC ${ctrcNorm}:`, err.message);
      erros++;
    }
  }

  return { atualizados, erros, ignorados, nao_encontrados: naoEncontrados };
}
