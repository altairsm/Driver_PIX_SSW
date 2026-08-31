import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { getRede, getAdminQuinzenas } from '../services/api';
import Topbar, { UNIDADE_STORAGE_KEY } from '../components/Topbar';

const TYPE_COLOR = { unidade: '#f0c040', cliente: '#60a5fa', setor: '#3de8a0' };
const TYPE_NAME = { unidade: 'Unidade', cliente: 'Cliente', setor: 'Destinatário (setor)' };

const fmtNum = (v) => Number(v || 0).toLocaleString('pt-BR');
const fmtMoeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function AdminRede() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isLocked = user.role !== 'admin' && Boolean(user.unidade);
  const [quinzenas, setQuinzenas] = useState([]);
  const [filtro, setFiltro] = useState({
    inicio: '',
    fim: '',
    unidade: isLocked ? user.unidade : localStorage.getItem(UNIDADE_STORAGE_KEY) || '',
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hover, setHover] = useState(null);
  const filtroRef = useRef(filtro);
  const graphRef = useRef(null);

  useEffect(() => {
    getAdminQuinzenas()
      .then(qs => {
        setQuinzenas(qs || []);
        if (qs?.length && !filtroRef.current.inicio) {
          const sel = qs[0];
          const next = { ...filtroRef.current, inicio: sel.inicio, fim: sel.fim };
          filtroRef.current = next;
          setFiltro(next);
        }
      })
      .catch(() => {});
  }, []);

  const carregar = useCallback(async (f = filtroRef.current) => {
    if (!f.inicio || !f.fim) return;
    setLoading(true); setError('');
    try {
      const r = await getRede(f.inicio, f.fim, f.unidade || null);
      setData(r);
    } catch { setError('Erro ao carregar a rede'); setData(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { filtroRef.current = filtro; }, [filtro]);
  useEffect(() => {
    if (filtro.inicio && filtro.fim) carregar(filtroRef.current);
  }, [carregar, filtro.inicio, filtro.fim]);

  useEffect(() => {
    const handleUnidadeChange = () => {
      const unidade = isLocked ? user.unidade : localStorage.getItem(UNIDADE_STORAGE_KEY) || '';
      const next = { ...filtroRef.current, unidade };
      filtroRef.current = next;
      setFiltro(next);
    };
    window.addEventListener('unidadeChange', handleUnidadeChange);
    return () => window.removeEventListener('unidadeChange', handleUnidadeChange);
  }, [isLocked, user.unidade]);

  const { nodes, links } = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    const n = [];
    const unis = data.unidades || [];
    const clis = data.clientes || [];
    const sets = data.setores || [];

    unis.forEach(u => n.push({ id: `u:${u.id}`, name: u.label || u.id, group: 'unidade', ctrcs: u.ctrcs, valor_frete: u.valor_frete, peso: u.peso, volumes: u.volumes }));
    clis.forEach(c => n.push({ id: `c:${c.id}`, name: c.label || c.id, group: 'cliente', ctrcs: c.ctrcs, valor_frete: c.valor_frete, peso: c.peso, volumes: c.volumes }));
    sets.forEach(s => n.push({ id: `s:${s.id}`, name: s.label || s.id, group: 'setor', ctrcs: s.ctrcs, valor_frete: s.valor_frete, peso: s.peso, volumes: s.volumes }));

    const l = [];
    (data.uc || []).forEach(e => l.push({ source: `u:${e.source}`, target: `c:${e.target}`, ctrcs: e.ctrcs, valor_frete: e.valor_frete }));
    (data.cs || []).forEach(e => l.push({ source: `c:${e.source}`, target: `s:${e.target}`, ctrcs: e.ctrcs, valor_frete: e.valor_frete }));
    (data.us || []).forEach(e => l.push({ source: `u:${e.source}`, target: `s:${e.target}`, ctrcs: e.ctrcs, valor_frete: e.valor_frete }));

    return { nodes: n, links: l };
  }, [data]);

  const totals = useMemo(() => {
    if (!data) return { ctrcs: 0, valor_frete: 0, peso: 0, volumes: 0 };
    const all = [...(data.unidades || []), ...(data.clientes || []), ...(data.setores || [])];
    return {
      ctrcs: all.reduce((s, x) => s + Number(x.ctrcs || 0), 0),
      valor_frete: all.reduce((s, x) => s + Number(x.valor_frete || 0), 0),
      peso: all.reduce((s, x) => s + Number(x.peso || 0), 0),
      volumes: all.reduce((s, x) => s + Number(x.volumes || 0), 0),
    };
  }, [data]);

  const selectQuinzena = (e) => {
    const val = e.target.value;
    if (!val) return;
    const sel = quinzenas.find(q => `${q.inicio}|${q.fim}` === val);
    if (sel) setFiltro(f => ({ ...f, inicio: sel.inicio, fim: sel.fim }));
  };

  const linkWidth = (l) => Math.max(0.4, Math.min(6, Math.log2(Number(l.ctrcs) + 1)));

  return (
    <div style={s.container}>
      <Topbar user={user} />
      <div style={s.content}>
        <h2 style={s.title}>Rede — Unidades · Clientes · Destinatários</h2>
        <div style={s.sub}>Fluxo de remessas por período (data da última ocorrência), ligado por unidade receptora → pagador → setor de destino</div>

        {error && <div style={s.error}>{error}</div>}

        <div style={s.filterBar}>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Quinzena</label>
            <select style={s.filterInput} value={filtro.inicio && filtro.fim ? `${filtro.inicio}|${filtro.fim}` : ''} onChange={selectQuinzena}>
              <option value="">Selecione...</option>
              {quinzenas.map(q => (
                <option key={`${q.inicio}|${q.fim}`} value={`${q.inicio}|${q.fim}`}>
                  {q.inicio} a {q.fim}
                </option>
              ))}
            </select>
          </div>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Início</label>
            <input type="date" style={s.filterInput} value={filtro.inicio} onChange={(e) => setFiltro({ ...filtro, inicio: e.target.value })} />
          </div>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Fim</label>
            <input type="date" style={s.filterInput} value={filtro.fim} onChange={(e) => setFiltro({ ...filtro, fim: e.target.value })} />
          </div>
          <button type="button" style={s.filterBtn} onClick={() => carregar(filtro)} disabled={loading}>
            {loading ? 'Carregando...' : 'Filtrar'}
          </button>
          <div style={s.statsInline}>
            <span style={s.chip}>{fmtNum(totals.ctrcs)} remessas</span>
            <span style={s.chip}>R$ {fmtNum(totals.valor_frete)}</span>
          </div>
        </div>

        {loading ? (
          <div style={s.loadingBox}><div style={s.spinner}></div></div>
        ) : !nodes.length ? (
          <div style={s.empty}>Nenhum dado no período selecionado</div>
        ) : (
          <div style={s.graphCard}>
            <ForceGraph2D
              ref={graphRef}
              graphData={{ nodes, links }}
              nodeColor={(nd) => TYPE_COLOR[nd.group] || '#6b7280'}
              nodeLabel={(nd) => `${nd.name} (${TYPE_NAME[nd.group]}) — ${fmtNum(nd.ctrcs)} remessas`}
              nodeVal={(nd) => Math.max(2, Math.sqrt(Number(nd.ctrcs) || 1))}
              linkWidth={linkWidth}
              linkColor={() => 'rgba(139,148,165,0.35)'}
              onNodeHover={(nd) => setHover(nd)}
              linkDirectionalParticles={1}
              linkDirectionalParticleWidth={2}
              cooldownTicks={200}
              onEngineStop={() => graphRef.current?.zoomToFit(400, 60)}
              backgroundColor="#0d0f14"
            />
            <div style={s.legend}>
              {Object.keys(TYPE_COLOR).map(k => (
                <span key={k} style={s.legendItem}><span style={{ ...s.legendDot, background: TYPE_COLOR[k] }} />{TYPE_NAME[k]}</span>
              ))}
            </div>
            {hover && (
              <div style={s.tooltip}>
                <div style={s.ttName}>{hover.name}</div>
                <div style={s.ttSub}>{TYPE_NAME[hover.group]}</div>
                <div style={s.ttLine}>Remessas: <b>{fmtNum(hover.ctrcs)}</b></div>
                <div style={s.ttLine}>Frete: <b>{fmtMoeda(hover.valor_frete)}</b></div>
                {hover.peso ? <div style={s.ttLine}>Peso: <b>{fmtNum(hover.peso)} kg</b></div> : null}
                {hover.volumes ? <div style={s.ttLine}>Volumes: <b>{fmtNum(hover.volumes)}</b></div> : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: '#0d0f14', color: '#e8eaf0', fontFamily: "'IBM Plex Sans', sans-serif" },
  content: { maxWidth: 1200, margin: '0 auto', padding: '24px 20px' },
  title: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', letterSpacing: '2px', color: '#f0c040', marginBottom: 2 },
  sub: { color: '#6b7280', fontSize: '0.8rem', marginBottom: 16 },
  error: { background: '#2a1a1a', border: '1px solid #ff5a5a', color: '#ff5a5a', padding: '8px 14px', borderRadius: 4, marginBottom: 16 },
  filterBar: { display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16, background: '#161920', border: '1px solid #2a2f3e', borderRadius: 8, padding: '12px 16px', justifyContent: 'space-between' },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: 3 },
  filterLabel: { fontSize: '0.6rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' },
  filterInput: { background: '#1e2230', border: '1px solid #2a2f3e', color: '#e8eaf0', padding: '6px 10px', borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.78rem', minWidth: 150 },
  filterBtn: { background: '#f0c040', color: '#0d0f14', border: 'none', padding: '7px 20px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 1 },
  statsInline: { display: 'flex', gap: 8, marginLeft: 'auto' },
  chip: { background: '#1e2230', border: '1px solid #2a2f3e', color: '#9ca3af', padding: '6px 12px', borderRadius: 999, fontSize: '0.75rem', fontFamily: "'IBM Plex Mono', monospace", alignSelf: 'center' },
  graphCard: { position: 'relative', background: '#0d0f14', border: '1px solid #2a2f3e', borderRadius: 10, height: '72vh', overflow: 'hidden' },
  legend: { position: 'absolute', top: 12, left: 12, display: 'flex', gap: 12, background: 'rgba(13,15,20,0.85)', border: '1px solid #2a2f3e', borderRadius: 6, padding: '6px 10px', flexWrap: 'wrap', zIndex: 5 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: '#9ca3af', fontFamily: "'IBM Plex Mono', monospace" },
  legendDot: { width: 10, height: 10, borderRadius: '50%' },
  tooltip: { position: 'absolute', bottom: 12, right: 12, background: '#161920', border: '1px solid #2a2f3e', borderRadius: 8, padding: '10px 14px', minWidth: 180, zIndex: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' },
  ttName: { fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: '#f0c040', fontSize: '0.85rem' },
  ttSub: { fontSize: '0.62rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', margin: '2px 0 6px' },
  ttLine: { fontSize: '0.75rem', color: '#9ca3af', fontFamily: "'IBM Plex Mono', monospace" },
  loadingBox: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' },
  spinner: { width: 32, height: 32, border: '3px solid #2a2f3e', borderTopColor: '#f0c040', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  empty: { textAlign: 'center', color: '#6b7280', padding: 40, fontSize: '0.85rem', background: '#161920', borderRadius: 8, border: '1px solid #2a2f3e' },
};
