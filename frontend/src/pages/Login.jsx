import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('auth_error');
      if (saved) {
        const info = JSON.parse(saved);
        setError(`Erro de autenticação em "${info.url}" (${info.status}).`);
        sessionStorage.removeItem('auth_error');
      }
    } catch {}
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const clean = identifier.replace(/\D/g, '');
      const isCpf = /^\d{11}$/.test(clean);
      const data = await login(isCpf ? clean : identifier, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      const role = data.user.role || 'motorista';
      if (role === 'motorista') {
        if (data.user.leu_regras) {
          navigate('/driver');
        } else {
          navigate('/driver/regras-pagamento');
        }
      } else {
        navigate('/admin/operacional');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.container}>
      <div style={s.card}>
        <div style={s.cardAccent} />
        <div style={s.cardContent}>
          <div style={s.logo}>SSW TRANSPORTES</div>
          <div style={s.subtitle}>Portal de Acesso</div>

          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>CPF ou E-mail</label>
              <input
                style={s.input}
                type="text"
                placeholder="000.000.000-00 ou e-mail"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Senha</label>
              <input
                style={s.input}
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <div style={s.error}>{error}</div>}
            <button type="submit" style={{ ...s.button, opacity: loading ? 0.6 : 1 }} disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div style={s.hint}>
            Motorista sem acesso? Solicite ao administrador.
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: '#0d0f14', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  card: { background: '#161920', border: '1px solid #2a2f3e', borderTop: '3px solid #f0c040', width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 },
  cardAccent: { position: 'absolute', top: -1, left: 40, right: 40, height: 3, background: '#f0c040', filter: 'blur(6px)', opacity: 0.6 },
  cardContent: { padding: '48px 40px' },
  logo: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', letterSpacing: '4px', color: '#f0c040', textAlign: 'center', marginBottom: 4 },
  subtitle: { color: '#6b7280', textAlign: 'center', marginBottom: 32, fontSize: '0.9rem' },
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { color: '#9ca3af', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' },
  input: { background: '#1e2230', border: '1px solid #2a2f3e', color: '#e8eaf0', padding: '12px 16px', fontSize: '1rem', borderRadius: 4, outline: 'none', fontFamily: "'IBM Plex Mono', monospace" },
  button: { background: '#f0c040', color: '#0d0f14', border: 'none', padding: '14px', fontSize: '1rem', fontWeight: 600, borderRadius: 4, cursor: 'pointer', marginTop: 8 },
  error: { color: '#ff5a5a', fontSize: '0.85rem', textAlign: 'center' },
  hint: { color: '#4b5563', textAlign: 'center', marginTop: 24, fontSize: '0.8rem' },
};
