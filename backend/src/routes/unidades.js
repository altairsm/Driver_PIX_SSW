import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
  listarUnidades, listarUnidadesAtivas, criarUnidade, atualizarUnidade, deletarUnidade
} from '../services/unidadesService.js';

const router = Router();

router.get('/unidades', async (req, res) => {
  try {
    const apenasAtivas = req.query.ativas === 'true';
    const unidades = apenasAtivas ? await listarUnidadesAtivas() : await listarUnidades();
    res.json(unidades);
  } catch (err) {
    console.error('Erro ao listar unidades:', err);
    res.status(500).json({ error: 'Erro ao listar unidades' });
  }
});

router.post('/unidades', requireRole('admin'), async (req, res) => {
  try {
    const { nome, sigla } = req.body;
    if (!nome || !sigla) {
      return res.status(400).json({ error: 'Nome e sigla são obrigatórios' });
    }
    const unidade = await criarUnidade(req.body);
    res.status(201).json(unidade);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Sigla já cadastrada' });
    }
    console.error('Erro ao criar unidade:', err);
    res.status(500).json({ error: 'Erro ao criar unidade' });
  }
});

router.put('/unidades/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const atualizado = await atualizarUnidade(id, req.body);
    if (!atualizado) return res.status(404).json({ error: 'Unidade não encontrada' });
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Sigla já cadastrada' });
    }
    console.error('Erro ao atualizar unidade:', err);
    res.status(500).json({ error: 'Erro ao atualizar unidade' });
  }
});

router.delete('/unidades/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const deletado = await deletarUnidade(id);
    if (!deletado) return res.status(404).json({ error: 'Unidade não encontrada' });
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao deletar unidade:', err);
    res.status(500).json({ error: 'Erro ao deletar unidade' });
  }
});

export default router;
