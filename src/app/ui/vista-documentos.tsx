'use client';

import { useEffect, useState } from 'react';
import { listarPlanos } from '@/app/actions/plano.actions';
import { listarDocumentos, generarDocumento, regenerarDocumento, exportarMarkdown } from '@/app/actions/documento.actions';
import { TIPOS_POR_PLANO } from '@/app/documentos/documento-service';
import type { PlanoComExp } from '@/domain/plano-com-exp';
import type { Documento } from '@/domain/documento';

const card = { border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem 1rem', margin: '0.5rem 0', background: '#fafafa' } as const;
const btn = { padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 } as const;
const row = { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' as const, marginTop: '0.5rem' };

export function VistaDocumentos() {
  const [planos, setPlanos] = useState<PlanoComExp[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [planoSel, setPlanoSel] = useState('');
  const [tipoSel, setTipoSel] = useState('RESUMEN_COMERCIAL');
  const [markup, setMarkup] = useState('');
  const [msg, setMsg] = useState('');

  const cargar = () => {
    setLoading(true);
    Promise.all([listarPlanos(), listarDocumentos()])
      .then(([ps, ds]) => { setPlanos(ps); setDocumentos(ds); })
      .catch(() => setMsg('Error al cargar.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const tiposDisponibles = TIPOS_POR_PLANO[
    planos.find((p) => p.id === planoSel)?.id ? 'COM-EXP' : 'COM-EXP'
  ] ?? ['RESUMEN_COMERCIAL'];

  async function onGenerar() {
    if (!planoSel) { setMsg('Selecciona un plano primero.'); return; }
    setGenerando(true);
    try {
      await generarDocumento(planoSel, tipoSel);
      cargar();
      setMsg(`Documento ${tipoSel} generado.`);
    } catch (e) {
      setMsg('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGenerando(false);
    }
  }

  async function onRegenerar(id: string) {
    try {
      await regenerarDocumento(id);
      cargar();
      setMsg('Documento regenerado desde el plano actual.');
    } catch (e) {
      setMsg('Error: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function onExportar(id: string) {
    try {
      const text = await exportarMarkdown(id);
      setMarkup(text);
      setMsg('Markup exportado — visible abajo.');
    } catch (e) {
      setMsg('Error: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <section>
      {/* Generar nuevo documento */}
      <div style={{ ...card, background: '#f0f7ff', borderColor: '#b3d4f7' }}>
        <strong>Generar documento</strong>
        <div style={row}>
          <select value={planoSel} onChange={(e) => setPlanoSel(e.target.value)}
            style={{ padding: '0.3rem 0.5rem', borderRadius: 6, border: '1px solid #ccc', minWidth: 200 }}>
            <option value="">(seleccionar plano)</option>
            {planos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.entidad || p.id} {p.publicado ? '✓' : '(draft)'}
              </option>
            ))}
          </select>
          <select value={tipoSel} onChange={(e) => setTipoSel(e.target.value)}
            style={{ padding: '0.3rem 0.5rem', borderRadius: 6, border: '1px solid #ccc' }}>
            {tiposDisponibles.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button style={{ ...btn, background: '#e8f5e9' }} onClick={() => void onGenerar()} disabled={generando || !planoSel}>
            {generando ? 'Generando…' : 'Generar'}
          </button>
          <button style={btn} onClick={cargar} disabled={loading}>{loading ? 'Cargando…' : 'Actualizar'}</button>
        </div>
      </div>

      {msg && <p style={{ color: '#0a5', margin: '0.25rem 0' }}>{msg}</p>}

      {/* Lista de documentos */}
      {documentos.length === 0 && !loading && (
        <p style={{ color: '#666' }}>No hay documentos. Genera uno arriba.</p>
      )}
      {documentos.map((d) => (
        <div key={d.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <strong>{d.tipoDocumento}</strong>
              <span style={{ marginLeft: 8, fontSize: 12, color: '#555' }}>v{d.version}</span>
              {d.pendientes > 0 && (
                <span style={{ marginLeft: 6, fontSize: 12, color: '#a60' }}>⚠ {d.pendientes} pendiente(s)</span>
              )}
            </div>
            <span style={{ fontSize: 11, color: '#888' }}>{d.id.slice(0, 40)}…</span>
          </div>
          <div style={{ fontSize: 12, color: '#666', margin: '0.25rem 0' }}>
            Plano: {d.planoId.slice(0, 30)}… · Actualizado: {d.actualizadoEn.slice(0, 19).replace('T', ' ')}
          </div>
          <div style={row}>
            <button style={btn} onClick={() => void onRegenerar(d.id)}>Regenerar</button>
            <button style={{ ...btn, background: '#e8f5e9' }} onClick={() => void onExportar(d.id)}>Exportar Markdown</button>
          </div>
        </div>
      ))}

      {/* Markdown exportado */}
      {markup && (
        <>
          <h3 style={{ marginTop: '1.5rem' }}>Markdown exportado</h3>
          <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: 8, whiteSpace: 'pre-wrap', overflowX: 'auto', fontSize: 13 }}>
            {markup}
          </pre>
        </>
      )}
    </section>
  );
}
