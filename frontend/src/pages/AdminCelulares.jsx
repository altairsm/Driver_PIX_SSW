import { useEffect, useState } from 'react';
import { getCelulares, createCelular, updateCelular, deleteCelular } from '../services/api';
import Topbar from '../components/Topbar';

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '—';
  if (digits.length <= 5) return digits;
  if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : '—';
}

export default function AdminCelulares() {
  const [celulares, setCelulares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ numero: '', nome: '' });
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      setCelulares(await getCelulares());
    } catch {
      setCelulares([]);
      setError('Erro ao carregar celulares');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getCelulares()
      .then(setCelulares)
      .catch(() => {
        setCelulares([]);
        setError('Erro ao carregar celulares');
      })
      .finally(() => setLoading(false));
  }, []);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ numero: '', nome: '' });
    setError('');
    setModalAberto(true);
  };

  const abrirEditar = (celular) => {
    setEditando(celular);
    setForm({ numero: celular.numero || '', nome: celular.nome || '' });
    setError('');
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
  };

  const handleSalvar = async (event) => {
    event.preventDefault();
    if (!form.numero || !form.nome) {
      setError('Celular e Nome são obrigatórios');
      return;
    }

    setSalvando(true);
    setError('');
    try {
      if (editando) {
        await updateCelular(editando.id, form);
      } else {
        await createCelular(form);
      }
      fecharModal();
      await carregar();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar celular');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (celular) => {
    if (!confirm(`Excluir o celular ${formatPhone(celular.numero)}?`)) return;
    try {
      await deleteCelular(celular.id);
      await carregar();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir celular');
    }
  };

  return (
    <div style={s.container}>
      <Topbar user={{ nome: 'Admin' }} />
      <div style={s.content}>
        <h2 style={s.title}>Celulares</h2>
        <div style={s.card}>
          <div style={s.cardHeader}>
            <h5 style={s.cardTitle}>Cadastro de Celulares</h5>
            <button style={s.btn('#f0c040', '#0d0f14')} onClick={abrirNovo}>+ Novo</button>
          </div>
          <div style={s.cardBody}>
            {error && !modalAberto && <div style={s.errorMsg}>{error}</div>}
            {loading ? <div style={s.loadingText}>Carregando...</div>
            : celulares.length === 0 ? <div style={s.emptyText}>Nenhum celular cadastrado</div>
            : <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead><tr>
                    <th style={s.th}>Celular</th>
                    <th style={s.th}>Nome</th>
                    <th style={s.th}>Motorista atual</th>
                    <th style={s.th}>Atualizado em</th>
                    <th style={s.th}>Ações</th>
                  </tr></thead>
                  <tbody>
                    {celulares.map(celular => (
                      <tr key={celular.id}>
                        <td style={s.td}>{formatPhone(celular.numero)}</td>
                        <td style={s.td}>{celular.nome}</td>
                        <td style={s.td}>
                          {celular.motorista_cpf
                            ? `${celular.motorista_nome} (${celular.motorista_cpf})`
                            : 'Disponível'}
                        </td>
                        <td style={s.td}>{formatDateTime(celular.atualizado_em)}</td>
                        <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                          <button style={s.btnSm('#ffc107', '#0d0f14')} onClick={() => abrirEditar(celular)}>Editar</button>
                          <button style={s.btnSm('#dc3545', '#fff')} onClick={() => handleExcluir(celular)}>Excluir</button>
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
          <div style={s.modal} onClick={(event) => event.stopPropagation()}>
            <div style={s.mh}>
              <h3 style={s.mt}>{editando ? 'Editar Celular' : 'Novo Celular'}</h3>
              <button style={s.x} onClick={fecharModal}>&times;</button>
            </div>
            <form onSubmit={handleSalvar}>
              <div style={s.mb}>
                {error && <div style={s.errorMsg}>{error}</div>}
                <div style={s.field}>
                  <label style={s.label}>Celular</label>
                  <input style={s.input} name="numero" value={form.numero}
                    onChange={(event) => setForm({ ...form, numero: event.target.value.replace(/\D/g, '').slice(0, 20) })}
                    minLength={10} maxLength={20} placeholder="11999999999" required />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Nome</label>
                  <input style={s.input} name="nome" value={form.nome}
                    onChange={(event) => setForm({ ...form, nome: event.target.value })}
                    maxLength={200} placeholder="Nome do aparelho" required />
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
  errorMsg: { color: '#ff5a5a', fontSize: '0.85rem', marginBottom: 12 },
  loadingText: { textAlign: 'center', color: '#f0c040', padding: 40, fontSize: '0.85rem' },
  emptyText: { textAlign: 'center', color: '#6b7280', padding: 40, fontSize: '0.9rem' },
};
