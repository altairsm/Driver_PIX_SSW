import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { parseCSV, importarSsw036, importarSsw455 } from '../services/csvService.js';

const uploadDir = path.resolve('uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos .csv são permitidos'));
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 },
});

const router = Router();

router.post('/ssw-036', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const rows = parseCSV(req.file.path, 2);
    const result = await importarSsw036(rows);

    fs.unlink(req.file.path, () => {});

    res.json({
      success: true,
      total_lidos: rows.length,
      ...result,
    });
  } catch (err) {
    console.error('Erro ao processar CSV 036:', err);
    res.status(500).json({ error: `Erro ao processar arquivo: ${err.message}` });
  }
});

router.post('/ssw-455', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const rows = parseCSV(req.file.path, 2);
    const result = await importarSsw455(rows);

    fs.unlink(req.file.path, () => {});

    res.json({
      success: true,
      total_lidos: rows.length,
      ...result,
    });
  } catch (err) {
    console.error('Erro ao processar CSV 455:', err);
    res.status(500).json({ error: `Erro ao processar arquivo: ${err.message}` });
  }
});

router.post('/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const rows = parseCSV(req.file.path);
    fs.unlink(req.file.path, () => {});

    const amostra = rows.slice(0, 50);
    const colunas = amostra.length > 0 ? Object.keys(amostra[0]) : [];

    res.json({
      total_linhas: rows.length,
      colunas,
      amostra,
    });
  } catch (err) {
    res.status(500).json({ error: `Erro ao processar arquivo: ${err.message}` });
  }
});

export default router;
