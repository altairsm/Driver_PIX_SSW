import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCtrcsSemPreco, getAdminQuinzenas } from '../services/api';
import Topbar from '../components/Topbar';

function formatQuinzena(inicio, fim) {
  const i = String(inicio).slice(0, 10).split('-');
  const f = String(fim).slice(0, 10).split('-');
  return `${i[2]}/${i[1]}/${i[0].slice(2)} a ${f[2]}/${f[1]}/${f[0].slice(2)}`;
}

function formatBRL(v) {
  return `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;
}

export default function AdminCidadesSemPreco() {
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quinzenas, setQuinzenas] = useState([]);
  const [qzIdx, setQzIdx] = useState(-1);
  const [filtroInicio, setFiltroInicio] = useState('');
  const [filtroFim, setFiltroFim] = useState('');
  const [agrupar, setAgrupar] = useState(false);

  const fetchDados = useCallback(async (inicio, fim) => {
    setLoading(true);
    setError('');
    try {
      const data = await getCtrcsSemPreco(inicio || undefined, fim || undefined);
      setDados(data);
    } catch (err) {
      setError('Erro ao buscar CTRCs sem preço');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const qzs = await getAdminQuinzenas();
        setQuinzenas(qzs);
        await fetchDados();
      } catch (e) {
        setError('Erro ao carregar quinzenas');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [fetchDados]);

  const handleQuinzena = async (idx) => {
    setQzIdx(idx);
    if (idx >= 0 && idx < quinzenas.length) {
      const q = quinzenas[idx];
      const inicio = q.inicio.slice(0, 10);
      const fim = q.fim.slice(0, 10);
      setFiltroInicio(inicio);
      setFiltroFim(fim);
      await fetchDados(inicio, fim);
    }
  };

  const handleFiltroData = async () => {
    setQzIdx(-1);
    await fetchDados(filtroInicio || undefined, filtroFim || undefined);
  };

  const handleLimparFiltro = async () => {
    setQzIdx(-1);
    setFiltroInicio('');
    setFiltroFim('');
    await fetchDados();
  };

  const ctrcs = dados?.ctrcs || [];
  const cidadesUnicas = dados?.cidades_unicas || [];
  const totalFretePerdido = ctrcs.reduce((acc, c) => acc + (Number(c.frete_ctrc) || 0), 0);

  return (
    <div style={styles.container}>
      <Topbar user={{ nome: 'Admin' }} />
      <div style={styles.content}>
        <h2 style={styles.title}>CTRCs sem Preco de Cidade</h2>

        <div style={styles.filterRow}>
          <button
            onClick={() => handleQuinzena(qzIdx + 1)}
            disabled={qzIdx >= quinzenas.length - 1}
            style={styles.navBtn}
          >&lt; Anterior</button>
          <div style={styles.quinzenaLabel}>
            {qzIdx >= 0 ? formatQuinzena(quinzenas[qzIdx].inicio, quinzenas[qzIdx].fim) : 'Todos'}
          </div>
          <button
            onClick={() => handleQuinzena(qzIdx - 1)}
            disabled={qzIdx <= 0}
            style={styles.navBtn}
          >Proximo &gt;</button>
        </div>

        <div style={styles.filterRow}>
          <input
            type="date"
            style={styles.dateInput}
            value={filtroInicio}
            onChange={(e) => setFiltroInicio(e.target.value)}
          />
          <span style={{ color: '#6b7280' }}>a</span>
          <input
            type="date"
            style={styles.dateInput}
            value={filtroFim}
            onChange={(e) => setFiltroFim(e.target.value)}
          />
          <button onClick={handleFiltroData} style={styles.filterBtn}>Filtrar</button>
          <button onClick={handleLimparFiltro} style={styles.clearBtn}>Limpar</button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {loading ? (
          <div style={styles.loading}>Carregando...</div>
        ) : ctrcs.length === 0 ? (
          <div style={styles.empty}>Nenhum CTRC sem preco encontrado. Todas as cidades estao cadastradas!</div>
        ) : (
          <>
            <div style={styles.resumoCards}>
              <div style={styles.rCard}>
                <span style={styles.rLabel}>CTRCs Afetados</span>
                <span style={{ ...styles.rValue, color: '#ff5a5a' }}>{ctrcs.length}</span>
              </div>
              <div style={styles.rCard}>
                <span style={styles.rLabel}>Cidades s/ Cadastro</span>
                <span style={{ ...styles.rValue, color: '#f0c040' }}>{cidadesUnicas.length}</span>
              </div>
              <div style={styles.rCard}>
                <span style={styles.rLabel}>Frete Total (Receita)</span>
                <span style={styles.rValue}>{formatBRL(totalFretePerdido)}</span>
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <span>Cidades sem Cadastro ({cidadesUnicas.length})</span>
              </div>
              <div style={styles.cardBody}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Cidade</th>
                        <th style={styles.th}>CTRCs</th>
                        <th style={styles.th}>Frete Total</th>
                        <th style={styles.th}>Cadastro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cidadesUnicas.map((c) => (
                        <tr key={c.cidade}>
                          <td style={styles.td}>{c.cidade || '(vazio)'}</td>
                          <td style={{ ...styles.td, color: '#ff5a5a' }}>{c.total}</td>
                          <td style={styles.td}>{formatBRL(c.frete_total)}</td>
                          <td style={styles.td}>
                            <button
                              onClick={() => navigate(`/admin/precos-cidades?cidade=${encodeURIComponent((c.cidade || '').split('/')[0].trim())}`)}
                              style={styles.cadastrarBtn}
                            >Cadastrar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#0d0f14', color: '#e8eaf0', fontFamily: "'IBM Plex Sans', sans-serif" },
  content: { maxWidth: 1100, margin: '0 auto', padding: '32px 24px' },
  title: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', letterSpacing: '2px', color: '#f0c040', marginBottom: 24 },
  filterRow: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' },
  navBtn: { background: '#1e2230', border: '1px solid #2a2f3e', color: '#e8eaf0', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontSize: '0.82rem', fontFamily: "'IBM Plex Mono', monospace" },
  quinzenaLabel: { fontSize: '1.1rem', fontWeight: 600, color: '#f0c040', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '2px', minWidth: 180, textAlign: 'center' },
  dateInput: { background: '#0d0f14', border: '1px solid #2a2f3e', color: '#e8eaf0', padding: '8px 12px', borderRadius: 4, fontSize: '0.82rem', fontFamily: "'IBM Plex Mono', monospace" },
  filterBtn: { background: '#f0c040', color: '#0d0f14', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' },
  clearBtn: { background: '#2a2f3e', color: '#e8eaf0', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontSize: '0.82rem' },
  error: { background: '#2a1a1a', border: '1px solid #ff5a5a', color: '#ff5a5a', padding: '10px 16px', borderRadius: 4, marginBottom: 20 },
  loading: { textAlign: 'center', color: '#6b7280', padding: 40 },
  empty: { textAlign: 'center', color: '#3de8a0', padding: 40, fontSize: '1rem' },
  resumoCards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 },
  rCard: { background: '#161920', border: '1px solid #2a2f3e', borderRadius: 8, padding: '16px', display: 'flex', flexDirection: 'column', gap: 4 },
  rLabel: { fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' },
  rValue: { fontSize: '1.4rem', fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: '#e8eaf0' },
  card: { background: '#161920', border: '1px solid #2a2f3e', borderRadius: 8, marginBottom: 20, overflow: 'hidden' },
  cardHeader: { padding: '12px 20px', background: '#1e2230', borderBottom: '1px solid #2a2f3e', fontSize: '0.85rem', color: '#f0c040', fontFamily: "'IBM Plex Mono', monospace" },
  cardBody: { padding: 20 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' },
  th: { padding: '10px 14px', textAlign: 'left', color: '#6b7280', borderBottom: '1px solid #2a2f3e', background: '#1e2230', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' },
  td: { padding: '10px 14px', borderBottom: '1px solid #2a2f3e', color: '#e8eaf0', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' },
  cadastrarBtn: { background: '#f0c040', color: '#0d0f14', border: 'none', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.72rem', fontFamily: "'IBM Plex Mono', monospace" },
};
