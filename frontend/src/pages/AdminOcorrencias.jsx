import { useState, useEffect } from 'react';
import { getOcorrencias, createOcorrencia, updateOcorrencia, deleteOcorrencia } from '../services/api';
import Topbar from '../components/Topbar';

export default function AdminOcorrencias() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';
  const [ocorrencias, setOcorrencias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ codigo: '', descricao: '', finalizadora: false });
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');

  const carregar = async () => {
    setLoading(true);
    try { setOcorrencias(await getOcorrencias()); }
    catch { setOcorrencias([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ codigo: '', descricao: '', finalizadora: false });
    setError('');
    setModalAberto(true);
  };

  const abrirEditar = (o) => {
    setEditando(o);
    setForm({ codigo: o.codigo || '', descricao: o.descricao || '', finalizadora: o.finalizadora === true });
    setError('');
    setModalAberto(true);
  };

  const fecharModal = () => { setModalAberto(false); setEditando(null); };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!form.descricao.trim()) {
      setError('Descricao e obrigatoria');
      return;
    }
    setSalvando(true);
    setError('');
    try {
      if (editando) {
        await updateOcorrencia(editando.id, form);
      } else {
        await createOcorrencia(form);
      }
      fecharModal();
      await carregar();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (o) => {
    if (!confirm(`Excluir ocorrencia "${o.descricao}"?`)) return;
    try {
      await deleteOcorrencia(o.id);
      await carregar();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir');
    }
  };

  const handleToggleFinalizadora = async (o) => {
    try {
      await updateOcorrencia(o.id, { ...o, finalizadora: !o.finalizadora });
      await carregar();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao alterar');
    }
  };

  const filtrados = ocorrencias.filter(o =>
    o.descricao.toLowerCase().includes(busca.toLowerCase()) ||
    (o.codigo && o.codigo.toLowerCase().includes(busca.toLowerCase()))
  );

  const finalizadoras = filtrados.filter(o => o.finalizadora);
  const naoFinalizadoras = filtrados.filter(o => !o.finalizadora);

  return (
    <div style={s.container}>
      <Topbar user={{ nome: 'Admin' }} />
      <div style={s.content}>
        <h2 style={s.title}>Ocorrencias</h2>

        <div style={s.card}>
          <div style={s.cardHeader}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <h5 style={s.cardTitle}>Catalogo de Ocorrencias</h5>
              <span style={s.badge}>{ocorrencias.length} total</span>
              <span style={{ ...s.badge, background: '#1a3a2a', color: '#3de8a0' }}>{finalizadoras.length} finalizadoras</span>
              <span style={{ ...s.badge, background: '#3a2a1a', color: '#f0c040' }}>{naoFinalizadoras.length} em aberto</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                style={{ ...s.input, width: 200, margin: 0 }}
                placeholder="Buscar..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              {isAdmin && <button style={s.btn('#f0c040', '#0d0f14')} onClick={abrirNovo}>+ Nova</button>}
            </div>
          </div>
          <div style={s.cardBody}>
            {loading ? <div style={s.loadingText}>Carregando...</div>
            : filtrados.length === 0 ? <div style={s.emptyText}>Nenhuma ocorrencia encontrada</div>
            : <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead><tr>
                    <th style={s.th}>Codigo</th>
                    <th style={s.th}>Descricao</th>
                    <th style={s.th}>Tipo</th>
                    <th style={s.th}>Usos 036</th>
                    <th style={s.th}>Usos 455</th>
                    {isAdmin && <th style={s.th}>Acoes</th>}
                  </tr></thead>
                  <tbody>
                    {filtrados.map(o => (
                      <tr key={o.id} style={{ opacity: o.finalizadora ? 1 : 0.7 }}>
                        <td style={s.td}>{o.codigo || '—'}</td>
                        <td style={s.td}>{o.descricao}</td>
                        <td style={s.td}>
                          <button
                            onClick={() => isAdmin && handleToggleFinalizadora(o)}
                            style={{
                              background: o.finalizadora ? '#1a3a2a' : '#3a2a1a',
                              color: o.finalizadora ? '#3de8a0' : '#f0c040',
                              border: `1px solid ${o.finalizadora ? '#3de8a0' : '#f0c040'}`,
                              borderRadius: 12, padding: '3px 10px', cursor: isAdmin ? 'pointer' : 'default',
                              fontSize: '0.7rem', fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace"
                            }}
                          >
                            {o.finalizadora ? 'FINALIZADORA' : 'EM ABERTO'}
                          </button>
                        </td>
                        <td style={s.td}>{o.usos_ctrcs || 0}</td>
                        <td style={s.td}>{o.usos_455 || 0}</td>
                        {isAdmin && (
                          <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                            <button style={s.btnSm('#ffc107', '#0d0f14')} onClick={() => abrirEditar(o)}>Editar</button>
                            <button style={s.btnSm('#dc3545', '#fff')} onClick={() => handleExcluir(o)}>Excluir</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      </div>

      {modalAberto && (
        <div style={s.overlay} onClick={fecharModal}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.mh}>
              <h3 style={s.mt}>{editando ? 'Editar Ocorrencia' : 'Nova Ocorrencia'}</h3>
              <button style={s.x} onClick={fecharModal}>&times;</button>
            </div>
            <form onSubmit={handleSalvar}>
              <div style={s.mb}>
                {error && <div style={s.errorMsg}>{error}</div>}
                <div style={s.field}>
                  <label style={s.label}>Codigo (opcional)</label>
                  <input style={s.input} name="codigo" value={form.codigo}
                    onChange={handleChange} placeholder="Ex: 1" maxLength={10} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Descricao</label>
                  <input style={s.input} name="descricao" value={form.descricao}
                    onChange={handleChange} required placeholder="Ex: MERCADORIA ENTREGUE" />
                </div>
                <div style={s.field}>
                  <label style={{ ...s.label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" name="finalizadora" checked={form.finalizadora}
                      onChange={handleChange} style={{ width: 16, height: 16 }} />
                    Finalizadora (nao aparece como CTRC parado)
                  </label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                  <button type="button" style={s.btnSm('#6c757d', '#fff')} onClick={fecharModal}>Cancelar</button>
                  <button type="submit" style={s.btnSm('#198754', '#fff')} disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: '#0d0f14', color: '#e8eaf0', fontFamily: "'IBM Plex Sans', sans-serif" },
  content: { maxWidth: 1200, margin: '0 auto', padding: '32px 24px' },
  title: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', letterSpacing: '2px', color: '#f0c040', marginBottom: 24 },
  card: { background: '#161920', border: '1px solid #2a2f3e', borderRadius: 8, overflow: 'hidden', marginBottom: 20 },
  cardHeader: { padding: '12px 20px', background: '#1e2230', borderBottom: '1px solid #2a2f3e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  cardTitle: { margin: 0, fontSize: '0.95rem', color: '#e8eaf0' },
  cardBody: { padding: 20 },
  badge: { background: '#2a2f3e', color: '#e8eaf0', padding: '3px 10px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' },
  th: { padding: '8px 10px', textAlign: 'left', color: '#6b7280', borderBottom: '1px solid #2a2f3e', background: '#1e2230', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' },
  td: { padding: '6px 10px', borderBottom: '1px solid #2a2f3e', color: '#e8eaf0', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' },
  btn: (bg, c) => ({ background: bg, color: c, border: 'none', padding: '8px 20px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }),
  btnSm: (bg, c) => ({ background: bg, color: c, border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, marginRight: 4 }),
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#161920', border: '1px solid #2a2f3e', borderRadius: 8, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' },
  mh: { padding: '16px 20px', borderBottom: '1px solid #2a2f3e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  mt: { fontSize: '1rem', color: '#e8eaf0', margin: 0 },
  mb: { padding: 20 },
  x: { background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 },
  field: { marginBottom: 16 },
  label: { fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4, display: 'block' },
  input: { width: '100%', background: '#1e2230', border: '1px solid #2a2f3e', color: '#e8eaf0', padding: '8px 12px', borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', boxSizing: 'border-box' },
  errorMsg: { color: '#ff5a5a', fontSize: '0.85rem', marginBottom: 12 },
  loadingText: { textAlign: 'center', color: '#f0c040', padding: 40, fontSize: '0.85rem' },
  emptyText: { textAlign: 'center', color: '#6b7280', padding: 40, fontSize: '0.9rem' },
};
