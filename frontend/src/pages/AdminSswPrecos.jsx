import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPrecosCidades, updatePrecoCidade, deletePrecoCidade, getUnidades } from '../services/api';
import Topbar, { UNIDADE_STORAGE_KEY } from '../components/Topbar';

export default function AdminSswPrecos() {
  const [searchParams] = useSearchParams();
  const cidadeRef = useRef(null);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';
  const isLocked = !isAdmin && Boolean(user.unidade);

  const [cidades, setCidades] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);

  const [unidadeSelecionada, setUnidadeSelecionada] = useState(() => (
    isLocked ? user.unidade : localStorage.getItem(UNIDADE_STORAGE_KEY) || ''
  ));

  const [novaCidade, setNovaCidade] = useState('');
  const [novoValor, setNovoValor] = useState('');
  const [novaUnidade, setNovaUnidade] = useState(() => (isLocked ? user.unidade : localStorage.getItem(UNIDADE_STORAGE_KEY) || ''));
  const [editando, setEditando] = useState(null);
  const [editValor, setEditValor] = useState('');

  const unidadeAtual = isLocked ? user.unidade : unidadeSelecionada;

  useEffect(() => {
    const cidade = searchParams.get('cidade');
    if (cidade) {
      setNovaCidade(cidade.toUpperCase());
      cidadeRef.current?.focus();
    }
  }, [searchParams]);

  const fetchCidades = async (unidade) => {
    try {
      const data = await getPrecosCidades(unidade || undefined);
      setCidades(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getUnidades().then(setUnidades).catch(() => {});
  }, []);

  useEffect(() => { fetchCidades(unidadeAtual); }, [isLocked, user.unidade, unidadeSelecionada]);

  useEffect(() => {
    function handleUnidadeChange() {
      const u = isLocked ? user.unidade : localStorage.getItem(UNIDADE_STORAGE_KEY) || '';
      setUnidadeSelecionada(u);
      setNovaUnidade(u);
      fetchCidades(u || undefined);
    }
    window.addEventListener('unidadeChange', handleUnidadeChange);
    return () => window.removeEventListener('unidadeChange', handleUnidadeChange);
  }, [isLocked, user.unidade]);

  const handleUnidadeSelect = (e) => {
    const value = e.target.value;
    setUnidadeSelecionada(value);
    setNovaUnidade(value);
    localStorage.setItem(UNIDADE_STORAGE_KEY, value);
    fetchCidades(value || undefined);
  };

  const handleAdd = async () => {
    if (!novaCidade || !novoValor) return;
    if (isAdmin && !novaUnidade) { alert('Selecione uma unidade para a nova cidade.'); return; }
    try {
      await updatePrecoCidade(novaCidade, parseFloat(novoValor), novaUnidade);
      setNovaCidade('');
      setNovoValor('');
      await fetchCidades(unidadeAtual);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdate = async (cidade, unidade) => {
    if (!editValor) return;
    try {
      await updatePrecoCidade(cidade, parseFloat(editValor), unidade);
      setEditando(null);
      setEditValor('');
      await fetchCidades(unidadeAtual);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (cidade, unidade) => {
    if (!confirm(`Remover ${cidade}${unidade ? ` (${unidade})` : ''}?`)) return;
    try {
      await deletePrecoCidade(cidade, unidade);
      await fetchCidades(unidadeAtual);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={styles.container}>
      <Topbar user={{ nome: 'Admin' }} />
      <div style={styles.content}>
        <h2 style={styles.title}>Tabela de Preço por Cidade</h2>

        <div style={styles.filterRow}>
          <label style={styles.filterLabel}>Unidade:</label>
          <select
            value={unidadeSelecionada}
            onChange={handleUnidadeSelect}
            disabled={isLocked}
            style={{ ...styles.select, ...(isLocked ? styles.selectLocked : {}) }}
          >
            {!isLocked && <option value="">Todas</option>}
            {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        {isAdmin && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>Nova Cidade</div>
            <div style={styles.cardBody}>
              <div style={styles.formRow}>
                <select
                  value={novaUnidade}
                  onChange={(e) => setNovaUnidade(e.target.value)}
                  style={{ ...styles.select, minWidth: 140 }}
                >
                  <option value="">Unidade...</option>
                  {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <input
                  ref={cidadeRef}
                  style={styles.input}
                  placeholder="Cidade"
                  value={novaCidade}
                  onChange={(e) => setNovaCidade(e.target.value.toUpperCase())}
                />
                <input
                  style={{ ...styles.input, maxWidth: 120 }}
                  type="number"
                  step="0.01"
                  placeholder="Valor"
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                />
                <button onClick={handleAdd} style={styles.addBtn}>Adicionar</button>
              </div>
            </div>
          </div>
        )}

        <div style={styles.card}>
          <div style={styles.cardHeader}>Cidades Cadastradas ({cidades.length})</div>
          <div style={styles.cardBody}>
            {loading ? (
              <div style={styles.loading}>Carregando...</div>
            ) : cidades.length === 0 ? (
              <div style={styles.empty}>Nenhuma cidade cadastrada</div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Cidade</th>
                      <th style={styles.th}>Unidade</th>
                      <th style={styles.th}>Valor Entrega</th>
                      {isAdmin && <th style={styles.th}>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {cidades.map((c) => (
                      <tr key={`${c.cidade}|${c.unidade || ''}`}>
                        <td style={styles.td}>{c.cidade}</td>
                        <td style={styles.td}>{c.unidade || '—'}</td>
                        <td style={styles.td}>
                          {editando === `${c.cidade}|${c.unidade || ''}` ? (
                            <input
                              style={{ ...styles.input, width: 100 }}
                              type="number"
                              step="0.01"
                              value={editValor}
                              onChange={(e) => setEditValor(e.target.value)}
                            />
                          ) : (
                            `R$ ${Number(c.valor_entrega).toFixed(2)}`
                          )}
                        </td>
                        {isAdmin && (
                          <td style={styles.td}>
                            {editando === `${c.cidade}|${c.unidade || ''}` ? (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => handleUpdate(c.cidade, c.unidade || '')} style={styles.smallBtn}>Salvar</button>
                                <button onClick={() => setEditando(null)} style={{ ...styles.smallBtn, background: '#2a2f3e', color: '#9ca3af' }}>Cancelar</button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => { setEditando(`${c.cidade}|${c.unidade || ''}`); setEditValor(c.valor_entrega); }} style={styles.smallBtn}>Editar</button>
                                <button onClick={() => handleDelete(c.cidade, c.unidade || '')} style={{ ...styles.smallBtn, background: '#3a1a1a', color: '#ff5a5a' }}>Remover</button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#0d0f14', color: '#e8eaf0', fontFamily: "'IBM Plex Sans', sans-serif" },
  content: { maxWidth: 900, margin: '0 auto', padding: '32px 24px' },
  title: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', letterSpacing: '2px', color: '#f0c040', marginBottom: 24 },
  filterRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 },
  filterLabel: { color: '#6b7280', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', letterSpacing: '1px' },
  select: { background: '#1e2230', border: '1px solid #2a2f3e', color: '#e8eaf0', padding: '10px 14px', borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.8rem' },
  selectLocked: { opacity: 0.6, cursor: 'not-allowed' },
  card: { background: '#161920', border: '1px solid #2a2f3e', borderRadius: 8, marginBottom: 20, overflow: 'hidden' },
  cardHeader: { padding: '12px 20px', background: '#1e2230', borderBottom: '1px solid #2a2f3e', fontSize: '0.85rem', color: '#f0c040', fontFamily: "'IBM Plex Mono', monospace" },
  cardBody: { padding: 20 },
  formRow: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  input: { background: '#0d0f14', border: '1px solid #2a2f3e', color: '#e8eaf0', padding: '10px 14px', borderRadius: 4, fontSize: '0.85rem', fontFamily: "'IBM Plex Mono', monospace", flex: 1, minWidth: 150 },
  addBtn: { background: '#f0c040', color: '#0d0f14', border: 'none', padding: '10px 20px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' },
  th: { padding: '10px 14px', textAlign: 'left', color: '#6b7280', borderBottom: '1px solid #2a2f3e', background: '#1e2230', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem' },
  td: { padding: '10px 14px', borderBottom: '1px solid #2a2f3e', color: '#e8eaf0', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' },
  smallBtn: { background: '#1e2230', border: '1px solid #2a2f3e', color: '#e8eaf0', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: '0.7rem', fontFamily: "'IBM Plex Mono', monospace" },
  loading: { textAlign: 'center', color: '#6b7280', padding: 20 },
  empty: { textAlign: 'center', color: '#6b7280', padding: 20 },
};
