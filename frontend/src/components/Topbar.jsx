import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';

export const UNIDADE_STORAGE_KEY = 'unidadeSelecionada';

const GRUPOS = [
  {
    nome: 'Desempenho',
    icon: '📊',
    items: [
      { label: 'Operacional', path: '/admin/operacional', roles: ['admin', 'operador', 'consulta'] },
      { label: 'Gestão', path: '/admin/gestao', roles: ['admin', 'operador', 'consulta'] },
      { label: 'Rede', path: '/admin/rede', roles: ['admin', 'operador', 'consulta'] },
    ],
  },
  {
    nome: 'Entregas',
    icon: '🚚',
    items: [
      { label: 'Upload SSW', path: '/admin/upload', roles: ['admin', 'operador'] },
      { label: 'Ocorrencias', path: '/admin/ocorrencias', roles: ['admin', 'operador'] },
    ],
  },
  {
    nome: 'Financeiro',
    icon: '💰',
    items: [
      { label: 'Pagamentos', path: '/admin/pagamentos', roles: ['admin'] },
      { label: 'Adiantamentos', path: '/admin/solicitacoes-pagamento', roles: ['admin'] },
      { label: 'Taxas', path: '/admin/taxas-adiantamento', roles: ['admin'] },
      { label: 'Pagadores', path: '/admin/pagadores', roles: ['admin'] },
      { label: 'Precos Cidades', path: '/admin/precos-cidades', roles: ['admin'] },
      { label: 'Cidades s/ Preco', path: '/admin/cidades-sem-preco', roles: ['admin'] },
    ],
  },
  {
    nome: 'Sistema',
    icon: '⚙️',
    items: [
      { label: 'Motoristas', path: '/admin/motoristas', roles: ['admin'] },
      { label: 'Ajudantes', path: '/admin/ajudantes', roles: ['admin'] },
      { label: 'Unidades', path: '/admin/unidades', roles: ['admin'] },
      { label: 'Configurações', path: '/admin/configuracoes', roles: ['admin'] },
    ],
  },
];

export default function Topbar({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [aberto, setAberto] = useState(null);
  const ref = useRef(null);
  const [version, setVersion] = useState('');
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  })();
  const currentUser = { ...storedUser, ...(user || {}) };
  const userRole = currentUser.role || 'admin';
  const isUnidadeLocked = userRole !== 'admin' && Boolean(currentUser.unidade);
  const [unidades, setUnidades] = useState([]);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState(() => (
    isUnidadeLocked
      ? currentUser.unidade
      : localStorage.getItem(UNIDADE_STORAGE_KEY) || ''
  ));

  useEffect(() => {
    api.get('/version').then(r => setVersion(r.data.version)).catch(() => {});
  }, []);

  useEffect(() => {
    if (isUnidadeLocked && currentUser.unidade) {
      localStorage.setItem(UNIDADE_STORAGE_KEY, currentUser.unidade);
    }

    api.get('/admin/unidades')
      .then(({ data }) => setUnidades(data.filter(u => u.ativo !== false).map(u => u.sigla)))
      .catch(() => {});
  }, [isUnidadeLocked, currentUser.unidade]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setAberto(null);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const grupoAtivo = (g) => g.items.some(i => location.pathname === i.path);

  const navegar = (path) => {
    setAberto(null);
    navigate(path);
  };

  const handleUnidadeChange = (e) => {
    if (isUnidadeLocked) return;
    const value = e.target.value;
    setUnidadeSelecionada(value);
    localStorage.setItem(UNIDADE_STORAGE_KEY, value);
    window.dispatchEvent(new Event('unidadeChange'));
  };

  const unidadeOptions = isUnidadeLocked && currentUser.unidade && !unidades.includes(currentUser.unidade)
    ? [currentUser.unidade, ...unidades]
    : unidades;

  return (
    <div style={styles.topbar}>
      <div style={styles.brandArea}>
        <div style={styles.brand}>DRIVER PIX - SSW</div>
        {version && <span style={styles.versionBadge}>{version}</span>}
        <label style={styles.unidadeControl}>
          <span style={styles.unidadeLabel}>Unidade:</span>
          <select
            aria-label="Selecionar unidade"
            value={unidadeSelecionada}
            onChange={handleUnidadeChange}
            disabled={isUnidadeLocked}
            style={{ ...styles.unidadeSelect, ...(isUnidadeLocked ? styles.unidadeSelectLocked : {}) }}
          >
            {!isUnidadeLocked && <option value="">Todas</option>}
            {unidadeOptions.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
      </div>
      <div style={styles.nav} ref={ref}>
        {GRUPOS.filter(g => g.items.some(i => i.roles.includes(userRole))).map((g) => (
          <div key={g.nome} style={styles.grupoWrapper}>
            <span
              style={{ ...styles.grupoBtn, color: grupoAtivo(g) ? '#f0c040' : '#6b7280', borderColor: grupoAtivo(g) ? '#f0c040' : '#2a2f3e' }}
              onClick={() => setAberto(aberto === g.nome ? null : g.nome)}
            >
              {g.icon} {g.nome} <span style={styles.seta}>{aberto === g.nome ? '▲' : '▼'}</span>
            </span>
            {aberto === g.nome && (
              <div style={styles.dropdown}>
                {g.items.filter(i => i.roles.includes(userRole)).map((item) => (
                  <span key={item.path} style={{ ...styles.dropdownItem, color: location.pathname === item.path ? '#f0c040' : '#fdfdfd' }} onClick={() => navegar(item.path)}>
                    {item.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        <span style={styles.userName}>{currentUser.nome || currentUser.cpf || ''}</span>
        <button style={styles.logoutBtn} onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/login'); }}>Sair</button>
      </div>
    </div>
  );
}

const styles = {
  topbar: { background: '#161920', borderBottom: '1px solid #2a2f3e', padding: '10px 32px', minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, gap: 12, flexWrap: 'wrap' },
  brandArea: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 },
  brand: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '3px', color: '#f0c040' },
  versionBadge: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', letterSpacing: '1px', color: '#161920', background: '#f0c040', padding: '2px 8px', borderRadius: 4, fontWeight: 700, lineHeight: '1.4rem', verticalAlign: 'middle' },
  unidadeControl: { display: 'flex', alignItems: 'center', gap: 6, color: '#6b7280', fontFamily: "'IBM Plex Mono', monospace", whiteSpace: 'nowrap' },
  unidadeLabel: { fontSize: '0.7rem', letterSpacing: '1px' },
  unidadeSelect: { background: '#1e2230', border: '1px solid #2a2f3e', color: '#e8eaf0', padding: '6px 10px', borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.78rem', minWidth: 110, maxWidth: 180, cursor: 'pointer' },
  unidadeSelectLocked: { opacity: 0.6, cursor: 'not-allowed' },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 0 },
  grupoWrapper: { position: 'relative' },
  grupoBtn: { cursor: 'pointer', fontSize: '0.82rem', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '1px', padding: '6px 12px', border: '1px solid #2a2f3e', borderRadius: 4, whiteSpace: 'nowrap', transition: 'all .15s', userSelect: 'none' },
  seta: { fontSize: '0.55rem', marginLeft: 4 },
  dropdown: { position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#1e2230', border: '1px solid #2a2f3e', borderRadius: 6, minWidth: 180, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' },
  dropdownItem: { display: 'block', padding: '10px 16px', fontSize: '0.82rem', fontFamily: "'IBM Plex Mono', monospace", cursor: 'pointer', borderBottom: '1px solid #2a2f3e', transition: 'background .1s' },
  userName: { color: '#e8eaf0', fontSize: '0.85rem', marginLeft: 8, whiteSpace: 'nowrap' },
  logoutBtn: { background: 'transparent', border: '1px solid #ff5a5a', color: '#ff5a5a', padding: '6px 16px', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' },
};
