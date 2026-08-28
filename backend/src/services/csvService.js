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
  let motoristas = 0;
  let romaneios = 0;
  let ctrcs = 0;
  let erros = 0;

  const motoristaCache = new Map();
  const romaneioSet = new Set();
  const fretePorRomaneio = new Map();

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

      if (!motoristaCache.has(cpf)) {
        await pool.query(`
          INSERT INTO motoristas (cpf, nome)
          VALUES ($1, $2)
          ON CONFLICT (cpf) DO UPDATE SET nome = EXCLUDED.nome
        `, [cpf, nomeMotorista]);
        motoristaCache.set(cpf, true);
        motoristas++;
      }

      const id = `${idRomaneio}|${ctrc}`;

      await pool.query(`
        INSERT INTO ssw_romaneios (id_romaneio, motorista_cpf, motorista_nome, data_emissao, situacao, placa)
        VALUES ($1, $2, $3,
          NULLIF($4, '')::date,
          NULLIF($5, ''),
          NULLIF($6, ''))
        ON CONFLICT (id_romaneio) DO UPDATE SET
          situacao = EXCLUDED.situacao,
          placa = EXCLUDED.placa
      `, [
        idRomaneio, cpf, nomeMotorista,
        parseBrDate(row['DATA EMISSAO']),
        row['SITUACAO'] || null,
        row['PLACA'] || null,
      ]);

      if (!romaneioSet.has(idRomaneio)) {
        romaneioSet.add(idRomaneio);
        romaneios++;
      }

      const freteStr = (row['FRETE CTRC'] || '0').replace(/\./g, '').replace(',', '.');
      const freteVal = parseFloat(freteStr) || 0;
      fretePorRomaneio.set(idRomaneio, (fretePorRomaneio.get(idRomaneio) || 0) + freteVal);

      const pesoSStr = (row['PESO CALCULO'] || '0').replace(/\./g, '').replace(',', '.');
      const qtdeStr = (row['QTDE VOL'] || '0').replace(/\D/g, '') || '0';

      const cep = (row['CEP ENTREGA'] || '').replace(/\D/g, '');

      await pool.query(`
        INSERT INTO ssw_ctrcs (
          id, ctrc, id_romaneio, cidade_entrega, cep, bairro, local_entrega,
          peso_calculo, frete_ctrc, qtde_vol, data_emissao,
          ocorrencia, ocorrencia_data, ocorrencia_hora
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          NULLIF($11, '')::date, $12,
          NULLIF($13, '')::date,
          NULLIF($14, ''))
        ON CONFLICT (id) DO UPDATE SET
          cidade_entrega = COALESCE(EXCLUDED.cidade_entrega, ssw_ctrcs.cidade_entrega),
          cep = COALESCE(EXCLUDED.cep, ssw_ctrcs.cep),
          bairro = COALESCE(EXCLUDED.bairro, ssw_ctrcs.bairro),
          ocorrencia = EXCLUDED.ocorrencia,
          ocorrencia_data = EXCLUDED.ocorrencia_data,
          ocorrencia_hora = EXCLUDED.ocorrencia_hora
      `, [
        id, ctrc, idRomaneio,
        (row['CIDADE_ENTREGA'] || '').trim(),
        cep,
        (row['BAIRRO'] || '').trim(),
        (row['LOCAL DE ENTREGA'] || '').trim(),
        parseFloat(pesoSStr) || 0,
        parseFloat(freteStr) || 0,
        parseInt(qtdeStr) || 0,
        parseBrDate(row['DATA EMISSAO']),
        ocorrencia,
        ocorrenciaData,
        ocorrenciaHora,
      ]);
      ctrcs++;
    } catch (err) {
      console.error('Erro ao processar linha SSW 036:', err.message, JSON.stringify(row).slice(0, 200));
      erros++;
    }
  }

  for (const [romId, total] of fretePorRomaneio) {
    await pool.query(
      'UPDATE ssw_romaneios SET total_frete = $1 WHERE id_romaneio = $2',
      [total, romId]
    );
  }

  return { motoristas, romaneios, ctrcs, erros };
}

function classificarOrigem(texto) {
  const t = (texto || '').toUpperCase();
  if (t.includes('SSWMOBILE')) return 'APP';
  if (t.includes('OPC 038')) return 'BASE';
  return 'SSW';
}

export async function importarSsw455(rows) {
  let importados = 0;
  let erros = 0;
  let atualizados_ctrcs = 0;
  let pagadores_cadastrados = 0;
  const cnpjsVistos = new Set();

  for (const row of rows) {
    try {
      const ctrc = (row['Serie/Numero CTRC'] || '').trim();
      if (!ctrc) { erros++; continue; }

      const ctrcNormalizado = ctrc.replace(/\s+/g, '');
      const controleDuplicidade = `455|${ctrcNormalizado}`;

      const dataEmissao = parseBrDate(row['Data de Emissao']);
      const dataBaixa = parseBrDate(row['Data da Liquidacao']);

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
      const previsaoEntrega = parseBrDate(row['Previsao de Entrega']);
      const dataUltimaOcorrencia = parseBrDate(row['Data da Ultima Ocorrencia']);
      const unidadeUltimaOcorrencia = normalizarUnidadeOcorrencia(row['Unidade da Ultima Ocorrencia']);
      const cubagemM3 = parseFloat((row['Cubagem em m3'] || '0').replace(/\./g, '').replace(',', '.')) || 0;
      const tipoBaixa = (row['Tipo de Baixa'] || '').trim();
      const valorMercadoria = parseFloat((row['Valor da Mercadoria'] || '0').replace(/\./g, '').replace(',', '.')) || 0;
      const setorDestino = (row['Setor de Destino'] || '').trim();
      const origemOcorrencia = classificarOrigem(ocorrencia);

      await pool.query(`
        INSERT INTO ssw_455 (
          ctrc, ctrc_normalizado, serie_numero_cte, data_emissao,
          cnpj_pagador, cliente_pagador, unidade_receptora,
          cidade_entrega, uf_entrega, cep_entrega,
          peso_real, volumes, valor_frete, tipo_frete,
          data_baixa, ocorrencia, controle_duplicidade,
          numero_nota_fiscal, previsao_entrega, data_ultima_ocorrencia,
          unidade_ultima_ocorrencia, cubagem_m3, tipo_baixa, valor_mercadoria, setor_destino,
          codigo_ocorrencia, origem_ocorrencia
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
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
      `, [
        ctrc, ctrcNormalizado, serieNumeroCte, dataEmissao,
        cnpjPagador, clientePagador, unidadeReceptora,
        cidadeEntrega, ufEntrega, cepEntrega,
        pesoReal, volumes, valorFrete, tipoFrete,
        dataBaixa, ocorrencia, controleDuplicidade,
        numeroNotaFiscal, previsaoEntrega, dataUltimaOcorrencia,
        unidadeUltimaOcorrencia, cubagemM3, tipoBaixa, valorMercadoria, setorDestino,
        codigoOcorrencia, origemOcorrencia,
      ]);

      if (cnpjPagador && !cnpjsVistos.has(cnpjPagador)) {
        cnpjsVistos.add(cnpjPagador);
        const { rowCount } = await pool.query(`
          INSERT INTO pagadores (cnpj, razao_social, nome_simplificado)
          VALUES ($1, $2, $3)
          ON CONFLICT (cnpj) DO UPDATE SET
            razao_social = EXCLUDED.razao_social
          WHERE pagadores.razao_social IS NULL OR pagadores.razao_social = ''
        `, [cnpjPagador, clientePagador, clientePagador]);
        if (rowCount > 0) pagadores_cadastrados++;
      }

      if (unidadeReceptora) {
        const result = await pool.query(`
          UPDATE ssw_ctrcs SET unidade_receptora = $1
          WHERE REPLACE(ctrc, ' ', '') = $2 AND (unidade_receptora IS NULL OR unidade_receptora = '')
        `, [unidadeReceptora, ctrcNormalizado]);
        atualizados_ctrcs += result.rowCount;
      }

      importados++;
    } catch (err) {
      console.error('Erro ao processar linha SSW 455:', err.message, JSON.stringify(row).slice(0, 200));
      erros++;
    }
  }

  return { importados, erros, atualizados_ctrcs, pagadores_cadastrados };
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
          ctrcsVistos.set(ctrcNormalizado, { dataOcor, horaOcor, codOcor, complementoOcor, unidadeUltimaOcorrencia, dataEntrega, cnpjPagador, nomePagador, ctrc });
        }
      } else {
        ctrcsVistos.set(ctrcNormalizado, { dataOcor, horaOcor, codOcor, complementoOcor, unidadeUltimaOcorrencia, dataEntrega, cnpjPagador, nomePagador, ctrc });
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
          origem_ocorrencia = CASE WHEN $4::text IS NOT NULL THEN $5 ELSE origem_ocorrencia END
        WHERE ctrc_normalizado = $6
          AND ($1::date >= data_ultima_ocorrencia OR data_ultima_ocorrencia IS NULL)
      `, [info.dataOcor, info.codOcor, info.unidadeUltimaOcorrencia, info.complementoOcor || null, origem, ctrcNorm]);

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
