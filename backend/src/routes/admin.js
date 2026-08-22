import { Router } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../db/index.js';
import { requireRole } from '../middleware/auth.js';
import {
  calcularPagamentos, confirmarPagamento,
  listarMotoristas, criarMotorista, atualizarMotorista, deletarMotorista,
  getQuinzenasAdmin, getCidadesSemPreco, getCtrcsParados, getCtrcsParadosDetalhado
} from '../services/paymentService.js';
import { getEficienciaTodos, getAppUsageTodos } from '../services/driverService.js';
import { enviarSenhaPorEmail } from '../services/emailService.js';

const router = Router();

router.get('/quinzenas', async (req, res) => {
  try {
    const quinzenas = await getQuinzenasAdmin();
    res.json(quinzenas);
  } catch (err) {
    console.error('Erro ao buscar quinzenas:', err);
    res.status(500).json({ error: 'Erro ao buscar quinzenas' });
  }
});

router.get('/pagamentos', async (req, res) => {
  try {
    const { inicio, fim, unidade } = req.query;
    if (!inicio || !fim) {
      return res.status(400).json({ error: 'Parâmetros inicio e fim são obrigatórios' });
    }

    const resultado = await calcularPagamentos(inicio, fim, unidade || null);
    res.json(resultado);
  } catch (err) {
    console.error('Erro ao calcular pagamentos:', err);
    res.status(500).json({ error: 'Erro ao calcular pagamentos' });
  }
});

router.get('/motoristas', async (req, res) => {
  try {
    const motoristas = await listarMotoristas();
    res.json(motoristas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/confirmar-pagamento', requireRole('admin'), async (req, res) => {
  try {
    const { cpf, inicio, fim } = req.body;
    if (!cpf || !inicio || !fim) {
      return res.status(400).json({ error: 'CPF, inicio e fim são obrigatórios' });
    }

    const result = await confirmarPagamento(cpf, { inicio, fim });
    res.json({ success: true, message: 'Pagamento confirmado com sucesso', ...result });
  } catch (err) {
    console.error('Erro ao confirmar pagamento:', err);
    res.status(500).json({ error: 'Erro ao confirmar pagamento' });
  }
});

router.post('/motoristas', requireRole('admin'), async (req, res) => {
  try {
    const { cpf, nome, telefone, pix_tipo, unidade } = req.body;
    if (!cpf || !nome) {
      return res.status(400).json({ error: 'CPF e nome são obrigatórios' });
    }
    const motorista = await criarMotorista(req.body);
    res.status(201).json(motorista);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'CPF já cadastrado' });
    }
    console.error('Erro ao criar motorista:', err);
    res.status(500).json({ error: 'Erro ao criar motorista' });
  }
});

router.put('/motoristas/:cpf', requireRole('admin'), async (req, res) => {
  try {
    const { cpf } = req.params;
    const atualizado = await atualizarMotorista(cpf, req.body);
    if (!atualizado) return res.status(404).json({ error: 'Motorista não encontrado' });
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao atualizar motorista:', err);
    res.status(500).json({ error: 'Erro ao atualizar motorista' });
  }
});

router.delete('/motoristas/:cpf', requireRole('admin'), async (req, res) => {
  try {
    const { cpf } = req.params;
    const deletado = await deletarMotorista(cpf);
    if (!deletado) return res.status(404).json({ error: 'Motorista não encontrado' });
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao deletar motorista:', err);
    res.status(500).json({ error: 'Erro ao deletar motorista' });
  }
});

router.get('/resumo', async (req, res) => {
  try {
    const { inicio, fim, unidade } = req.query;
    if (!inicio || !fim) {
      return res.status(400).json({ error: 'Parâmetros inicio e fim são obrigatórios' });
    }

    const pagamentos = await calcularPagamentos(inicio, fim, unidade || null);

    const resumo = {
      total_motoristas: pagamentos.length,
      total_ctrcs: pagamentos.reduce((acc, p) => acc + Number(p.total_ctrcs), 0),
      total_receita: pagamentos.reduce((acc, p) => acc + Number(p.receita_total), 0),
      total_despesa: pagamentos.reduce((acc, p) => acc + Number(p.despesa_total), 0),
      total_pagar: pagamentos.reduce((acc, p) => acc + Number(p.total_pagar), 0),
      total_adiantado: pagamentos.reduce((acc, p) => acc + Number(p.total_adiantado), 0),
      motoristas: pagamentos,
    };

    res.json(resumo);
  } catch (err) {
    console.error('Erro ao gerar resumo:', err);
    res.status(500).json({ error: 'Erro ao gerar resumo' });
  }
});

router.get('/precos-cidades', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tabela_preco_cidade ORDER BY cidade');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar preços' });
  }
});

router.put('/precos-cidades', requireRole('admin'), async (req, res) => {
  try {
    const { cidade, valor_entrega } = req.body;
    if (!cidade || valor_entrega === undefined) {
      return res.status(400).json({ error: 'cidade e valor_entrega são obrigatórios' });
    }

    await pool.query(`
      INSERT INTO tabela_preco_cidade (cidade, valor_entrega)
      VALUES ($1, $2)
      ON CONFLICT (cidade) DO UPDATE SET valor_entrega = $2, atualizado_em = CURRENT_TIMESTAMP
    `, [cidade.toUpperCase(), parseFloat(valor_entrega)]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar preço' });
  }
});

router.delete('/precos-cidades/:cidade', requireRole('admin'), async (req, res) => {
  try {
    const { cidade } = req.params;
    await pool.query('DELETE FROM tabela_preco_cidade WHERE cidade = $1', [cidade.toUpperCase()]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao deletar preço' });
  }
});

router.get('/ctrcs-sem-preco', async (req, res) => {
  try {
    const { inicio, fim } = req.query;
    const resultado = await getCidadesSemPreco(inicio || null, fim || null);
    res.json(resultado);
  } catch (err) {
    console.error('Erro ao buscar CTRCs sem preço:', err);
    res.status(500).json({ error: 'Erro ao buscar CTRCs sem preço' });
  }
});

router.get('/eficiencia-motoristas', async (req, res) => {
  try {
    const { inicio, fim, tipo } = req.query;
    const data = await getEficienciaTodos(inicio || null, fim || null, tipo || null);
    res.json(data);
  } catch (err) {
    console.error('Erro ao buscar eficiência dos motoristas:', err);
    res.status(500).json({ error: 'Erro ao buscar eficiência dos motoristas' });
  }
});

router.get('/app-usage-motoristas', async (req, res) => {
  try {
    const { inicio, fim, tipo } = req.query;
    const data = await getAppUsageTodos(inicio || null, fim || null, tipo || null);
    res.json(data);
  } catch (err) {
    console.error('Erro ao buscar uso do app:', err);
    res.status(500).json({ error: 'Erro ao buscar uso do app' });
  }
});

router.get('/ctrcs-parados', async (req, res) => {
  try {
    const data = await getCtrcsParados();
    res.json(data);
  } catch (err) {
    console.error('Erro ao buscar CTRCs parados:', err);
    res.status(500).json({ error: 'Erro ao buscar CTRCs parados' });
  }
});

router.get('/ctrcs-parados-detalhado', async (req, res) => {
  try {
    const data = await getCtrcsParadosDetalhado();
    res.json(data);
  } catch (err) {
    console.error('Erro ao buscar CTRCs parados detalhado:', err);
    res.status(500).json({ error: 'Erro ao buscar CTRCs parados detalhado' });
  }
});

router.get('/unidades', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT unidade_receptora AS unidade
      FROM ssw_455
      WHERE unidade_receptora IS NOT NULL AND unidade_receptora != ''
      ORDER BY unidade_receptora
    `);
    res.json(rows.map(r => r.unidade));
  } catch (err) {
    console.error('Erro ao buscar unidades:', err);
    res.status(500).json({ error: 'Erro ao buscar unidades' });
  }
});

router.get('/gestao', async (req, res) => {
  try {
    const { inicio, fim, unidade } = req.query;
    const params = [];
    const conditions = ['p.ativo = true'];

    if (inicio) { params.push(inicio); conditions.push(`v.data_emissao >= $${params.length}::date`); }
    if (fim) { params.push(fim); conditions.push(`v.data_emissao <= $${params.length}::date`); }
    if (unidade) { params.push(unidade); conditions.push(`v.unidade_receptora = $${params.length}`); }

    conditions.push('v.previsao_entrega IS NOT NULL');

    const where = `WHERE ${conditions.join(' AND ')}`;

    const { rows: dados } = await pool.query(`
      SELECT * FROM (
        SELECT
          COALESCE(p.nome_simplificado, v.cliente_pagador) AS cliente,
          CASE
            WHEN v.previsao_entrega < CURRENT_DATE THEN 'Vencido'
            WHEN v.previsao_entrega = CURRENT_DATE THEN 'Vence hoje'
            ELSE 'A Vencer'
          END AS status_prazo,
          COUNT(*) FILTER (WHERE COALESCE(oc.resumo, 'Na filial') = 'Em rota')::int AS em_rota,
          COUNT(*) FILTER (WHERE COALESCE(oc.resumo, 'Na filial') = 'Na filial')::int AS na_filial,
          COUNT(*) FILTER (WHERE COALESCE(oc.resumo, 'Na filial') = 'Insucesso')::int AS insucesso,
          COUNT(*) FILTER (WHERE COALESCE(oc.resumo, 'Na filial') = 'Devolução')::int AS devolucao,
          COUNT(*) FILTER (WHERE COALESCE(oc.resumo, 'Na filial') = 'Agendado')::int AS agendado,
          COUNT(*) FILTER (WHERE COALESCE(oc.resumo, 'Na filial') = 'Transferência')::int AS transferencia
        FROM ssw_455 v
        JOIN pagadores p ON p.cnpj = v.cnpj_pagador
        LEFT JOIN ocorrencia_catalogo oc ON UPPER(v.ocorrencia) LIKE UPPER(oc.descricao) || '%'
        ${where}
        GROUP BY 1, 2
      ) sub
      ORDER BY sub.cliente,
        CASE sub.status_prazo WHEN 'A Vencer' THEN 1 WHEN 'Vence hoje' THEN 2 WHEN 'Vencido' THEN 3 END
    `, params);

    const { rows: [totais] } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE COALESCE(oc.resumo, 'Na filial') = 'Em rota')::int AS em_rota,
        COUNT(*) FILTER (WHERE COALESCE(oc.resumo, 'Na filial') = 'Na filial')::int AS na_filial,
        COUNT(*) FILTER (WHERE COALESCE(oc.resumo, 'Na filial') = 'Insucesso')::int AS insucesso,
        COUNT(*) FILTER (WHERE COALESCE(oc.resumo, 'Na filial') = 'Devolução')::int AS devolucao,
        COUNT(*) FILTER (WHERE COALESCE(oc.resumo, 'Na filial') = 'Agendado')::int AS agendado,
        COUNT(*) FILTER (WHERE COALESCE(oc.resumo, 'Na filial') = 'Transferência')::int AS transferencia
      FROM ssw_455 v
      JOIN pagadores p ON p.cnpj = v.cnpj_pagador
      LEFT JOIN ocorrencia_catalogo oc ON UPPER(v.ocorrencia) LIKE UPPER(oc.descricao) || '%'
      ${where}
    `, params);

    res.json({ dados, totais: totais || {} });
  } catch (err) {
    console.error('Erro ao buscar dados da gestão:', err);
    res.status(500).json({ error: 'Erro ao buscar dados da gestão' });
  }
});

router.post('/motoristas/:cpf/enviar-senha', requireRole('admin', 'operador'), async (req, res) => {
  try {
    const { cpf } = req.params;
    const { rows } = await pool.query('SELECT cpf, nome, email FROM motoristas WHERE cpf = $1', [cpf]);
    if (rows.length === 0) return res.status(404).json({ error: 'Motorista não encontrado' });

    const motorista = rows[0];
    if (!motorista.email) return res.status(400).json({ error: 'Motorista não possui e-mail cadastrado' });

    const senha = Math.random().toString(36).slice(-8).toUpperCase();
    const hash = await bcrypt.hash(senha, 10);
    await pool.query('UPDATE motoristas SET password_hash = $1 WHERE cpf = $2', [hash, cpf]);
    await enviarSenhaPorEmail(motorista.email, motorista.nome, senha);

    res.json({ success: true, message: `Senha enviada para ${motorista.email}` });
  } catch (err) {
    console.error('Erro ao enviar senha:', err);
    res.status(500).json({ error: err.message || 'Erro ao enviar senha' });
  }
});

export default router;
