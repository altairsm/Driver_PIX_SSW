import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDriverDashboard, getDriverRomaneios, getDriverRomaneioDetalhes, getDriverMe, getQuinzenas, getProdutividade, getEficiencia, solicitarPagamento, getConfig, getTaxasAdiantamento, getBonusD0, getAppUsage } from '../services/api';

function formatDate(d) {
  if (!d) return '—';
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : String(d);
}

function formatMoney(v) {
  const n = Number(v) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calcPagamento(endDate, diasUteis) {
  const d = new Date(endDate);
  d.setUTCDate(d.getUTCDate() + 1);
  let uteis = 0;
  while (uteis < diasUteis) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) uteis++;
    if (uteis < diasUteis) d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

const TABS = [
  { id: 'resumo', label: 'Resumo', icon: '📋' },
  { id: 'produtividade', label: 'Produção', icon: '📦' },
  { id: 'eficiencia', label: 'Eficiência', icon: '📊' },
  { id: 'romaneios', label: 'Romaneios', icon: '🚚' },
];

export default function DriverDashboard() {
  const navigate = useNavigate();
  const [driver, setDriver] = useState(null);
  const [quinzenas, setQuinzenas] = useState([]);
  const [qzIdx, setQzIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [dashboard, setDashboard] = useState(null);
  const [romaneios, setRomaneios] = useState([]);
  const [prods, setProds] = useState([]);
  const [bonusD0, setBonusD0] = useState(null);
  const [appUsage, setAppUsage] = useState(null);
  const [eficiencia, setEficiencia] = useState([]);
  const [expandido, setExpandido] = useState({});
  const [solicitando, setSolicitando] = useState(null);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [config, setConfig] = useState(null);
  const [taxas, setTaxas] = useState([]);
  const [activeTab, setActiveTab] = useState('resumo');
  const [menuOpen, setMenuOpen] = useState(false);
  const [detalhesRomaneio, setDetalhesRomaneio] = useState({});

  const qzAtual = quinzenas[qzIdx] || null;

  const fetchQuinzenaData = useCallback(async (inicio, fim) => {
    try {
      const [dash, roms, prod, ef, bD0, app] = await Promise.all([
        getDriverDashboard(inicio, fim),
        getDriverRomaneios(inicio, fim),
        getProdutividade(inicio, fim),
        getEficiencia(),
        getBonusD0(inicio, fim).catch(() => null),
        getAppUsage(inicio, fim).catch(() => null),
      ]);
      setDashboard(dash);
      setRomaneios(roms);
      setProds(prod);
      setEficiencia(ef);
      setBonusD0(bD0);
      setAppUsage(app);
    } catch (err) {
      setError('Erro ao carregar dados da quinzena');
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const me = await getDriverMe();
        setDriver(me);
        const userLS = JSON.parse(localStorage.getItem('user') || '{}');
        if (!me.leu_regras && !userLS.leu_regras) {
          navigate('/driver/regras-pagamento');
          return;
        }
        const [qzs, cfg, tx] = await Promise.all([getQuinzenas(), getConfig(), getTaxasAdiantamento()]);
        setQuinzenas(qzs);
        setConfig(cfg);
        setTaxas(tx);
        if (qzs.length > 0) {
          const q = qzs[0];
          await fetchQuinzenaData(q.inicio, q.fim);
        }
      } catch (e) {
        setError('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [fetchQuinzenaData, navigate]);

  const handlePrev = async () => {
    if (qzIdx < quinzenas.length - 1) {
      const ni = qzIdx + 1;
      setQzIdx(ni);
      const q = quinzenas[ni];
      await fetchQuinzenaData(q.inicio, q.fim);
    }
  };

  const handleNext = async () => {
    if (qzIdx > 0) {
      const ni = qzIdx - 1;
      setQzIdx(ni);
      const q = quinzenas[ni];
      await fetchQuinzenaData(q.inicio, q.fim);
    }
  };

  const toggleExpandido = (id) => {
    if (!expandido[id] && !detalhesRomaneio[id]) {
      getDriverRomaneioDetalhes(id, qzAtual.inicio, qzAtual.fim).then(ctrcs => {
        setDetalhesRomaneio(prev => ({ ...prev, [id]: ctrcs }));
      }).catch(() => {});
    }
    setExpandido(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSolicitar = async (rom) => {
    setSolicitando(rom.id_romaneio);
    setMsg({ text: '', type: '' });
    try {
      const result = await solicitarPagamento(rom.id_romaneio);
      if (result.success) {
        setMsg({ text: `✅ Romaneio #${rom.id_romaneio}: ${result.motivo}`, type: 'ok' });
        await fetchQuinzenaData(qzAtual.inicio, qzAtual.fim);
      } else {
        setMsg({ text: `❌ ${result.motivo}`, type: 'err' });
      }
    } catch (err) {
      setMsg({ text: `❌ ${err.response?.data?.error || err.message}`, type: 'err' });
    } finally {
      setSolicitando(null);
    }
    setTimeout(() => setMsg({ text: '', type: '' }), 5000);
  };

  const entregasQ = eficiencia.filter(e => e.evento === 'entrega');
  const totalEventos = eficiencia.reduce((s, e) => s + Number(e.quantidade), 0);
  const totalEntregas = entregasQ.reduce((s, e) => s + Number(e.quantidade), 0);
  const totalInsucessos = eficiencia.filter(e => e.evento === 'insucesso').reduce((s, e) => s + Number(e.quantidade), 0);
  const pctEficiencia = totalEventos > 0 ? ((totalEntregas / totalEventos) * 100) : 0;

  const qzLabel = qzAtual ? `${formatDate(qzAtual.inicio)} — ${formatDate(qzAtual.fim)}` : 'SEM DADOS';
  const qzPos = quinzenas.length > 1 ? ` (${qzIdx + 1}/${quinzenas.length})` : '';
  const pagamentoDate = qzAtual ? calcPagamento(qzAtual.fim, config?.dias_uteis_pagamento || 4) : null;
  const prodMaxCtes = Math.max(...prods.map(p => Number(p.ctrcs)), 1);

  if (loading) {
    return (
      <div style={s.container}>
        <div style={s.loading}>
          <div style={s.spinner}></div>
          <span>CARREGANDO...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <div style={s.topbar}>
        <div style={s.brand}>DRIVER PIX - SSW</div>
        <button style={s.menuBtn} onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {menuOpen && (
        <>
          <div style={s.overlay} onClick={() => setMenuOpen(false)} />
          <div style={s.drawer}>
            <div style={s.drawerHeader}>
              <div style={s.drawerName}>{driver?.nome?.toUpperCase() || 'MOTORISTA'}</div>
              <div style={s.drawerCpf}>CPF {driver?.cpf || '—'}</div>
            </div>
            <div style={s.drawerDivider} />
            <button style={s.drawerItem} onClick={() => { setMenuOpen(false); navigate('/driver/regras-pagamento'); }}>📋 Regras de Pagamento</button>
            <button style={s.drawerItem} onClick={() => { setMenuOpen(false); navigate('/driver/meus-dados'); }}>👤 Meus Dados</button>
            <div style={s.drawerDivider} />
            <button style={{ ...s.drawerItem, color: '#ff5a5a' }} onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = '/login'; }}>⏻ Sair</button>
          </div>
        </>
      )}

      <div style={s.content}>
        {error && <div style={s.error}>{error}</div>}

        <div style={s.hero}>
          <div style={s.heroName}>
            <em style={s.heroNameEm}>{driver?.nome?.split(' ').slice(0, 2).join(' ')?.toUpperCase() || 'MOTORISTA'}</em>
          </div>
          <div style={s.heroCpf}>CPF {driver?.cpf || '—'}</div>

          <div style={s.qzNav}>
            <div style={s.qzLabelSmall}>Selecionar Quinzena</div>
            <div style={s.qzNavRow}>
              <button onClick={handlePrev} disabled={qzIdx >= quinzenas.length - 1} style={{ ...s.qzBtn, opacity: qzIdx >= quinzenas.length - 1 ? 0.3 : 1 }}>&#8249;</button>
              <div style={s.qzBadge}>{qzLabel}{qzPos}</div>
              <button onClick={handleNext} disabled={qzIdx <= 0} style={{ ...s.qzBtn, opacity: qzIdx <= 0 ? 0.3 : 1 }}>&#8250;</button>
            </div>
            {pagamentoDate && (
              <div style={s.pagLabel}>
                💰 PAGAMENTO: <span style={s.pagData}>{pagamentoDate.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'long' })}</span>
              </div>
            )}
          </div>
        </div>

        <div style={s.kpiScroll}>
          <div style={{ ...s.kpiCard, borderBottomColor: '#3de8a0' }}>
            <div style={s.kpiLabel}>CTRCs Entregues</div>
            <div style={{ ...s.kpiValue, color: '#3de8a0' }}>{dashboard?.total_ctrcs || 0}</div>
          </div>
          <div style={{ ...s.kpiCard, borderBottomColor: '#ff9f40' }}>
            <div style={s.kpiLabel}>Romaneios</div>
            <div style={{ ...s.kpiValue, color: '#ff9f40' }}>{dashboard?.total_romaneios || 0}</div>
          </div>
          <div style={{ ...s.kpiCard, borderBottomColor: '#ff5a5a' }}>
            <div style={s.kpiLabel}>Insucessos</div>
            <div style={{ ...s.kpiValue, color: '#ff5a5a' }}>{totalInsucessos}</div>
          </div>
          <div style={{ ...s.kpiCard, borderBottomColor: '#3de8a0', minWidth: 140 }}>
            <div style={s.kpiLabel}>Total a Receber</div>
            <div style={{ ...s.kpiValue, color: '#3de8a0', fontSize: '1.2rem' }}>{formatMoney(dashboard?.receita_total)}</div>
            <div style={s.kpiDetail}>por cidade</div>
          </div>
        </div>

        <div style={s.tabBar}>
          {TABS.map(t => (
            <button key={t.id} style={{ ...s.tabBtn, ...(activeTab === t.id ? s.tabBtnActive : {}) }} onClick={() => setActiveTab(t.id)}>
              <span style={s.tabIcon}>{t.icon}</span>
              <span style={s.tabLabel}>{t.label}</span>
            </button>
          ))}
        </div>

        <div style={s.tabContent}>
          {activeTab === 'resumo' && (
            <div style={s.section}>
              <div style={s.sectionTitle}>📋 RESUMO DA QUINZENA</div>
              <div style={s.sectionSub}>Visão geral do seu desempenho</div>
              <div style={s.resumoGrid}>
                <div style={s.resumoItem}>
                  <div style={s.resumoLbl}>Eficiência</div>
                  <div style={{ ...s.resumoVal, color: pctEficiencia < 70 ? '#ff5a5a' : pctEficiencia < 85 ? '#ff9f40' : '#3de8a0' }}>{pctEficiencia.toFixed(2).replace('.', ',')}%</div>
                </div>
                <div style={s.resumoItem}>
                  <div style={s.resumoLbl}>CTRCs</div>
                  <div style={{ ...s.resumoVal, color: '#3de8a0' }}>{dashboard?.total_ctrcs || 0}</div>
                </div>
                <div style={s.resumoItem}>
                  <div style={s.resumoLbl}>Dias</div>
                  <div style={{ ...s.resumoVal, color: '#f0c040' }}>{prods.length}</div>
                </div>
                <div style={s.resumoItem}>
                  <div style={s.resumoLbl}>Insucessos</div>
                  <div style={{ ...s.resumoVal, color: '#ff9f40' }}>{totalInsucessos}</div>
                </div>
              </div>
              {appUsage && appUsage.total > 0 && (
                <div style={s.appCard}>
                  <div style={s.appCardTitle}>📱 USO DO APP</div>
                  <div style={s.appCardSub}>Registros por origem</div>
                  <div style={s.appBarTrack}>
                    <div style={{ ...s.appBarFill, width: `${appUsage.pct_app}%`, background: '#3de8a0' }}></div>
                    <div style={{ ...s.appBarFill, width: `${appUsage.total_base > 0 ? (appUsage.total_base / appUsage.total * 100).toFixed(1) : 0}%`, background: '#ff9f40', left: `${appUsage.pct_app}%` }}></div>
                  </div>
                  <div style={s.appStats}>
                    <span style={{ color: '#3de8a0' }}>APP {appUsage.total_app}</span>
                    <span style={{ color: '#ff9f40' }}>BASE {appUsage.total_base}</span>
                    <span style={{ color: '#6b7280' }}>{appUsage.pct_app}% via app</span>
                  </div>
                </div>
              )}
              {pagamentoDate && (
                <div style={s.pagCard}>
                  <div style={s.pagCardLbl}>💰 Previsão de Pagamento</div>
                  <div style={s.pagCardVal}>{pagamentoDate.toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
                  <div style={s.pagCardTotal}>{formatMoney(dashboard?.receita_total)}</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'produtividade' && (
            <>
              {bonusD0?.valor_unitario > 0 && (
                <div style={s.section}>
                  <div style={{ ...s.sectionTitle, color: '#3de8a0' }}>🏆 BÔNUS D0</div>
                  <div style={s.sectionSub}>Entrega no mesmo dia da emissão</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.9rem', color: '#3de8a0', marginBottom: 12, letterSpacing: '2px' }}>
                    Total: R$ {bonusD0.total_bonus.toFixed(2)} · {bonusD0.total_entregas} entregas · R$ {bonusD0.valor_unitario.toFixed(2)}/un
                  </div>
                  <div style={s.barChart}>
                    {(() => {
                      const maxVal = Math.max(...bonusD0.dias.map(d => Number(d.valor_total)), 1);
                      return bonusD0.dias.map(d => {
                        const pct = (Number(d.valor_total) / maxVal * 100).toFixed(1);
                        return (
                          <div key={d.data} style={s.barRow}>
                            <div style={s.barLabel}>{formatDate(d.data)}</div>
                            <div style={s.barTrack}>
                              <div style={{ ...s.barFill, background: '#3de8a0', width: `${pct}%` }}></div>
                            </div>
                            <div style={s.barVal}>{d.entregas_d0}</div>
                          </div>
                        );
                      });
                    })()}
                    {bonusD0.dias.length === 0 && <div style={s.empty}>Nenhum registro D0 na quinzena</div>}
                  </div>
                </div>
              )}
              <div style={s.section}>
                <div style={s.sectionTitle}>📦 PRODUTIVIDADE</div>
                <div style={s.sectionSub}>Entregas por data</div>
                <div style={s.barChart}>
                  {prods.map(p => {
                    const pct = (Number(p.ctrcs) / prodMaxCtes * 100).toFixed(1);
                    return (
                      <div key={p.data} style={s.barRow}>
                        <div style={s.barLabel}>{formatDate(p.data)}</div>
                        <div style={s.barTrack}>
                          <div style={{ ...s.barFill, width: `${pct}%` }}></div>
                        </div>
                        <div style={s.barVal}>{p.ctrcs}</div>
                      </div>
                    );
                  })}
                  {prods.length === 0 && <div style={s.empty}>Nenhum registro na quinzena</div>}
                </div>
              </div>
            </>
          )}

          {activeTab === 'eficiencia' && (
            <div style={s.section}>
              <div style={s.sectionTitle}>📊 EFICIÊNCIA</div>
              <div style={s.sectionSub}>Proporção de entregas × insucessos — últimos 30 dias</div>
              <div style={s.gaugeWrap}>
                <div style={s.gaugeRing}>
                  <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#2a2f3e" strokeWidth="10" />
                    <circle cx="60" cy="60" r="50" fill="none"
                      stroke={pctEficiencia < 95 ? '#ff5a5a' : pctEficiencia < 97 ? '#ff9f40' : '#3de8a0'}
                      strokeWidth="10"
                      strokeDasharray="314"
                      strokeDashoffset={314 - (pctEficiencia / 100) * 314}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.23,1,.32,1)' }} />
                  </svg>
                  <div style={s.gaugeCenter}>
                    <div style={{ ...s.gaugePct, color: pctEficiencia < 70 ? '#ff5a5a' : pctEficiencia < 85 ? '#ff9f40' : '#3de8a0' }}>{pctEficiencia.toFixed(2).replace('.', ',')}%</div>
                    <div style={s.gaugeSubLabel}>eficiência</div>
                  </div>
                </div>
                <div style={s.gaugeStats}>
                  <div style={s.gaugeRow}><span style={s.gaugeLbl}>TOTAL EVENTOS</span><span style={s.gaugeVal}>{totalEventos}</span></div>
                  <div style={s.gaugeRow}><span style={s.gaugeLbl}>ENTREGAS</span><span style={s.gaugeVal}>{totalEntregas}</span></div>
                  <div style={s.gaugeRow}><span style={s.gaugeLbl}>INSUCESSOS</span><span style={s.gaugeVal}>{totalInsucessos}</span></div>
                </div>
              </div>
              {eficiencia.map(e => {
                const pct = totalEventos > 0 ? ((Number(e.quantidade) / totalEventos) * 100).toFixed(1) : '0.0';
                const isIns = e.evento === 'insucesso';
                return (
                  <div key={e.evento} style={{ ...s.efCard, borderLeftColor: isIns ? '#ff9f40' : '#3de8a0' }}>
                    <div style={s.efCardEvento}>
                      {e.evento.toUpperCase()}
                      {isIns && <span style={s.badgeWarn}>INSUCESSO</span>}
                    </div>
                    <div style={s.efCardNums}>
                      <span style={s.efCardQtd}>{e.quantidade}</span>
                      <span style={s.efCardPct}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
              {eficiencia.length === 0 && <div style={s.empty}>Sem dados de eficiência.</div>}
            </div>
          )}

          {activeTab === 'romaneios' && (
            <div style={s.section}>
              <div style={{ ...s.sectionTitle, justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span>🚚 ROMANEIOS DA QUINZENA</span>
                <a href="/driver/regras-pagamento" target="_blank" rel="noopener noreferrer" style={s.regrasLink}>📋 Regras</a>
              </div>
              <div style={s.sectionSub}>Adiantamento disponível por romaneio</div>
              {msg.text && (
                <div style={{ ...s.solicMsg, color: msg.type === 'ok' ? '#3de8a0' : '#ff5a5a', background: msg.type === 'ok' ? '#1a3a2a' : '#3a1a1a', border: `1px solid ${msg.type === 'ok' ? '#3de8a0' : '#ff5a5a'}` }}>
                  {msg.text}
                </div>
              )}
              {romaneios.length === 0 ? (
                <div style={s.empty}>Nenhum romaneio encontrado para esta quinzena.</div>
              ) : (
                <>
                  {romaneios.map((rom) => {
                    const solInfo = rom.solicitacao_info || {};
                    const hasSolic = solInfo.status && solInfo.status !== 'recusado';
                    const isPreAprovado = driver?.pre_aprovado === true;
                    const elegivel = !hasSolic && rom.ctrcs_vinculados > 0 && Number(rom.valor_total) > 0;

                    return (
                      <div key={rom.id_romaneio} style={s.romCard}>
                        <div style={s.romCardHeader}>
                          <div>
                            <div style={s.romNumero}>#{rom.id_romaneio}</div>
                            <div style={s.romData}>{formatDate(rom.data_emissao)}</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <span style={{ ...s.badgeStatus, color: rom.situacao === 'Finalizado' ? '#3de8a0' : '#ff9f40', background: `${rom.situacao === 'Finalizado' ? '#3de8a0' : '#ff9f40'}22` }}>
                              {rom.situacao || 'EM ABERTO'}
                            </span>
                            {hasSolic && (
                              <span style={{ ...s.badgeStatus, color: solInfo.status === 'aprovado' ? '#3de8a0' : '#ff9f40', background: `${solInfo.status === 'aprovado' ? '#3de8a0' : '#ff9f40'}22`, fontSize: '0.5rem' }}>
                                {solInfo.pix_enviado ? 'PIX ENVIADO' : `ADIANT. ${solInfo.status.toUpperCase()}`}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={s.romStats}>
                          <div style={s.romStat}>
                            <div style={s.romStatVal}>{rom.ctrcs_vinculados}</div>
                            <div style={s.romStatLbl}>CTRCs</div>
                          </div>
                          <div style={s.romStat}>
                            <div style={{ ...s.romStatVal, color: '#f0c040' }}>{formatMoney(rom.valor_total)}</div>
                            <div style={s.romStatLbl}>Valor</div>
                          </div>
                        </div>

                        {isPreAprovado && elegivel && (
                          <div style={{ ...s.solicMsg, color: '#3de8a0', background: '#1a3a2a', border: '1px solid #3de8a0', fontSize: '0.62rem', marginBottom: 8 }}>
                            Motorista pré-aprovado · PIX automático ao solicitar
                          </div>
                        )}

                        {expandido[rom.id_romaneio] && detalhesRomaneio[rom.id_romaneio] && (
                          <div style={s.romDetalhes}>
                            <div style={s.romDetalhesTitle}>RESUMO POR BAIRRO</div>
                            <div style={s.romDetalhesTable}>
                              <div style={s.romDetalhesHeader}>
                                <span style={s.romDetHdr}>CIDADE</span>
                                <span style={s.romDetHdr}>BAIRRO</span>
                                <span style={s.romDetHdr}>QTD</span>
                                <span style={s.romDetHdr}>VALOR TOTAL</span>
                              </div>
                              {detalhesRomaneio[rom.id_romaneio].map((item, i) => (
                                <div key={i} style={{ ...s.romDetalhesRow, borderBottom: i < detalhesRomaneio[rom.id_romaneio].length - 1 ? '1px solid #2a2f3e' : 'none' }}>
                                  <span style={s.romDetCidade}>{item.cidade_entrega}</span>
                                  <span style={s.romDetBairro}>{item.bairro}</span>
                                  <span style={s.romDetQtd}>{item.quantidade}</span>
                                  <span style={s.romDetValor}>{formatMoney(item.valor_total)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <button style={s.romDetalhesBtn} onClick={() => toggleExpandido(rom.id_romaneio)}>
                          {expandido[rom.id_romaneio] ? '▲ RECOLHER' : '▼ VER BAIRROS'}
                        </button>

                        <button
                          onClick={() => handleSolicitar(rom)}
                          disabled={!elegivel || solicitando === rom.id_romaneio}
                          title={!elegivel ? 'Romaneio não elegível para adiantamento' : ''}
                          style={{ ...s.btnSolicitar, ...(!elegivel ? s.btnSolicitarDisabled : {}), marginTop: 10, width: '100%' }}
                        >
                          {solicitando === rom.id_romaneio ? '...' : hasSolic ? 'ADIANTAMENTO SOLICITADO' : isPreAprovado ? '⚡ Solicitar Adiantamento (PIX Automático)' : 'Solicitar 50% do Valor das Entregas'}
                        </button>
                      </div>
                    );
                  })}

                  <div style={s.totalRodape}>
                    <div style={s.totalRodapeLbl}>Total da Quinzena</div>
                    <div style={s.totalRodapeVal}>{formatMoney(romaneios.reduce((s, r) => s + Number(r.valor_total), 0))}</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={s.footer}>DRIVER PIX · INTUITIVA LOG · SSW</div>
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: '#0d0f14', color: '#e8eaf0', fontFamily: "'IBM Plex Sans', sans-serif" },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12, fontFamily: "'IBM Plex Mono', monospace", color: '#6b7280', fontSize: '0.8rem', letterSpacing: '2px', flexDirection: 'column' },
  spinner: { width: 24, height: 24, border: '2px solid #2a2f3e', borderTopColor: '#f0c040', borderRadius: '50%', animation: 'spin .7s linear infinite' },
  topbar: { background: '#161920', borderBottom: '1px solid #2a2f3e', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52, position: 'sticky', top: 0, zIndex: 100 },
  brand: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem', letterSpacing: '3px', color: '#f0c040' },
  menuBtn: { background: 'transparent', border: '1px solid #2a2f3e', color: '#e8eaf0', width: 36, height: 36, cursor: 'pointer', fontSize: '1rem', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 200 },
  drawer: { position: 'fixed', top: 0, right: 0, width: 260, height: '100%', background: '#161920', borderLeft: '1px solid #2a2f3e', zIndex: 201, display: 'flex', flexDirection: 'column', padding: '20px 0' },
  drawerHeader: { padding: '0 20px 20px' },
  drawerName: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', letterSpacing: '2px', color: '#e8eaf0' },
  drawerCpf: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#6b7280', letterSpacing: '1px', marginTop: 4 },
  drawerDivider: { height: 1, background: '#2a2f3e', margin: '8px 0' },
  drawerItem: { background: 'transparent', border: 'none', color: '#e8eaf0', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.8rem', letterSpacing: '1px', padding: '14px 20px', cursor: 'pointer', textAlign: 'left', width: '100%' },
  content: { maxWidth: 600, margin: '0 auto', paddingBottom: 80 },
  error: { background: '#2a1a1a', border: '1px solid #ff5a5a', color: '#ff5a5a', padding: '12px 16px', margin: '12px 16px', fontSize: '0.85rem', borderRadius: 4 },
  hero: { padding: '24px 16px 0' },
  heroName: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2rem, 10vw, 3.5rem)', letterSpacing: '3px', lineHeight: 1, color: '#e8eaf0' },
  heroNameEm: { color: '#f0c040', fontStyle: 'normal' },
  heroCpf: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#6b7280', letterSpacing: '2px', marginTop: 4 },
  qzNav: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  qzLabelSmall: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '2px', color: '#6b7280', textTransform: 'uppercase' },
  qzNavRow: { display: 'flex', alignItems: 'center', gap: 6 },
  qzBtn: { background: '#2a2f3e', border: '1px solid #3a3f4e', color: '#f0c040', width: 44, height: 44, borderRadius: 8, cursor: 'pointer', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' },
  qzBadge: { flex: 1, background: '#1e2230', border: '1px solid #2a2f3e', borderLeft: 'none', borderRight: 'none', padding: '10px 12px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem', letterSpacing: '1px', color: '#3de8a0', textAlign: 'center' },
  pagLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#3de8a0', letterSpacing: '1px' },
  pagData: { fontWeight: 600, color: '#f0c040' },
  kpiScroll: { display: 'flex', gap: 1, background: '#2a2f3e', overflowX: 'auto', margin: '16px 0 0', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' },
  kpiCard: { background: '#161920', padding: '16px 14px', borderBottom: '2px solid #3de8a0', flexShrink: 0, minWidth: 110 },
  kpiLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#6b7280', marginBottom: 8 },
  kpiValue: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', letterSpacing: '2px', lineHeight: 1 },
  kpiDetail: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#6b7280', marginTop: 4 },
  tabBar: { display: 'flex', background: '#161920', borderBottom: '1px solid #2a2f3e', position: 'sticky', top: 52, zIndex: 90, overflowX: 'auto', scrollbarWidth: 'none' },
  tabBtn: { flex: '1 0 auto', background: 'transparent', border: 'none', color: '#6b7280', padding: '10px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, transition: 'color .15s', borderBottom: '2px solid transparent', minWidth: 60 },
  tabBtnActive: { color: '#f0c040', borderBottomColor: '#f0c040' },
  tabIcon: { fontSize: '1rem' },
  tabLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  tabContent: { padding: '0 0 16px' },
  section: { padding: '20px 16px' },
  sectionTitle: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', letterSpacing: '3px', color: '#f0c040', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 },
  sectionSub: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#6b7280', letterSpacing: '1px', marginBottom: 16 },
  resumoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 },
  resumoItem: { background: '#161920', border: '1px solid #2a2f3e', padding: '16px 14px', borderRadius: 4 },
  resumoLbl: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#6b7280', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8 },
  resumoVal: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.2rem', lineHeight: 1, color: '#e8eaf0' },
  pagCard: { background: '#1e2230', border: '1px solid #2a2f3e', borderLeft: '3px solid #3de8a0', padding: '16px', borderRadius: 4 },
  pagCardLbl: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#6b7280', letterSpacing: '1px', marginBottom: 6 },
  pagCardVal: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.8rem', color: '#e8eaf0', marginBottom: 8 },
  pagCardTotal: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', color: '#3de8a0', letterSpacing: '2px' },
  barChart: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 },
  barRow: { display: 'flex', alignItems: 'center', gap: 10 },
  barLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#6b7280', width: 72, flexShrink: 0, textAlign: 'right' },
  barTrack: { flex: 1, background: '#1e2230', height: 18, position: 'relative', overflow: 'hidden' },
  barFill: { height: '100%', background: '#f0c040', transition: 'width 1s cubic-bezier(.23,1,.32,1)' },
  barVal: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#e8eaf0', width: 28, flexShrink: 0 },
  gaugeWrap: { display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 20 },
  gaugeRing: { position: 'relative', width: 120, height: 120, flexShrink: 0 },
  gaugeCenter: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  gaugePct: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', lineHeight: 1 },
  gaugeSubLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#6b7280', letterSpacing: '1px', marginTop: 4 },
  gaugeStats: { flex: 1 },
  gaugeRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2a2f3e', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem' },
  gaugeLbl: { color: '#6b7280' },
  gaugeVal: { color: '#e8eaf0', fontWeight: 600 },
  efCard: { background: '#161920', border: '1px solid #2a2f3e', borderLeft: '3px solid #3de8a0', padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 2 },
  efCardEvento: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', color: '#e8eaf0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 },
  efCardNums: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  efCardQtd: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', color: '#e8eaf0', lineHeight: 1 },
  efCardPct: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#6b7280' },
  badgeWarn: { display: 'inline-block', padding: '2px 6px', fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', monospace", borderRadius: 2, background: 'rgba(255,159,64,.15)', color: '#ff9f40' },
  romCard: { background: '#161920', border: '1px solid #2a2f3e', padding: '14px', marginBottom: 10, borderRadius: 4 },
  romCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  romNumero: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem', letterSpacing: '2px', color: '#f0c040', lineHeight: 1 },
  romData: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#6b7280', letterSpacing: '1px', marginTop: 2 },
  romStats: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 },
  romStat: { textAlign: 'center', background: '#0d0f14', padding: '8px 4px', borderRadius: 2 },
  romStatVal: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', color: '#3de8a0', lineHeight: 1 },
  romStatLbl: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#6b7280', letterSpacing: '1px', textTransform: 'uppercase', marginTop: 2 },
  romDetalhes: { background: '#1e2230', borderRadius: 4, padding: 10, marginTop: 8 },
  romDetalhesTitle: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#f0c040', letterSpacing: '1px', marginBottom: 8 },
  romDetalhesTable: { display: 'flex', flexDirection: 'column', gap: 4 },
  romDetalhesHeader: { display: 'flex', justifyContent: 'space-between', fontSize: '0.5rem', fontFamily: "'IBM Plex Mono', monospace", color: '#6b7280', letterSpacing: '1px', padding: '3px 0', borderBottom: '1px solid #2a2f3e', marginBottom: 4 },
  romDetHdr: { flex: 1, textAlign: 'center' },
  romDetalhesRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontFamily: "'IBM Plex Mono', monospace", padding: '3px 0' },
  romDetCidade: { flex: 1, textAlign: 'center', color: '#e8eaf0' },
  romDetBairro: { flex: 1, textAlign: 'center', color: '#6b7280' },
  romDetQtd: { flex: 0.5, textAlign: 'center', color: '#f0c040' },
  romDetValor: { flex: 1, textAlign: 'center', color: '#3de8a0' },
  romDetalhesBtn: { background: 'transparent', border: '1px solid #2a2f3e', color: '#6b7280', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', letterSpacing: '1px', padding: '6px', cursor: 'pointer', borderRadius: 2, width: '100%', marginTop: 6 },
  badgeStatus: { display: 'inline-block', padding: '3px 8px', fontSize: '0.55rem', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', monospace", borderRadius: 2 },
  regrasLink: { color: '#5ab4ff', textDecoration: 'none', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '1px', border: '1px solid #5ab4ff', padding: '4px 10px', borderRadius: 4 },
  btnSolicitar: { background: 'rgba(61,232,160,.15)', border: '1px solid #3de8a0', color: '#3de8a0', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '1px', padding: '10px 12px', cursor: 'pointer', borderRadius: 4, textAlign: 'center' },
  btnSolicitarDisabled: { background: '#1e2230', border: '1px solid #2a2f3e', color: '#6b7280', cursor: 'not-allowed' },
  solicMsg: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', padding: '10px 14px', borderRadius: 4, marginBottom: 12 },
  totalRodape: { marginTop: 12, padding: '14px 16px', background: '#1e2230', border: '1px solid #2a2f3e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 4 },
  totalRodapeLbl: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#6b7280', letterSpacing: '2px', textTransform: 'uppercase' },
  totalRodapeVal: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', color: '#3de8a0', letterSpacing: '2px' },
  empty: { textAlign: 'center', color: '#6b7280', padding: 40, fontSize: '0.85rem', fontFamily: "'IBM Plex Mono', monospace" },
  appCard: { background: '#1e2230', border: '1px solid #2a2f3e', borderLeft: '3px solid #3de8a0', padding: '16px', borderRadius: 4, marginBottom: 16 },
  appCardTitle: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', letterSpacing: '2px', color: '#f0c040', marginBottom: 2 },
  appCardSub: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#6b7280', letterSpacing: '1px', marginBottom: 12 },
  appBarTrack: { height: 20, background: '#0d0f14', borderRadius: 4, position: 'relative', overflow: 'hidden', marginBottom: 10, display: 'flex' },
  appBarFill: { height: '100%', borderRadius: 4, transition: 'width 1s cubic-bezier(.23,1,.32,1)', position: 'absolute', top: 0 },
  appStats: { display: 'flex', justifyContent: 'space-between', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', letterSpacing: '1px' },
  footer: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#161920', borderTop: '1px solid #2a2f3e', padding: '8px 16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#2a2f3e', letterSpacing: '2px', textAlign: 'center' },
};
