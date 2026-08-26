import { useState, useEffect } from 'react';
import { getEficienciaMotoristas, getAppUsageMotoristas, getCtrcsParados, getCtrcsParadosDetalhado, getExpedicao } from '../services/api';
import api from '../services/api';
import * as XLSX from 'xlsx';
import Topbar from '../components/Topbar';

export default function AdminDashboard() {
  const defaultInicio = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const defaultFim = new Date().toISOString().slice(0, 10);

  const [filtro, setFiltro] = useState({ inicio: defaultInicio, fim: defaultFim, tipo: '', unidade: '' });
  const [unidades, setUnidades] = useState([]);
  const [eficiencia, setEficiencia] = useState([]);
  const [appUsage, setAppUsage] = useState([]);
  const [ctrcsParados, setCtrcsParados] = useState([]);
  const [expedicao, setExpedicao] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('eficiencia');

  const carregar = async (f) => {
    setLoading(true);
    setError('');
    try {
      const fInicio = f?.inicio || null;
      const fFim = f?.fim || null;
      const fTipo = f?.tipo || null;
      const fUnidade = f?.unidade || null;
      const [ef, app, parados, exp] = await Promise.all([
        getEficienciaMotoristas(fInicio, fFim, fTipo, fUnidade),
        getAppUsageMotoristas(fInicio, fFim, fTipo, fUnidade),
        getCtrcsParados(fUnidade),
        getExpedicao(fUnidade),
      ]);
      setEficiencia(ef);
      setAppUsage(app);
      setCtrcsParados(parados);
      setExpedicao(exp);
    } catch {
      setError('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar(filtro);
    api.get('/admin/unidades').then(({ data }) => setUnidades(data.filter(u => u.ativo !== false).map(u => u.sigla))).catch(() => {});
  }, []);

  const handleFiltrar = (e) => {
    e.preventDefault();
    carregar(filtro);
  };

  const tipoLabel = (tipo) => {
    const labels = { funcionario: 'Funcionario', agregado: 'Agregado' };
    return labels[tipo] || tipo || '—';
  };

  const tipoBadgeStyle = (tipo) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 600,
    background: tipo === 'agregado' ? '#ff9f40' : '#0d6efd',
    color: '#fff',
  });

  const [exportando, setExportando] = useState(false);

  const handleExportarExcel = async () => {
    setExportando(true);
    try {
      const dados = await getCtrcsParadosDetalhado(filtro.unidade || null);
      const fmtDate = (v) => {
        if (!v) return '';
        const d = new Date(v);
        if (isNaN(d.getTime())) return '';
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const yyyy = d.getUTCFullYear();
        return `${dd}/${mm}/${yyyy}`;
      };
      const rows = dados.map(r => ({
        'Nota Fiscal': r.nf || '',
        'CTRC': r.ctrc || '',
        'Data Emissao': fmtDate(r.data_emissao),
        'Previsao de Entrega': fmtDate(r.previsao_entrega),
        'Data Ultima Ocorrencia': fmtDate(r.data_ultima_ocorrencia),
        'Ocorrencia Atual': r.ocorrencia || '',
        'Cidade': r.cidade_entrega || '',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 15 }, { wch: 18 }, { wch: 14 },
        { wch: 18 }, { wch: 18 }, { wch: 35 }, { wch: 25 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'CTRCs Parados');
      XLSX.writeFile(wb, 'ctrcs_parados.xlsx');
    } catch {
      alert('Erro ao exportar dados');
    } finally {
      setExportando(false);
    }
  };

  const totalParados = ctrcsParados.reduce((s, c) => s + c.total, 0);
  const totalAte3 = ctrcsParados.reduce((s, c) => s + c.ate_3_dias, 0);
  const total4a7 = ctrcsParados.reduce((s, c) => s + c.de_4_a_7, 0);
  const total8a15 = ctrcsParados.reduce((s, c) => s + c.de_8_a_15, 0);
  const total16a30 = ctrcsParados.reduce((s, c) => s + c.de_16_a_30, 0);
  const totalMais30 = ctrcsParados.reduce((s, c) => s + c.mais_30, 0);

  if (loading && eficiencia.length === 0) {
    return (
      <div style={s.container}>
        <Topbar user={JSON.parse(localStorage.getItem('user') || '{}')} />
        <div style={s.loading}><div style={s.spinner}></div><span>CARREGANDO...</span></div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <Topbar user={JSON.parse(localStorage.getItem('user') || '{}')} />
      <div style={s.content}>
        <h2 style={s.title}>Operacional</h2>
        <div style={s.sub}>Visao geral dos motoristas</div>

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
            <label style={s.filterLabel}>Tipo</label>
            <select style={s.filterInput} value={filtro.tipo}
              onChange={(e) => setFiltro({ ...filtro, tipo: e.target.value })}>
              <option value="">Todos</option>
              <option value="funcionario">Funcionario</option>
              <option value="agregado">Agregado</option>
            </select>
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

        <div style={s.tabBar}>
          {[
            { id: 'eficiencia', label: 'Eficiência', icon: '📊' },
            { id: 'app', label: 'Uso do App', icon: '📱' },
            { id: 'aging', label: 'CTRCs Parados', icon: '⏳' },
            { id: 'expedicao', label: 'Expedição', icon: '📦' },
          ].map(t => (
            <button key={t.id} style={{ ...s.tabBtn, ...(activeTab === t.id ? s.tabBtnActive : {}) }} onClick={() => setActiveTab(t.id)}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'eficiencia' && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Eficiência por Motorista</div>
            {eficiencia.length === 0 ? (
              <div style={s.empty}>Nenhum dado de eficiência encontrado.</div>
            ) : (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Motorista</th>
                      <th style={s.th}>CPF</th>
                      <th style={s.th}>Tipo</th>
                      <th style={s.th}>Entregas</th>
                      <th style={s.th}>Total</th>
                      <th style={{ ...s.th, minWidth: 200 }}>Eficiencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eficiencia.map((e, i) => {
                      const pct = Number(e.pct_eficiencia) || 0;
                      const color = pct >= 95 ? '#3de8a0' : pct >= 85 ? '#ff9f40' : '#ff5a5a';
                      return (
                        <tr key={i}>
                          <td style={s.td}>{e.nome}</td>
                          <td style={s.td}>{e.cpf}</td>
                          <td style={s.td}><span style={tipoBadgeStyle(e.tipo)}>{tipoLabel(e.tipo)}</span></td>
                          <td style={s.td}>{e.entregas}</td>
                          <td style={s.td}>{e.total}</td>
                          <td style={s.td}>
                            <div style={s.barWrap}>
                              <div style={{ ...s.barFill, width: `${pct}%`, background: color }}></div>
                            </div>
                            <span style={{ ...s.pctLabel, color }}>{pct.toFixed(1)}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'app' && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Uso do App por Motorista</div>
            {appUsage.length === 0 ? (
              <div style={s.empty}>Nenhum dado de uso do app encontrado.</div>
            ) : (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Motorista</th>
                      <th style={s.th}>CPF</th>
                      <th style={s.th}>Tipo</th>
                      <th style={s.th}>APP</th>
                      <th style={s.th}>BASE</th>
                      <th style={s.th}>Sem Origem</th>
                      <th style={s.th}>Total</th>
                      <th style={{ ...s.th, minWidth: 200 }}>% APP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appUsage.map((a, i) => {
                      const pct = Number(a.pct_app) || 0;
                      return (
                        <tr key={i}>
                          <td style={s.td}>{a.nome}</td>
                          <td style={s.td}>{a.cpf}</td>
                          <td style={s.td}><span style={tipoBadgeStyle(a.tipo)}>{tipoLabel(a.tipo)}</span></td>
                          <td style={{ ...s.td, color: '#3de8a0' }}>{a.app}</td>
                          <td style={{ ...s.td, color: '#ff9f40' }}>{a.base}</td>
                          <td style={{ ...s.td, color: '#6b7280' }}>{a.sem_origem}</td>
                          <td style={s.td}>{a.total}</td>
                          <td style={s.td}>
                            <div style={s.barWrap}>
                              <div style={{ ...s.barFill, width: `${pct}%`, background: '#3de8a0' }}></div>
                              <div style={{ ...s.barFill, width: `${a.total > 0 ? ((a.base / a.total) * 100).toFixed(1) : 0}%`, background: '#ff9f40', position: 'absolute', left: `${pct}%` }}></div>
                            </div>
                            <span style={{ ...s.pctLabel, color: '#3de8a0' }}>{pct}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'aging' && (
          <div style={s.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={s.sectionTitle}>CTRCs Parados — Aging de Entregas</div>
                <div style={s.sectionSub}>CTRCs com ocorrência diferente de "MERCADORIA ENTREGUE", agrupados por cidade</div>
              </div>
              <button
                style={{ ...s.exportBtn, opacity: exportando ? 0.6 : 1 }}
                onClick={handleExportarExcel}
                disabled={exportando || ctrcsParados.length === 0}
              >
                {exportando ? 'Exportando...' : 'Exportar Excel'}
              </button>
            </div>

            <div style={s.agingCards}>
              <div style={{ ...s.agingCard, borderBottomColor: '#3de8a0' }}>
                <div style={s.agingLbl}>Total Parados</div>
                <div style={{ ...s.agingVal, color: '#3de8a0' }}>{totalParados}</div>
              </div>
              <div style={{ ...s.agingCard, borderBottomColor: '#6b7280' }}>
                <div style={s.agingLbl}>Ate 3 dias</div>
                <div style={{ ...s.agingVal, color: '#6b7280' }}>{totalAte3}</div>
              </div>
              <div style={{ ...s.agingCard, borderBottomColor: '#ff9f40' }}>
                <div style={s.agingLbl}>4-7 dias</div>
                <div style={{ ...s.agingVal, color: '#ff9f40' }}>{total4a7}</div>
              </div>
              <div style={{ ...s.agingCard, borderBottomColor: '#ff9f40' }}>
                <div style={s.agingLbl}>8-15 dias</div>
                <div style={{ ...s.agingVal, color: '#ff9f40' }}>{total8a15}</div>
              </div>
              <div style={{ ...s.agingCard, borderBottomColor: '#ff5a5a' }}>
                <div style={s.agingLbl}>16-30 dias</div>
                <div style={{ ...s.agingVal, color: '#ff5a5a' }}>{total16a30}</div>
              </div>
              <div style={{ ...s.agingCard, borderBottomColor: '#ff5a5a' }}>
                <div style={s.agingLbl}>+30 dias</div>
                <div style={{ ...s.agingVal, color: '#ff5a5a' }}>{totalMais30}</div>
              </div>
            </div>

            {ctrcsParados.length === 0 ? (
              <div style={s.empty}>Nenhum CTRC parado encontrado.</div>
            ) : (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Cidade</th>
                      <th style={s.th}>Ate 3 dias</th>
                      <th style={s.th}>4-7 dias</th>
                      <th style={s.th}>8-15 dias</th>
                      <th style={s.th}>16-30 dias</th>
                      <th style={s.th}>+30 dias</th>
                      <th style={s.th}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ctrcsParados.map((c, i) => (
                      <tr key={i}>
                        <td style={s.td}>{c.cidade_entrega}</td>
                        <td style={s.td}>{c.ate_3_dias}</td>
                        <td style={{ ...s.td, color: c.de_4_a_7 > 0 ? '#ff9f40' : '#e8eaf0' }}>{c.de_4_a_7}</td>
                        <td style={{ ...s.td, color: c.de_8_a_15 > 0 ? '#ff9f40' : '#e8eaf0' }}>{c.de_8_a_15}</td>
                        <td style={{ ...s.td, color: c.de_16_a_30 > 0 ? '#ff5a5a' : '#e8eaf0' }}>{c.de_16_a_30}</td>
                        <td style={{ ...s.td, color: c.mais_30 > 0 ? '#ff5a5a' : '#e8eaf0', fontWeight: c.mais_30 > 0 ? 600 : 400 }}>{c.mais_30}</td>
                        <td style={{ ...s.td, fontWeight: 600 }}>{c.total}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={{ ...s.td, fontWeight: 600, color: '#f0c040' }}>TOTAL</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{totalAte3}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{total4a7}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{total8a15}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{total16a30}</td>
                      <td style={{ ...s.td, fontWeight: 600, color: '#ff5a5a' }}>{totalMais30}</td>
                      <td style={{ ...s.td, fontWeight: 600, color: '#f0c040' }}>{totalParados}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'expedicao' && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Expedição — CT-e's Disponíveis</div>
            <div style={s.sectionSub}>CT-e's que não estão em rota e sem ocorrência finalizadora</div>

            {expedicao.length === 0 ? (
              <div style={s.empty}>Nenhum CT-e encontrado para expedição.</div>
            ) : (
              <>
                <div style={s.agingCards}>
                  <div style={{ ...s.agingCard, borderBottomColor: '#3de8a0' }}>
                    <div style={s.agingLbl}>Total CT-e's</div>
                    <div style={{ ...s.agingVal, color: '#3de8a0' }}>{expedicao.length}</div>
                  </div>
                  <div style={{ ...s.agingCard, borderBottomColor: '#0d6efd' }}>
                    <div style={s.agingLbl}>Cubagem Total (m³)</div>
                    <div style={{ ...s.agingVal, color: '#0d6efd' }}>{expedicao.reduce((s, r) => s + (Number(r.cubagem_m3) || 0), 0).toFixed(3)}</div>
                  </div>
                  <div style={{ ...s.agingCard, borderBottomColor: '#f0c040' }}>
                    <div style={s.agingLbl}>Valor Mercadoria (R$)</div>
                    <div style={{ ...s.agingVal, color: '#f0c040' }}>{expedicao.reduce((s, r) => s + (Number(r.valor_mercadoria) || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                  </div>
                </div>

                <div style={s.tableWrap}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>CTRC</th>
                        <th style={s.th}>Cliente</th>
                        <th style={s.th}>Cidade</th>
                        <th style={s.th}>Unidade</th>
                        <th style={s.th}>Cubagem (m³)</th>
                        <th style={s.th}>Valor Mercadoria</th>
                        <th style={s.th}>Setor Destino</th>
                        <th style={s.th}>Data Emissão</th>
                        <th style={s.th}>Ocorrência</th>
                        <th style={s.th}>Resumo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expedicao.map((r, i) => (
                        <tr key={i}>
                          <td style={s.td}>{r.ctrc}</td>
                          <td style={s.td}>{r.cliente_pagador}</td>
                          <td style={s.td}>{r.cidade_entrega}</td>
                          <td style={s.td}>{r.unidade_receptora}</td>
                          <td style={s.td}>{Number(r.cubagem_m3 || 0).toFixed(3)}</td>
                          <td style={s.td}>{Number(r.valor_mercadoria || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          <td style={s.td}>{r.setor_destino || '—'}</td>
                          <td style={s.td}>{r.data_emissao ? new Date(r.data_emissao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                          <td style={{ ...s.td, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.ocorrencia || '—'}</td>
                          <td style={s.td}>{r.resumo}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={{ ...s.td, fontWeight: 600, color: '#f0c040' }}>TOTAL</td>
                        <td style={s.td}></td>
                        <td style={s.td}></td>
                        <td style={s.td}></td>
                        <td style={{ ...s.td, fontWeight: 600, color: '#0d6efd' }}>{expedicao.reduce((s, r) => s + (Number(r.cubagem_m3) || 0), 0).toFixed(3)}</td>
                        <td style={{ ...s.td, fontWeight: 600, color: '#f0c040' }}>{expedicao.reduce((s, r) => s + (Number(r.valor_mercadoria) || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td style={s.td}></td>
                        <td style={s.td}></td>
                        <td style={s.td}></td>
                        <td style={{ ...s.td, fontWeight: 600, color: '#f0c040' }}>{expedicao.length}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
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
  loading: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, color: '#6b7280' },
  spinner: { width: 36, height: 36, border: '3px solid #2a2f3e', borderTopColor: '#f0c040', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  filterBar: { display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 24, background: '#161920', border: '1px solid #2a2f3e', borderRadius: 8, padding: '16px 20px' },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  filterLabel: { fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' },
  filterInput: { background: '#1e2230', border: '1px solid #2a2f3e', color: '#e8eaf0', padding: '8px 12px', borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.82rem', minWidth: 150 },
  filterBtn: { background: '#f0c040', color: '#0d0f14', border: 'none', padding: '9px 24px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 1 },
  tabBar: { display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  tabBtn: { background: '#1e2230', border: '1px solid #2a2f3e', color: '#6b7280', padding: '10px 20px', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', fontFamily: "'IBM Plex Mono', monospace", transition: 'all .15s' },
  tabBtnActive: { background: '#1e2230', borderColor: '#f0c040', color: '#f0c040' },
  section: { marginBottom: 32 },
  sectionTitle: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '2px', color: '#f0c040', marginBottom: 16 },
  sectionSub: { color: '#6b7280', fontSize: '0.8rem', marginBottom: 16 },
  tableWrap: { background: '#161920', border: '1px solid #2a2f3e', borderRadius: 8, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #2a2f3e', background: '#1e2230', fontFamily: "'IBM Plex Mono', monospace" },
  td: { padding: '10px 14px', fontSize: '0.82rem', borderBottom: '1px solid #2a2f3e', color: '#e8eaf0', fontFamily: "'IBM Plex Mono', monospace" },
  barWrap: { display: 'inline-block', width: 120, height: 8, background: '#2a2f3e', borderRadius: 4, position: 'relative', verticalAlign: 'middle', marginRight: 8 },
  barFill: { height: '100%', borderRadius: 4, position: 'absolute', top: 0, left: 0 },
  pctLabel: { fontSize: '0.78rem', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 },
  agingCards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 },
  agingCard: { background: '#161920', border: '1px solid #2a2f3e', borderRadius: 8, padding: '16px', display: 'flex', flexDirection: 'column', gap: 4 },
  agingLbl: { fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' },
  agingVal: { fontSize: '1.4rem', fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" },
  empty: { textAlign: 'center', color: '#6b7280', padding: 40, fontSize: '0.9rem' },
  exportBtn: { background: '#198754', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', fontFamily: "'IBM Plex Mono', monospace", transition: 'all .15s', whiteSpace: 'nowrap' },
};
