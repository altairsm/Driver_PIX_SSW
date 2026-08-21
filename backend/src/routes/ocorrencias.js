import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
  listarOcorrencias, criarOcorrencia, atualizarOcorrencia, deletarOcorrencia
} from '../services/ocorrenciaService.js';

const router = Router();

router.get('/ocorrencias', async (req, res) => {
  try {
    const ocorrencias = await listarOcorrencias();
    res.json(ocorrencias);
  } catch (err) {
    console.error('Erro ao listar ocorrencias:', err);
    res.status(500).json({ error: 'Erro ao listar ocorrencias' });
  }
});

router.post('/ocorrencias', requireRole('admin'), async (req, res) => {
  try {
    const { descricao } = req.body;
    if (!descricao) return res.status(400).json({ error: 'Descricao e obrigatoria' });
    const ocorrencia = await criarOcorrencia(req.body);
    res.status(201).json(ocorrencia);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ocorrencia ja cadastrada' });
    console.error('Erro ao criar ocorrencia:', err);
    res.status(500).json({ error: err.message || 'Erro ao criar ocorrencia' });
  }
});

router.put('/ocorrencias/:id', requireRole('admin'), async (req, res) => {
  try {
    const atualizada = await atualizarOcorrencia(req.params.id, req.body);
    if (!atualizada) return res.status(404).json({ error: 'Ocorrencia nao encontrada' });
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ocorrencia ja cadastrada' });
    console.error('Erro ao atualizar ocorrencia:', err);
    res.status(500).json({ error: 'Erro ao atualizar ocorrencia' });
  }
});

router.delete('/ocorrencias/:id', requireRole('admin'), async (req, res) => {
  try {
    const deletada = await deletarOcorrencia(req.params.id);
    if (!deletada) return res.status(404).json({ error: 'Ocorrencia nao encontrada' });
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao deletar ocorrencia:', err);
    res.status(500).json({ error: 'Erro ao deletar ocorrencia' });
  }
});

export default router;
