'use client';

// Vista de un Plano (nodo del grafo de planos). 2 columnas:
//  · Izq: chat del Especialista (Q&A en orden lógico).
//  · Der: campos capturados (editables) + tablas maestras (CSV descarga/subida) + readiness.

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ChatEspecialista } from './chat-especialista';
import { useEsMovil } from './use-movil';
import {
  obtenerDetallePlano, plantillaCSV, importarCSV, guardarCampo,
} from '@/app/actions/especialista.actions';
import type { DetallePlano } from '@/app/actions/especialista.actions';
import type { Readiness } from '@/app/readiness/readiness-engine';
import { COLOR_ESTADO, LABEL_ESTADO } from '@/app/readiness/readiness-engine';

const card: CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: '0.6rem 0.9rem', margin: '0.4rem 0', background: '#fafafa' };
const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };
const ENTREGA_ICON: Record<string, string> = { documento: '📄', tabla: '📊', diagrama: '🔀', dashboard: '📈' };

interface Props { proyectoId: string; planoId: string; onVolver: () => void }

export function VistaPlano({ proyectoId, planoId, onVolver }: Props) {
  const [det, setDet] = useState<DetallePlano | null>(null);
  const [loading, setLoading] = useState(true);
  const movil = useEsMovil();
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [msgCsv, setMsgCsv] = useState<string>('');
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const cargar = () => {
    setLoading(true);
    obtenerDetallePlano(proyectoId, planoId).then((d) => { setDet(d); setReadiness(d?.readiness ?? null); }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [proyectoId, planoId]);

  async function descargar(tablaRef: string) {
    const csv = await plantillaCSV(proyectoId, planoId, tablaRef);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${planoId}_${tablaRef}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function subir(tablaRef: string, file: File) {
    const texto = await file.text();
    const r = await importarCSV(proyectoId, planoId, tablaRef, texto);
    if (!r.ok) setMsgCsv(`❌ ${tablaRef}: ${r.errores.join(' ')}`);
    else setMsgCsv(`✅ ${tablaRef}: +${r.agregadas} filas (total ${r.total})${r.pendientes.length ? ` · ${r.pendientes.length} pendientes` : ''}`);
    cargar();
  }

  async function editarCampo(campoId: string, valor: string) {
    await guardarCampo(proyectoId, planoId, campoId, valor);
    cargar();
  }

  const r = readiness ?? det?.readiness ?? null;
  const estado = r?.estado ?? 'LOCKED';

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>
          {ENTREGA_ICON[det?.entrega.tipo ?? 'documento']} {det?.nombre ?? planoId}
          {det && <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>entrega: {det.entrega.tipo}</span>}
        </h2>
        <button style={btn} onClick={onVolver}>← Grafo de planos</button>
      </div>

      {loading && <p style={{ color: '#666' }}>Cargando plano…</p>}
      {!loading && !det && <p style={{ color: '#a00' }}>Este plano no tiene especialista configurado.</p>}

      {det && (
        <>
          {/* barra de estado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.5rem 0', flexWrap: 'wrap' }}>
            <span style={{ background: COLOR_ESTADO[estado], color: '#fff', borderRadius: 6, padding: '0.2rem 0.6rem', fontSize: 13, fontWeight: 'bold' }}>
              {LABEL_ESTADO[estado]}
            </span>
            <span style={{ fontSize: 13, color: '#555' }}>Profundidad: <strong>{det.profundidad}</strong></span>
            {r && <span style={{ fontSize: 13, color: '#555' }}>{r.cumplidoRequerido}/{r.totalRequerido} requeridos</span>}
            <div style={{ flex: 1, minWidth: 120, height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((r?.progreso ?? 0) * 100)}%`, height: '100%', background: COLOR_ESTADO[estado] }} />
            </div>
          </div>
          {!det.seleccionado && <p style={{ color: '#a60', fontSize: 13 }}>⚠ Este plano NO fue seleccionado por el blueprint del proyecto. Puedes explorarlo, pero no es necesario.</p>}

          <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : 'minmax(320px, 5fr) 7fr', gap: '1rem', alignItems: 'start', marginTop: '0.5rem' }}>
            {/* Izq: chat especialista */}
            <div style={{ border: '1px solid #cdd8ef', borderRadius: 10, padding: '0.75rem', background: '#f7f9ff' }}>
              <strong style={{ fontSize: 14 }}>Especialista · {det.nombre}</strong>
              <p style={{ margin: '0.25rem 0 0.5rem', fontSize: 12, color: '#555' }}>{det.lenguajeTecnico}</p>
              <ChatEspecialista proyectoId={proyectoId} planoId={planoId} nombrePlano={det.nombre} onReadiness={setReadiness} altura={380} />
            </div>

            {/* Der: campos + tablas + readiness */}
            <div>
              <h3 style={{ margin: '0 0 0.25rem' }}>Campos</h3>
              {det.bloques.filter((b) => b.campos && b.campos.length).map((b) => (
                <div key={b.id} style={card}>
                  <strong style={{ fontSize: 13 }}>{b.titulo}</strong>
                  {(b.campos ?? []).map((c) => (
                    <div key={c.id} style={{ margin: '0.4rem 0' }}>
                      <label style={{ fontSize: 12, color: '#555', display: 'block' }}>
                        {c.pregunta} <span style={{ color: '#999' }}>· req. en {c.requeridoEn}</span>
                      </label>
                      <textarea
                        defaultValue={det.campos[c.id] ?? ''}
                        onBlur={(e) => { if (e.target.value !== (det.campos[c.id] ?? '')) void editarCampo(c.id, e.target.value); }}
                        rows={2}
                        style={{ width: '100%', fontSize: 13, padding: '0.35rem', borderRadius: 6, border: '1px solid #ccc', resize: 'vertical' }}
                        placeholder="(vacío → PENDIENTE)"
                      />
                    </div>
                  ))}
                </div>
              ))}

              {det.tablas.length > 0 && <h3 style={{ margin: '0.75rem 0 0.25rem' }}>Tablas (datos repetitivos · CSV)</h3>}
              {msgCsv && <p style={{ fontSize: 13, color: '#06c' }}>{msgCsv}</p>}
              {det.tablas.map((t) => (
                <div key={t.tablaRef} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <strong style={{ fontSize: 13 }}>{t.etiqueta} <span style={{ color: '#888', fontWeight: 'normal' }}>({t.filas.length} filas)</span></strong>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button style={btn} onClick={() => void descargar(t.tablaRef)}>⬇ Plantilla CSV</button>
                      <button style={btn} onClick={() => fileRefs.current[t.tablaRef]?.click()}>⬆ Subir CSV</button>
                      <input ref={(el) => { fileRefs.current[t.tablaRef] = el; }} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void subir(t.tablaRef, f); e.target.value = ''; }} />
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: '#777', margin: '0.25rem 0' }}>
                    Columnas: {t.columnas.map((c) => c.etiqueta).join(', ')}. {t.filas.length >= t.disparadorCSV ? '' : `Sugerido CSV si esperas ≥${t.disparadorCSV} filas.`}
                  </p>
                  {t.filas.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
                        <thead><tr>{t.columnas.map((c) => <th key={c.id} style={{ border: '1px solid #ddd', padding: '2px 6px', background: '#f0f0f0', textAlign: 'left' }}>{c.etiqueta}</th>)}</tr></thead>
                        <tbody>
                          {t.filas.slice(0, 8).map((f, i) => (
                            <tr key={i}>{t.columnas.map((c) => <td key={c.id} style={{ border: '1px solid #eee', padding: '2px 6px' }}>{f[c.id] ?? ''}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                      {t.filas.length > 8 && <p style={{ fontSize: 11, color: '#999' }}>…{t.filas.length - 8} filas más</p>}
                    </div>
                  )}
                </div>
              ))}

              {r && r.faltanNivel.length > 0 && (
                <div style={{ ...card, background: '#fff7e6', borderColor: '#ffd591' }}>
                  <strong style={{ fontSize: 13 }}>Falta para publicar (nivel {det.profundidad})</strong>
                  <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem', fontSize: 12, color: '#7a5a00' }}>
                    {r.faltanNivel.map((it, i) => <li key={i}>{it.etiqueta} <span style={{ color: '#aa8' }}>({it.tipo}, {it.nivel})</span></li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
