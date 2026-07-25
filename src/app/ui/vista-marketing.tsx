'use client';

// MARKETING — embudo/flujo del plano de Marketing como grafo: investigación antropológica →
// segmentación y avatar → mapas del cliente → calendario de campañas → laboratorio de mercado.
// Cada etapa edita los campos del plano MKT (misma fuente que el documento). Las tablas
// (hallazgos, campañas, experimentos) se muestran con su conteo y se editan por CSV en el plano.

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { obtenerDetallePlano, guardarCampo, generarDocumentoDePlano } from '@/app/actions/especialista.actions';
import type { DetallePlano } from '@/app/actions/especialista.actions';
import type { DocumentoPlano } from '@/domain/plano-doc';

const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };
const inp: CSSProperties = { padding: '0.4rem 0.55rem', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, width: '100%', boxSizing: 'border-box', resize: 'vertical' };

const EMOJI: Record<string, string> = {
  antropologia: '🔬', hallazgos: '🔎', segmentacion: '🎯', mapas: '🗺️',
  calendario: '📅', plan: '📋', laboratorio: '🧪', labmetodo: '🔁',
};

export function VistaMarketing({ proyectoId }: { proyectoId: string }) {
  const [det, setDet] = useState<DetallePlano | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<DocumentoPlano | null>(null);
  const [genLoading, setGenLoading] = useState(false);

  const cargar = () => {
    setLoading(true);
    obtenerDetallePlano(proyectoId, 'MKT').then((d) => { setDet(d); setCampos(d?.campos ?? {}); }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [proyectoId]);

  async function editar(campoId: string, valor: string) {
    setCampos((c) => ({ ...c, [campoId]: valor }));
    await guardarCampo(proyectoId, 'MKT', campoId, valor);
  }
  async function generar() {
    setGenLoading(true);
    try { setDoc(await generarDocumentoDePlano(proyectoId, 'MKT')); } catch { setDoc(null); } finally { setGenLoading(false); }
  }

  const filasDe = (ref: string) => det?.tablas.find((t) => t.tablaRef === ref)?.filas.length ?? 0;

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>📣 Marketing <span style={{ fontSize: 13, color: '#888' }}>· embudo del plan de marketing</span></h2>
        <button style={{ ...btn, borderColor: '#c95b7c', color: '#a03e5c' }} onClick={() => void generar()}>{genLoading ? '…' : '📄 Generar documento'}</button>
      </div>
      <p style={{ fontSize: 12, color: '#777', margin: '0.3rem 0 0.8rem' }}>
        El flujo va de la <strong>investigación antropológica</strong> al <strong>laboratorio de mercado</strong> (validar antes de gastar). Lo que escribes aquí ES el plano <strong>Marketing</strong>.
      </p>

      {loading && <p style={{ color: '#666' }}>Cargando…</p>}

      {doc && (
        <div style={{ border: '1px solid #c95b7c', borderRadius: 10, background: '#fff', padding: '0.7rem', marginBottom: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>📄 Documento — {doc.titulo} <span style={{ color: doc.pendientes ? '#c60' : '#2e9e63', fontWeight: 'normal' }}>({doc.pendientes} pendientes / {doc.totalRequerido})</span></strong>
            <button style={btn} onClick={() => setDoc(null)}>Cerrar</button>
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 320, overflow: 'auto', background: '#fafafa', padding: '0.6rem', borderRadius: 6, marginTop: '0.5rem', lineHeight: 1.5 }}>{doc.markup}</pre>
        </div>
      )}

      {/* EMBUDO como flujo vertical */}
      {det && (
        <div style={{ maxWidth: 720 }}>
          {det.bloques.map((b, i) => {
            const tieneCampos = (b.campos ?? []).length > 0;
            const tref = b.tabla?.tablaRef;
            return (
              <div key={b.id}>
                <div style={{ border: '1px solid #e6cdd6', borderLeft: '4px solid #c95b7c', borderRadius: 10, background: '#fff', padding: '0.7rem 0.85rem' }}>
                  <div style={{ fontWeight: 'bold', fontSize: 14, color: '#a03e5c' }}>{EMOJI[b.id] ?? '•'} {b.titulo}</div>
                  {tieneCampos && (b.campos ?? []).map((c) => (
                    <div key={c.id} style={{ marginTop: '0.5rem' }}>
                      <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 2 }}>{c.pregunta}</label>
                      <textarea style={inp} rows={2} defaultValue={campos[c.id] ?? ''} key={`${c.id}-${det.planoId}`}
                        placeholder="(vacío → PENDIENTE)"
                        onBlur={(e) => { if (e.target.value !== (campos[c.id] ?? '')) void editar(c.id, e.target.value); }} />
                    </div>
                  ))}
                  {tref && (
                    <div style={{ marginTop: '0.5rem', fontSize: 12.5, color: '#555', background: '#fdf3f7', borderRadius: 8, padding: '0.4rem 0.55rem' }}>
                      📊 {b.tabla!.etiqueta ?? tref}: <strong>{filasDe(tref)} filas</strong>. Edítalas por CSV en <strong>📄 Planos → Marketing</strong> (descarga/sube la plantilla).
                    </div>
                  )}
                </div>
                {i < det.bloques.length - 1 && <div style={{ textAlign: 'center', color: '#c95b7c', fontSize: 18, lineHeight: 1 }}>↓</div>}
              </div>
            );
          })}
          <div style={{ textAlign: 'center', color: '#c95b7c', fontSize: 13, marginTop: 6 }}>↺ resultados → aprendizajes → nueva campaña</div>
        </div>
      )}
    </section>
  );
}
