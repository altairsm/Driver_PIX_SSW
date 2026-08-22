import { useState, useEffect } from 'react';
import { getGestao, getUnidades } from '../services/api';
import Topbar from '../components/Topbar';

const STATUS_ORDER = ['A Vencer', 'Vence hoje', 'Vencido'];
const STATUS_COLORS = {
  'A Vencer': { bg: '#1a2a3a', color: '#60a5fa' },
  'Vence hoje': { bg: '#3a2a1a', color: '#f0c040' },
  'Vencido': { bg: '#3a1a1a', color: '#ff5a5a' },
};
const STATUS_BG = {
  'A Vencer': '#60a5fa',
  'Vence hoje': '#f0c040',
  'Vencido': '#ff5a5a',
};

export default function AdminGestao() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [dados, setDados] = useState([]);
  const [totais, setTotais] = useState({});
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState({
    inicio: new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
    fim: new Date().toISOString().slice(0, 10),
    unidade: '',
  });

  const carregar = async () => {
    setLoading(true);
    setError('');
    try {
      const [gestao, units] = await Promise.all([
        getGestao(filtro.inicio || null, filtro.fim || null, filtro.unidade || null),
        getUnidades(),
      ]);
      setDados(gestao.dados || []);
      setTotais(gestao.totais || {});
      setUnidades(units || []);
    } catch {
      setError('Erro ao carregar dados da gestão');
      setDados([]);
      setTotais({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const handleFiltrar = (e) => {
    e.preventDefault();
    carregar();
  };

  const agrupado = {};
  dados.forEach((row) => {
    if (!agrupado[row.cliente]) agrupado[row.cliente] = {};
    agrupado[row.cliente][row.status_prazo] = row;
  });

  const clientes = Object.keys(agrupado).sort();

  const sumField = (arr, field) => arr.reduce((acc, r) => acc + (r[field] || 0), 0);

  const totalCliente = (nome) => {
    const rows = Object.values(agrupado[nome] || {});
    return {
      em_rota: sumField(rows, 'em_rota'),
      na_filial: sumField(rows, 'na_filial'),
      insucesso: sumField(rows, 'insucesso'),
      devolucao: sumField(rows, 'devolucao'),
      agendado: sumField(rows, 'agendado'),
      transferencia: sumField(rows, 'transferencia'),
    };
  };

  const totalGeral = () => {
    const rows = Object.values(agrupado).flatMap(obj => Object.values(obj));
    return {
      em_rota: sumField(rows, 'em_rota'),
      na_filial: sumField(rows, 'na_filial'),
      insucesso: sumField(rows, 'insucesso'),
      devolucao: sumField(rows, 'devolucao'),
      agendado: sumField(rows, 'agendado'),
      transferencia: sumField(rows, 'transferencia'),
    };
  };

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR');

  const renderRow = (label, data, bold, borderColor) => (
    <tr key={label} style={{
      fontWeight: bold ? 700 : 400,
      background: bold ? '#1e2230' : 'transparent',
      borderLeft: borderColor ? `3px solid ${borderColor}` : '3px solid transparent',
    }}>
      <td style={{ ...s.td, fontWeight: bold ? 700 : 400, color: bold ? '#e8eaf0' : '#9ca3af' }}>{label}</td>
      <td style={{ ...s.td, textAlign: 'center' }}>{fmt(data.em_rota)}</td>
      <td style={{ ...s.td, textAlign: 'center' }}>{fmt(data.na_filial)}</td>
      <td style={{ ...s.td, textAlign: 'center' }}>{fmt(data.insucesso)}</td>
      <td style={{ ...s.td, textAlign: 'center' }}>{fmt(data.devolucao)}</td>
      <td style={{ ...s.td, textAlign: 'center' }}>{fmt(data.agendado)}</td>
      <td style={{ ...s.td, textAlign: 'center' }}>{fmt(data.transferencia)}</td>
    </tr>
  );

  return (
    <div style={s.container}>
      <Topbar user={user} />
      <div style={s.content}>
        <h2 style={s.title}>Gestao — Prazo de Entrega</h2>
        <div style={s.sub}>Entregas por pagador agrupadas por status de prazo e ocorrencia atual</div>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={handleFiltrar} style={s.filterBar}>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Inicio</label>
            <input type="date" style={s.filterInput} value={filtro.inicio}
              onChange={(e) => setFiltro({ ...filtro, inicio: e.target.value })} />
          </div>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Fim</label>
            <input type="date" style={s.filterInput} value={filtro.fim}
              onChange={(e) => setFiltro({ ...filtro, fim: e.target.value })} />
          </div>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Unidade</label>
            <select style={s.filterInput} value={filtro.unidade}
              onChange={(e) => setFiltro({ ...filtro, unidade: e.target.value })}>
              <option value="">Todas</option>
              {unidades.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <button type="submit" style={s.filterBtn} disabled={loading}>
            {loading ? 'Carregando...' : 'Filtrar'}
          </button>
        </form>

        {loading ? (
          <div style={s.loadingBox}><div style={s.spinner}></div></div>
        ) : dados.length === 0 ? (
          <div style={s.empty}>Nenhum dado encontrado para o periodo selecionado</div>
        ) : (
          <>
            <div style={s.card}>
              <div style={s.cardHeader}>
                <h5 style={s.cardTitle}>Total Geral — {clientes.length} clientes</h5>
              </div>
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead><tr>
                    <th style={s.th}>Cliente</th>
                    <th style={s.th}>Em rota</th>
                    <th style={s.th}>Na filial</th>
                    <th style={s.th}>Insucesso</th>
                    <th style={s.th}>Devolucao</th>
                    <th style={s.th}>Agendado</th>
                    <th style={s.th}>Transferencia</th>
                  </tr></thead>
                  <tbody>
                    {renderRow('TOTAL GERAL', totalGeral(), true)}
                  </tbody>
                </table>
              </div>
            </div>

            {clientes.map((nome) => {
              const t = totalCliente(nome);
              const totalAll = t.em_rota + t.na_filial + t.insucesso + t.devolucao + t.agendado + t.transferencia;
              return (
                <div key={nome} style={s.card}>
                  <div style={s.cardHeader}>
                    <h5 style={s.cardTitle}>{nome}</h5>
                    <span style={s.badge}>{fmt(totalAll)} entregas</span>
                  </div>
                  <div style={s.tableWrap}>
                    <table style={s.table}>
                      <thead><tr>
                        <th style={s.th}>Status Prazo</th>
                        <th style={s.th}>Em rota</th>
                        <th style={s.th}>Na filial</th>
                        <th style={s.th}>Insucesso</th>
                        <th style={s.th}>Devolucao</th>
                        <th style={s.th}>Agendado</th>
                        <th style={s.th}>Transferencia</th>
                      </tr></thead>
                      <tbody>
                        {STATUS_ORDER.map((st) => {
                          const row = agrupado[nome][st];
                          const borderColor = STATUS_BG[st];
                          if (!row) return (
                            <tr key={st} style={{ borderLeft: `3px solid ${borderColor}`, opacity: 0.35 }}>
                              <td style={{ ...s.td, color: STATUS_COLORS[st]?.color || '#6b7280' }}>{st}</td>
                              <td style={{ ...s.td, textAlign: 'center' }}>0</td>
                              <td style={{ ...s.td, textAlign: 'center' }}>0</td>
                              <td style={{ ...s.td, textAlign: 'center' }}>0</td>
                              <td style={{ ...s.td, textAlign: 'center' }}>0</td>
                              <td style={{ ...s.td, textAlign: 'center' }}>0</td>
                              <td style={{ ...s.td, textAlign: 'center' }}>0</td>
                            </tr>
                          );
                          return (
                            <tr key={st} style={{ borderLeft: `3px solid ${borderColor}` }}>
                              <td style={{ ...s.td, color: STATUS_COLORS[st]?.color || '#6b7280', fontWeight: 600 }}>{st}</td>
                              <td style={{ ...s.td, textAlign: 'center' }}>{fmt(row.em_rota)}</td>
                              <td style={{ ...s.td, textAlign: 'center' }}>{fmt(row.na_filial)}</td>
                              <td style={{ ...s.td, textAlign: 'center' }}>{fmt(row.insucesso)}</td>
                              <td style={{ ...s.td, textAlign: 'center' }}>{fmt(row.devolucao)}</td>
                              <td style={{ ...s.td, textAlign: 'center' }}>{fmt(row.agendado)}</td>
                              <td style={{ ...s.td, textAlign: 'center' }}>{fmt(row.transferencia)}</td>
                            </tr>
                          );
                        })}
                        {renderRow('Total', t, true)}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: '#0d0f14', color: '#e8eaf0', fontFamily: "'IBM Plex Sans', sans-serif" },
  content: { maxWidth: 1200, margin: '0 auto', padding: '32px 24px' },
  title: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', letterSpacing: '2px', color: '#f0c040', marginBottom: 4 },
  sub: { color: '#6b7280', fontSize: '0.85rem', marginBottom: 20 },
  error: { background: '#2a1a1a', border: '1px solid #ff5a5a', color: '#ff5a5a', padding: '10px 16px', borderRadius: 4, marginBottom: 20 },
  filterBar: { display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 24, background: '#161920', border: '1px solid #2a2f3e', borderRadius: 8, padding: '16px 20px' },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  filterLabel: { fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' },
  filterInput: { background: '#1e2230', border: '1px solid #2a2f3e', color: '#e8eaf0', padding: '8px 12px', borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.82rem', minWidth: 160 },
  filterBtn: { background: '#f0c040', color: '#0d0f14', border: 'none', padding: '9px 24px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 1 },
  card: { background: '#161920', border: '1px solid #2a2f3e', borderRadius: 8, overflow: 'hidden', marginBottom: 20 },
  cardHeader: { padding: '12px 20px', background: '#1e2230', borderBottom: '1px solid #2a2f3e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  cardTitle: { margin: 0, fontSize: '0.95rem', color: '#e8eaf0' },
  badge: { background: '#2a2f3e', color: '#e8eaf0', padding: '3px 10px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #2a2f3e', background: '#1e2230', fontFamily: "'IBM Plex Mono', monospace" },
  td: { padding: '10px 14px', fontSize: '0.8rem', borderBottom: '1px solid #2a2f3e', color: '#e8eaf0', fontFamily: "'IBM Plex Mono', monospace" },
  loadingBox: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' },
  spinner: { width: 32, height: 32, border: '3px solid #2a2f3e', borderTopColor: '#f0c040', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  empty: { textAlign: 'center', color: '#6b7280', padding: 40, fontSize: '0.9rem', background: '#161920', borderRadius: 8, border: '1px solid #2a2f3e' },
};
