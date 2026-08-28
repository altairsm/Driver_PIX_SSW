import { useState, useEffect } from 'react';
import { getAjudantes, createAjudante, updateAjudante, deleteAjudante, getUnidades } from '../services/api';
import Topbar from '../components/Topbar';

export default function AdminAjudantes() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';
  const [ajudantes, setAjudantes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ codigo: '', nome: '', observacao: '', celular: '', unidade: '', tipo: 'funcionario' });
  const [salvando, setSalvando] = useState(false);
  const [unidades, setUnidades] = useState([]);

  const carregar = async () => {
    setLoading(true);
    try { setAjudantes(await getAjudantes()); }
    catch { setAjudantes([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);
  useEffect(() => { getUnidades().then(setUnidades).catch(() => {}); }, []);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ codigo: '', nome: '', observacao: '', celular: '', unidade: '', tipo: 'funcionario' });
    setError('');
    setModalAberto(true);
  };

  const abrirEditar = (a) => {
    setEditando(a);
    setForm({
      codigo: a.codigo || '',
      nome: a.nome || '',
      observacao: a.observacao || '',
      celular: a.celular || '',
      unidade: a.unidade || '',
      tipo: a.tipo || 'funcionario',
    });
    setError('');
    setModalAberto(true);
  };

  const fecharModal = () => { setModalAberto(false); setEditando(null); };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!form.codigo || !form.nome) {
      setError('Código e Nome são obrigatórios');
      return;
    }
    setSalvando(true);
    setError('');
    try {
      if (editando) {
        await updateAjudante(editando.codigo, form);
      } else {
        await createAjudante(form);
      }
      fecharModal();
      await carregar();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (a) => {
    if (!confirm(`Excluir ajudante ${a.nome}?`)) return;
    if (!confirm(`Confirma exclusão de ${a.nome}? Romaneios vinculados serão desassociados.`)) return;
    try {
      await deleteAjudante(a.codigo);
      await carregar();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir');
    }
  };

  const tipoLabel = (tipo) => {
    const labels = { funcionario: 'Funcionário', agregado: 'Agregado' };
    return labels[tipo] || tipo || 'Funcionário';
  };

  const tipoBadgeStyle = (tipo) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 600,
    background: tipo === 'agregado' ? '#ff9f40' : '#0d6efd',
    color: '#fff',
  });

  return (
    <div style={s.container}>
      <Topbar user={{ nome: 'Admin' }} />
      <div style={s.content}>
        <h2 style={s.title}>Ajudantes</h2>
        <div style={s.card}>
          <div style={s.cardHeader}>
            <h5 style={s.cardTitle}>Cadastro de Ajudantes</h5>
            {isAdmin && <button style={s.btn('#f0c040', '#0d0f14')} onClick={abrirNovo}>+ Novo</button>}
          </div>
          <div style={s.cardBody}>
            {loading ? <div style={s.loadingText}>Carregando...</div>
            : ajudantes.length === 0 ? <div style={s.emptyText}>Nenhum ajudante cadastrado</div>
            : <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead><tr>
                    <th style={s.th}>Código</th>
                    <th style={s.th}>Nome</th>
                    <th style={s.th}>Tipo</th>
                    <th style={s.th}>Celular</th>
                    <th style={s.th}>Unidade</th>
                    <th style={s.th}>Observação</th>
                    <th style={s.th}>Ações</th>
                  </tr></thead>
                  <tbody>
                    {ajudantes.map(a => (
                      <tr key={a.codigo}>
                        <td style={s.td}>{a.codigo}</td>
                        <td style={s.td}>{a.nome}</td>
                        <td style={s.td}><span style={tipoBadgeStyle(a.tipo)}>{tipoLabel(a.tipo)}</span></td>
                        <td style={s.td}>{a.celular || '—'}</td>
                        <td style={s.td}>{a.unidade || '—'}</td>
                        <td style={s.td}>{a.observacao || '—'}</td>
                        <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                          {isAdmin && <>
                            <button style={s.btnSm('#ffc107', '#0d0f14')} onClick={() => abrirEditar(a)}>Editar</button>
                            <button style={s.btnSm('#dc3545', '#fff')} onClick={() => handleExcluir(a)}>Excluir</button>
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
              <h3 style={s.mt}>{editando ? 'Editar Ajudante' : 'Novo Ajudante'}</h3>
              <button style={s.x} onClick={fecharModal}>&times;</button>
            </div>
            <form onSubmit={handleSalvar}>
              <div style={s.mb}>
                {error && <div style={s.errorMsg}>{error}</div>}
                <div style={s.field}>
                  <label style={s.label}>Código</label>
                  <input style={s.input} name="codigo" value={form.codigo}
                    onChange={(e) => setForm({...form, codigo: e.target.value.replace(/\D/g, '').substring(0, 20)})}
                    maxLength={20} disabled={!!editando} required />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Nome</label>
                  <input style={s.input} name="nome" value={form.nome}
                    onChange={handleChange} required />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Tipo</label>
                  <select style={s.select} name="tipo" value={form.tipo} onChange={handleChange}>
                    <option value="funcionario">Funcionário</option>
                    <option value="agregado">Agregado</option>
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Unidade</label>
                  <select style={s.select} name="unidade" value={form.unidade} onChange={handleChange}>
                    <option value="">—</option>
                    {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Celular</label>
                  <input style={s.input} name="celular" value={form.celular}
                    onChange={(e) => setForm({...form, celular: e.target.value.replace(/\D/g, '')})} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Observação</label>
                  <input style={s.input} name="observacao" value={form.observacao}
                    onChange={handleChange} />
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
  card: { background: '#161920', border: '1px solid #2a2f3e', borderRadius: 8, overflow: 'hidden' },
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
};
