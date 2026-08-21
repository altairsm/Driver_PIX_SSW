import { useState, useEffect } from 'react';
import { getGestao, getUnidades } from '../services/api';
import Topbar from '../components/Topbar';

export default function AdminGestao() {
  const [dados, setDados] = useState(null);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState({ inicio: '', fim: '', unidade: '' });
  const [activeTab, setActiveTab] = useState('pagador');

  const carregar = async () => {
    setLoading(true);
    setError('');
    try {
      const [gestao, uni] = await Promise.all([
        getGestao(filtro.inicio || null, filtro.fim || null, filtro.unidade || null),
        getUnidades(),
      ]);
      setDados(gestao);
      setUnidades(uni);
    } catch {
      setError('Erro ao carregar dados da gestão');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const handleFiltrar = (e) => {
    e.preventDefault();
    carregar();
  };

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR');
  const fmtCurrency = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtKg = (v) => `${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;

  return (
    <div style={s.container}>
      <Topbar user={JSON.parse(localStorage.getItem('user') || '{}')} />
      <div style={s.content}>
        <h2 style={s.title}>Gestão</h2>
        <div style={s.sub}>Indicadores baseados no SSW 455 — entregas por pagador e unidade</div>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={handleFiltrar} style={s.filterBar}>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Início</label>
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
        ) : dados ? (
          <>
            <div style={s.kpiRow}>
              <div style={{ ...s.kpiCard, borderBottomColor: '#3de8a0' }}>
                <div style={s.kpiLabel}>Total Entregas</div>
                <div style={{ ...s.kpiValue, color: '#3de8a0' }}>{fmt(dados.resumo_geral?.total_entregas)}</div>
              </div>
              <div style={{ ...s.kpiCard, borderBottomColor: '#f0c040' }}>
                <div style={s.kpiLabel}>Frete Total</div>
                <div style={{ ...s.kpiValue, color: '#f0c040' }}>{fmtCurrency(dados.resumo_geral?.frete_total)}</div>
              </div>
              <div style={{ ...s.kpiCard, borderBottomColor: '#0d6efd' }}>
                <div style={s.kpiLabel}>Peso Total</div>
                <div style={{ ...s.kpiValue, color: '#0d6efd' }}>{fmtKg(dados.resumo_geral?.peso_total)}</div>
              </div>
              <div style={{ ...s.kpiCard, borderBottomColor: '#6b7280' }}>
                <div style={s.kpiLabel}>Volumes</div>
                <div style={{ ...s.kpiValue, color: '#e8eaf0' }}>{fmt(dados.resumo_geral?.volumes_total)}</div>
              </div>
              <div style={{ ...s.kpiCard, borderBottomColor: '#ff9f40' }}>
                <div style={s.kpiLabel}>Pagadores</div>
                <div style={{ ...s.kpiValue, color: '#ff9f40' }}>{fmt(dados.resumo_geral?.cnpjs_distintos)}</div>
              </div>
              <div style={{ ...s.kpiCard, borderBottomColor: '#a855f7' }}>
                <div style={s.kpiLabel}>Unidades</div>
                <div style={{ ...s.kpiValue, color: '#a855f7' }}>{fmt(dados.resumo_geral?.unidades_distintas)}</div>
              </div>
            </div>

            <div style={s.tabBar}>
              <button style={{ ...s.tabBtn, ...(activeTab === 'pagador' ? s.tabBtnActive : {}) }}
                onClick={() => setActiveTab('pagador')}>
                Por Pagador
              </button>
              <button style={{ ...s.tabBtn, ...(activeTab === 'unidade' ? s.tabBtnActive : {}) }}
                onClick={() => setActiveTab('unidade')}>
                Por Unidade
              </button>
            </div>

            {activeTab === 'pagador' && (
              <div style={s.section}>
                <div style={s.sectionTitle}>Entregas por Pagador</div>
                {dados.por_pagador?.length === 0 ? (
                  <div style={s.empty}>Nenhum pagador encontrado para o período.</div>
                ) : (
                  <div style={s.tableWrap}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={s.th}>Status</th>
                          <th style={s.th}>Pagador</th>
                          <th style={s.th}>CNPJ</th>
                          <th style={s.th}>Entregas</th>
                          <th style={s.th}>Frete Total</th>
                          <th style={s.th}>Peso Total</th>
                          <th style={s.th}>Volumes</th>
                          <th style={s.th}>Unidades</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dados.por_pagador.map((p, i) => (
                          <tr key={i} style={{ opacity: p.ativo === false ? 0.45 : 1 }}>
                            <td style={s.td}>
                              <span style={{
                                background: p.ativo !== false ? '#1a3a2a' : '#3a1a1a',
                                color: p.ativo !== false ? '#3de8a0' : '#ff5a5a',
                                border: `1px solid ${p.ativo !== false ? '#3de8a0' : '#ff5a5a'}`,
                                borderRadius: 12, padding: '2px 8px', fontSize: '0.65rem', fontWeight: 600
                              }}>
                                {p.ativo !== false ? 'ATIVO' : 'INATIVO'}
                              </span>
                            </td>
                            <td style={s.td}>{p.razao_social || p.nome_simplificado || '—'}</td>
                            <td style={s.td}>{(p.cnpj_pagador || '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}</td>
                            <td style={{ ...s.td, fontWeight: 600 }}>{fmt(p.total_entregas)}</td>
                            <td style={{ ...s.td, color: '#3de8a0' }}>{fmtCurrency(p.frete_total)}</td>
                            <td style={s.td}>{fmtKg(p.peso_total)}</td>
                            <td style={s.td}>{fmt(p.volumes_total)}</td>
                            <td style={s.td}>{(p.unidades || []).filter(Boolean).join(', ') || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3} style={{ ...s.td, fontWeight: 600, color: '#f0c040' }}>TOTAL</td>
                          <td style={{ ...s.td, fontWeight: 600 }}>{fmt(dados.por_pagador.reduce((s, p) => s + p.total_entregas, 0))}</td>
                          <td style={{ ...s.td, fontWeight: 600, color: '#3de8a0' }}>{fmtCurrency(dados.por_pagador.reduce((s, p) => s + Number(p.frete_total), 0))}</td>
                          <td style={{ ...s.td, fontWeight: 600 }}>{fmtKg(dados.por_pagador.reduce((s, p) => s + Number(p.peso_total), 0))}</td>
                          <td style={{ ...s.td, fontWeight: 600 }}>{fmt(dados.por_pagador.reduce((s, p) => s + p.volumes_total, 0))}</td>
                          <td style={s.td}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'unidade' && (
              <div style={s.section}>
                <div style={s.sectionTitle}>Entregas por Unidade</div>
                {dados.por_unidade?.length === 0 ? (
                  <div style={s.empty}>Nenhuma unidade encontrada para o período.</div>
                ) : (
                  <div style={s.tableWrap}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={s.th}>Unidade</th>
                          <th style={s.th}>Entregas</th>
                          <th style={s.th}>Frete Total</th>
                          <th style={s.th}>Peso Total</th>
                          <th style={s.th}>Volumes</th>
                          <th style={s.th}>Pagadores</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dados.por_unidade.map((u, i) => (
                          <tr key={i}>
                            <td style={{ ...s.td, fontWeight: 600, color: '#a855f7' }}>{u.unidade_receptora}</td>
                            <td style={{ ...s.td, fontWeight: 600 }}>{fmt(u.total_entregas)}</td>
                            <td style={{ ...s.td, color: '#3de8a0' }}>{fmtCurrency(u.frete_total)}</td>
                            <td style={s.td}>{fmtKg(u.peso_total)}</td>
                            <td style={s.td}>{fmt(u.volumes_total)}</td>
                            <td style={s.td}>{fmt(u.cnpjs_distintos)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td style={{ ...s.td, fontWeight: 600, color: '#f0c040' }}>TOTAL</td>
                          <td style={{ ...s.td, fontWeight: 600 }}>{fmt(dados.por_unidade.reduce((s, u) => s + u.total_entregas, 0))}</td>
                          <td style={{ ...s.td, fontWeight: 600, color: '#3de8a0' }}>{fmtCurrency(dados.por_unidade.reduce((s, u) => s + Number(u.frete_total), 0))}</td>
                          <td style={{ ...s.td, fontWeight: 600 }}>{fmtKg(dados.por_unidade.reduce((s, u) => s + Number(u.peso_total), 0))}</td>
                          <td style={{ ...s.td, fontWeight: 600 }}>{fmt(dados.por_unidade.reduce((s, u) => s + u.volumes_total, 0))}</td>
                          <td style={{ ...s.td, fontWeight: 600 }}>{fmt(dados.por_unidade.reduce((s, u) => s + u.cnpjs_distintos, 0))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
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
  loadingBox: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' },
  spinner: { width: 32, height: 32, border: '3px solid #2a2f3e', borderTopColor: '#f0c040', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  filterBar: { display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 24, background: '#161920', border: '1px solid #2a2f3e', borderRadius: 8, padding: '16px 20px' },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  filterLabel: { fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' },
  filterInput: { background: '#1e2230', border: '1px solid #2a2f3e', color: '#e8eaf0', padding: '8px 12px', borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.82rem', minWidth: 160 },
  filterBtn: { background: '#f0c040', color: '#0d0f14', border: 'none', padding: '9px 24px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 1 },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 },
  kpiCard: { background: '#161920', border: '1px solid #2a2f3e', borderBottom: '3px solid', borderRadius: 8, padding: '16px', display: 'flex', flexDirection: 'column', gap: 4 },
  kpiLabel: { fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' },
  kpiValue: { fontSize: '1.3rem', fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" },
  tabBar: { display: 'flex', gap: 8, marginBottom: 20 },
  tabBtn: { background: '#1e2230', border: '1px solid #2a2f3e', color: '#6b7280', padding: '10px 20px', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', fontFamily: "'IBM Plex Mono', monospace", transition: 'all .15s' },
  tabBtnActive: { background: '#1e2230', borderColor: '#f0c040', color: '#f0c040' },
  section: { marginBottom: 32 },
  sectionTitle: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', letterSpacing: '2px', color: '#f0c040', marginBottom: 12 },
  tableWrap: { background: '#161920', border: '1px solid #2a2f3e', borderRadius: 8, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #2a2f3e', background: '#1e2230', fontFamily: "'IBM Plex Mono', monospace" },
  td: { padding: '10px 14px', fontSize: '0.8rem', borderBottom: '1px solid #2a2f3e', color: '#e8eaf0', fontFamily: "'IBM Plex Mono', monospace" },
  empty: { textAlign: 'center', color: '#6b7280', padding: 40, fontSize: '0.9rem' },
};
