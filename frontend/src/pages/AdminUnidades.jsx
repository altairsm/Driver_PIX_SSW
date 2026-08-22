import { useState, useEffect } from 'react';
import { getUnidadesAll, createUnidade, updateUnidade, deleteUnidade } from '../services/api';
import Topbar from '../components/Topbar';

export default function AdminUnidades() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';

  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nome: '', sigla: '' });
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const data = await getUnidadesAll();
      setUnidades(data);
    } catch {
      setError('Erro ao carregar unidades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => { setForm({ nome: '', sigla: '' }); setEditando(null); setModalAberto(true); };
  const abrirEditar = (u) => { setForm({ nome: u.nome, sigla: u.sigla }); setEditando(u); setModalAberto(true); };
  const fecharModal = () => { setModalAberto(false); setEditando(null); };
  const handleChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); };

  const handleSalvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setError('');
    try {
      if (editando) {
        await updateUnidade(editando.id, { ...form, ativo: editando.ativo });
      } else {
        await createUnidade(form);
      }
      fecharModal();
      await carregar();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar unidade');
    } finally {
      setSalvando(false);
    }
  };

  const handleToggleAtivo = async (u) => {
    try {
      await updateUnidade(u.id, { nome: u.nome, sigla: u.sigla, ativo: u.ativo === false });
      await carregar();
    } catch { setError('Erro ao alterar status'); }
  };

  const handleExcluir = async (u) => {
    if (!window.confirm('Excluir unidade "' + u.sigla + '"?')) return;
    try { await deleteUnidade(u.id); await carregar(); }
    catch (err) { setError(err.response?.data?.error || 'Erro ao excluir unidade'); }
  };

  return (
    <div style={s.container}>
      <Topbar user={user} />
      <div style={s.content}>
        <h2 style={s.title}>Unidades</h2>
        {error && <div style={s.error}>{error}</div>}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <h5 style={s.cardTitle}>Cadastro de Unidades</h5>
            {isAdmin && <button style={s.btn('#f0c040', '#0d0f14')} onClick={abrirNovo}>+ Nova</button>}
          </div>
          <div style={s.cardBody}>
            {loading ? <div style={s.loadingText}>Carregando...</div>
            : unidades.length === 0 ? <div style={s.emptyText}>Nenhuma unidade cadastrada.</div>
            : <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead><tr>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Sigla</th>
                    <th style={s.th}>Nome</th>
                    <th style={s.th}>Criado em</th>
                    <th style={s.th}>Acoes</th>
                  </tr></thead>
                  <tbody>
                    {unidades.map(u => (
                      <tr key={u.id} style={{ opacity: u.ativo === false ? 0.5 : 1 }}>
                        <td style={s.td}>
                          <button onClick={() => isAdmin && handleToggleAtivo(u)} style={{
                            background: u.ativo !== false ? '#1a3a2a' : '#3a1a1a',
                            color: u.ativo !== false ? '#3de8a0' : '#ff5a5a',
                            border: '1px solid ' + (u.ativo !== false ? '#3de8a0' : '#ff5a5a'),
                            borderRadius: 12, padding: '3px 10px', cursor: isAdmin ? 'pointer' : 'default',
                            fontSize: '0.7rem', fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace"
                          }}>{u.ativo !== false ? 'ATIVO' : 'INATIVO'}</button>
                        </td>
                        <td style={{ ...s.td, fontWeight: 600, color: '#f0c040' }}>{u.sigla}</td>
                        <td style={s.td}>{u.nome}</td>
                        <td style={s.td}>{u.criado_em ? new Date(u.criado_em).toLocaleDateString('pt-BR') : '-'}</td>
                        <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                          {isAdmin && (<>
                            <button style={s.actionBtn('#60a5fa')} onClick={() => abrirEditar(u)}>Editar</button>
                            <button style={s.actionBtn('#ff5a5a')} onClick={() => handleExcluir(u)}>Excluir</button>
                          </>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>

        {modalAberto && (
          <div style={s.overlay} onClick={fecharModal}>
            <div style={s.modal} onClick={(e) => e.stopPropagation()}>
              <h3 style={s.modalTitle}>{editando ? 'Editar Unidade' : 'Nova Unidade'}</h3>
              <form onSubmit={handleSalvar}>
                <div style={s.formGroup}>
                  <label style={s.label}>Sigla</label>
                  <input name="sigla" value={form.sigla} onChange={handleChange}
                    style={s.input} maxLength={10} required placeholder="Ex: SAL" />
                </div>
                <div style={s.formGroup}>
                  <label style={s.label}>Nome</label>
                  <input name="nome" value={form.nome} onChange={handleChange}
                    style={s.input} required placeholder="Ex: SALVADOR" />
                </div>
                <div style={s.modalActions}>
                  <button type="button" style={s.btn('#6b7280', '#fff')} onClick={fecharModal}>Cancelar</button>
                  <button type="submit" style={s.btn('#f0c040', '#0d0f14')} disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: '#0d0f14', color: '#e8eaf0', fontFamily: "'IBM Plex Sans', sans-serif" },
  content: { maxWidth: 900, margin: '0 auto', padding: '32px 24px' },
  title: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', letterSpacing: '2px', color: '#f0c040', marginBottom: 24 },
  error: { background: '#2a1a1a', border: '1px solid #ff5a5a', color: '#ff5a5a', padding: '10px 16px', borderRadius: 4, marginBottom: 20 },
  card: { background: '#161920', border: '1px solid #2a2f3e', borderRadius: 8, overflow: 'hidden' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: '#1e2230', borderBottom: '1px solid #2a2f3e' },
  cardTitle: { margin: 0, fontSize: '0.85rem', color: '#f0c040', fontFamily: "'IBM Plex Mono', monospace" },
  cardBody: { padding: 20 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #2a2f3e', background: '#1e2230', fontFamily: "'IBM Plex Mono', monospace" },
  td: { padding: '10px 14px', fontSize: '0.82rem', borderBottom: '1px solid #2a2f3e', color: '#e8eaf0', fontFamily: "'IBM Plex Mono', monospace" },
  btn: (bg, fg) => ({ background: bg, color: fg, border: 'none', padding: '8px 18px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', fontFamily: "'IBM Plex Mono', monospace" }),
  actionBtn: (color) => ({ background: 'transparent', color, border: '1px solid ' + color, borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", marginRight: 6 }),
  loadingText: { textAlign: 'center', color: '#6b7280', padding: 40 },
  emptyText: { textAlign: 'center', color: '#6b7280', padding: 40 },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { background: '#161920', border: '1px solid #2a2f3e', borderRadius: 12, padding: 28, width: '100%', maxWidth: 420 },
  modalTitle: { margin: '0 0 20px', fontSize: '1.1rem', color: '#f0c040', fontFamily: "'IBM Plex Mono', monospace" },
  formGroup: { marginBottom: 16 },
  label: { display: 'block', fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6, fontFamily: "'IBM Plex Mono', monospace" },
  input: { width: '100%', background: '#1e2230', border: '1px solid #2a2f3e', color: '#e8eaf0', padding: '10px 12px', borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', boxSizing: 'border-box' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
};