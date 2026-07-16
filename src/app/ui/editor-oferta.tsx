'use client';

// Editor de una OFERTA dentro de una UC. Ref: PLANNER_CATALOG_TO_OFFERING_V1.md.
// Captura: datos de la oferta · RUTA BASE (pasos por fase) · PRESENTACIONES (SKU vendible)
// con composición (BOM) + ruta efectiva (hereda la base, omite pasos, añade pasos extra) + costeo.

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  actualizarOferta, guardarPasoBase, eliminarPasoBase,
  listarPresentaciones, crearPresentacion, actualizarPresentacion, eliminarPresentacion,
} from '@/app/actions/oferta.actions';
import type { Oferta, Presentacion, Paso, Insumo, TipoEntregable, FasePaso, Disparador, TipoDisparador } from '@/domain/oferta';
import { TIPOS_ENTREGABLE, FASES, etiquetaFase, rutaEfectiva, costearPresentacion } from '@/domain/oferta';

const inp: CSSProperties = { padding: '0.35rem 0.55rem', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 };
const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };
const btnSm: CSSProperties = { padding: '0.15rem 0.5rem', borderRadius: 5, border: '1px solid #bbb', background: '#fff', cursor: 'pointer', fontSize: 12 };
const card: CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: '0.7rem 0.9rem', margin: '0.5rem 0', background: '#fafafa' };
const lbl: CSSProperties = { display: 'block', fontSize: 11, color: '#666', marginBottom: 2 };

function nid(p: string): string { return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }

interface Props { proyectoId: string; oferta: Oferta; procesos?: { id: string; nombre: string }[]; onVolver: () => void }

export function EditorOferta({ proyectoId, oferta, procesos = [], onVolver }: Props) {
  const [rutaBase, setRutaBase] = useState<Paso[]>(oferta.rutaBase);
  const [disparadores, setDisparadores] = useState<Disparador[]>(oferta.disparadores ?? []);
  const [dragId, setDragId] = useState<string | null>(null);
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [nomPres, setNomPres] = useState('');

  useEffect(() => { listarPresentaciones(proyectoId, oferta.id).then(setPresentaciones).catch(() => {}); }, [proyectoId, oferta.id]);

  // --- Ruta base ---
  function addPaso(fase: FasePaso) {
    const p: Paso = { id: nid('PASO'), nombre: '', fase, insumos: [] };
    setRutaBase((r) => [...r, p]); void guardarPasoBase(oferta.id, p);
  }
  function changePaso(p: Paso) { setRutaBase((r) => r.map((x) => x.id === p.id ? p : x)); }
  function persistPaso(p: Paso) { void guardarPasoBase(oferta.id, p); }
  function delPaso(id: string) { setRutaBase((r) => r.filter((x) => x.id !== id)); void eliminarPasoBase(oferta.id, id); }

  // --- Reordenar pasos (drag & drop). targetId=null → soltar al final de la fase. ---
  function persistRuta(arr: Paso[]) { void actualizarOferta(oferta.id, { rutaBase: arr }); }
  function reordenar(targetId: string | null, fase: FasePaso) {
    const id = dragId;
    setDragId(null);
    if (!id || id === targetId) return;
    setRutaBase((prev) => {
      const arr = [...prev];
      const from = arr.findIndex((x) => x.id === id);
      const src = arr[from];
      if (from < 0 || !src) return prev;
      const moved: Paso = { ...src, fase };   // adopta la fase destino (permite mover entre fases)
      arr.splice(from, 1);
      if (targetId) {
        const to = arr.findIndex((x) => x.id === targetId);
        if (to < 0) arr.push(moved); else arr.splice(to, 0, moved);
      } else {
        arr.push(moved);
      }
      persistRuta(arr);
      return arr;
    });
  }

  // --- Disparadores (triggers del proceso) ---
  function persistDisp(ds: Disparador[]) { void actualizarOferta(oferta.id, { disparadores: ds }); }
  function commitDisp() { setDisparadores((prev) => { persistDisp(prev); return prev; }); }
  function addDisp(tipo: TipoDisparador) {
    setDisparadores((prev) => { const next = [...prev, { id: nid('DISP'), tipo, evento: '' } as Disparador]; persistDisp(next); return next; });
  }
  function updDisp(id: string, patch: Partial<Disparador>, persist = false) {
    setDisparadores((prev) => { const next = prev.map((x) => x.id === id ? { ...x, ...patch } : x); if (persist) persistDisp(next); return next; });
  }
  function delDisp(id: string) { setDisparadores((prev) => { const next = prev.filter((x) => x.id !== id); persistDisp(next); return next; }); }

  // --- Presentaciones ---
  async function addPres() {
    if (!nomPres.trim()) return;
    const p = await crearPresentacion(proyectoId, oferta.id, nomPres.trim());
    setNomPres(''); setPresentaciones((a) => [...a, p]); setSel(p.id);
  }
  function changePres(p: Presentacion) { setPresentaciones((a) => a.map((x) => x.id === p.id ? p : x)); }
  function persistPres(p: Presentacion) {
    void actualizarPresentacion(p.id, { nombre: p.nombre, composicion: p.composicion, omitidos: p.omitidos, pasosExtra: p.pasosExtra, overrides: p.overrides, ...(p.precio !== undefined ? { precio: p.precio } : {}), ...(p.unidad !== undefined ? { unidad: p.unidad } : {}), ...(p.minimo !== undefined ? { minimo: p.minimo } : {}) });
  }
  function delPres(id: string) { setPresentaciones((a) => a.filter((x) => x.id !== id)); if (sel === id) setSel(null); void eliminarPresentacion(id); }

  const selPres = presentaciones.find((p) => p.id === sel) ?? null;

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>🏷️ {oferta.nombre} <span style={{ fontSize: 12, color: '#888' }}>· Oferta</span></h3>
        <button style={btn} onClick={onVolver}>← Catálogo</button>
      </div>

      {/* Datos de la oferta */}
      <div style={card}>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: 160 }}><span style={lbl}>Nombre</span><input style={{ ...inp, width: '100%' }} defaultValue={oferta.nombre} onBlur={(e) => void actualizarOferta(oferta.id, { nombre: e.target.value })} /></div>
          <div style={{ flex: 1, minWidth: 160 }}><span style={lbl}>Tipo de entregable</span>
            <select style={{ ...inp, width: '100%' }} defaultValue={oferta.tipoEntregable} onChange={(e) => void actualizarOferta(oferta.id, { tipoEntregable: e.target.value as TipoEntregable })}>
              {TIPOS_ENTREGABLE.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 120 }}><span style={lbl}>Categoría</span><input style={{ ...inp, width: '100%' }} defaultValue={oferta.categoria ?? ''} onBlur={(e) => void actualizarOferta(oferta.id, { categoria: e.target.value })} /></div>
        </div>
        <div style={{ marginTop: '0.5rem' }}><span style={lbl}>Descripción · qué recibe el cliente</span><textarea style={{ ...inp, width: '100%', resize: 'vertical' }} rows={2} defaultValue={oferta.descripcion ?? ''} onBlur={(e) => void actualizarOferta(oferta.id, { descripcion: e.target.value })} /></div>
      </div>

      {/* Ruta base */}
      <div style={{ ...card, background: '#fff6f2', borderColor: '#e8c3b4' }}>
        <strong style={{ fontSize: 14 }}>🛠️ Ruta base · cómo se entrega</strong>
        <p style={{ fontSize: 12, color: '#777', margin: '0.2rem 0 0.5rem' }}>Los pasos de esta oferta (antes / durante / después). Arrastra <span style={{ color: '#a85b3d' }}>⠿</span> para reordenarlos o moverlos entre fases. Cada presentación los hereda; luego omite o añade lo que difiera.</p>
        {FASES.map((f) => {
          const pasos = rutaBase.filter((p) => p.fase === f.id);
          return (
            <div key={f.id} style={{ marginBottom: '0.4rem' }}
              onDragOver={dragId ? (e) => e.preventDefault() : undefined}
              onDrop={dragId ? (e) => { e.preventDefault(); reordenar(null, f.id); } : undefined}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 'bold', color: '#a85b3d' }}>{f.label}</span>
                <button style={btnSm} onClick={() => addPaso(f.id)}>＋ paso</button>
              </div>
              {pasos.length === 0 && <p style={{ fontSize: 12, color: '#bbb', margin: '0.2rem 0', padding: '0.3rem 0', border: dragId ? '1px dashed #e0b9a6' : 'none', borderRadius: 6, textAlign: 'center' }}>{dragId ? 'Suéltalo aquí' : '—'}</p>}
              {pasos.map((p) => (
                <PasoCard key={p.id} paso={p} onChange={changePaso} onBlur={persistPaso} onDelete={() => delPaso(p.id)}
                  dnd={{ onDragStart: () => setDragId(p.id), onDrop: () => reordenar(p.id, p.fase), isDragging: dragId === p.id }} />
              ))}
            </div>
          );
        })}
      </div>

      {/* Disparadores del proceso */}
      <div style={{ ...card, background: '#f1f6ff', borderColor: '#b4cbe8' }}>
        <strong style={{ fontSize: 14 }}>🔀 Disparadores del proceso</strong>
        <p style={{ fontSize: 12, color: '#777', margin: '0.2rem 0 0.5rem' }}>Qué <strong>inicia</strong> y qué <strong>termina</strong> este proceso, y a qué otro proceso redirige cada disparador. Puedes dar de alta varios.</p>
        {(['inicio', 'fin'] as TipoDisparador[]).map((tipo) => {
          const ds = disparadores.filter((d) => d.tipo === tipo);
          return (
            <div key={tipo} style={{ marginBottom: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 'bold', color: '#2b5a97' }}>{tipo === 'inicio' ? '▶ Disparadores de inicio' : '⏹ Disparadores de fin'}</span>
                <button style={btnSm} onClick={() => addDisp(tipo)}>＋ disparador</button>
              </div>
              {ds.length === 0 && <p style={{ fontSize: 12, color: '#bbb', margin: '0.2rem 0' }}>—</p>}
              {ds.map((d) => (
                <div key={d.id} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', margin: '0.3rem 0', flexWrap: 'wrap' }}>
                  <input style={{ ...inp, flex: 2, minWidth: 200 }} placeholder={tipo === 'inicio' ? 'Evento que inicia (ej. Cliente agenda cita)' : 'Evento que termina (ej. Pago recibido)'} value={d.evento} onChange={(e) => updDisp(d.id, { evento: e.target.value })} onBlur={commitDisp} />
                  <span style={{ fontSize: 12, color: '#777' }}>→ redirige a</span>
                  <select style={{ ...inp, minWidth: 150 }} value={d.destinoOfertaId ?? ''} onChange={(e) => updDisp(d.id, { destinoOfertaId: e.target.value || undefined }, true)}>
                    <option value="">(ninguno)</option>
                    {procesos.filter((p) => p.id !== oferta.id).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <button style={{ ...btnSm, color: '#a00' }} onClick={() => delDisp(d.id)}>✕</button>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Presentaciones */}
      <div style={card}>
        <strong style={{ fontSize: 14 }}>📦 Presentaciones · lo que el cliente compra (SKU)</strong>
        <div style={{ display: 'flex', gap: '0.4rem', margin: '0.5rem 0', flexWrap: 'wrap' }}>
          <input style={{ ...inp, flex: 1, minWidth: 160 }} placeholder="ej. Granel x kg · Caja 4 kg premium · Sesión 60 min" value={nomPres} onChange={(e) => setNomPres(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addPres(); }} />
          <button style={btn} onClick={() => void addPres()} disabled={!nomPres.trim()}>＋ Presentación</button>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
          {presentaciones.map((p) => (
            <button key={p.id} style={{ ...btnSm, ...(sel === p.id ? { background: '#33415c', color: '#fff', borderColor: '#33415c' } : {}) }} onClick={() => setSel(p.id)}>{p.nombre}</button>
          ))}
          {presentaciones.length === 0 && <span style={{ fontSize: 12, color: '#999' }}>Sin presentaciones aún.</span>}
        </div>

        {selPres && <PresentacionEditor key={selPres.id} rutaBase={rutaBase} pres={selPres} onChange={changePres} onBlur={persistPres} onDelete={() => delPres(selPres.id)} />}
      </div>
    </section>
  );
}

// ---------------- Paso ----------------
interface DnDPaso { onDragStart: () => void; onDrop: () => void; isDragging: boolean }
function PasoCard({ paso, onChange, onBlur, onDelete, dnd }: { paso: Paso; onChange: (p: Paso) => void; onBlur: (p: Paso) => void; onDelete: () => void; dnd?: DnDPaso }) {
  const set = (patch: Partial<Paso>) => onChange({ ...paso, ...patch });
  const [abierto, setAbierto] = useState(false);
  return (
    <div
      style={{ border: '1px solid #e3d2c8', borderRadius: 6, padding: '0.4rem 0.5rem', margin: '0.3rem 0', background: '#fff', opacity: dnd?.isDragging ? 0.4 : 1 }}
      onDragOver={dnd ? (e) => e.preventDefault() : undefined}
      onDrop={dnd ? (e) => { e.preventDefault(); e.stopPropagation(); dnd.onDrop(); } : undefined}>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        {dnd && (
          <span
            draggable
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; dnd.onDragStart(); }}
            style={{ cursor: 'grab', color: '#c9a493', fontSize: 16, userSelect: 'none', padding: '0 2px' }}
            title="Arrastra para reordenar o mover de fase">⠿</span>
        )}
        <input style={{ ...inp, flex: 1 }} placeholder="Nombre del paso (ej. Seleccionar, Empacar…)" value={paso.nombre} onChange={(e) => set({ nombre: e.target.value })} onBlur={() => onBlur(paso)} />
        <button style={btnSm} onClick={() => setAbierto((v) => !v)}>{abierto ? '▲ detalle' : '▼ detalle'}</button>
        <button style={{ ...btnSm, color: '#a00' }} onClick={onDelete}>✕</button>
      </div>
      {abierto && (
        <div style={{ marginTop: '0.4rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
          <div><span style={lbl}>Lugar / espacio</span><input style={{ ...inp, width: '100%' }} value={paso.lugar ?? ''} onChange={(e) => set({ lugar: e.target.value })} onBlur={() => onBlur(paso)} /></div>
          <div><span style={lbl}>Rol / quién</span><input style={{ ...inp, width: '100%' }} value={paso.rol ?? ''} onChange={(e) => set({ rol: e.target.value })} onBlur={() => onBlur(paso)} /></div>
          <div><span style={lbl}>Herramientas</span><input style={{ ...inp, width: '100%' }} value={paso.herramientas ?? ''} onChange={(e) => set({ herramientas: e.target.value })} onBlur={() => onBlur(paso)} /></div>
          <div><span style={lbl}>Tiempo (min)</span><input style={{ ...inp, width: '100%' }} type="number" value={paso.tiempoMin ?? ''} onChange={(e) => set({ tiempoMin: e.target.value === '' ? undefined : Number(e.target.value) })} onBlur={() => onBlur(paso)} /></div>
          <div><span style={lbl}>Entrada</span><input style={{ ...inp, width: '100%' }} value={paso.entrada ?? ''} onChange={(e) => set({ entrada: e.target.value })} onBlur={() => onBlur(paso)} /></div>
          <div><span style={lbl}>Salida</span><input style={{ ...inp, width: '100%' }} value={paso.salida ?? ''} onChange={(e) => set({ salida: e.target.value })} onBlur={() => onBlur(paso)} /></div>
          <div style={{ gridColumn: '1 / -1' }}><span style={lbl}>Insumos consumidos en este paso</span><FilasInsumo value={paso.insumos} onChange={(v) => set({ insumos: v })} onBlur={() => onBlur(paso)} labelItem="Insumo" /></div>
          <div style={{ gridColumn: '1 / -1' }}><span style={lbl}>Manual / instrucción</span><textarea style={{ ...inp, width: '100%', resize: 'vertical' }} rows={2} value={paso.manual ?? ''} onChange={(e) => set({ manual: e.target.value })} onBlur={() => onBlur(paso)} /></div>
        </div>
      )}
    </div>
  );
}

// ---------------- Presentación ----------------
function PresentacionEditor({ rutaBase, pres, onChange, onBlur, onDelete }: { rutaBase: Paso[]; pres: Presentacion; onChange: (p: Presentacion) => void; onBlur: (p: Presentacion) => void; onDelete: () => void }) {
  const set = (patch: Partial<Presentacion>) => onChange({ ...pres, ...patch });
  const toggleOmitido = (pasoId: string) => {
    const omit = pres.omitidos.includes(pasoId) ? pres.omitidos.filter((x) => x !== pasoId) : [...pres.omitidos, pasoId];
    const next = { ...pres, omitidos: omit }; onChange(next); onBlur(next);
  };
  const addExtra = (fase: FasePaso) => {
    const p: Paso = { id: nid('PASO'), nombre: '', fase, insumos: [] };
    const next = { ...pres, pasosExtra: [...pres.pasosExtra, p] }; onChange(next); onBlur(next);
  };
  const changeExtra = (p: Paso) => set({ pasosExtra: pres.pasosExtra.map((x) => x.id === p.id ? p : x) });
  const delExtra = (id: string) => { const next = { ...pres, pasosExtra: pres.pasosExtra.filter((x) => x.id !== id) }; onChange(next); onBlur(next); };

  const efectiva = rutaEfectiva(rutaBase, pres);
  const c = costearPresentacion(rutaBase, pres);

  return (
    <div style={{ border: '1px solid #33415c', borderRadius: 8, padding: '0.7rem 0.9rem', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
        <input style={{ ...inp, fontWeight: 'bold', flex: 1, minWidth: 160 }} value={pres.nombre} onChange={(e) => set({ nombre: e.target.value })} onBlur={() => onBlur(pres)} />
        <button style={{ ...btnSm, color: '#a00' }} onClick={onDelete}>Eliminar presentación</button>
      </div>

      {/* precio / unidad / mínimo */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
        <div><span style={lbl}>Precio ($)</span><input style={{ ...inp, width: 100 }} type="number" value={pres.precio ?? ''} onChange={(e) => set({ precio: e.target.value === '' ? undefined : Number(e.target.value) })} onBlur={() => onBlur(pres)} /></div>
        <div><span style={lbl}>Unidad</span><input style={{ ...inp, width: 120 }} placeholder="kg · caja · sesión" value={pres.unidad ?? ''} onChange={(e) => set({ unidad: e.target.value })} onBlur={() => onBlur(pres)} /></div>
        <div><span style={lbl}>Mínimo de compra</span><input style={{ ...inp, width: 140 }} value={pres.minimo ?? ''} onChange={(e) => set({ minimo: e.target.value })} onBlur={() => onBlur(pres)} /></div>
      </div>

      {/* composición (BOM) */}
      <div style={{ marginTop: '0.6rem' }}>
        <span style={{ ...lbl, fontWeight: 'bold', fontSize: 12 }}>🧩 Composición (BOM) · insumos, complementarios y empaque</span>
        <FilasInsumo value={pres.composicion} onChange={(v) => set({ composicion: v })} onBlur={() => onBlur(pres)} labelItem="Componente" />
      </div>

      {/* ruta efectiva */}
      <div style={{ marginTop: '0.7rem' }}>
        <span style={{ ...lbl, fontWeight: 'bold', fontSize: 12 }}>🧭 Ruta de esta presentación (hereda la base)</span>
        {rutaBase.length === 0 && <p style={{ fontSize: 12, color: '#bbb', margin: '0.2rem 0' }}>Define primero la ruta base arriba.</p>}
        {rutaBase.map((p) => {
          const omitido = pres.omitidos.includes(p.id);
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: 13, padding: '0.15rem 0', opacity: omitido ? 0.45 : 1 }}>
              <input type="checkbox" checked={!omitido} onChange={() => toggleOmitido(p.id)} title="Incluir este paso base" />
              <span style={{ textDecoration: omitido ? 'line-through' : 'none' }}>{etiquetaFase(p.fase).split('·')[0]?.trim()} · <strong>{p.nombre || '(sin nombre)'}</strong></span>
              <span style={{ fontSize: 11, color: '#28a745', marginLeft: 'auto' }}>heredado</span>
            </div>
          );
        })}
        {/* pasos extra */}
        {pres.pasosExtra.length > 0 && <div style={{ fontSize: 11, color: '#33415c', margin: '0.4rem 0 0.2rem', fontWeight: 'bold' }}>Pasos exclusivos de esta presentación:</div>}
        {pres.pasosExtra.map((p) => <PasoCard key={p.id} paso={p} onChange={changeExtra} onBlur={(pp) => { changeExtra(pp); onBlur({ ...pres, pasosExtra: pres.pasosExtra.map((x) => x.id === pp.id ? pp : x) }); }} onDelete={() => delExtra(p.id)} />)}
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
          <span style={{ fontSize: 11, color: '#777', alignSelf: 'center' }}>＋ paso extra en:</span>
          {FASES.map((f) => <button key={f.id} style={btnSm} onClick={() => addExtra(f.id)}>{f.label.split('·')[1]?.trim() ?? f.id}</button>)}
        </div>
      </div>

      {/* costeo */}
      <div style={{ marginTop: '0.7rem', borderTop: '1px dashed #ccc', paddingTop: '0.5rem', display: 'flex', gap: '1.2rem', flexWrap: 'wrap', fontSize: 13 }}>
        <span>Costo BOM: <strong>${c.costoBOM.toFixed(2)}</strong></span>
        <span>Costo insumos ruta: <strong>${c.costoInsumosRuta.toFixed(2)}</strong></span>
        <span>Costo total: <strong>${c.costoTotal.toFixed(2)}</strong></span>
        {c.margen !== undefined && <span style={{ color: c.margen >= 0 ? '#2e9e63' : '#c0392b' }}>Margen: <strong>${c.margen.toFixed(2)}</strong></span>}
        <span style={{ color: '#777' }}>Tiempo ruta: <strong>{c.tiempoTotalMin} min</strong> · {efectiva.length} pasos</span>
      </div>
    </div>
  );
}

// ---------------- Filas de insumos (reutilizable) ----------------
function FilasInsumo({ value, onChange, onBlur, labelItem }: { value: Insumo[]; onChange: (v: Insumo[]) => void; onBlur: () => void; labelItem: string }) {
  const set = (i: number, patch: Partial<Insumo>) => onChange(value.map((x, j) => j === i ? { ...x, ...patch } : x));
  return (
    <div>
      {value.map((ins, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.3rem', marginTop: '0.25rem' }}>
          <input style={{ ...inp, flex: 2 }} placeholder={labelItem} value={ins.item} onChange={(e) => set(i, { item: e.target.value })} onBlur={onBlur} />
          <input style={{ ...inp, width: 80 }} placeholder="cant." value={ins.cantidad ?? ''} onChange={(e) => set(i, { cantidad: e.target.value })} onBlur={onBlur} />
          <input style={{ ...inp, width: 80 }} type="number" placeholder="$" value={ins.costo ?? ''} onChange={(e) => set(i, { costo: e.target.value === '' ? undefined : Number(e.target.value) })} onBlur={onBlur} />
          <button style={btnSm} onClick={() => { onChange(value.filter((_, j) => j !== i)); onBlur(); }}>✕</button>
        </div>
      ))}
      <button style={{ ...btnSm, marginTop: '0.3rem' }} onClick={() => { onChange([...value, { item: '' }]); }}>＋ {labelItem}</button>
    </div>
  );
}
