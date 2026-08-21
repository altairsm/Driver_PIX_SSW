import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { initNotifications } from './services/notificationService'
import Login from './pages/Login'
import DriverDashboard from './pages/DriverDashboard'
import DriverRegrasPagamento from './pages/DriverRegrasPagamento'
import MeusDados from './pages/MeusDados'
import AdminPagamentos from './pages/AdminPagamentos'
import AdminSswUpload from './pages/AdminSswUpload'
import AdminMotoristas from './pages/AdminMotoristas'
import AdminSolicitacoesPagamento from './pages/AdminSolicitacoesPagamento'
import AdminConfiguracoes from './pages/AdminConfiguracoes'
import AdminTaxasAdiantamento from './pages/AdminTaxasAdiantamento'
import AdminSswPrecos from './pages/AdminSswPrecos'
import AdminCidadesSemPreco from './pages/AdminCidadesSemPreco'
import AdminDashboard from './pages/AdminDashboard'
import AdminPagadores from './pages/AdminPagadores'
import AdminGestao from './pages/AdminGestao'
import AdminOcorrencias from './pages/AdminOcorrencias'

const spinKeyframes = `@keyframes spin { to { transform: rotate(360deg); } }`;
const loadingStyle = {
  minHeight: '100vh', background: '#0d0f14', display: 'flex',
  flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#6b7280',
  fontFamily: "'IBM Plex Mono', monospace",
};
const spinnerStyle = {
  width: 36, height: 36, border: '3px solid #2a2f3e', borderTopColor: '#f0c040',
  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
};

function ProtectedRoute({ children }) {
  const [valid, setValid] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setValid(false); return; }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(d => {
        localStorage.setItem('user', JSON.stringify(d.user));
        setValid(true);
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setValid(false);
      })
      .finally(() => clearTimeout(timer));

    return () => { clearTimeout(timer); controller.abort(); };
  }, []);

  if (valid === null) {
    return (
      <div style={loadingStyle}>
        <style>{spinKeyframes}</style>
        <div style={spinnerStyle}></div>
        <span>CARREGANDO...</span>
      </div>
    );
  }
  if (!valid) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  useEffect(() => {
    initNotifications().catch(err => console.error('Erro ao inicializar notificações:', err));
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/driver" element={<ProtectedRoute><DriverDashboard /></ProtectedRoute>} />
      <Route path="/driver/regras-pagamento" element={<ProtectedRoute><DriverRegrasPagamento /></ProtectedRoute>} />
      <Route path="/driver/meus-dados" element={<ProtectedRoute><MeusDados /></ProtectedRoute>} />
      <Route path="/admin/pagamentos" element={<ProtectedRoute><AdminPagamentos /></ProtectedRoute>} />
      <Route path="/admin/upload" element={<ProtectedRoute><AdminSswUpload /></ProtectedRoute>} />
      <Route path="/admin/motoristas" element={<ProtectedRoute><AdminMotoristas /></ProtectedRoute>} />
      <Route path="/admin/solicitacoes-pagamento" element={<ProtectedRoute><AdminSolicitacoesPagamento /></ProtectedRoute>} />
      <Route path="/admin/configuracoes" element={<ProtectedRoute><AdminConfiguracoes /></ProtectedRoute>} />
      <Route path="/admin/taxas-adiantamento" element={<ProtectedRoute><AdminTaxasAdiantamento /></ProtectedRoute>} />
      <Route path="/admin/precos-cidades" element={<ProtectedRoute><AdminSswPrecos /></ProtectedRoute>} />
      <Route path="/admin/cidades-sem-preco" element={<ProtectedRoute><AdminCidadesSemPreco /></ProtectedRoute>} />
      <Route path="/admin/pagadores" element={<ProtectedRoute><AdminPagadores /></ProtectedRoute>} />
      <Route path="/admin/ocorrencias" element={<ProtectedRoute><AdminOcorrencias /></ProtectedRoute>} />
      <Route path="/admin/gestao" element={<ProtectedRoute><AdminGestao /></ProtectedRoute>} />
      <Route path="/admin/operacional" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
