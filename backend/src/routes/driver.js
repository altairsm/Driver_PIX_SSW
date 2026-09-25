import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getDriverData, getDriverDashboard, getDriverRomaneios, getDriverRomaneioDetalhes,
  getQuinzenasDisponiveis, getProdutividade, getEficiencia,
  solicitarPagamento,
  getDriverDados, atualizarDriverDados, confirmarRegras,
  getBonusD0, getAppUsage
} from '../services/driverService.js';

const router = Router();

router.use(authenticateToken);

router.get('/me', async (req, res) => {
  try {
    const driver = await getDriverData(req.user.cpf);
    if (!driver) return res.status(404).json({ error: 'Motorista não encontrado' });
    res.json(driver);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const { inicio, fim } = req.query;
    const dashboard = await getDriverDashboard(req.user.cpf, inicio || null, fim || null);
    const driver = await getDriverData(req.user.cpf);
    res.json({ ...dashboard, nome: driver?.nome, cpf: req.user.cpf });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/romaneios', async (req, res) => {
  try {
    const { inicio, fim } = req.query;
    const romaneios = await getDriverRomaneios(req.user.cpf, inicio || null, fim || null);
    res.json(romaneios);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/romaneios/:id', async (req, res) => {
  try {
    const { inicio, fim } = req.query;
    const detalhes = await getDriverRomaneioDetalhes(req.user.cpf, req.params.id, inicio || null, fim || null);
    res.json(detalhes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/quinzenas', async (req, res) => {
  try {
    const quinzenas = await getQuinzenasDisponiveis(req.user.cpf);
    res.json(quinzenas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/produtividade', async (req, res) => {
  try {
    const { inicio, fim } = req.query;
    if (!inicio || !fim) return res.status(400).json({ error: 'inicio e fim são obrigatórios' });
    const data = await getProdutividade(req.user.cpf, inicio, fim);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/eficiencia', async (req, res) => {
  try {
    const data = await getEficiencia(req.user.cpf);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/solicitar-pagamento', async (req, res) => {
  try {
    const { id_romaneio } = req.body;
    if (!id_romaneio) {
      return res.status(400).json({ error: 'id_romaneio é obrigatório' });
    }
    const result = await solicitarPagamento(req.user.cpf, id_romaneio);
    if (!result.success) {
      return res.status(400).json({ error: result.motivo });
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/dados', async (req, res) => {
  try {
    const dados = await getDriverDados(req.user.cpf);
    if (!dados) return res.status(404).json({ error: 'Motorista não encontrado' });
    res.json(dados);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.put('/dados', async (req, res) => {
  try {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'telefone')) {
      return res.status(409).json({ error: 'O celular é mantido exclusivamente pela administração', code: 'TELEFONE_PROTEGIDO' });
    }
    const { cnpj_mei, pix_tipo } = req.body;
    const result = await atualizarDriverDados(req.user.cpf, { cnpj_mei, pix_tipo });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/confirmar-regras', async (req, res) => {
  try {
    const result = await confirmarRegras(req.user.cpf);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/app-usage', async (req, res) => {
  try {
    const { inicio, fim } = req.query;
    if (!inicio || !fim) return res.status(400).json({ error: 'inicio e fim são obrigatórios' });
    const data = await getAppUsage(req.user.cpf, inicio, fim);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/bonus-d0', async (req, res) => {
  try {
    const { inicio, fim } = req.query;
    if (!inicio || !fim) return res.status(400).json({ error: 'inicio e fim são obrigatórios' });
    const data = await getBonusD0(req.user.cpf, inicio, fim);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
