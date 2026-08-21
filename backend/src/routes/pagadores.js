import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
  listarPagadores, criarPagador, atualizarPagador, deletarPagador, resumoPagador
} from '../services/pagadoresService.js';

const router = Router();

router.get('/pagadores', async (req, res) => {
  try {
    const pagadores = await listarPagadores();
    res.json(pagadores);
  } catch (err) {
    console.error('Erro ao listar pagadores:', err);
    res.status(500).json({ error: 'Erro ao listar pagadores' });
  }
});

router.post('/pagadores', requireRole('admin'), async (req, res) => {
  try {
    const { cnpj, razao_social } = req.body;
    if (!cnpj || !razao_social) {
      return res.status(400).json({ error: 'CNPJ e razão social são obrigatórios' });
    }
    const pagador = await criarPagador(req.body);
    res.status(201).json(pagador);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'CNPJ já cadastrado' });
    }
    console.error('Erro ao criar pagador:', err);
    res.status(500).json({ error: 'Erro ao criar pagador' });
  }
});

router.put('/pagadores/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const atualizado = await atualizarPagador(id, req.body);
    if (!atualizado) return res.status(404).json({ error: 'Pagador não encontrado' });
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao atualizar pagador:', err);
    res.status(500).json({ error: 'Erro ao atualizar pagador' });
  }
});

router.delete('/pagadores/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const deletado = await deletarPagador(id);
    if (!deletado) return res.status(404).json({ error: 'Pagador não encontrado' });
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao deletar pagador:', err);
    res.status(500).json({ error: 'Erro ao deletar pagador' });
  }
});

router.get('/pagadores/:cnpj/resumo', async (req, res) => {
  try {
    const { cnpj } = req.params;
    const { inicio, fim } = req.query;
    const resumo = await resumoPagador(cnpj, inicio || null, fim || null);
    res.json(resumo);
  } catch (err) {
    console.error('Erro ao buscar resumo do pagador:', err);
    res.status(500).json({ error: 'Erro ao buscar resumo do pagador' });
  }
});

export default router;
