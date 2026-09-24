import { Router } from 'express';
import { pool } from '../db/index.js';

const router = Router();

function requireApiKey(req, res, next) {
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const key = req.get('x-api-key') || bearer;
  if (!process.env.EXTERNAL_API_KEY || key !== process.env.EXTERNAL_API_KEY) {
    return res.status(401).json({ error: 'API key inválida' });
  }
  next();
}

router.use(requireApiKey);

router.get('/nf-ajudante/:numero', async (req, res) => {
  try {
    const numero = String(req.params.numero || '').replace(/[^0-9]/g, '');
    if (!numero) return res.status(400).json({ error: 'Número da nota fiscal inválido' });

    const { rows } = await pool.query(`
      SELECT
        a.codigo,
        a.nome,
        a.celular,
        v.ctrc,
        v.unidade_receptora AS unidade
      FROM ssw_455 v
      LEFT JOIN ssw_ctrcs c ON c.ctrc = v.ctrc_normalizado
      LEFT JOIN ssw_romaneios r ON r.id_romaneio = c.id_romaneio
      LEFT JOIN ajudantes a ON a.codigo = r.ajudante_codigo
      WHERE REGEXP_REPLACE(v.numero_nota_fiscal, '[^0-9]', '', 'g') = $1
      ORDER BY v.data_emissao DESC NULLS LAST, v.data_ultima_ocorrencia DESC NULLS LAST
      LIMIT 1
    `, [numero]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    }

    const r = rows[0];
    res.json({
      codigo: r.codigo || null,
      nome: r.nome || null,
      celular: r.celular || null,
      ctrc: r.ctrc,
      unidade: r.unidade || null,
    });
  } catch (err) {
    console.error('Erro ao consultar NF:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;