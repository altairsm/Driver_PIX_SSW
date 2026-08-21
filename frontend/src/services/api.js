import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
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
    if (err.response?.status === 401 || err.response?.status === 403) {
      if (err.config?.url?.includes('fcm-token')) {
        return Promise.reject(err);
      }
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
export async function getEficienciaMotoristas(inicio, fim, tipo) {
  const params = {};
  if (inicio) params.inicio = inicio;
  if (fim) params.fim = fim;
  if (tipo) params.tipo = tipo;
  const { data } = await api.get('/admin/eficiencia-motoristas', { params });
  return data;
}

export async function getAppUsageMotoristas(inicio, fim, tipo) {
  const params = {};
  if (inicio) params.inicio = inicio;
  if (fim) params.fim = fim;
  if (tipo) params.tipo = tipo;
  const { data } = await api.get('/admin/app-usage-motoristas', { params });
  return data;
}

export async function getCtrcsParados() {
  const { data } = await api.get('/admin/ctrcs-parados');
  return data;
}

export async function getCtrcsParadosDetalhado() {
  const { data } = await api.get('/admin/ctrcs-parados-detalhado');
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

// Upload SSW 455
export async function uploadSsw455(file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/upload/ssw-455', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
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
