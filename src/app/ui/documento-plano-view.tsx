'use client';

// DOCUMENTO ESTILIZADO de un plano, con ÍNDICE y "docs anidados" por tabla: cada tabla del
// plano (catálogo, campañas, procesos, puestos…) se rinde como un LIBRO con su propio índice
// de entradas y cada entrada como ficha completa. Info indexada y completa según el plano.
// Solo presentación: lee el DetallePlano que ya trae campos + tablas (con todas sus filas).

import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { DetallePlano } from '@/app/actions/especialista.actions';

const ENTREGA_ICON: Record<string, string> = { documento: '📄', tabla: '📊', diagrama: '🔀', dashboard: '📈' };

const wrap: CSSProperties = { maxWidth: 860, margin: '0 auto', background: '#fff', color: '#222', fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: 1.6 };
const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'system-ui, sans-serif' };

function slug(s: string): string { return 'sec-' + s.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase(); }
function irA(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

export function DocumentoPlanoView({ det, onCerrar, onExportar, exportando }: {
  det: DetallePlano; onCerrar: () => void; onExportar: () => void; exportando: boolean;
}) {
  const bloquesCampos = det.bloques.filter((b) => (b.campos ?? []).length > 0);
  const listo = det.readiness.totalRequerido ? Math.round((det.readiness.cumplidoRequerido / det.readiness.totalRequerido) * 100) : 100;

  return (
    <section>
      {/* Barra de herramientas (no imprime) */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem', fontFamily: 'system-ui, sans-serif' }}>
        <h2 style={{ margin: 0 }}>{ENTREGA_ICON[det.entrega.tipo] ?? '📄'} Documento · {det.nombre}</h2>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button style={btn} onClick={() => window.print()}>🖨️ Imprimir / PDF</button>
          <button style={btn} onClick={onExportar}>{exportando ? '…' : '⬇ Markdown'}</button>
          <button style={btn} onClick={onCerrar}>← Volver</button>
        </div>
      </div>

      <article style={wrap}>
        {/* Portada */}
        <header style={{ borderBottom: '3px double #333', paddingBottom: '0.8rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#888', fontFamily: 'system-ui, sans-serif' }}>Plano · {det.entrega.tipo}</div>
          <h1 style={{ margin: '0.2rem 0', fontSize: 30 }}>{det.nombre}</h1>
          <div style={{ fontSize: 14, color: '#555', fontStyle: 'italic' }}>{det.entrega.descripcion}</div>
          <div style={{ fontSize: 12.5, color: '#777', marginTop: 6, fontFamily: 'system-ui, sans-serif' }}>
            Completitud <strong style={{ color: listo === 100 ? '#2e7d4f' : '#b5651d' }}>{listo}%</strong> · {det.readiness.cumplidoRequerido}/{det.readiness.totalRequerido} requeridos · profundidad {det.profundidad}
          </div>
        </header>

        {/* ÍNDICE general */}
        <nav style={{ background: '#faf9f6', border: '1px solid #e6e2d8', borderRadius: 8, padding: '0.7rem 1rem', marginBottom: '1.4rem' }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, color: '#777', marginBottom: 6, fontFamily: 'system-ui, sans-serif' }}>Índice</div>
          <ol style={{ margin: 0, paddingLeft: '1.3rem', fontSize: 14 }}>
            {bloquesCampos.map((b) => (
              <li key={b.id} style={{ margin: '2px 0' }}>
                <a href="#" onClick={(e) => { e.preventDefault(); irA(slug(b.titulo)); }} style={{ color: '#2b5a97', textDecoration: 'none' }}>{b.titulo}</a>
              </li>
            ))}
            {det.tablas.map((t) => (
              <li key={t.tablaRef} style={{ margin: '2px 0' }}>
                <a href="#" onClick={(e) => { e.preventDefault(); irA(slug(t.etiqueta)); }} style={{ color: '#2b5a97', textDecoration: 'none' }}>{t.etiqueta}</a>
                <span style={{ color: '#aaa', fontSize: 12.5 }}> — {t.filas.length} entrada(s)</span>
              </li>
            ))}
          </ol>
        </nav>

        {/* Secciones de CAMPOS */}
        {bloquesCampos.map((b) => (
          <section key={b.id} id={slug(b.titulo)} style={{ marginBottom: '1.6rem' }}>
            <h2 style={{ fontSize: 21, borderBottom: '1px solid #ddd', paddingBottom: 4 }}>{b.titulo}</h2>
            {(b.campos ?? []).map((c) => {
              const val = (det.campos[c.id] ?? '').trim();
              return (
                <div key={c.id} style={{ margin: '0.7rem 0' }}>
                  <div style={{ fontSize: 12.5, color: '#8a7a4a', fontFamily: 'system-ui, sans-serif' }}>{c.pregunta}</div>
                  {val
                    ? <div style={{ fontSize: 15, whiteSpace: 'pre-wrap' }}>{val}</div>
                    : <div style={{ fontSize: 13.5, color: '#c0392b', fontStyle: 'italic' }}>⚠ PENDIENTE</div>}
                </div>
              );
            })}
          </section>
        ))}

        {/* Cada TABLA como DOC ANIDADO (libro con índice de entradas) */}
        {det.tablas.map((t) => (
          <TablaLibro key={t.tablaRef} etiqueta={t.etiqueta} columnas={t.columnas} filas={t.filas} llave={t.llave} derivadas={t.derivadas.length} />
        ))}
      </article>

      <style>{`@media print { .no-print { display: none !important; } body { background: #fff; } }`}</style>
    </section>
  );
}

// Un "libro" de una tabla: índice de entradas + cada entrada como ficha con todos sus campos.
function TablaLibro({ etiqueta, columnas, filas, llave, derivadas }: {
  etiqueta: string; columnas: { id: string; etiqueta: string }[]; filas: Record<string, string>[]; llave: string; derivadas: number;
}) {
  const [abierto, setAbierto] = useState(true);
  const keyCol = columnas.find((c) => c.id === llave) ?? columnas[0]!;
  const tituloDe = (f: Record<string, string>, i: number) => (f[keyCol.id] ?? '').trim() || `Entrada ${i + 1}`;
  const idSec = slug(etiqueta);

  return (
    <section id={idSec} style={{ marginBottom: '1.8rem', borderTop: '3px double #333', paddingTop: '0.8rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setAbierto((a) => !a)}>
        <h2 style={{ fontSize: 22, margin: 0, flex: 1 }}>📖 {etiqueta}</h2>
        <span style={{ fontSize: 12.5, color: '#888', fontFamily: 'system-ui, sans-serif' }}>{filas.length} entrada(s){derivadas > 0 ? ` · ${derivadas} 🔗 auto` : ''}</span>
        <span style={{ color: '#999' }}>{abierto ? '▾' : '▸'}</span>
      </div>

      {abierto && filas.length === 0 && <p style={{ color: '#999', fontStyle: 'italic' }}>Sin entradas todavía.</p>}

      {abierto && filas.length > 0 && (
        <>
          {/* Índice de entradas del libro */}
          <nav style={{ background: '#f7f9ff', border: '1px solid #dfe6f4', borderRadius: 8, padding: '0.5rem 0.8rem', margin: '0.6rem 0 1rem', columns: filas.length > 6 ? 2 : 1, columnGap: '1.5rem' }}>
            <ol style={{ margin: 0, paddingLeft: '1.4rem', fontSize: 13.5 }}>
              {filas.map((f, i) => (
                <li key={i} style={{ margin: '1px 0' }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); irA(`${idSec}-${i}`); }} style={{ color: '#2b5a97', textDecoration: 'none' }}>{tituloDe(f, i)}</a>
                </li>
              ))}
            </ol>
          </nav>

          {/* Cada entrada como ficha completa */}
          {filas.map((f, i) => (
            <div key={i} id={`${idSec}-${i}`} style={{ borderLeft: '4px solid #8a4fbf', background: '#fbfaff', borderRadius: '0 8px 8px 0', padding: '0.6rem 0.9rem', margin: '0.5rem 0' }}>
              <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>{i + 1}. {tituloDe(f, i)}</div>
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px', fontSize: 14 }}>
                {columnas.filter((c) => c.id !== keyCol.id).map((c) => {
                  const v = (f[c.id] ?? '').trim();
                  return (
                    <div key={c.id} style={{ display: 'contents' }}>
                      <dt style={{ color: '#8a7a4a', fontFamily: 'system-ui, sans-serif', fontSize: 12.5 }}>{c.etiqueta}</dt>
                      <dd style={{ margin: 0, color: v ? '#222' : '#bbb' }}>{v || '—'}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
