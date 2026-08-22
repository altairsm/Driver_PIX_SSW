import { pool } from '../db/index.js';
import { parse } from 'csv-parse/sync';
import fs from 'fs';

function parseBrDate(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
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
      const serieNumeroCte = (row['Serie/Numero CT-e'] || '').trim();
      const numeroNotaFiscal = (row['Numero da Nota Fiscal'] || '').trim();
      const previsaoEntrega = parseBrDate(row['Previsao de Entrega']);
      const dataUltimaOcorrencia = parseBrDate(row['Data da Ultima Ocorrencia']);

      await pool.query(`
        INSERT INTO ssw_455 (
          ctrc, ctrc_normalizado, serie_numero_cte, data_emissao,
          cnpj_pagador, cliente_pagador, unidade_receptora,
          cidade_entrega, uf_entrega, cep_entrega,
          peso_real, volumes, valor_frete, tipo_frete,
          data_baixa, ocorrencia, controle_duplicidade,
          numero_nota_fiscal, previsao_entrega, data_ultima_ocorrencia
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        ON CONFLICT ("controle_duplicidade") DO UPDATE SET
          unidade_receptora = EXCLUDED.unidade_receptora,
          ocorrencia = EXCLUDED.ocorrencia,
          data_baixa = EXCLUDED.data_baixa,
          valor_frete = EXCLUDED.valor_frete,
          numero_nota_fiscal = EXCLUDED.numero_nota_fiscal,
          previsao_entrega = EXCLUDED.previsao_entrega,
          data_ultima_ocorrencia = EXCLUDED.data_ultima_ocorrencia
      `, [
        ctrc, ctrcNormalizado, serieNumeroCte, dataEmissao,
        cnpjPagador, clientePagador, unidadeReceptora,
        cidadeEntrega, ufEntrega, cepEntrega,
        pesoReal, volumes, valorFrete, tipoFrete,
        dataBaixa, ocorrencia, controleDuplicidade,
        numeroNotaFiscal, previsaoEntrega, dataUltimaOcorrencia,
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
