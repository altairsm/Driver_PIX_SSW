import { useState, useEffect, useCallback, Fragment } from 'react';
import * as XLSX from 'xlsx';
import { getCustoDaBase, getAdminQuinzenas } from '../services/api';
import Topbar, { UNIDADE_STORAGE_KEY } from '../components/Topbar';

function formatQuinzena(inicio, fim) {
  const i = String(inicio).slice(0, 10).split('-');
  const f = String(fim).slice(0, 10).split('-');
  return `${i[2]}/${i[1]}/${i[0].slice(2)} a ${f[2]}/${f[1]}/${f[0].slice(2)}`;
}

const fmt = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

export default function AdminCustoDaBase() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isLocked = user.role !== 'admin' && Boolean(user.unidade);

  const [quinzenas, setQuinzenas] = useState([]);
  const [qzIdx, setQzIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dados, setDados] = useState(null);
  const [unidadeFilter, setUnidadeFilter] = useState(() => (
    isLocked ? user.unidade : localStorage.getItem(UNIDADE_STORAGE_KEY) || ''
  ));

  const qzAtual = quinzenas[qzIdx] || null;

  const fetchDados = useCallback(async (inicio, fim, unidade) => {
    setLoading(true);
    setError('');
    try {
      const data = await getCustoDaBase(inicio, fim, unidade || undefined);
      setDados(data);
    } catch (err) {
      setError('Erro ao buscar custo da base');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const qzs = await getAdminQuinzenas();
        const unidade = isLocked ? user.unidade : localStorage.getItem(UNIDADE_STORAGE_KEY) || '';
        setQuinzenas(qzs);
        setUnidadeFilter(unidade);
        if (qzs.length > 0) {
          const q = qzs[0];
          await fetchDados(String(q.inicio).slice(0, 10), String(q.fim).slice(0, 10), unidade || null);
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError('Erro ao carregar quinzenas');
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, user.unidade]);

  useEffect(() => {
    function handleUnidadeChange() {
      const unidade = isLocked ? user.unidade : localStorage.getItem(UNIDADE_STORAGE_KEY) || '';
      setUnidadeFilter(unidade);
      if (qzAtual) fetchDados(String(qzAtual.inicio).slice(0, 10), String(qzAtual.fim).slice(0, 10), unidade || null);
    }
    window.addEventListener('unidadeChange', handleUnidadeChange);
    return () => window.removeEventListener('unidadeChange', handleUnidadeChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, user.unidade, qzAtual]);

  const selecionarQuinzena = async (idx) => {
    setQzIdx(idx);
    const q = quinzenas[idx];
    if (q) await fetchDados(String(q.inicio).slice(0, 10), String(q.fim).slice(0, 10), unidadeFilter || null);
  };

  const exportarExcel = () => {
    if (!dados || dados.motoristas.length === 0) return;
    const linhas = [];
    dados.motoristas.forEach((m) => {
      m.cidades.forEach((c) => {
        linhas.push({
          Motorista: m.motorista_nome,
          'CPF': m.motorista_cpf,
          Unidade: m.unidade_receptora || '',
          Cidade: c.cidade,
          Quantidade: c.quantidade,
          'Valor Unitário': Number(c.valor_unitario) || 0,
          'Valor Total': Number(c.valor_total) || 0,
          'Sem Preço': c.sem_preco ? 'Sim' : 'Não',
        });
      });
    });
    linhas.push({
      Motorista: 'TOTAL GERAL',
      Cidade: '',
      Quantidade: dados.entregas_geral,
      'Valor Total': Number(dados.total_geral) || 0,
    });

    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Custo da Base');
    const nome = `custo_da_base_${qzAtual ? formatQuinzena(qzAtual.inicio, qzAtual.fim) : 'periodo'}.xlsx`.replace(/\//g, '-');
    XLSX.writeFile(wb, nome);
  };

  return (
    <div style={s.container}>
      <Topbar user={{ nome: 'Admin' }} />
      <div style={s.content}>
        <h2 style={s.title}>Custo da Base</h2>

        <div style={s.filterRow}>
          <button onClick={exportarExcel} style={s.exportBtn} disabled={!dados || dados.motoristas.length === 0}>
            Exportar Excel
          </button>
          <div style={s.quinsWrap}>
            <label style={s.label}>Quinzena:</label>
            <select value={qzIdx} onChange={(e) => selecionarQuinzena(Number(e.target.value))} style={s.select}>
              {quinzenas.map((q, i) => (
                <option key={i} value={i}>{formatQuinzena(q.inicio, q.fim)}</option>
              ))}
            </select>
          </div>
          {isLocked && <span style={s.lockedTag}>Unidade: {user.unidade}</span>}
        </div>

        {loading ? (
          <div style={s.loading}>Carregando...</div>
        ) : error ? (
          <div style={s.error}>{error}</div>
        ) : !dados || dados.motoristas.length === 0 ? (
          <div style={s.empty}>Nenhuma entrega no período</div>
        ) : (
          <div style={s.card}>
            <div style={s.cardHeader}>
              Resumo por Motorista e Cidade ({unidadeFilter || 'todas as unidades'}) — Total: {fmt(dados.total_geral)} · {dados.entregas_geral} entregas
            </div>
            <div style={s.cardBody}>
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Motorista</th>
                      <th style={s.th}>Unidade</th>
                      <th style={s.th}>Cidade</th>
                      <th style={s.th}>Qtd</th>
                      <th style={s.th}>Valor Unit.</th>
                      <th style={s.th}>Valor Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.motoristas.map((m) => (
                      <Fragment key={m.motorista_cpf}>
                        {m.cidades.map((c, i) => (
                          <tr key={`${m.motorista_cpf}|${c.cidade}|${i}`} style={i === 0 ? s.motoristaFirst : {}}>
                            {i === 0 && (
                              <td style={s.td} rowSpan={m.cidades.length}>
                                <div style={{ fontWeight: 700 }}>{m.motorista_nome}</div>
                                <div style={{ color: '#6b7280', fontSize: '0.7rem' }}>{m.motorista_cpf} · {m.entregas} entregas · {fmt(m.total)}</div>
                              </td>
                            )}
                            {i === 0 && <td style={s.td} rowSpan={m.cidades.length}>{m.unidade_receptora || '—'}</td>}
                            <td style={c.sem_preco ? { ...s.td, color: '#ff9f43' } : s.td}>
                              {c.cidade} {c.sem_preco && ' ⚠'}
                            </td>
                            <td style={s.td}>{c.quantidade}</td>
                            <td style={s.td}>{fmt(c.valor_unitario)}</td>
                            <td style={s.td}>{fmt(c.valor_total)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: '#0d0f14', color: '#e8eaf0', fontFamily: "'IBM Plex Sans', sans-serif" },
  content: { maxWidth: 1000, margin: '0 auto', padding: '32px 24px' },
  title: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', letterSpacing: '2px', color: '#f0c040', marginBottom: 24 },
  filterRow: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' },
  exportBtn: { background: '#3de8a0', color: '#0d0f14', border: 'none', padding: '10px 18px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' },
  quinsWrap: { display: 'flex', alignItems: 'center', gap: 8 },
  label: { color: '#6b7280', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', letterSpacing: '1px' },
  select: { background: '#1e2230', border: '1px solid #2a2f3e', color: '#e8eaf0', padding: '10px 14px', borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.8rem' },
  lockedTag: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem', color: '#f0c040', border: '1px solid #2a2f3e', padding: '6px 10px', borderRadius: 4 },
  loading: { textAlign: 'center', color: '#6b7280', padding: 40 },
  error: { textAlign: 'center', color: '#ff5a5a', padding: 40 },
  empty: { textAlign: 'center', color: '#6b7280', padding: 40 },
  card: { background: '#161920', border: '1px solid #2a2f3e', borderRadius: 8, overflow: 'hidden' },
  cardHeader: { padding: '12px 20px', background: '#1e2230', borderBottom: '1px solid #2a2f3e', fontSize: '0.85rem', color: '#f0c040', fontFamily: "'IBM Plex Mono', monospace" },
  cardBody: { padding: 20 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' },
  th: { padding: '10px 14px', textAlign: 'left', color: '#6b7280', borderBottom: '1px solid #2a2f3e', background: '#1e2230', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem' },
  td: { padding: '10px 14px', borderBottom: '1px solid #2a2f3e', color: '#e8eaf0', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem', verticalAlign: 'top' },
  motoristaFirst: { background: 'rgba(240,192,64,0.04)' },
};
