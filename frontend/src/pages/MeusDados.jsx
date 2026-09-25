import { useState, useEffect } from 'react';
import { getDriverDados, updateDriverDados } from '../services/api';

function formatCNPJ(v) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatPhone(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 13);
  if (!d) return '-';
  if (d.length <= 2) return `+${d}`;
  if (d.length <= 4) return `+${d.slice(0, 2)} (${d.slice(2)}`;
  if (d.length <= 9) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4)}`;
  return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
}

export default function MeusDados() {
  const [dados, setDados] = useState(null);
  const [cnpj, setCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [pixTipo, setPixTipo] = useState('CPF');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const d = await getDriverDados();
        setDados(d);
        setTelefone(d.telefone || '');
        setCnpj(d.cnpj_mei || '');
        setPixTipo(d.pix_tipo || 'CPF');
      } catch {
        setMsg('Erro ao carregar dados');
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSalvando(true);
    setMsg('');
    try {
      const cnpjClean = cnpj.replace(/\D/g, '');
      await updateDriverDados({
        cnpj_mei: cnpjClean || null,
        pix_tipo: pixTipo,
      });
      const updated = await getDriverDados();
      setDados(updated);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.cnpj_mei = updated.cnpj_mei;
      user.pix_tipo = updated.pix_tipo;
      user.telefone = updated.telefone;
      localStorage.setItem('user', JSON.stringify(user));
      setMsg('Dados salvos com sucesso!');
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setMsg('Erro ao salvar dados');
    }
    setSalvando(false);
  };

  if (loading) return null;

  return (
    <div style={s.container}>
      <div style={s.topbar}>
        <div style={s.brand}>DRIVER PIX - INTUITIVA LOG</div>
        <a href="/driver" style={s.backBtn}>&#8592; Voltar ao Painel</a>
      </div>
      <div style={s.content}>
        <h1 style={s.title}>Meus Dados</h1>

        <div style={s.card}>
          <div style={s.field}>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Nome:</span>
              <span style={s.infoValue}>{dados?.nome || '-'}</span>
            </div>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>CPF:</span>
              <span style={s.infoValue}>{dados?.cpf || '-'}</span>
            </div>
          </div>
        </div>

        <div style={s.card}>
          <div style={s.field}>
            <label style={s.label}>CNPJ do MEI</label>
            <input style={s.input} value={cnpj} onChange={e => setCnpj(formatCNPJ(e.target.value))} placeholder="XX.XXX.XXX/XXXX-XX" />
          </div>
           <div style={s.field}>
             <label style={s.label}>Celular atual</label>
             <div style={s.readOnlyValue}>{formatPhone(telefone)}</div>
             {dados?.celular_nome && <div style={s.readOnlyHint}>Aparelho: {dados.celular_nome}</div>}
             {dados?.celular_atualizado_em && <div style={s.readOnlyHint}>Atualizado em: {new Date(dados.celular_atualizado_em).toLocaleString('pt-BR')}</div>}
           </div>
          <div style={s.field}>
            <label style={s.label}>Chave PIX para recebimento</label>
            <select style={s.select} value={pixTipo} onChange={e => setPixTipo(e.target.value)}>
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
            </select>
          </div>

          {msg && <div style={msg.includes('sucesso') ? s.msg : s.msgErro}>{msg}</div>}

          <button onClick={handleSave} disabled={salvando} style={{ ...s.saveBtn, ...(salvando ? s.saveBtnDisabled : {}) }}>
            {salvando ? 'SALVANDO...' : 'SALVAR'}
          </button>
        </div>
      </div>
      <div style={s.footer}>SISTEMA DE GESTÃO DE MOTORISTAS · DRIVER PIX · SSW</div>
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: '#0d0f14', color: '#e8eaf0', fontFamily: "'IBM Plex Sans', sans-serif" },
  topbar: { background: '#161920', borderBottom: '1px solid #2a2f3e', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 },
  brand: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '3px', color: '#f0c040' },
  backBtn: { background: 'transparent', border: '1px solid #2a2f3e', color: '#6b7280', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', letterSpacing: '1px', padding: '6px 12px', cursor: 'pointer', textDecoration: 'none' },
  content: { maxWidth: 600, margin: '0 auto', padding: '40px 24px 60px' },
  title: { fontFamily: "'Bebas Neue', sans-serif", fontSize: '2rem', letterSpacing: '3px', color: '#f0c040', marginBottom: 32 },
  card: { background: '#161920', border: '1px solid #2a2f3e', borderRadius: 6, padding: 24, marginBottom: 16 },
  field: { marginBottom: 20 },
  label: { display: 'block', color: '#9ca3af', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 },
  input: { width: '100%', background: '#1e2230', border: '1px solid #2a2f3e', color: '#e8eaf0', padding: '12px 16px', fontSize: '0.9rem', borderRadius: 4, outline: 'none', fontFamily: "'IBM Plex Mono', monospace", boxSizing: 'border-box' },
  readOnlyValue: { width: '100%', background: '#161920', border: '1px solid #2a2f3e', color: '#e8eaf0', padding: '12px 16px', fontSize: '0.9rem', borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", boxSizing: 'border-box' },
  readOnlyHint: { color: '#6b7280', fontSize: '0.7rem', marginTop: 6, fontFamily: "'IBM Plex Mono', monospace" },
  select: { width: '100%', background: '#1e2230', border: '1px solid #2a2f3e', color: '#e8eaf0', padding: '12px 16px', fontSize: '0.9rem', borderRadius: 4, outline: 'none', fontFamily: "'IBM Plex Mono', monospace", boxSizing: 'border-box', cursor: 'pointer' },
  saveBtn: { background: '#f0c040', color: '#0d0f14', border: 'none', padding: '14px', fontSize: '0.85rem', fontWeight: 600, borderRadius: 4, cursor: 'pointer', width: '100%', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '1px' },
  saveBtnDisabled: { background: '#2a2f3e', color: '#6b7280', cursor: 'not-allowed' },
  msg: { textAlign: 'center', padding: 12, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem', color: '#3de8a0' },
  msgErro: { textAlign: 'center', padding: 12, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem', color: '#ff5a5a' },
  infoRow: { display: 'flex', marginBottom: 8, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', color: '#b0b4c0' },
  infoLabel: { color: '#6b7280', minWidth: 80 },
  infoValue: { color: '#e8eaf0' },
  footer: { padding: '20px 32px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#2a2f3e', letterSpacing: '1px', textAlign: 'center' },
};
