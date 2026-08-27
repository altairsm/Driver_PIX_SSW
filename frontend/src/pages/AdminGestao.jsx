import { useState, useEffect } from 'react';
import { getGestao, getGestaoDetalhe, getUnidades, exportGestao } from '../services/api';
import * as XLSX from 'xlsx';
import Topbar from '../components/Topbar';

const STATUS_ORDER = ['A Vencer', 'Vence hoje', 'Vencido'];
const STATUS_COLORS = {
  'A Vencer': '#60a5fa',
  'Vence hoje': '#f0c040',
  'Vencido': '#ff5a5a',
};
const RESUMO_KEYS = ['em_rota', 'na_filial', 'insucesso', 'devolucao', 'agendado', 'transferencia'];
const RESUMO_LABELS = { em_rota: 'Em rota', na_filial: 'Na filial', insucesso: 'Insucesso', devolucao: 'Devolução', agendado: 'Agendado', transferencia: 'Transferência' };
const RESUMO_COLORS = { em_rota: '#60a5fa', na_filial: '#f0c040', insucesso: '#ff5a5a', devolucao: '#a855f7', agendado: '#3de8a0', transferencia: '#06b6d4' };
const RESUMO_BG = { em_rota: 'rgba(96,165,250,0.12)', na_filial: 'rgba(240,192,64,0.12)', insucesso: 'rgba(255,90,90,0.12)', devolucao: 'rgba(168,85,247,0.12)', agendado: 'rgba(61,232,160,0.12)', transferencia: 'rgba(6,182,212,0.12)' };

export default function AdminGestao() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [dados, setDados] = useState([]);
  const [realizadasHoje, setRealizadasHoje] = useState({ por_cliente: {}, total: 0 });
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportando, setExportando] = useState(false);
  const [filtro, setFiltro] = useState({
    inicio: new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
    fim: new Date().toISOString().slice(0, 10),
    unidade: '',
  });
  const [modal, setModal] = useState({ aberto: false, cliente: '', resumo: '', dados: [], carregando: false });

  const carregar = async () => {
    setLoading(true); setError('');
    try {
      const [gestao, units] = await Promise.all([
        getGestao(filtro.inicio || null, filtro.fim || null, filtro.unidade || null),
        getUnidades(),
      ]);
      setDados(gestao.dados || []);
      setRealizadasHoje(gestao.realizadas_hoje || { por_cliente: {}, total: 0 });
      setUnidades(units || []);
    } catch { setError('Erro ao carregar dados'); setDados([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const handleFiltrar = (e) => { e.preventDefault(); carregar(); };

  const handleExportar = async () => {
    setExportando(true);
    try {
      const rows = await exportGestao(filtro.inicio || null, filtro.fim || null, filtro.unidade || null);
      if (!rows?.length) { alert('Nenhum dado'); return; }
      const ws = XLSX.utils.json_to_sheet(rows.map(r => ({
        'Nota Fiscal': r.numero_nota_fiscal || '', 'CTRC': r.ctrc, 'Cliente': r.cliente_pagador,
        'Emissão': r.data_emissao || '', 'Previsão': r.previsao_entrega || '', 'Status': r.status_prazo,
        'Resumo': r.resumo_ocorrencia, 'Ocorrência': r.ocorrencia, 'Cidade': r.cidade_entrega,
        'Unidade': r.unidade_receptora, 'Últ. Ocorrência': r.data_ultima_ocorrencia || '',
        'Cubagem': r.cubagem_m3 || 0, 'Valor Merc.': r.valor_mercadoria || 0,
        'Setor': r.setor_destino || '', 'Tipo Baixa': r.tipo_baixa || '',
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Gestão Prazo');
      XLSX.writeFile(wb, `gestao_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch { alert('Erro ao exportar'); }
    finally { setExportando(false); }
  };

  const abrirDetalhe = async (cliente, resumo) => {
    setModal({ aberto: true, cliente, resumo, dados: [], carregando: true });
    try {
      const rows = await getGestaoDetalhe(cliente, null, resumo, filtro.inicio || null, filtro.fim || null, filtro.unidade || null);
      setModal(prev => ({ ...prev, dados: rows, carregando: false }));
    } catch { setModal(prev => ({ ...prev, dados: [], carregando: false })); }
  };

  const fecharModal = () => setModal({ aberto: false, cliente: '', resumo: '', dados: [], carregando: false });

  const agrupado = {};
  dados.forEach((row) => {
    if (!agrupado[row.cliente]) agrupado[row.cliente] = {};
    agrupado[row.cliente][row.status_prazo] = row;
  });

  const clientes = Object.keys(agrupado).sort((a, b) => {
    const sumObj = (obj) => Object.values(obj).reduce((s, r) => s + RESUMO_KEYS.reduce((ss, k) => ss + (r[k] || 0), 0), 0);
    return sumObj(agrupado[b]) - sumObj(agrupado[a]);
  });

  const totalGeralObj = () => {
    const out = {}; RESUMO_KEYS.forEach(k => out[k] = 0);
    dados.forEach(r => RESUMO_KEYS.forEach(k => out[k] += (r[k] || 0)));
    return out;
  };
  const totalClienteObj = (nome) => {
    const out = {}; RESUMO_KEYS.forEach(k => out[k] = 0);
    Object.values(agrupado[nome] || {}).forEach(r => RESUMO_KEYS.forEach(k => out[k] += (r[k] || 0)));
    return out;
  };

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR');
  const fmtBig = (v) => Number(v || 0).toLocaleString('pt-BR');

  const ClickNum = ({ value, cliente, resumo }) => {
    const n = Number(value || 0);
    if (n === 0) return <span style={{ color: '#374151', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem' }}>0</span>;
    return (
      <span onClick={() => abrirDetalhe(cliente, resumo)}
        style={{ color: RESUMO_COLORS[resumo] || '#f0c040', cursor: 'pointer', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', lineHeight: 1, textDecoration: 'underline', textUnderlineOffset: 3, textDecorationThickness: 2 }}
        title={`Ver ${n} CT-e's`}>
        {fmtBig(n)}
      </span>
    );
  };

  const TotalGeral = () => {
    const t = totalGeralObj();
    return (
      <div style={s.card}>
        <div style={s.cardHeaderMain}>
          <div>
            <div style={s.cardTitle}>TOTAL GERAL</div>
            <div style={s.cardSub}>{clientes.length} clientes</div>
          </div>
          <div style={s.statsRow}>
            <div style={{ ...s.statBox, background: 'rgba(61,232,160,0.15)', border: '1px solid rgba(61,232,160,0.3)' }}>
              <div style={{ ...s.statValue, color: '#3de8a0' }}>{fmtBig(realizadasHoje.total)}</div>
              <div style={s.statLabel}>Realizadas Hoje</div>
            </div>
            <div style={{ ...s.statBox, background: 'rgba(240,192,64,0.15)', border: '1px solid rgba(240,192,64,0.3)' }}>
              <div style={{ ...s.statValue, color: '#f0c040' }}>{fmtBig(RESUMO_KEYS.reduce((s, k) => s + t[k], 0))}</div>
              <div style={s.statLabel}>Pendentes</div>
            </div>
          </div>
        </div>
        <div style={s.resumoGrid}>
          {RESUMO_KEYS.map(k => (
            <div key={k} style={{ ...s.resumoCard, background: RESUMO_BG[k], borderColor: RESUMO_COLORS[k] + '40' }}>
              <div style={{ ...s.resumoValue, color: RESUMO_COLORS[k] }}>{fmtBig(t[k])}</div>
              <div style={{ ...s.resumoLabel, color: RESUMO_COLORS[k] }}>{RESUMO_LABELS[k]}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const CardCliente = ({ nome }) => {
    const t = totalClienteObj(nome);
    const totalAll = RESUMO_KEYS.reduce((s, k) => s + t[k], 0);
    const realizadasCliente = realizadasHoje.por_cliente[nome] || 0;
    return (
      <div style={s.card}>
        <div style={s.cardHeader}>
          <div style={s.cardTitle}>{nome}</div>
          <div style={s.statsRowSmall}>
            <span style={{ ...s.statSmall, color: '#3de8a0' }}>✅ {fmtBig(realizadasCliente)}</span>
            <span style={{ ...s.statSmall, color: '#f0c040' }}>⏳ {fmtBig(totalAll)}</span>
          </div>
        </div>
        <div style={s.statusGrid}>
          {STATUS_ORDER.map(st => {
            const row = agrupado[nome]?.[st];
            return (
              <div key={st} style={{ ...s.statusBox, borderLeft: `3px solid ${STATUS_COLORS[st]}` }}>
                <div style={{ ...s.statusTitle, color: STATUS_COLORS[st] }}>{st}</div>
                <div style={s.statusResumos}>
                  {RESUMO_KEYS.map(k => (
                    <div key={k} style={s.statusItem}>
                      <div style={{ ...s.statusItemLabel, color: RESUMO_COLORS[k] }}>{RESUMO_LABELS[k]}</div>
                      {row ? <ClickNum value={row[k]} cliente={nome} resumo={RESUMO_LABELS[k]} /> : <span style={{ color: '#374151', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem' }}>0</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={s.container}>
      <Topbar user={user} />
      <div style={s.content}>
        <h2 style={s.title}>Gestão — Prazo de Entrega</h2>
        <div style={s.sub}>Entregas por pagador agrupadas por status de prazo e ocorrência atual</div>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={handleFiltrar} style={s.filterBar}>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Início</label>
            <input type="date" style={s.filterInput} value={filtro.inicio} onChange={(e) => setFiltro({ ...filtro, inicio: e.target.value })} />
          </div>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Fim</label>
            <input type="date" style={s.filterInput} value={filtro.fim} onChange={(e) => setFiltro({ ...filtro, fim: e.target.value })} />
          </div>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Unidade</label>
            <select style={s.filterInput} value={filtro.unidade} onChange={(e) => setFiltro({ ...filtro, unidade: e.target.value })}>
              <option value="">Todas</option>
              {unidades.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <button type="submit" style={s.filterBtn} disabled={loading}>{loading ? 'Carregando...' : 'Filtrar'}</button>
          <button type="button" style={{ ...s.filterBtn, background: '#198754', color: '#fff' }} onClick={handleExportar} disabled={exportando || loading}>
            {exportando ? 'Exportando...' : '📥 Exportar Excel'}
          </button>
        </form>

        {loading ? (
          <div style={s.loadingBox}><div style={s.spinner}></div></div>
        ) : dados.length === 0 ? (
          <div style={s.empty}>Nenhum dado encontrado</div>
        ) : (
          <>
            <TotalGeral />
            {clientes.map(nome => <CardCliente key={nome} nome={nome} />)}
          </>
        )}
      </div>

      {modal.aberto && (
        <div style={s.modalOverlay} onClick={fecharModal}>
          <div style={s.modalContent} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <div style={s.modalTitle}>{modal.cliente}</div>
                <div style={s.modalSub}>{modal.resumo} — {modal.dados.length} CT-e's</div>
              </div>
              <button style={s.modalClose} onClick={fecharModal}>✕</button>
            </div>
            <div style={s.modalBody}>
              {modal.carregando ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Carregando...</div>
              ) : modal.dados.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Nenhum CT-e encontrado</div>
              ) : (
                <table style={s.modalTable}>
                  <thead><tr>
                    <th style={s.modalTh}>CTRC</th>
                    <th style={s.modalTh}>Nota Fiscal</th>
                    <th style={s.modalTh}>Cidade</th>
                    <th style={s.modalTh}>Unidade</th>
                    <th style={s.modalTh}>Previsão</th>
                  </tr></thead>
                  <tbody>
                    {modal.dados.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #2a2f3e' }}>
                        <td style={s.modalTd}>{r.ctrc}</td>
                        <td style={s.modalTd}>{r.numero_nota_fiscal || '-'}</td>
                        <td style={s.modalTd}>{r.cidade_entrega || '-'}</td>
                        <td style={s.modalTd}>{r.unidade_receptora || '-'}</td>
                        <td style={s.modalTd}>{r.previsao_entrega || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: '#0d0f14', color: '#e8eaf0', fontFamily: "'IBM Plex Sans', sans-serif" },
  content: { maxWidth: 1200, margin: '0 auto', padding: '24px 20px' },
  title: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', letterSpacing: '2px', color: '#f0c040', marginBottom: 2 },
  sub: { color: '#6b7280', fontSize: '0.8rem', marginBottom: 16 },
  error: { background: '#2a1a1a', border: '1px solid #ff5a5a', color: '#ff5a5a', padding: '8px 14px', borderRadius: 4, marginBottom: 16 },
  filterBar: { display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16, background: '#161920', border: '1px solid #2a2f3e', borderRadius: 8, padding: '12px 16px' },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: 3 },
  filterLabel: { fontSize: '0.6rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' },
  filterInput: { background: '#1e2230', border: '1px solid #2a2f3e', color: '#e8eaf0', padding: '6px 10px', borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.78rem', minWidth: 140 },
  filterBtn: { background: '#f0c040', color: '#0d0f14', border: 'none', padding: '7px 20px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 1 },

  card: { background: '#161920', border: '1px solid #2a2f3e', borderRadius: 10, overflow: 'hidden', marginBottom: 12 },
  cardHeaderMain: { padding: '16px 20px', background: 'linear-gradient(135deg, #1e2230 0%, #161920 100%)', borderBottom: '1px solid #2a2f3e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  cardHeader: { padding: '10px 16px', background: '#1e2230', borderBottom: '1px solid #2a2f3e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  cardTitle: { fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: '#e8eaf0', fontSize: '0.95rem' },
  cardSub: { color: '#6b7280', fontSize: '0.7rem', marginTop: 2 },

  statsRow: { display: 'flex', gap: 12 },
  statBox: { borderRadius: 8, padding: '8px 16px', textAlign: 'center', minWidth: 100 },
  statValue: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', lineHeight: 1, fontWeight: 700 },
  statLabel: { fontSize: '0.6rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', marginTop: 2 },

  statsRowSmall: { display: 'flex', gap: 12, fontFamily: "'IBM Plex Mono', monospace" },
  statSmall: { fontWeight: 700, fontSize: '1rem' },

  resumoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, padding: '12px 16px' },
  resumoCard: { borderRadius: 8, padding: '10px 12px', textAlign: 'center', border: '1px solid' },
  resumoValue: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', lineHeight: 1, fontWeight: 700 },
  resumoLabel: { fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px', marginTop: 2, fontWeight: 600 },

  statusGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 },
  statusBox: { padding: '10px 14px', borderRight: '1px solid #2a2f3e' },
  statusTitle: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 },
  statusResumos: { display: 'flex', flexDirection: 'column', gap: 4 },
  statusItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  statusItemLabel: { fontSize: '0.65rem', fontFamily: "'IBM Plex Mono', monospace" },

  loadingBox: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' },
  spinner: { width: 32, height: 32, border: '3px solid #2a2f3e', borderTopColor: '#f0c040', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  empty: { textAlign: 'center', color: '#6b7280', padding: 40, fontSize: '0.85rem', background: '#161920', borderRadius: 8, border: '1px solid #2a2f3e' },

  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 20 },
  modalContent: { background: '#161920', border: '1px solid #2a2f3e', borderRadius: 10, width: '100%', maxWidth: 800, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  modalHeader: { padding: '14px 20px', background: '#1e2230', borderBottom: '1px solid #2a2f3e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: '1rem', fontWeight: 700, color: '#f0c040' },
  modalSub: { fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 },
  modalClose: { background: 'none', border: 'none', color: '#6b7280', fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px' },
  modalBody: { overflow: 'auto', flex: 1 },
  modalTable: { width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' },
  modalTh: { padding: '8px 12px', textAlign: 'left', fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #3a3f4e', background: '#1a1f2e', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, position: 'sticky', top: 0 },
  modalTd: { padding: '6px 12px', borderBottom: '1px solid #2a2f3e', color: '#e8eaf0', fontFamily: "'IBM Plex Mono', monospace" },
};
