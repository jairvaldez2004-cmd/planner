'use client';

// DOCUMENTOS ESTILIZADOS con ÍNDICE y "docs anidados" por tabla. Un plano (o un PAQUETE de
// planos = un libro con capítulos) se rinde con estilo: portada, índice navegable, campos y
// cada TABLA como un sub-libro (índice de entradas + cada entrada como ficha completa).
// Solo presentación: lee DetallePlano (campos + tablas completas). Reusable por plano y paquete.

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { DetallePlano } from '@/app/actions/especialista.actions';
import type { CatalogoMkt } from '@/domain/mkt-catalogo';
import { CatalogoMktCascada } from './catalogo-mkt-view';
import { ArqPlanoSection } from './arq-plano-section';
import { exportarElementoPDF } from './pdf';
import { Logo, BRAND } from './brand';

// Contexto de exportación a PDF. `forced` fuerza a expandir TODO lo colapsable antes de
// capturar, para que el PDF salga en cascada sin dejar nada oculto dentro de las anidaciones.
// `exportPDF` hace: forzar-expandir → esperar re-render → capturar el nodo → restaurar.
interface PdfCtxVal { forced: boolean; exportPDF: (getEl: () => HTMLElement | null, titulo: string) => Promise<void> }
const PdfCtx = createContext<PdfCtxVal>({ forced: false, exportPDF: async () => {} });

// Valor del contexto de PDF, memoizado (no recrea Provider → no remonta el árbol).
function usePdfExport(): PdfCtxVal {
  const [forced, setForced] = useState(false);
  const exportPDF = useCallback(async (getEl: () => HTMLElement | null, titulo: string) => {
    setForced(true);
    // dos frames para asegurar que React re-renderizó todo lo forzado a abierto
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    try { await exportarElementoPDF(getEl(), titulo); } finally { setForced(false); }
  }, []);
  return useMemo(() => ({ forced, exportPDF }), [forced, exportPDF]);
}

const ENTREGA_ICON: Record<string, string> = { documento: '📄', tabla: '📊', diagrama: '🔀', dashboard: '📈' };

const wrap: CSSProperties = { maxWidth: 880, margin: '0 auto', background: 'var(--bp-panel)', color: 'var(--bp-text)', fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: 1.6, padding: '0 0.5rem' };
const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid var(--bp-border)', background: 'var(--bp-panel)', cursor: 'pointer', fontSize: 13, fontFamily: 'system-ui, sans-serif' };
const sans = 'system-ui, sans-serif';

function slug(prefix: string, s: string): string { return `${prefix}-sec-${s.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`; }
function irA(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function pctListo(d: DetallePlano): number { return d.readiness.totalRequerido ? Math.round((d.readiness.cumplidoRequerido / d.readiness.totalRequerido) * 100) : 100; }

const printStyle = `@media print { .no-print { display: none !important; } body { background: var(--bp-bg2); } }`;

// Botón "⬇ PDF" que captura un elemento por su id (una parte indexada) o el ref dado.
// Usa el contexto para forzar-expandir todo antes de capturar (cascada sin nada oculto).
function BotonPDFdoc({ getEl, titulo, label, small }: { getEl: () => HTMLElement | null; titulo: string; label: string; small?: boolean }) {
  const { exportPDF } = useContext(PdfCtx);
  const [busy, setBusy] = useState(false);
  const st: CSSProperties = small
    ? { padding: '0.15rem 0.55rem', borderRadius: 6, border: '1px solid var(--bp-gold)', background: 'var(--bp-gold-soft)', color: 'var(--bp-gold)', cursor: 'pointer', fontSize: 12, fontFamily: sans, whiteSpace: 'nowrap' }
    : { ...btn, borderColor: 'var(--bp-gold)', color: 'var(--bp-gold)' };
  return (
    <button className="no-print no-pdf" style={st}
      onClick={async () => { setBusy(true); try { await exportPDF(getEl, titulo); } finally { setBusy(false); } }}
    >{busy ? '…' : label}</button>
  );
}

// ---------- Vista de UN plano ----------
export function DocumentoPlanoView({ det, proyectoId, onCerrar, onExportar, exportando }: {
  det: DetallePlano; proyectoId: string; onCerrar: () => void; onExportar: () => void; exportando: boolean;
}) {
  const pdf = usePdfExport();
  const articleRef = useRef<HTMLElement>(null);
  return (
    <PdfCtx.Provider value={pdf}>
    <section>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem', fontFamily: sans }}>
        <h2 style={{ margin: 0 }}>{ENTREGA_ICON[det.entrega.tipo] ?? '📄'} Documento · {det.nombre}</h2>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <BotonPDFdoc getEl={() => articleRef.current} titulo={det.nombre} label="⬇ PDF completo" />
          <button style={btn} onClick={() => window.print()}>🖨️ Imprimir</button>
          <button style={btn} onClick={onExportar}>{exportando ? '…' : '⬇ Markdown'}</button>
          <button style={btn} onClick={onCerrar}>← Volver</button>
        </div>
      </div>
      <article ref={articleRef} style={wrap}>
        <PlanoDocBody det={det} idPrefix={det.planoId} portada />
        {det.planoId === 'ARQ' && <ArqPlanoSection proyectoId={proyectoId} idPrefix={det.planoId} />}
      </article>
      <style>{printStyle}</style>
    </section>
    </PdfCtx.Provider>
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
        <header style={{ borderBottom: `2px solid ${BRAND.gold}`, paddingBottom: '0.9rem', marginBottom: '1rem' }}>
          <div style={{ marginBottom: 10 }}><Logo size={38} /></div>
          <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--bp-gold)', fontFamily: sans }}>Plano · {det.entrega.tipo}</div>
          <h1 style={{ margin: '0.2rem 0', fontSize: 30 }}>{det.nombre}</h1>
          <div style={{ fontSize: 14, color: 'var(--bp-muted)', fontStyle: 'italic' }}>{det.entrega.descripcion}</div>
          <div style={{ fontSize: 12.5, color: 'var(--bp-muted)', marginTop: 6, fontFamily: sans }}>Completitud <strong style={{ color: colorPct }}>{listo}%</strong> · {det.readiness.cumplidoRequerido}/{det.readiness.totalRequerido} requeridos · profundidad {det.profundidad}</div>
        </header>
      ) : (
        <header style={{ marginBottom: '0.8rem' }}>
          <h1 style={{ margin: 0, fontSize: 25 }}>{capitulo !== undefined ? `${capitulo}. ` : ''}{ENTREGA_ICON[det.entrega.tipo] ?? '📄'} {det.nombre}</h1>
          <div style={{ fontSize: 13, color: 'var(--bp-muted)', fontFamily: sans }}>{det.entrega.descripcion} · completitud <strong style={{ color: colorPct }}>{listo}%</strong></div>
        </header>
      )}

      {/* Índice del plano */}
      {(bloquesCampos.length > 0 || det.tablas.length > 0) && (
        <nav style={{ background: 'var(--bp-panel-alt)', border: '1px solid var(--bp-border)', borderRadius: 8, padding: '0.6rem 1rem', marginBottom: '1.3rem' }}>
          <div style={{ fontSize: 12.5, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--bp-muted)', marginBottom: 5, fontFamily: sans }}>Contenido</div>
          <ol style={{ margin: 0, paddingLeft: '1.3rem', fontSize: 14 }}>
            {bloquesCampos.map((b) => (
              <li key={b.id} style={{ margin: '2px 0' }}><a href="#" onClick={(e) => { e.preventDefault(); irA(slug(idPrefix, b.titulo)); }} style={{ color: 'var(--bp-gold)', textDecoration: 'none' }}>{b.titulo}</a></li>
            ))}
            {det.tablas.map((t) => (
              <li key={t.tablaRef} style={{ margin: '2px 0' }}>
                <a href="#" onClick={(e) => { e.preventDefault(); irA(slug(idPrefix, t.etiqueta)); }} style={{ color: 'var(--bp-gold)', textDecoration: 'none' }}>{t.etiqueta}</a>
                <span style={{ color: 'var(--bp-faint)', fontSize: 12.5 }}> — {t.filas.length} entrada(s)</span>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Campos */}
      {bloquesCampos.map((b) => (
        <section key={b.id} id={slug(idPrefix, b.titulo)} style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: 21, borderBottom: '1px solid var(--bp-border)', paddingBottom: 4 }}>{b.titulo}</h2>
          {(b.campos ?? []).map((c) => {
            const val = (det.campos[c.id] ?? '').trim();
            return (
              <div key={c.id} style={{ margin: '0.7rem 0' }}>
                <div style={{ fontSize: 12.5, color: 'var(--bp-muted)', fontFamily: sans }}>{c.pregunta}</div>
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
  const { forced } = useContext(PdfCtx);
  const [abierto, setAbierto] = useState(true);
  const open = abierto || forced; // en PDF (forced) SIEMPRE abierto → nada oculto
  const keyCol = columnas.find((c) => c.id === llave) ?? columnas[0]!;
  const tituloDe = (f: Record<string, string>, i: number) => (f[keyCol.id] ?? '').trim() || `Entrada ${i + 1}`;
  const idSec = slug(idPrefix, etiqueta);

  return (
    <section id={idSec} style={{ marginBottom: '1.7rem', borderTop: '3px solid var(--bp-border)', paddingTop: '0.8rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ fontSize: 22, margin: 0, flex: 1, cursor: 'pointer' }} onClick={() => setAbierto((a) => !a)}>📖 {etiqueta}</h2>
        <span style={{ fontSize: 12.5, color: 'var(--bp-muted)', fontFamily: sans }}>{filas.length} entrada(s){derivadas > 0 ? ` · ${derivadas} 🔗 auto` : ''}</span>
        <BotonPDFdoc getEl={() => document.getElementById(idSec)} titulo={`${etiqueta}`} label="⬇ PDF" small />
        <span style={{ color: 'var(--bp-muted)', cursor: 'pointer' }} onClick={() => setAbierto((a) => !a)}>{abierto ? '▾' : '▸'}</span>
      </div>

      {open && filas.length === 0 && <p style={{ color: 'var(--bp-muted)', fontStyle: 'italic' }}>Sin entradas todavía.</p>}

      {open && filas.length > 0 && (
        <>
          <nav style={{ background: 'var(--bp-panel-alt)', border: '1px solid var(--bp-border)', borderRadius: 8, padding: '0.5rem 0.8rem', margin: '0.6rem 0 1rem', columns: filas.length > 6 ? 2 : 1, columnGap: '1.5rem' }}>
            <ol style={{ margin: 0, paddingLeft: '1.4rem', fontSize: 13.5 }}>
              {filas.map((f, i) => (
                <li key={i} style={{ margin: '1px 0' }}><a href="#" onClick={(e) => { e.preventDefault(); irA(`${idSec}-${i}`); }} style={{ color: 'var(--bp-gold)', textDecoration: 'none' }}>{tituloDe(f, i)}</a></li>
              ))}
            </ol>
          </nav>
          {filas.map((f, i) => (
            <div key={i} id={`${idSec}-${i}`} style={{ borderLeft: '4px solid #8a4fbf', background: 'var(--bp-panel-alt)', borderRadius: '0 8px 8px 0', padding: '0.6rem 0.9rem', margin: '0.5rem 0' }}>
              <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>{i + 1}. {tituloDe(f, i)}</div>
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px', fontSize: 14 }}>
                {columnas.filter((c) => c.id !== keyCol.id).map((c) => {
                  const v = (f[c.id] ?? '').trim();
                  return (
                    <div key={c.id} style={{ display: 'contents' }}>
                      <dt style={{ color: 'var(--bp-muted)', fontFamily: sans, fontSize: 12.5 }}>{c.etiqueta}</dt>
                      <dd style={{ margin: 0, color: v ? 'var(--bp-text)' : 'var(--bp-faint)' }}>{v || '—'}</dd>
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
export interface PaqueteDetallado { paqueteId: string; nombre: string; icono: string; descripcion: string; empresa: string; planos: DetallePlano[]; catalogoMkt?: CatalogoMkt | undefined }

export function DocumentoPaqueteView({ pkg, proyectoId, onCerrar, onExportar, exportando }: {
  pkg: PaqueteDetallado; proyectoId: string; onCerrar: () => void; onExportar: () => void; exportando: boolean;
}) {
  const pend = pkg.planos.reduce((s, d) => s + (d.readiness.totalRequerido - d.readiness.cumplidoRequerido), 0);
  const req = pkg.planos.reduce((s, d) => s + d.readiness.totalRequerido, 0);
  const listo = req ? Math.round((1 - pend / req) * 100) : 100;
  const pdf = usePdfExport();
  const articleRef = useRef<HTMLElement>(null);
  const hayCatalogo = !!pkg.catalogoMkt && pkg.catalogoMkt.length > 0;
  const hayArq = pkg.planos.some((d) => d.planoId === 'ARQ');

  return (
    <PdfCtx.Provider value={pdf}>
    <section>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem', fontFamily: sans }}>
        <h2 style={{ margin: 0 }}>{pkg.icono} {pkg.nombre}</h2>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <BotonPDFdoc getEl={() => articleRef.current} titulo={`${pkg.nombre}-${pkg.empresa}`} label={'⬇ PDF completo'} />
          <button style={btn} onClick={() => window.print()}>🖨️ Imprimir</button>
          <button style={btn} onClick={onExportar}>{exportando ? '…' : '⬇ Markdown'}</button>
          <button style={btn} onClick={onCerrar}>← Paquetes</button>
        </div>
      </div>

      <article ref={articleRef} style={wrap}>
        {/* Portada del libro — marca Business Planner */}
        <header style={{ textAlign: 'center', borderBottom: `2px solid ${BRAND.gold}`, background: BRAND.bg2, borderRadius: 12, padding: '1.6rem 1rem 1.3rem', marginBottom: '1.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Logo size={44} /></div>
          <div style={{ fontSize: 40 }}>{pkg.icono}</div>
          <h1 style={{ margin: '0.2rem 0', fontSize: 32 }}>{pkg.nombre}</h1>
          <div style={{ fontSize: 15, color: 'var(--bp-muted)', fontStyle: 'italic' }}>{pkg.descripcion}</div>
          <div style={{ fontSize: 15, color: BRAND.gold, marginTop: 10, fontFamily: sans, fontWeight: 700, letterSpacing: 0.3 }}>{pkg.empresa}</div>
          <div style={{ fontSize: 12.5, color: 'var(--bp-muted)', marginTop: 4, fontFamily: sans }}>{pkg.planos.length} capítulos · completitud <strong style={{ color: listo === 100 ? BRAND.ok : BRAND.gold }}>{listo}%</strong> · {pend} pendientes de {req}</div>
        </header>

        {/* Índice de capítulos (planos) */}
        <nav style={{ background: 'var(--bp-panel-alt)', border: '1px solid var(--bp-border)', borderRadius: 8, padding: '0.7rem 1.1rem', marginBottom: '1.6rem' }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--bp-muted)', marginBottom: 6, fontFamily: sans }}>Índice de capítulos</div>
          <ol style={{ margin: 0, paddingLeft: '1.4rem', fontSize: 15 }}>
            {pkg.planos.map((d) => (
              <li key={d.planoId} style={{ margin: '3px 0' }}>
                <a href="#" onClick={(e) => { e.preventDefault(); irA(`cap-${d.planoId}`); }} style={{ color: 'var(--bp-gold)', textDecoration: 'none' }}>{d.nombre}</a>
                <span style={{ color: 'var(--bp-faint)', fontSize: 12.5, fontFamily: sans }}> — {pctListo(d)}% · {d.tablas.length} tabla(s)</span>
              </li>
            ))}
            {hayArq && (
              <li style={{ margin: '3px 0' }}>
                <a href="#" onClick={(e) => { e.preventDefault(); irA('arq-planos'); }} style={{ color: 'var(--bp-gold)', textDecoration: 'none', fontWeight: 600 }}>📐 Planos de la sede — 2D y 3D</a>
                <span style={{ color: 'var(--bp-faint)', fontSize: 12.5, fontFamily: sans }}> — visor 3D + descarga .glb</span>
              </li>
            )}
            {hayCatalogo && (
              <li style={{ margin: '3px 0' }}>
                <a href="#" onClick={(e) => { e.preventDefault(); irA('mkt-catalogo'); }} style={{ color: 'var(--bp-gold)', textDecoration: 'none', fontWeight: 600 }}>🗂️ Catálogo de Marketing (contenido por producto)</a>
                <span style={{ color: 'var(--bp-faint)', fontSize: 12.5, fontFamily: sans }}> — {pkg.catalogoMkt!.length} producto(s) en cascada</span>
              </li>
            )}
          </ol>
        </nav>

        {/* Capítulos */}
        {pkg.planos.map((d, i) => (
          <section key={d.planoId} id={`cap-${d.planoId}`} style={{ borderTop: '4px solid var(--bp-border)', paddingTop: '1rem', marginTop: '1.5rem' }}>
            <div className="no-print no-pdf" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: -8 }}>
              <BotonPDFdoc getEl={() => document.getElementById(`cap-${d.planoId}`)} titulo={`${d.nombre}-${pkg.empresa}`} label="⬇ PDF capítulo" />
            </div>
            <PlanoDocBody det={d} idPrefix={d.planoId} capitulo={i + 1} />
          </section>
        ))}

        {/* Planos de la sede (2D + 3D) para el paquete de Arquitectura */}
        {hayArq && <ArqPlanoSection proyectoId={proyectoId} idPrefix="arq" />}

        {/* Catálogo de Marketing en cascada (producto→campaña→formato→guion/minuta) */}
        {hayCatalogo && <CatalogoMktCascada cat={pkg.catalogoMkt!} idPrefix="mkt" empresa={pkg.empresa} />}
      </article>
      <style>{printStyle}</style>
    </section>
    </PdfCtx.Provider>
  );
}
