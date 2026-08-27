import { useState, useRef } from 'react';
import { uploadSswCsv, uploadSsw455, uploadSsw930 } from '../services/api';
import Topbar from '../components/Topbar';

export default function AdminSswUpload() {
  const [file036, setFile036] = useState(null);
  const [file455, setFile455] = useState(null);
  const [file930, setFile930] = useState(null);
  const [result036, setResult036] = useState(null);
  const [result455, setResult455] = useState(null);
  const [result930, setResult930] = useState(null);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [preview036, setPreview036] = useState(null);
  const [preview455, setPreview455] = useState(null);
  const [preview930, setPreview930] = useState(null);
  const [showNaoEncontrados, setShowNaoEncontrados] = useState(false);
  const input036Ref = useRef(null);
  const input455Ref = useRef(null);
  const input930Ref = useRef(null);

  const handleFile = async (e, tipo) => {
    const selected = e.target.files[0];
    if (!selected) return;
    if (tipo === '036') {
      setFile036(selected);
      setResult036(null);
    } else if (tipo === '455') {
      setFile455(selected);
      setResult455(null);
    } else {
      setFile930(selected);
      setResult930(null);
      setShowNaoEncontrados(false);
    }
    setError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n').slice(0, 5);
      const cols = lines[1] ? lines[1].split(';').map(c => c.trim()) : [];
      const preview = { total_linhas: text.split('\n').length, colunas: cols, amostra: lines.slice(2, 5).map(l => l.split(';')) };
      if (tipo === '036') setPreview036(preview);
      else if (tipo === '455') setPreview455(preview);
      else setPreview930(preview);
    };
    reader.readAsText(selected.slice(0, 50000));
  };

  const handleUpload = async (tipo) => {
    const file = tipo === '036' ? file036 : tipo === '455' ? file455 : file930;
    if (!file) return;
    setLoading(tipo);
    setError('');
    try {
      let data;
      if (tipo === '455') {
        data = await uploadSsw455(file);
      } else if (tipo === '930') {
        data = await uploadSsw930(file);
      } else {
        data = await uploadSswCsv(file, tipo);
      }
      if (tipo === '036') {
        setResult036(data);
        setFile036(null);
        setPreview036(null);
        if (input036Ref.current) input036Ref.current.value = '';
      } else if (tipo === '455') {
        setResult455(data);
        setFile455(null);
        setPreview455(null);
        if (input455Ref.current) input455Ref.current.value = '';
      } else {
        setResult930(data);
        setFile930(null);
        setPreview930(null);
        setShowNaoEncontrados(false);
        if (input930Ref.current) input930Ref.current.value = '';
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Erro ao importar arquivo';
      const status = err.response?.status ? ` [${err.response.status}]` : '';
      setError(`${status} ${msg}`);
    } finally {
      setLoading('');
    }
  };

  const copiarNaoEncontrados = () => {
    if (!result930?.nao_encontrados) return;
    const texto = result930.nao_encontrados.map(n => n.ctrc).join('\n');
    navigator.clipboard.writeText(texto);
  };

  return (
    <div style={styles.container}>
      <Topbar user={{ nome: 'Admin' }} />
      <div style={styles.content}>
        <h2 style={styles.title}>Importar Dados SSW</h2>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.card}>
          <div style={styles.cardHeader}>SSW 036 — Romaneios e CTRCs</div>
          <div style={styles.cardBody}>
            <p style={styles.desc}>Importar primeiro: contém romaneios, motoristas, CTRCs com cidade de entrega.</p>
            <label style={styles.uploadZone}>
              <input ref={input036Ref} type="file" accept=".csv" onChange={(e) => handleFile(e, '036')} style={{ display: 'none' }} />
              <div style={styles.uploadPlaceholder}>
                {file036 ? <span style={{ color: '#3de8a0' }}>{file036.name}</span> : 'Selecionar CSV 036'}
              </div>
            </label>

            {preview036 && !result036 && (
              <div style={styles.preview}>
                <div style={styles.previewTitle}>Preview — {preview036.total_linhas} linhas</div>
                <div style={styles.colList}>
                  {preview036.colunas.slice(0, 10).map((col, i) => (
                    <span key={i} style={styles.colTag}>{col}</span>
                  ))}
                  {preview036.colunas.length > 10 && <span style={styles.colTag}>+{preview036.colunas.length - 10}</span>}
                </div>
                <button onClick={() => handleUpload('036')} disabled={loading === '036'} style={styles.importBtn}>
                  {loading === '036' ? 'Importando...' : 'Importar SSW 036'}
                </button>
              </div>
            )}

            {result036 && (
              <div style={styles.resultCard}>
                <div style={styles.resultTitle}>✓ Importado</div>
                <div style={styles.resultDetails}>
                  <span>{result036.total_lidos} linhas</span>
                  <span>{result036.motoristas} motoristas</span>
                  <span>{result036.romaneios} romaneios</span>
                  <span>{result036.ctrcs} CTRCs</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>SSW 455 — CT-e's Expedidos e Recebidos (Unidade Receptora)</div>
          <div style={styles.cardBody}>
            <p style={styles.desc}>Identifica a unidade responsável pela entrega. Cruzamento automático com CTRCs existentes. Inclui dados do pagador do frete.</p>
            <label style={styles.uploadZone}>
              <input ref={input455Ref} type="file" accept=".csv" onChange={(e) => handleFile(e, '455')} style={{ display: 'none' }} />
              <div style={styles.uploadPlaceholder}>
                {file455 ? <span style={{ color: '#3de8a0' }}>{file455.name}</span> : 'Selecionar CSV 455'}
              </div>
            </label>

            {preview455 && !result455 && (
              <div style={styles.preview}>
                <div style={styles.previewTitle}>Preview — {preview455.total_linhas} linhas</div>
                <div style={styles.colList}>
                  {preview455.colunas.slice(0, 10).map((col, i) => (
                    <span key={i} style={styles.colTag}>{col}</span>
                  ))}
                  {preview455.colunas.length > 10 && <span style={styles.colTag}>+{preview455.colunas.length - 10}</span>}
                </div>
                <button onClick={() => handleUpload('455')} disabled={loading === '455'} style={styles.importBtn}>
                  {loading === '455' ? 'Importando...' : 'Importar SSW 455'}
                </button>
              </div>
            )}

            {result455 && (
              <div style={styles.resultCard}>
                <div style={styles.resultTitle}>✓ Importado</div>
                <div style={styles.resultDetails}>
                  <span>{result455.total_lidos} linhas</span>
                  <span>{result455.importados} CT-e's importados</span>
                  <span>{result455.atualizados_ctrcs} CTRCs atualizados com unidade</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>SSW 930 — Atualizar Ocorrências</div>
          <div style={styles.cardBody}>
            <p style={styles.desc}>Atualiza a última ocorrência dos CT-e's já importados no 455. Não armazena o arquivo — apenas usa para cruzamento. CTRCs ausentes no 455 são listados para importação posterior.</p>
            <label style={styles.uploadZone}>
              <input ref={input930Ref} type="file" accept=".csv" onChange={(e) => handleFile(e, '930')} style={{ display: 'none' }} />
              <div style={styles.uploadPlaceholder}>
                {file930 ? <span style={{ color: '#3de8a0' }}>{file930.name}</span> : 'Selecionar CSV 930'}
              </div>
            </label>

            {preview930 && !result930 && (
              <div style={styles.preview}>
                <div style={styles.previewTitle}>Preview — {preview930.total_linhas} linhas</div>
                <div style={styles.colList}>
                  {preview930.colunas.slice(0, 10).map((col, i) => (
                    <span key={i} style={styles.colTag}>{col}</span>
                  ))}
                  {preview930.colunas.length > 10 && <span style={styles.colTag}>+{preview930.colunas.length - 10}</span>}
                </div>
                <button onClick={() => handleUpload('930')} disabled={loading === '930'} style={styles.importBtn}>
                  {loading === '930' ? 'Importando...' : 'Importar SSW 930'}
                </button>
              </div>
            )}

            {result930 && (
              <div style={styles.resultCard}>
                <div style={styles.resultTitle}>✓ Processado</div>
                <div style={styles.resultDetails}>
                  <span>{result930.total_lidos} linhas</span>
                  <span>{result930.atualizados} CTRCs atualizados</span>
                  <span>{result930.nao_encontrados?.length || 0} não encontrados no 455</span>
                </div>
                {result930.nao_encontrados?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <button
                      onClick={() => setShowNaoEncontrados(!showNaoEncontrados)}
                      style={{ ...styles.importBtn, background: '#f59e0b', fontSize: '0.75rem', padding: '6px 16px' }}
                    >
                      {showNaoEncontrados ? 'Ocultar' : 'Ver'} {result930.nao_encontrados.length} CTRCs não encontrados
                    </button>
                    {showNaoEncontrados && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontFamily: "'IBM Plex Mono', monospace" }}>
                            Importe o SSW 455 para incluí-los
                          </span>
                          <button
                            onClick={copiarNaoEncontrados}
                            style={{ ...styles.importBtn, background: '#3b82f6', fontSize: '0.65rem', padding: '4px 12px' }}
                          >
                            Copiar lista
                          </button>
                        </div>
                        <div style={{ maxHeight: 200, overflow: 'auto', background: '#0d0f14', borderRadius: 4, padding: 8, border: '1px solid #2a2f3e' }}>
                          {result930.nao_encontrados.map((n, i) => (
                            <div key={i} style={{ fontSize: '0.7rem', color: '#f87171', fontFamily: "'IBM Plex Mono', monospace", padding: '2px 0' }}>
                              {n.ctrc} <span style={{ color: '#6b7280' }}>({n.cliente_pagador})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
  card: { background: '#161920', border: '1px solid #2a2f3e', borderRadius: 8, marginBottom: 20, overflow: 'hidden' },
  cardHeader: { padding: '12px 20px', background: '#1e2230', borderBottom: '1px solid #2a2f3e', fontSize: '0.85rem', color: '#f0c040', fontFamily: "'IBM Plex Mono', monospace" },
  cardBody: { padding: 20 },
  desc: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', color: '#6b7280', marginBottom: 12 },
  uploadZone: { display: 'block', cursor: 'pointer' },
  uploadPlaceholder: { border: '2px dashed #2a2f3e', borderRadius: 8, padding: '20px', textAlign: 'center', color: '#6b7280' },
  preview: { marginTop: 12 },
  previewTitle: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', color: '#9ca3af', marginBottom: 8 },
  colList: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 },
  colTag: { background: '#0d0f14', padding: '2px 8px', borderRadius: 4, fontSize: '0.65rem', color: '#9ca3af', fontFamily: "'IBM Plex Mono', monospace" },
  importBtn: { background: '#f0c040', color: '#0d0f14', border: 'none', padding: '10px 24px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', marginTop: 8 },
  resultCard: { background: '#1a3a2a', border: '1px solid #3de8a0', borderRadius: 8, padding: 20, marginTop: 12 },
  resultTitle: { fontSize: '1.1rem', fontWeight: 600, color: '#3de8a0', marginBottom: 8 },
  resultDetails: { display: 'flex', gap: 16, color: '#9ca3af', fontSize: '0.8rem', flexWrap: 'wrap' },
  error: { background: '#2a1a1a', border: '1px solid #ff5a5a', color: '#ff5a5a', padding: '10px 16px', borderRadius: 4, marginBottom: 20 },
};
