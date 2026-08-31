import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.config?.url?.includes('fcm-token') || err.config?.url?.includes('/upload/')) {
      return Promise.reject(err);
    }
    const status = err.response?.status;
    const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
    const isNetwork = !err.response && err.request;
    if (status === 401 || status === 403 || isTimeout || isNetwork) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// Auth
export async function login(identifier, password) {
  const clean = identifier.replace(/\D/g, '');
  const isCpf = /^\d{11}$/.test(clean);
  const payload = isCpf ? { cpf: clean, password } : { email: identifier, password };
  const { data } = await api.post('/auth/login', payload);
  return data;
}

export async function adminLogin(username, password) {
  return login(username, password);
}

export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

// Driver
export async function getDriverDashboard(inicio, fim) {
  const { data } = await api.get('/driver/dashboard', { params: { inicio, fim } });
  return data;
}

export async function getDriverRomaneios(inicio, fim) {
  const { data } = await api.get('/driver/romaneios', { params: { inicio, fim } });
  return data;
}

export async function getDriverRomaneioDetalhes(id, inicio, fim) {
  const { data } = await api.get(`/driver/romaneios/${id}`, { params: { inicio, fim } });
  return data;
}

export async function getQuinzenas() {
  const { data } = await api.get('/driver/quinzenas');
  return data;
}

export async function getProdutividade(inicio, fim) {
  const { data } = await api.get('/driver/produtividade', { params: { inicio, fim } });
  return data;
}

export async function getEficiencia() {
  const { data } = await api.get('/driver/eficiencia');
  return data;
}

export async function solicitarPagamento(id_romaneio) {
  const { data } = await api.post('/driver/solicitar-pagamento', { id_romaneio });
  return data;
}

export async function getDriverMe() {
  const { data } = await api.get('/driver/me');
  return data;
}

export async function getDriverDados() {
  const { data } = await api.get('/driver/dados');
  return data;
}

export async function updateDriverDados(dados) {
  const { data } = await api.put('/driver/dados', dados);
  return data;
}

export async function confirmarRegras() {
  const { data } = await api.post('/driver/confirmar-regras');
  return data;
}

export async function saveFcmToken(token) {
  const { data } = await api.post('/driver/fcm-token', { token });
  return data;
}

export async function getBonusD0(inicio, fim) {
  const { data } = await api.get('/driver/bonus-d0', { params: { inicio, fim } });
  return data;
}

export async function getAppUsage(inicio, fim) {
  const { data } = await api.get('/driver/app-usage', { params: { inicio, fim } });
  return data;
}

// Admin
export async function getAdminQuinzenas() {
  const { data } = await api.get('/admin/quinzenas');
  return data;
}

export async function getPagamentos(inicio, fim) {
  const { data } = await api.get('/admin/pagamentos', { params: { inicio, fim } });
  return data;
}

export async function getResumo(inicio, fim, unidade) {
  const params = { inicio, fim };
  if (unidade) params.unidade = unidade;
  const { data } = await api.get('/admin/resumo', { params });
  return data;
}

export async function confirmarPagamento(cpf, inicio, fim, pagamento) {
  const { data } = await api.post('/admin/confirmar-pagamento', { cpf, inicio, fim, pagamento });
  return data;
}

export async function getMotoristas() {
  const { data } = await api.get('/admin/motoristas');
  return data;
}

export async function createMotorista(dados) {
  const { data } = await api.post('/admin/motoristas', dados);
  return data;
}

export async function updateMotorista(cpf, dados) {
  const { data } = await api.put(`/admin/motoristas/${cpf}`, dados);
  return data;
}

export async function deleteMotorista(cpf) {
  const { data } = await api.delete(`/admin/motoristas/${cpf}`);
  return data;
}

export async function getAjudantes(unidade) {
  const params = {};
  if (unidade) params.unidade = unidade;
  const { data } = await api.get('/admin/ajudantes', { params });
  return data;
}

export async function createAjudante(dados) {
  const { data } = await api.post('/admin/ajudantes', dados);
  return data;
}

export async function updateAjudante(codigo, dados) {
  const { data } = await api.put(`/admin/ajudantes/${codigo}`, dados);
  return data;
}

export async function deleteAjudante(codigo) {
  const { data } = await api.delete(`/admin/ajudantes/${codigo}`);
  return data;
}

export async function sendMotoristaPassword(cpf) {
  const { data } = await api.post(`/admin/motoristas/${cpf}/enviar-senha`);
  return data;
}

export async function getSolicitacoes(status) {
  const { data } = await api.get('/admin/solicitacoes', { params: { status } });
  return data;
}

export async function aprovarSolicitacao(id) {
  const { data } = await api.post(`/admin/solicitacoes/${id}/aprovar`);
  return data;
}

export async function recusarSolicitacao(id) {
  const { data } = await api.post(`/admin/solicitacoes/${id}/recusar`);
  return data;
}

// Config
export async function getConfig() {
  const { data } = await api.get('/configuracoes');
  return data;
}

export async function updateConfig(dados) {
  const { data } = await api.put('/configuracoes', dados);
  return data;
}

export async function getTaxasAdiantamento() {
  const { data } = await api.get('/taxas-adiantamento');
  return data;
}

export async function updateTaxasAdiantamento(dados) {
  const { data } = await api.put('/taxas-adiantamento', dados);
  return data;
}

// SSW Upload
export async function uploadSswCsv(file, tipo) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post(`/upload/ssw-${tipo}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  });
  return data;
}

export async function previewSswCsv(file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/upload/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// Precos Cidades
export async function getPrecosCidades() {
  const { data } = await api.get('/admin/precos-cidades');
  return data;
}

export async function updatePrecoCidade(cidade, valor_entrega) {
  const { data } = await api.put('/admin/precos-cidades', { cidade, valor_entrega });
  return data;
}

export async function deletePrecoCidade(cidade) {
  const { data } = await api.delete(`/admin/precos-cidades/${encodeURIComponent(cidade)}`);
  return data;
}

// CTRCs sem preco
export async function getCtrcsSemPreco(inicio, fim) {
  const { data } = await api.get('/admin/ctrcs-sem-preco', { params: { inicio, fim } });
  return data;
}

// Admin Dashboard
export async function getEficienciaMotoristas(inicio, fim, tipo, unidade) {
  const params = {};
  if (inicio) params.inicio = inicio;
  if (fim) params.fim = fim;
  if (tipo) params.tipo = tipo;
  if (unidade) params.unidade = unidade;
  const { data } = await api.get('/admin/eficiencia-motoristas', { params });
  return data;
}

export async function getAppUsageMotoristas(inicio, fim, tipo, unidade) {
  const params = {};
  if (inicio) params.inicio = inicio;
  if (fim) params.fim = fim;
  if (tipo) params.tipo = tipo;
  if (unidade) params.unidade = unidade;
  const { data } = await api.get('/admin/app-usage-motoristas', { params });
  return data;
}

export async function getAppUsageAjudantes(inicio, fim, tipo, unidade) {
  const params = {};
  if (inicio) params.inicio = inicio;
  if (fim) params.fim = fim;
  if (tipo) params.tipo = tipo;
  if (unidade) params.unidade = unidade;
  const { data } = await api.get('/admin/app-usage-ajudantes', { params });
  return data;
}

export async function getEscoamento(inicio, fim, unidade) {
  const params = {};
  if (inicio) params.inicio = inicio;
  if (fim) params.fim = fim;
  if (unidade) params.unidade = unidade;
  const { data } = await api.get('/admin/escoamento', { params });
  return data;
}

// Rede (synapse)
export async function getRede(inicio, fim, unidade, cliente) {
  const params = { inicio, fim };
  if (unidade) params.unidade = unidade;
  if (cliente) params.cliente = cliente;
  const { data } = await api.get('/admin/rede', { params });
  return data;
}

export async function getRedePeriodo() {
  const { data } = await api.get('/admin/rede/periodo');
  return data;
}

export async function getCtrcsParados(unidade) {
  const params = {};
  if (unidade) params.unidade = unidade;
  const { data } = await api.get('/admin/ctrcs-parados', { params });
  return data;
}

export async function getCtrcsParadosDetalhado(unidade) {
  const params = {};
  if (unidade) params.unidade = unidade;
  const { data } = await api.get('/admin/ctrcs-parados-detalhado', { params });
  return data;
}

// Pagadores
export async function getPagadores() {
  const { data } = await api.get('/admin/pagadores');
  return data;
}

export async function createPagador(dados) {
  const { data } = await api.post('/admin/pagadores', dados);
  return data;
}

export async function updatePagador(id, dados) {
  const { data } = await api.put(`/admin/pagadores/${id}`, dados);
  return data;
}

export async function deletePagador(id) {
  const { data } = await api.delete(`/admin/pagadores/${id}`);
  return data;
}

export async function getResumoPagador(cnpj, inicio, fim) {
  const { data } = await api.get(`/admin/pagadores/${cnpj}/resumo`, { params: { inicio, fim } });
  return data;
}

// Unidades
export async function getUnidades() {
  const { data } = await api.get('/admin/unidades');
  return data.filter(u => u.ativo !== false).map(u => u.sigla);
}

export async function getUnidadesAll() {
  const { data } = await api.get('/admin/unidades');
  return data;
}

export async function createUnidade(dados) {
  const { data } = await api.post('/admin/unidades', dados);
  return data;
}

export async function updateUnidade(id, dados) {
  const { data } = await api.put(`/admin/unidades/${id}`, dados);
  return data;
}

export async function deleteUnidade(id) {
  const { data } = await api.delete(`/admin/unidades/${id}`);
  return data;
}

// Gestão
export async function getGestao(inicio, fim, unidade) {
  const params = {};
  if (inicio) params.inicio = inicio;
  if (fim) params.fim = fim;
  if (unidade) params.unidade = unidade;
  const { data } = await api.get('/admin/gestao', { params });
  return data;
}

export async function getGestaoDetalhe(cliente, status_prazo, resumo, inicio, fim, unidade) {
  const params = {};
  if (cliente) params.cliente = cliente;
  if (status_prazo) params.status_prazo = status_prazo;
  if (resumo) params.resumo = resumo;
  if (inicio) params.inicio = inicio;
  if (fim) params.fim = fim;
  if (unidade) params.unidade = unidade;
  const { data } = await api.get('/admin/gestao/detalhe', { params });
  return data;
}

export async function exportGestao(inicio, fim, unidade) {
  const params = {};
  if (inicio) params.inicio = inicio;
  if (fim) params.fim = fim;
  if (unidade) params.unidade = unidade;
  const { data } = await api.get('/admin/gestao/export', { params, timeout: 300000 });
  return data;
}

export async function getExpedicao(unidade) {
  const params = {};
  if (unidade) params.unidade = unidade;
  const { data } = await api.get('/admin/expedicao', { params });
  return data;
}

export async function getExpedicaoAgrupada(unidade) {
  const params = {};
  if (unidade) params.unidade = unidade;
  const { data } = await api.get('/admin/expedicao-agrupada', { params });
  return data;
}

// Upload SSW 455
export async function uploadSsw455(file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/upload/ssw-455', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  });
  return data;
}

export async function uploadSsw930(file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/upload/ssw-930', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  });
  return data;
}

// Ocorrências
export async function getOcorrencias() {
  const { data } = await api.get('/admin/ocorrencias');
  return data;
}

export async function createOcorrencia(dados) {
  const { data } = await api.post('/admin/ocorrencias', dados);
  return data;
}

export async function updateOcorrencia(id, dados) {
  const { data } = await api.put(`/admin/ocorrencias/${id}`, dados);
  return data;
}

export async function deleteOcorrencia(id) {
  const { data } = await api.delete(`/admin/ocorrencias/${id}`);
  return data;
}

export default api;
