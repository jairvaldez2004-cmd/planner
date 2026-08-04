'use client';

// CATÁLOGO DE MARKETING EN CASCADA. Rinde el árbol producto→campaña→formato→guion(tomas)/minuta
// TODO expandido (nada oculto), con índice por nivel, anclas de navegación y un botón "⬇ PDF"
// por cada parte indexada (catálogo completo, producto, campaña o formato). El PDF se genera con
// html2pdf.js (ver ./pdf) capturando el subárbol del nodo; los botones (.no-pdf) no salen en el PDF.

import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { CatalogoMkt, ProductoMkt, CampanaMkt, FormatoMkt } from '@/domain/mkt-catalogo';
import { contarCatalogo } from '@/domain/mkt-catalogo';
import { exportarElementoPDF } from './pdf';

const sans = 'system-ui, sans-serif';
const irA = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
const sl = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();

const chip = (bg: string, fg: string): CSSProperties => ({ display: 'inline-block', background: bg, color: fg, borderRadius: 999, padding: '2px 10px', fontSize: 12, fontFamily: sans, fontWeight: 600, marginRight: 6 });
const linkStyle: CSSProperties = { color: '#2b5a97', textDecoration: 'none' };

// Botón "⬇ PDF" reusable. Marca .no-pdf para no aparecer dentro del propio PDF.
function BotonPDF({ getEl, titulo, label = '⬇ PDF' }: { getEl: () => HTMLElement | null; titulo: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="no-print no-pdf"
      onClick={async () => { setBusy(true); try { await exportarElementoPDF(getEl(), titulo); } finally { setBusy(false); } }}
      style={{ padding: '0.2rem 0.6rem', borderRadius: 6, border: '1px solid #b39', background: '#fff', color: '#8a1c6b', cursor: 'pointer', fontSize: 12, fontFamily: sans, whiteSpace: 'nowrap' }}
    >{busy ? '…' : label}</button>
  );
}

function Tabla({ columnas, filas }: { columnas: { id: string; et: string }[]; filas: Record<string, string | number | undefined>[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13.5, fontFamily: sans, margin: '0.4rem 0' }}>
        <thead>
          <tr>{columnas.map((c) => <th key={c.id} style={{ textAlign: 'left', background: '#f3eefa', border: '1px solid #e3d9f0', padding: '5px 8px', color: '#5a3d78', fontSize: 12 }}>{c.et}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>{columnas.map((c) => <td key={c.id} style={{ border: '1px solid #eee', padding: '5px 8px', verticalAlign: 'top' }}>{f[c.id] != null && f[c.id] !== '' ? String(f[c.id]) : '—'}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Formato (nivel más profundo: specs + guion + minuta) ----------
function FormatoNode({ fmt, idPrefix }: { fmt: FormatoMkt; idPrefix: string }) {
  const id = `${idPrefix}-fmt-${sl(fmt.id)}`;
  const ref = useRef<HTMLDivElement>(null);
  const Campo = ({ k, v }: { k: string; v?: string | undefined }) => v ? (
    <div style={{ margin: '3px 0' }}><span style={{ color: '#8a7a4a', fontFamily: sans, fontSize: 12 }}>{k}: </span><span style={{ fontSize: 14 }}>{v}</span></div>
  ) : null;
  return (
    <div ref={ref} id={id} className="pdf-keep" style={{ borderLeft: '4px solid #d29', background: '#fffafd', borderRadius: '0 8px 8px 0', padding: '0.55rem 0.85rem', margin: '0.6rem 0 0.6rem 0.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={chip('#fce4f3', '#a01e77')}>🎬 Formato</span>
        <strong style={{ fontSize: 15.5, flex: 1 }}>{fmt.formato}</strong>
        <BotonPDF getEl={() => ref.current} titulo={`formato-${fmt.formato}`} />
      </div>
      <div style={{ marginTop: 6 }}>
        <Campo k="Objetivo" v={fmt.objetivo} />
        <Campo k="Especificaciones" v={fmt.especificaciones} />
        <Campo k="Características" v={fmt.caracteristicas} />
        <Campo k="CTA" v={fmt.cta} />
        <Campo k="Hashtags" v={fmt.hashtags} />
      </div>

      {/* Guion profesional (tomas) */}
      {fmt.guion.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#7a2e63', fontFamily: sans, marginBottom: 2 }}>🎥 Guion — {fmt.guion.length} toma(s)</div>
          <Tabla
            columnas={[{ id: 'n', et: '#' }, { id: 'plano', et: 'Plano / Toma' }, { id: 'descripcion', et: 'Acción' }, { id: 'vozTexto', et: 'Voz / Texto' }, { id: 'duracion', et: 'Dur.' }, { id: 'audio', et: 'Audio' }]}
            filas={fmt.guion.map((t) => ({ n: t.n, plano: t.plano, descripcion: t.descripcion, vozTexto: t.vozTexto, duracion: t.duracion, audio: t.audio }))}
          />
        </div>
      )}

      {/* Minuta de producción (si aplica) */}
      {fmt.minuta && fmt.minuta.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#7a2e63', fontFamily: sans, marginBottom: 2 }}>📝 Minuta de producción — {fmt.minuta.length} punto(s)</div>
          <Tabla
            columnas={[{ id: 'momento', et: 'Momento' }, { id: 'tema', et: 'Tema' }, { id: 'responsable', et: 'Responsable' }, { id: 'acuerdo', et: 'Acuerdo / Entregable' }]}
            filas={fmt.minuta.map((m) => ({ momento: m.momento, tema: m.tema, responsable: m.responsable, acuerdo: m.acuerdo }))}
          />
        </div>
      )}
    </div>
  );
}

// ---------- Campaña ----------
function CampanaNode({ camp, idPrefix }: { camp: CampanaMkt; idPrefix: string }) {
  const id = `${idPrefix}-camp-${sl(camp.id)}`;
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} id={id} style={{ border: '1px solid #eadff2', borderRadius: 10, padding: '0.7rem 0.9rem', margin: '0.7rem 0', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={chip('#ede0fb', '#5a2ea6')}>📣 Campaña</span>
        <strong style={{ fontSize: 17, flex: 1 }}>{camp.nombre}</strong>
        <BotonPDF getEl={() => ref.current} titulo={`campana-${camp.nombre}`} />
      </div>
      <div style={{ margin: '6px 0' }}>
        {camp.tipo && <span style={chip('#e0f0ff', '#1c5aa0')}>{camp.tipo}</span>}
        {camp.cta && <span style={chip('#fef3d6', '#8a5a00')}>CTA: {camp.cta}</span>}
      </div>
      <dl style={{ margin: '4px 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px', fontSize: 13.5, fontFamily: sans }}>
        {([['Objetivo', camp.objetivo], ['Mensaje / ángulo', camp.mensaje], ['Temporada', camp.temporada], ['Canal', camp.canal], ['Presupuesto', camp.presupuesto], ['KPI', camp.kpi]] as [string, string | undefined][])
          .filter(([, v]) => v).map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt style={{ color: '#8a7a4a', fontSize: 12 }}>{k}</dt><dd style={{ margin: 0 }}>{v}</dd>
            </div>
          ))}
      </dl>
      {/* Índice de formatos */}
      {camp.formatos.length > 0 && (
        <div style={{ fontSize: 12.5, color: '#777', fontFamily: sans, margin: '4px 0' }}>
          Formatos ({camp.formatos.length}):{' '}
          {camp.formatos.map((f, i) => (
            <span key={f.id}>{i > 0 ? ' · ' : ''}<a href="#" onClick={(e) => { e.preventDefault(); irA(`${idPrefix}-fmt-${sl(f.id)}`); }} style={linkStyle}>{f.formato}</a></span>
          ))}
        </div>
      )}
      {camp.formatos.map((f) => <FormatoNode key={f.id} fmt={f} idPrefix={idPrefix} />)}
    </div>
  );
}

// ---------- Producto ----------
function ProductoNode({ prod, idPrefix, n }: { prod: ProductoMkt; idPrefix: string; n: number }) {
  const id = `${idPrefix}-prod-${sl(prod.id)}`;
  const ref = useRef<HTMLDivElement>(null);
  return (
    <section ref={ref} id={id} style={{ borderTop: '3px double #333', paddingTop: '0.9rem', marginTop: '1.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 22, margin: 0, flex: 1 }}>{n}. 🛍️ {prod.producto}</h3>
        <BotonPDF getEl={() => ref.current} titulo={`producto-${prod.producto}`} label="⬇ PDF producto" />
      </div>
      <div style={{ margin: '4px 0' }}>
        {prod.categoria && <span style={chip('#e7f6ec', '#1f7a45')}>{prod.categoria}</span>}
        {prod.precio && <span style={chip('#f0f0f0', '#444')}>{prod.precio}</span>}
      </div>
      {prod.descripcion && <p style={{ fontSize: 14.5, color: '#333', margin: '4px 0 8px' }}>{prod.descripcion}</p>}
      <div style={{ fontSize: 12.5, color: '#777', fontFamily: sans, marginBottom: 4 }}>
        Campañas ({prod.campanas.length}):{' '}
        {prod.campanas.map((c, i) => (
          <span key={c.id}>{i > 0 ? ' · ' : ''}<a href="#" onClick={(e) => { e.preventDefault(); irA(`${idPrefix}-camp-${sl(c.id)}`); }} style={linkStyle}>{c.nombre}</a></span>
        ))}
      </div>
      {prod.campanas.map((c) => <CampanaNode key={c.id} camp={c} idPrefix={idPrefix} />)}
    </section>
  );
}

// ---------- Catálogo completo ----------
export function CatalogoMktCascada({ cat, idPrefix = 'mkt', empresa }: { cat: CatalogoMkt; idPrefix?: string; empresa?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  if (!cat.length) return null;
  const c = contarCatalogo(cat);
  return (
    <section id={`${idPrefix}-catalogo`} ref={ref} style={{ borderTop: '4px double #333', paddingTop: '1rem', marginTop: '1.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <h2 style={{ fontSize: 25, margin: 0, flex: 1 }}>🗂️ Catálogo de Marketing (contenido por producto)</h2>
        <BotonPDF getEl={() => ref.current} titulo={`catalogo-marketing-${empresa ?? ''}`} label="⬇ PDF catálogo completo" />
      </div>
      <div style={{ fontSize: 13, color: '#777', fontFamily: sans, marginBottom: 10 }}>
        {c.productos} productos · {c.campanas} campañas · {c.formatos} formatos · {c.tomas} tomas de guion · {c.minutas} minuta(s). Todo en cascada, sin nada oculto.
      </div>

      {/* Índice del catálogo (productos → campañas) */}
      <nav style={{ background: '#faf7fd', border: '1px solid #ecdff5', borderRadius: 8, padding: '0.7rem 1.1rem', marginBottom: '1.2rem' }}>
        <div style={{ fontSize: 12.5, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, color: '#7a5b96', marginBottom: 6, fontFamily: sans }}>Índice del catálogo</div>
        <ol style={{ margin: 0, paddingLeft: '1.3rem', fontSize: 14.5 }}>
          {cat.map((p) => (
            <li key={p.id} style={{ margin: '3px 0' }}>
              <a href="#" onClick={(e) => { e.preventDefault(); irA(`${idPrefix}-prod-${sl(p.id)}`); }} style={{ ...linkStyle, fontWeight: 600 }}>{p.producto}</a>
              <span style={{ color: '#aaa', fontSize: 12.5, fontFamily: sans }}> — {p.campanas.length} campaña(s)</span>
              {p.campanas.length > 0 && (
                <ul style={{ margin: '2px 0', paddingLeft: '1.1rem', listStyle: 'circle', color: '#888' }}>
                  {p.campanas.map((c2) => (
                    <li key={c2.id} style={{ margin: '1px 0' }}>
                      <a href="#" onClick={(e) => { e.preventDefault(); irA(`${idPrefix}-camp-${sl(c2.id)}`); }} style={linkStyle}>{c2.nombre}</a>
                      <span style={{ color: '#bbb', fontSize: 12 }}> · {c2.tipo}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {cat.map((p, i) => <ProductoNode key={p.id} prod={p} idPrefix={idPrefix} n={i + 1} />)}
    </section>
  );
}
