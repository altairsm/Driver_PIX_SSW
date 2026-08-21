import { useState, useEffect } from 'react';
import { getMotoristas, createMotorista, updateMotorista, deleteMotorista, sendMotoristaPassword, getUnidades } from '../services/api';
import Topbar from '../components/Topbar';

export default function AdminMotoristas() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ cpf: '', nome: '', telefone: '', pix_tipo: 'CPF', cnpj_mei: '', bonus_d0: 0, email: '', role: 'motorista', pre_aprovado: false });
  const [salvando, setSalvando] = useState(false);
  const [enviandoSenha, setEnviandoSenha] = useState(null);
  const [unidades, setUnidades] = useState([]);

  const carregar = async () => {
    setLoading(true);
    try { setMotoristas(await getMotoristas()); }
    catch { setMotoristas([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);
  useEffect(() => { getUnidades().then(setUnidades).catch(() => {}); }, []);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ cpf: '', nome: '', telefone: '', pix_tipo: 'CPF', cnpj_mei: '', bonus_d0: 0, email: '', role: 'motorista', pre_aprovado: false, unidade: '', tipo: 'funcionario' });
    setError('');
    setModalAberto(true);
  };

  const abrirEditar = (m) => {
    setEditando(m);
    setForm({
      cpf: m.cpf || '',
      nome: m.nome || '',
      telefone: m.telefone || '',
      pix_tipo: m.pix_tipo || 'CPF',
      cnpj_mei: m.cnpj_mei || '',
      bonus_d0: m.bonus_d0 || 0,
      email: m.email || '',
      role: m.role || 'motorista',
      pre_aprovado: m.pre_aprovado || false,
      unidade: m.unidade || '',
      tipo: m.tipo || 'funcionario',
    });
    setError('');
    setModalAberto(true);
  };

  const fecharModal = () => { setModalAberto(false); setEditando(null); };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!form.cpf || !form.nome) {
      setError('CPF e Nome são obrigatórios');
      return;
    }
    setSalvando(true);
    setError('');
    try {
      if (editando) {
        await updateMotorista(editando.cpf, form);
      } else {
        await createMotorista(form);
      }
      fecharModal();
      await carregar();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (m) => {
    if (!confirm(`Excluir motorista ${m.nome}?`)) return;
    if (!confirm(`Confirma exclusão de ${m.nome}? Romaneios vinculados serão removidos.`)) return;
    try {
      await deleteMotorista(m.cpf);
      await carregar();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir');
    }
  };

  const handleEnviarSenha = async (m) => {
    setEnviandoSenha(m.cpf);
    try {
      const result = await sendMotoristaPassword(m.cpf);
      alert(result.message || 'Senha enviada com sucesso');
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao enviar senha');
    } finally {
      setEnviandoSenha(null);
    }
  };

  const roleLabel = (role) => {
    const labels = { motorista: 'Motorista', admin: 'Admin', operador: 'Operador', consulta: 'Consulta' };
    return labels[role] || role;
  };

  const roleBadgeStyle = (role) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 600,
    background: role === 'admin' ? '#dc3545' : role === 'operador' ? '#0d6efd' : role === 'consulta' ? '#6c757d' : '#198754',
    color: '#fff',
  });

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
        <h2 style={s.title}>Motoristas</h2>
        <div style={s.card}>
          <div style={s.cardHeader}>
            <h5 style={s.cardTitle}>Cadastro de Motoristas</h5>
            {isAdmin && <button style={s.btn('#f0c040', '#0d0f14')} onClick={abrirNovo}>+ Novo</button>}
          </div>
          <div style={s.cardBody}>
            {loading ? <div style={s.loadingText}>Carregando...</div>
            : motoristas.length === 0 ? <div style={s.emptyText}>Nenhum motorista cadastrado</div>
            : <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead><tr>
                    <th style={s.th}>CPF</th>
                    <th style={s.th}>Nome</th>
                    <th style={s.th}>Tipo</th>
                    <th style={s.th}>E-mail</th>
                    <th style={s.th}>Perfil</th>
                    <th style={s.th}>Unidade</th>
                    <th style={s.th}>Adiantamento</th>
                    <th style={s.th}>Telefone</th>
                    <th style={s.th}>Bônus D0</th>
                    <th style={s.th}>Ações</th>
                  </tr></thead>
                  <tbody>
                    {motoristas.map(m => (
                      <tr key={m.cpf}>
                        <td style={s.td}>{m.cpf}</td>
                        <td style={s.td}>{m.nome}</td>
                        <td style={s.td}><span style={tipoBadgeStyle(m.tipo)}>{tipoLabel(m.tipo)}</span></td>
                        <td style={s.td}>{m.email || '—'}</td>
                        <td style={s.td}><span style={roleBadgeStyle(m.role)}>{roleLabel(m.role)}</span></td>
                        <td style={s.td}>{m.unidade || '—'}</td>
                        <td style={s.td}>
                          {m.pre_aprovado ? (
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 600, background: '#1a3a2a', color: '#3de8a0' }}>PRÉ-APROVADO</span>
                          ) : (
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 600, background: '#2a2f3e', color: '#6b7280' }}>MANUAL</span>
                          )}
                        </td>
                        <td style={s.td}>{m.telefone || '—'}</td>
                        <td style={{ ...s.td, color: '#3de8a0' }}>R$ {Number(m.bonus_d0 || 0).toFixed(2)}</td>
                        <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                          {m.email && <button style={s.btnSm('#0d6efd', '#fff')} onClick={() => handleEnviarSenha(m)} disabled={enviandoSenha === m.cpf}>
                            {enviandoSenha === m.cpf ? '...' : 'Senha'}
                          </button>}
                          {isAdmin && <>
                            <button style={s.btnSm('#ffc107', '#0d0f14')} onClick={() => abrirEditar(m)}>Editar</button>
                            <button style={s.btnSm('#dc3545', '#fff')} onClick={() => handleExcluir(m)}>Excluir</button>
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
              <h3 style={s.mt}>{editando ? 'Editar Motorista' : 'Novo Motorista'}</h3>
              <button style={s.x} onClick={fecharModal}>&times;</button>
            </div>
            <form onSubmit={handleSalvar}>
              <div style={s.mb}>
                {error && <div style={s.errorMsg}>{error}</div>}
                <div style={s.field}>
                  <label style={s.label}>CPF</label>
                  <input style={s.input} name="cpf" value={form.cpf}
                    onChange={(e) => setForm({...form, cpf: e.target.value.replace(/\D/g, '').substring(0, 11)})}
                    maxLength={11} disabled={!!editando} required />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Nome Completo</label>
                  <input style={s.input} name="nome" value={form.nome}
                    onChange={handleChange} required />
                </div>
                <div style={s.field}>
                  <label style={s.label}>E-mail</label>
                  <input style={s.input} name="email" type="email" value={form.email}
                    onChange={handleChange} placeholder="email@exemplo.com.br" />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Tipo</label>
                  <select style={s.select} name="tipo" value={form.tipo} onChange={handleChange}>
                    <option value="funcionario">Funcionário</option>
                    <option value="agregado">Agregado</option>
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Perfil de Acesso</label>
                  <select style={s.select} name="role" value={form.role} onChange={handleChange}>
                    <option value="motorista">Motorista</option>
                    <option value="admin">Admin</option>
                    <option value="operador">Operador</option>
                    <option value="consulta">Consulta</option>
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Unidade (para operador/consulta)</label>
                  <select style={s.select} name="unidade" value={form.unidade} onChange={handleChange}>
                    <option value="">Todas (admin)</option>
                    {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Telefone</label>
                  <input style={s.input} name="telefone" value={form.telefone}
                    onChange={(e) => setForm({...form, telefone: e.target.value.replace(/\D/g, '')})} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Tipo PIX</label>
                  <select style={s.select} name="pix_tipo" value={form.pix_tipo} onChange={handleChange}>
                    <option value="CPF">CPF</option>
                    <option value="CNPJ">CNPJ</option>
                    <option value="EMAIL">E-mail</option>
                    <option value="TELEFONE">Telefone</option>
                    <option value="ALEATORIA">Chave Aleatória</option>
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>CNPJ MEI</label>
                  <input style={s.input} name="cnpj_mei" value={form.cnpj_mei}
                    onChange={handleChange} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Bônus D0 (R$ por entrega no mesmo dia)</label>
                  <input style={s.input} name="bonus_d0" type="number" step="0.01" min="0" value={form.bonus_d0}
                    onChange={(e) => setForm({...form, bonus_d0: e.target.value})} />
                </div>
                <div style={s.field}>
                  <label style={{ ...s.label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.pre_aprovado}
                      onChange={(e) => setForm({...form, pre_aprovado: e.target.checked})}
                      style={{ width: 16, height: 16, accentColor: '#3de8a0' }} />
                    Adiantamento Pré-Aprovado (PIX automático)
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
