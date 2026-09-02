import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import driverRoutes from './routes/driver.js';
import adminRoutes from './routes/admin.js';
import uploadRoutes from './routes/upload.js';
import configuracoesRoutes from './routes/configuracoes.js';
import taxasAdiantamentoRoutes from './routes/taxasAdiantamento.js';
import solicitacoesRoutes from './routes/solicitacoes.js';
import pagadoresRoutes from './routes/pagadores.js';
import ocorrenciasRoutes from './routes/ocorrencias.js';
import unidadesRoutes from './routes/unidades.js';
import { authenticateToken, requireAdmin, requireRole } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

function getVersionFile(filename, fallback) {
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    return readFileSync(join(dir, '..', filename), 'utf8').trim();
  } catch { return fallback; }
}

function getCommitHash() {
  return getVersionFile('.commit', 'unknown');
}

function getVersion() {
  return getVersionFile('.version', 'dev');
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/version', (req, res) => {
  res.json({ commit: getCommitHash(), version: getVersion() });
});

app.use('/auth', authRoutes);
app.use('/driver', driverRoutes);
app.use('/admin', authenticateToken, requireRole('admin', 'operador', 'consulta', 'financeiro'));
app.use('/admin', adminRoutes);
app.use('/upload', authenticateToken, requireRole('admin', 'operador'), uploadRoutes);
app.use('/configuracoes', authenticateToken, configuracoesRoutes);
app.use('/taxas-adiantamento', authenticateToken, taxasAdiantamentoRoutes);
app.use('/admin', authenticateToken, requireRole('admin', 'operador', 'consulta', 'financeiro'), solicitacoesRoutes);
app.use('/admin', authenticateToken, requireRole('admin', 'operador', 'consulta', 'financeiro'), pagadoresRoutes);
app.use('/admin', authenticateToken, requireRole('admin', 'operador', 'consulta', 'financeiro'), ocorrenciasRoutes);
app.use('/admin', authenticateToken, requireRole('admin', 'operador', 'consulta', 'financeiro'), unidadesRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Erro interno do servidor' });
});

import { runMigrations } from './db/migrate.js';

async function start() {
  try {
    await runMigrations();
  } catch (err) {
    console.error('Migration failed, starting anyway:', err);
  }
  app.listen(PORT, () => {
    console.log(`SSW API running on http://localhost:${PORT}`);
  });
}

start();
