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

// Animación del drag & drop de pasos (barra de inserción, arrastre suave, resaltado de fase).
const DND_CSS = `
@keyframes bpBarIn { from { opacity: 0; transform: scaleX(.5); } to { opacity: 1; transform: scaleX(1); } }
.bp-drop-bar { height: 3px; margin: 1px 6px; border-radius: 3px; background: linear-gradient(90deg, #d98c5f, #a85b3d); box-shadow: 0 0 8px rgba(217,140,95,.7); transform-origin: left center; animation: bpBarIn .12s ease-out; }
.bp-paso { transition: opacity .15s ease, transform .15s ease, box-shadow .15s ease; }
.bp-handle { cursor: grab; transition: color .12s ease, transform .12s ease; }
.bp-handle:hover { color: #a85b3d !important; transform: scale(1.15); }
.bp-handle:active { cursor: grabbing; }
.bp-fase-over { background: #fff1ea; box-shadow: inset 0 0 0 1px #e8c3b4; }
`;

function nid(p: string): string { return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }

interface Props { proyectoId: string; oferta: Oferta; procesos?: { id: string; nombre: string }[]; onVolver: () => void }

export function EditorOferta({ proyectoId, oferta, procesos = [], onVolver }: Props) {
  const [rutaBase, setRutaBase] = useState<Paso[]>(oferta.rutaBase);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverFase, setDragOverFase] = useState<FasePaso | null>(null);
  const limpiarDrag = () => { setDragId(null); setDragOverId(null); setDragOverFase(null); };
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
    limpiarDrag();
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
        <style dangerouslySetInnerHTML={{ __html: DND_CSS }} />
        <strong style={{ fontSize: 14 }}>🛠️ Ruta base · cómo se entrega</strong>
        <p style={{ fontSize: 12, color: '#777', margin: '0.2rem 0 0.5rem' }}>Arrastra <span style={{ color: '#a85b3d' }}>⠿</span> para reordenar los pasos o moverlos entre fases. Dentro de cada paso (▼ detalle) defines herramientas, roles y sus <strong>disparadores</strong> (qué lo inicia / qué lo termina y a qué proceso redirige). Cada presentación hereda la ruta.</p>
        {FASES.map((f) => {
          const pasos = rutaBase.filter((p) => p.fase === f.id);
          const faseOver = !!dragId && dragOverFase === f.id;
          return (
            <div key={f.id}
              className={faseOver ? 'bp-fase-over' : undefined}
              style={{ marginBottom: '0.3rem', padding: '0.3rem', borderRadius: 8, transition: 'background .15s ease, box-shadow .15s ease' }}
              onDragOver={dragId ? (e) => { e.preventDefault(); setDragOverFase(f.id); } : undefined}
              onDrop={dragId ? (e) => { e.preventDefault(); reordenar(null, f.id); } : undefined}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 'bold', color: '#a85b3d' }}>{f.label}</span>
                <button style={btnSm} onClick={() => addPaso(f.id)}>＋ paso</button>
              </div>
              {pasos.length === 0 && <p style={{ fontSize: 12, color: faseOver ? '#a85b3d' : '#bbb', margin: '0.2rem 0', padding: '0.45rem 0', border: dragId ? '2px dashed #e0b9a6' : '1px dashed transparent', borderRadius: 8, textAlign: 'center', background: faseOver ? '#fff' : 'transparent', transition: 'all .15s ease' }}>{dragId ? '⤵ Suéltalo aquí' : '—'}</p>}
              {pasos.map((p) => (
                <PasoCard key={p.id} paso={p} onChange={changePaso} onBlur={persistPaso} onDelete={() => delPaso(p.id)}
                  procesos={procesos} selfId={oferta.id}
                  dnd={{
                    onDragStart: () => setDragId(p.id),
                    onDragEnd: limpiarDrag,
                    onDragOver: () => setDragOverId(p.id),
                    onDrop: () => reordenar(p.id, p.fase),
                    isDragging: dragId === p.id,
                    showBar: !!dragId && dragOverId === p.id && dragId !== p.id,
                  }} />
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
interface DnDPaso {
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  isDragging: boolean;
  showBar: boolean;   // barra de inserción encima de esta tarjeta
}
function PasoCard({ paso, onChange, onBlur, onDelete, dnd, procesos = [], selfId }: {
  paso: Paso; onChange: (p: Paso) => void; onBlur: (p: Paso) => void; onDelete: () => void;
  dnd?: DnDPaso; procesos?: { id: string; nombre: string }[]; selfId?: string;
}) {
  const set = (patch: Partial<Paso>) => onChange({ ...paso, ...patch });
  const commit = (next: Paso) => { onChange(next); onBlur(next); };
  const [abierto, setAbierto] = useState(false);

  // Disparadores de ESTE paso (viven dentro del paso; se guardan con el paso).
  const ds = paso.disparadores ?? [];
  const addDisp = (tipo: TipoDisparador) => commit({ ...paso, disparadores: [...ds, { id: nid('DISP'), tipo, evento: '' }] });
  const updDisp = (id: string, patch: Partial<Disparador>, persist = false) => {
    const next: Paso = { ...paso, disparadores: ds.map((x) => x.id === id ? { ...x, ...patch } : x) };
    if (persist) commit(next); else onChange(next);
  };
  const delDisp = (id: string) => commit({ ...paso, disparadores: ds.filter((x) => x.id !== id) });

  return (
    <div>
      {dnd?.showBar && <div className="bp-drop-bar" />}
      <div
        className="bp-paso"
        style={{
          border: '1px solid #e3d2c8', borderRadius: 6, padding: '0.4rem 0.5rem', margin: '0.3rem 0', background: '#fff',
          opacity: dnd?.isDragging ? 0.4 : 1,
          transform: dnd?.isDragging ? 'scale(0.98)' : 'none',
          boxShadow: dnd?.isDragging ? '0 10px 22px rgba(168,91,61,.22)' : 'none',
        }}
        onDragOver={dnd ? (e) => { e.preventDefault(); dnd.onDragOver(); } : undefined}
        onDrop={dnd ? (e) => { e.preventDefault(); e.stopPropagation(); dnd.onDrop(); } : undefined}>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {dnd && (
            <span
              className="bp-handle" draggable
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; dnd.onDragStart(); }}
              onDragEnd={() => dnd.onDragEnd()}
              style={{ color: '#c9a493', fontSize: 16, userSelect: 'none', padding: '0 2px' }}
              title="Arrastra para reordenar o mover de fase">⠿</span>
          )}
          <input style={{ ...inp, flex: 1 }} placeholder="Nombre del paso (ej. Seleccionar, Empacar…)" value={paso.nombre} onChange={(e) => set({ nombre: e.target.value })} onBlur={() => onBlur(paso)} />
          {ds.length > 0 && <span title={`${ds.length} disparador(es)`} style={{ fontSize: 12, color: '#2b5a97' }}>🔀{ds.length}</span>}
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

            {/* Disparadores de este paso */}
            <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed #e3d2c8', paddingTop: '0.45rem', marginTop: '0.15rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ ...lbl, marginBottom: 0, color: '#2b5a97', fontWeight: 'bold' }}>🔀 Disparadores de este paso</span>
                <span style={{ display: 'flex', gap: '0.3rem' }}>
                  <button style={btnSm} onClick={() => addDisp('inicio')}>＋ inicio</button>
                  <button style={btnSm} onClick={() => addDisp('fin')}>＋ fin</button>
                </span>
              </div>
              {ds.length === 0 && <p style={{ fontSize: 11, color: '#bbb', margin: '0.25rem 0 0' }}>Sin disparadores. <strong>Inicio</strong> = qué arranca este paso · <strong>Fin</strong> = qué lo cierra y a qué proceso redirige.</p>}
              {ds.map((d) => (
                <div key={d.id} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', margin: '0.3rem 0', flexWrap: 'wrap' }}>
                  <select style={{ ...inp, width: 82 }} value={d.tipo} onChange={(e) => updDisp(d.id, { tipo: e.target.value as TipoDisparador }, true)}>
                    <option value="inicio">▶ inicio</option>
                    <option value="fin">⏹ fin</option>
                  </select>
                  <input style={{ ...inp, flex: 2, minWidth: 150 }} placeholder={d.tipo === 'inicio' ? 'Evento que inicia (ej. Cliente llega)' : 'Evento que termina (ej. Pago recibido)'} value={d.evento} onChange={(e) => updDisp(d.id, { evento: e.target.value })} onBlur={() => onBlur(paso)} />
                  <span style={{ fontSize: 12, color: '#777' }}>→</span>
                  <select style={{ ...inp, minWidth: 130 }} value={d.destinoOfertaId ?? ''} onChange={(e) => updDisp(d.id, { destinoOfertaId: e.target.value || undefined }, true)} title="Proceso al que redirige">
                    <option value="">(sin redirección)</option>
                    {procesos.filter((p) => p.id !== selfId).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <button style={{ ...btnSm, color: '#a00' }} onClick={() => delDisp(d.id)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
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
