import { useState, useEffect } from 'react';
import { getPagadores, createPagador, updatePagador, deletePagador } from '../services/api';
import Topbar from '../components/Topbar';

export default function AdminPagadores() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';
  const [pagadores, setPagadores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ cnpj: '', razao_social: '', nome_simplificado: '' });
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try { setPagadores(await getPagadores()); }
    catch { setPagadores([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ cnpj: '', razao_social: '', nome_simplificado: '', ativo: true });
    setError('');
    setModalAberto(true);
  };

  const abrirEditar = (p) => {
    setEditando(p);
    setForm({ cnpj: p.cnpj || '', razao_social: p.razao_social || '', nome_simplificado: p.nome_simplificado || '', ativo: p.ativo !== false });
    setError('');
    setModalAberto(true);
  };

  const fecharModal = () => { setModalAberto(false); setEditando(null); };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!form.cnpj || !form.razao_social) {
      setError('CNPJ e Razão Social são obrigatórios');
      return;
    }
    setSalvando(true);
    setError('');
    try {
      if (editando) {
        await updatePagador(editando.id, form);
      } else {
        await createPagador(form);
      }
      fecharModal();
      await carregar();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const handleToggleAtivo = async (p) => {
    try {
      await updatePagador(p.id, { ...p, ativo: !p.ativo });
      await carregar();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao alterar status');
    }
  };

  const handleExcluir = async (p) => {
    if (!confirm(`Excluir pagador ${p.razao_social}?`)) return;
    try {
      await deletePagador(p.id);
      await carregar();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir');
    }
  };

  const formatCnpj = (v) => {
    const c = (v || '').replace(/\D/g, '');
    return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  return (
    <div style={s.container}>
      <Topbar user={{ nome: 'Admin' }} />
      <div style={s.content}>
        <h2 style={s.title}>Pagadores</h2>

        <div style={s.card}>
          <div style={s.cardHeader}>
            <h5 style={s.cardTitle}>Cadastro de Pagadores</h5>
            {isAdmin && <button style={s.btn('#f0c040', '#0d0f14')} onClick={abrirNovo}>+ Novo</button>}
          </div>
          <div style={s.cardBody}>
            {loading ? <div style={s.loadingText}>Carregando...</div>
            : pagadores.length === 0 ? <div style={s.emptyText}>Nenhum pagador cadastrado. Importe o SSW 455 primeiro.</div>
            : <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead><tr>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>CNPJ</th>
                    <th style={s.th}>Razão Social</th>
                    <th style={s.th}>Nome Simplificado</th>
                    <th style={s.th}>Ações</th>
                  </tr></thead>
                  <tbody>
                    {pagadores.map(p => (
                      <tr key={p.id} style={{ opacity: p.ativo === false ? 0.5 : 1 }}>
                        <td style={s.td}>
                          <button
                            onClick={() => isAdmin && handleToggleAtivo(p)}
                            style={{
                              background: p.ativo !== false ? '#1a3a2a' : '#3a1a1a',
                              color: p.ativo !== false ? '#3de8a0' : '#ff5a5a',
                              border: `1px solid ${p.ativo !== false ? '#3de8a0' : '#ff5a5a'}`,
                              borderRadius: 12, padding: '3px 10px', cursor: isAdmin ? 'pointer' : 'default',
                              fontSize: '0.7rem', fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace"
                            }}
                          >
                            {p.ativo !== false ? 'ATIVO' : 'INATIVO'}
                          </button>
                        </td>
                        <td style={s.td}>{formatCnpj(p.cnpj)}</td>
                        <td style={s.td}>{p.razao_social}</td>
                        <td style={s.td}>{p.nome_simplificado || '—'}</td>
                        <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                          {isAdmin && <>
                            <button style={s.btnSm('#ffc107', '#0d0f14')} onClick={() => abrirEditar(p)}>Editar</button>
                            <button style={s.btnSm('#dc3545', '#fff')} onClick={() => handleExcluir(p)}>Excluir</button>
                          </>}
                        </td>
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
              <h3 style={s.mt}>{editando ? 'Editar Pagador' : 'Novo Pagador'}</h3>
              <button style={s.x} onClick={fecharModal}>&times;</button>
            </div>
            <form onSubmit={handleSalvar}>
              <div style={s.mb}>
                {error && <div style={s.errorMsg}>{error}</div>}
                <div style={s.field}>
                  <label style={s.label}>CNPJ</label>
                  <input style={s.input} name="cnpj" value={form.cnpj}
                    onChange={(e) => setForm({...form, cnpj: e.target.value.replace(/\D/g, '').substring(0, 14)})}
                    maxLength={14} required placeholder="00000000000000" />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Razão Social</label>
                  <input style={s.input} name="razao_social" value={form.razao_social}
                    onChange={handleChange} required />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Nome Simplificado</label>
                  <input style={s.input} name="nome_simplificado" value={form.nome_simplificado}
                    onChange={handleChange} placeholder="Ex: MAGAZINE LUIZA" />
                </div>
                {editando && (
                  <div style={s.field}>
                    <label style={s.label}>Status</label>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, ativo: !form.ativo })}
                      style={{
                        background: form.ativo ? '#1a3a2a' : '#3a1a1a',
                        color: form.ativo ? '#3de8a0' : '#ff5a5a',
                        border: `1px solid ${form.ativo ? '#3de8a0' : '#ff5a5a'}`,
                        borderRadius: 12, padding: '6px 16px', cursor: 'pointer',
                        fontSize: '0.8rem', fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace"
                      }}
                    >
                      {form.ativo ? 'ATIVO' : 'INATIVO'}
                    </button>
                  </div>
                )}
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
  cardHeader: { padding: '12px 20px', background: '#1e2230', borderBottom: '1px solid #2a2f3e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { margin: 0, fontSize: '0.95rem', color: '#e8eaf0' },
  cardBody: { padding: 20 },
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
  select: { width: '100%', background: '#1e2230', border: '1px solid #2a2f3e', color: '#e8eaf0', padding: '8px 12px', borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', boxSizing: 'border-box' },
  errorMsg: { color: '#ff5a5a', fontSize: '0.85rem', marginBottom: 12 },
  loadingText: { textAlign: 'center', color: '#f0c040', padding: 40, fontSize: '0.85rem' },
  emptyText: { textAlign: 'center', color: '#6b7280', padding: 40, fontSize: '0.9rem' },
  subTitle: { margin: '20px 0 10px', fontSize: '0.85rem', color: '#f0c040', fontFamily: "'IBM Plex Mono', monospace" },
  resumoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 },
  resumoItem: { background: '#1e2230', borderRadius: 6, padding: 12, textAlign: 'center' },
  resumoLabel: { fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 },
  resumoValor: { fontSize: '1.1rem', fontWeight: 600, color: '#e8eaf0', fontFamily: "'IBM Plex Mono', monospace" },
};
