'use client';

// DOCUMENTOS ESTILIZADOS con ÍNDICE y "docs anidados" por tabla. Un plano (o un PAQUETE de
// planos = un libro con capítulos) se rinde con estilo: portada, índice navegable, campos y
// cada TABLA como un sub-libro (índice de entradas + cada entrada como ficha completa).
// Solo presentación: lee DetallePlano (campos + tablas completas). Reusable por plano y paquete.

import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { DetallePlano } from '@/app/actions/especialista.actions';

const ENTREGA_ICON: Record<string, string> = { documento: '📄', tabla: '📊', diagrama: '🔀', dashboard: '📈' };

const wrap: CSSProperties = { maxWidth: 880, margin: '0 auto', background: '#fff', color: '#222', fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: 1.6, padding: '0 0.5rem' };
const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'system-ui, sans-serif' };
const sans = 'system-ui, sans-serif';

function slug(prefix: string, s: string): string { return `${prefix}-sec-${s.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`; }
function irA(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function pctListo(d: DetallePlano): number { return d.readiness.totalRequerido ? Math.round((d.readiness.cumplidoRequerido / d.readiness.totalRequerido) * 100) : 100; }

const printStyle = `@media print { .no-print { display: none !important; } body { background: #fff; } }`;

// ---------- Vista de UN plano ----------
export function DocumentoPlanoView({ det, onCerrar, onExportar, exportando }: {
  det: DetallePlano; onCerrar: () => void; onExportar: () => void; exportando: boolean;
}) {
  return (
    <section>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem', fontFamily: sans }}>
        <h2 style={{ margin: 0 }}>{ENTREGA_ICON[det.entrega.tipo] ?? '📄'} Documento · {det.nombre}</h2>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button style={btn} onClick={() => window.print()}>🖨️ Imprimir / PDF</button>
          <button style={btn} onClick={onExportar}>{exportando ? '…' : '⬇ Markdown'}</button>
          <button style={btn} onClick={onCerrar}>← Volver</button>
        </div>
      </div>
      <article style={wrap}><PlanoDocBody det={det} idPrefix={det.planoId} portada /></article>
      <style>{printStyle}</style>
    </section>
  );
}

// ---------- Cuerpo reusable de un plano (portada opcional / capítulo) ----------
export function PlanoDocBody({ det, idPrefix, portada, capitulo }: {
  det: DetallePlano; idPrefix: string; portada?: boolean; capitulo?: number;
}) {
  const bloquesCampos = det.bloques.filter((b) => (b.campos ?? []).length > 0);
  const listo = pctListo(det);
  const colorPct = listo === 100 ? '#2e7d4f' : '#b5651d';

  return (
    <>
      {portada ? (
        <header style={{ borderBottom: '3px double #333', paddingBottom: '0.8rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#888', fontFamily: sans }}>Plano · {det.entrega.tipo}</div>
          <h1 style={{ margin: '0.2rem 0', fontSize: 30 }}>{det.nombre}</h1>
          <div style={{ fontSize: 14, color: '#555', fontStyle: 'italic' }}>{det.entrega.descripcion}</div>
          <div style={{ fontSize: 12.5, color: '#777', marginTop: 6, fontFamily: sans }}>Completitud <strong style={{ color: colorPct }}>{listo}%</strong> · {det.readiness.cumplidoRequerido}/{det.readiness.totalRequerido} requeridos · profundidad {det.profundidad}</div>
        </header>
      ) : (
        <header style={{ marginBottom: '0.8rem' }}>
          <h1 style={{ margin: 0, fontSize: 25 }}>{capitulo !== undefined ? `${capitulo}. ` : ''}{ENTREGA_ICON[det.entrega.tipo] ?? '📄'} {det.nombre}</h1>
          <div style={{ fontSize: 13, color: '#777', fontFamily: sans }}>{det.entrega.descripcion} · completitud <strong style={{ color: colorPct }}>{listo}%</strong></div>
        </header>
      )}

      {/* Índice del plano */}
      {(bloquesCampos.length > 0 || det.tablas.length > 0) && (
        <nav style={{ background: '#faf9f6', border: '1px solid #e6e2d8', borderRadius: 8, padding: '0.6rem 1rem', marginBottom: '1.3rem' }}>
          <div style={{ fontSize: 12.5, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, color: '#777', marginBottom: 5, fontFamily: sans }}>Contenido</div>
          <ol style={{ margin: 0, paddingLeft: '1.3rem', fontSize: 14 }}>
            {bloquesCampos.map((b) => (
              <li key={b.id} style={{ margin: '2px 0' }}><a href="#" onClick={(e) => { e.preventDefault(); irA(slug(idPrefix, b.titulo)); }} style={{ color: '#2b5a97', textDecoration: 'none' }}>{b.titulo}</a></li>
            ))}
            {det.tablas.map((t) => (
              <li key={t.tablaRef} style={{ margin: '2px 0' }}>
                <a href="#" onClick={(e) => { e.preventDefault(); irA(slug(idPrefix, t.etiqueta)); }} style={{ color: '#2b5a97', textDecoration: 'none' }}>{t.etiqueta}</a>
                <span style={{ color: '#aaa', fontSize: 12.5 }}> — {t.filas.length} entrada(s)</span>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Campos */}
      {bloquesCampos.map((b) => (
        <section key={b.id} id={slug(idPrefix, b.titulo)} style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: 21, borderBottom: '1px solid #ddd', paddingBottom: 4 }}>{b.titulo}</h2>
          {(b.campos ?? []).map((c) => {
            const val = (det.campos[c.id] ?? '').trim();
            return (
              <div key={c.id} style={{ margin: '0.7rem 0' }}>
                <div style={{ fontSize: 12.5, color: '#8a7a4a', fontFamily: sans }}>{c.pregunta}</div>
                {val ? <div style={{ fontSize: 15, whiteSpace: 'pre-wrap' }}>{val}</div> : <div style={{ fontSize: 13.5, color: '#c0392b', fontStyle: 'italic' }}>⚠ PENDIENTE</div>}
              </div>
            );
          })}
        </section>
      ))}

      {/* Tablas como sub-libros */}
      {det.tablas.map((t) => (
        <TablaLibro key={t.tablaRef} idPrefix={idPrefix} etiqueta={t.etiqueta} columnas={t.columnas} filas={t.filas} llave={t.llave} derivadas={t.derivadas.length} />
      ))}
    </>
  );
}

// ---------- Un "libro" de una tabla ----------
function TablaLibro({ idPrefix, etiqueta, columnas, filas, llave, derivadas }: {
  idPrefix: string; etiqueta: string; columnas: { id: string; etiqueta: string }[]; filas: Record<string, string>[]; llave: string; derivadas: number;
}) {
  const [abierto, setAbierto] = useState(true);
  const keyCol = columnas.find((c) => c.id === llave) ?? columnas[0]!;
  const tituloDe = (f: Record<string, string>, i: number) => (f[keyCol.id] ?? '').trim() || `Entrada ${i + 1}`;
  const idSec = slug(idPrefix, etiqueta);

  return (
    <section id={idSec} style={{ marginBottom: '1.7rem', borderTop: '3px double #333', paddingTop: '0.8rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setAbierto((a) => !a)}>
        <h2 style={{ fontSize: 22, margin: 0, flex: 1 }}>📖 {etiqueta}</h2>
        <span style={{ fontSize: 12.5, color: '#888', fontFamily: sans }}>{filas.length} entrada(s){derivadas > 0 ? ` · ${derivadas} 🔗 auto` : ''}</span>
        <span style={{ color: '#999' }}>{abierto ? '▾' : '▸'}</span>
      </div>

      {abierto && filas.length === 0 && <p style={{ color: '#999', fontStyle: 'italic' }}>Sin entradas todavía.</p>}

      {abierto && filas.length > 0 && (
        <>
          <nav style={{ background: '#f7f9ff', border: '1px solid #dfe6f4', borderRadius: 8, padding: '0.5rem 0.8rem', margin: '0.6rem 0 1rem', columns: filas.length > 6 ? 2 : 1, columnGap: '1.5rem' }}>
            <ol style={{ margin: 0, paddingLeft: '1.4rem', fontSize: 13.5 }}>
              {filas.map((f, i) => (
                <li key={i} style={{ margin: '1px 0' }}><a href="#" onClick={(e) => { e.preventDefault(); irA(`${idSec}-${i}`); }} style={{ color: '#2b5a97', textDecoration: 'none' }}>{tituloDe(f, i)}</a></li>
              ))}
            </ol>
          </nav>
          {filas.map((f, i) => (
            <div key={i} id={`${idSec}-${i}`} style={{ borderLeft: '4px solid #8a4fbf', background: '#fbfaff', borderRadius: '0 8px 8px 0', padding: '0.6rem 0.9rem', margin: '0.5rem 0' }}>
              <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>{i + 1}. {tituloDe(f, i)}</div>
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px', fontSize: 14 }}>
                {columnas.filter((c) => c.id !== keyCol.id).map((c) => {
                  const v = (f[c.id] ?? '').trim();
                  return (
                    <div key={c.id} style={{ display: 'contents' }}>
                      <dt style={{ color: '#8a7a4a', fontFamily: sans, fontSize: 12.5 }}>{c.etiqueta}</dt>
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

// ---------- Vista de un PAQUETE (libro con capítulos = planos) ----------
export interface PaqueteDetallado { paqueteId: string; nombre: string; icono: string; descripcion: string; empresa: string; planos: DetallePlano[] }

export function DocumentoPaqueteView({ pkg, onCerrar, onExportar, exportando }: {
  pkg: PaqueteDetallado; onCerrar: () => void; onExportar: () => void; exportando: boolean;
}) {
  const pend = pkg.planos.reduce((s, d) => s + (d.readiness.totalRequerido - d.readiness.cumplidoRequerido), 0);
  const req = pkg.planos.reduce((s, d) => s + d.readiness.totalRequerido, 0);
  const listo = req ? Math.round((1 - pend / req) * 100) : 100;

  return (
    <section>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem', fontFamily: sans }}>
        <h2 style={{ margin: 0 }}>{pkg.icono} {pkg.nombre}</h2>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button style={btn} onClick={() => window.print()}>🖨️ Imprimir / PDF</button>
          <button style={btn} onClick={onExportar}>{exportando ? '…' : '⬇ Markdown'}</button>
          <button style={btn} onClick={onCerrar}>← Paquetes</button>
        </div>
      </div>

      <article style={wrap}>
        {/* Portada del libro */}
        <header style={{ textAlign: 'center', borderBottom: '3px double #333', paddingBottom: '1rem', marginBottom: '1.2rem' }}>
          <div style={{ fontSize: 40 }}>{pkg.icono}</div>
          <h1 style={{ margin: '0.2rem 0', fontSize: 32 }}>{pkg.nombre}</h1>
          <div style={{ fontSize: 15, color: '#555', fontStyle: 'italic' }}>{pkg.descripcion}</div>
          <div style={{ fontSize: 14, color: '#333', marginTop: 8, fontFamily: sans }}>{pkg.empresa}</div>
          <div style={{ fontSize: 12.5, color: '#777', marginTop: 4, fontFamily: sans }}>{pkg.planos.length} capítulos · completitud <strong style={{ color: listo === 100 ? '#2e7d4f' : '#b5651d' }}>{listo}%</strong> · {pend} pendientes de {req}</div>
        </header>

        {/* Índice de capítulos (planos) */}
        <nav style={{ background: '#faf9f6', border: '1px solid #e6e2d8', borderRadius: 8, padding: '0.7rem 1.1rem', marginBottom: '1.6rem' }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, color: '#777', marginBottom: 6, fontFamily: sans }}>Índice de capítulos</div>
          <ol style={{ margin: 0, paddingLeft: '1.4rem', fontSize: 15 }}>
            {pkg.planos.map((d) => (
              <li key={d.planoId} style={{ margin: '3px 0' }}>
                <a href="#" onClick={(e) => { e.preventDefault(); irA(`cap-${d.planoId}`); }} style={{ color: '#2b5a97', textDecoration: 'none' }}>{d.nombre}</a>
                <span style={{ color: '#aaa', fontSize: 12.5, fontFamily: sans }}> — {pctListo(d)}% · {d.tablas.length} tabla(s)</span>
              </li>
            ))}
          </ol>
        </nav>

        {/* Capítulos */}
        {pkg.planos.map((d, i) => (
          <section key={d.planoId} id={`cap-${d.planoId}`} style={{ borderTop: '4px double #333', paddingTop: '1rem', marginTop: '1.5rem' }}>
            <PlanoDocBody det={d} idPrefix={d.planoId} capitulo={i + 1} />
          </section>
        ))}
      </article>
      <style>{printStyle}</style>
    </section>
  );
}
