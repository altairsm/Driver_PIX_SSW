import bcrypt from 'bcrypt';
import { Router } from 'express';
import { pool } from '../db/index.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { cpf, email, password } = req.body;
    const identifier = cpf || email;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identificador e senha são obrigatórios' });
    }

    const clean = identifier.replace(/\D/g, '');
    const isCpf = /^\d{11}$/.test(clean);

    const query = isCpf
      ? 'SELECT cpf, nome, email, role, password_hash, leu_regras, unidade FROM motoristas WHERE cpf = $1'
      : 'SELECT cpf, nome, email, role, password_hash, leu_regras, unidade FROM motoristas WHERE LOWER(email) = LOWER($1)';

    const result = await pool.query(query, [isCpf ? clean : identifier]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(401).json({ error: 'Acesso não configurado. Entre em contato com o administrador.' });
    }

    const senhaValida = await bcrypt.compare(password, user.password_hash);
    if (!senhaValida) {
      return res.status(401).json({ error: 'Senha inválida' });
    }

    const token = generateToken({
      cpf: user.cpf,
      nome: user.nome,
      role: user.role || 'motorista',
      unidade: user.unidade || null,
    });

    res.json({
      token,
      user: { cpf: user.cpf, nome: user.nome, email: user.email, role: user.role || 'motorista', leu_regras: user.leu_regras, unidade: user.unidade || null },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

export default router;
