'use client';

// MAPA OPERATIVO — canvas de procesos estilo n8n (ADITIVO). Ref: domain/mapa.ts.
//   · Carriles (filas) = departamentos: Administración + cada Unidad Comercial, una sola lista.
//   · Bandas (columnas) = Antes · Durante · Después (orden cronológico).
//   · Nodo = proceso (arrastrable entre celdas) · Flecha = rama por disparador (puede bifurcarse).
//   · Lentes: misma data, distinta vista (general/instructivo/roles/espacios/herramientas/tiempos).
//   · "Crear y volver": roles/herramientas se crean al vuelo en el maestro; espacios → Sedes.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, DragEvent } from 'react';
import {
  listarDepartamentos, crearDepartamento, actualizarDepartamento, eliminarDepartamento,
  listarProcesos, crearProceso, actualizarProceso, moverProceso, eliminarProceso,
  importarRutasCatalogo, listarRecursosProyecto, crearRolMaestro, crearHerramientaMaestro,
} from '@/app/actions/mapa.actions';
import type { RecursosProyecto } from '@/app/actions/mapa.actions';
import { FASES_MAPA, VISTAS_MAPA, colorDepto, recursosCompartidos } from '@/domain/mapa';
import type { AsignacionRecurso, Departamento, FaseMapa, ProcesoNodo, VistaMapa } from '@/domain/mapa';

const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };
const btnSm: CSSProperties = { ...btn, padding: '0.15rem 0.5rem', fontSize: 12 };
const inp: CSSProperties = { padding: '0.35rem 0.55rem', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const lbl: CSSProperties = { display: 'block', fontSize: 11, color: '#666', marginTop: '0.5rem', fontWeight: 'bold' };
const tag: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eef2fb', border: '1px solid #cdd8ef', borderRadius: 12, padding: '0.1rem 0.5rem', fontSize: 12, margin: '2px 3px 0 0' };

interface Props { proyectoId: string; onVolver: () => void; onIrSedes: () => void; nombreProyecto?: string }

type Rect = { x: number; y: number; w: number; h: number };

export function MapaOperativo({ proyectoId, onVolver, onIrSedes, nombreProyecto }: Props) {
  const [deptos, setDeptos] = useState<Departamento[]>([]);
  const [procesos, setProcesos] = useState<ProcesoNodo[]>([]);
  const [recursos, setRecursos] = useState<RecursosProyecto>({ espacios: [], roles: [], herramientas: [] });
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<VistaMapa>('general');
  const [selProc, setSelProc] = useState<string | null>(null);
  const [selDepto, setSelDepto] = useState<string | null>(null);
  const [nuevoDepto, setNuevoDepto] = useState('');
  const [msg, setMsg] = useState('');

  // refs de tarjetas para dibujar las flechas (ramas) en SVG.
  const contRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const [rects, setRects] = useState<Record<string, Rect>>({});

  const cargar = () => {
    setLoading(true);
    Promise.all([listarDepartamentos(proyectoId), listarProcesos(proyectoId), listarRecursosProyecto(proyectoId)])
      .then(([d, p, r]) => { setDeptos(d); setProcesos(p); setRecursos(r); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [proyectoId]);

  // Recalcula posiciones de tarjetas (para las flechas) tras cada render relevante.
  const medir = () => {
    const cont = contRef.current; if (!cont) return;
    const cr = cont.getBoundingClientRect();
    const out: Record<string, Rect> = {};
    for (const [id, el] of cardRefs.current) {
      if (!el.isConnected) continue;
      const r = el.getBoundingClientRect();
      out[id] = { x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height };
    }
    setRects(out);
  };
  useLayoutEffect(() => { medir(); /* eslint-disable-next-line */ }, [procesos, deptos, vista, loading]);
  useEffect(() => {
    const h = () => medir();
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const proc = procesos.find((p) => p.id === selProc) ?? null;
  const depto = deptos.find((d) => d.id === selDepto) ?? null;
  const compartidos = recursosCompartidos(deptos);

  function celda(deptoId: string, fase: FaseMapa): ProcesoNodo[] {
    return procesos.filter((p) => p.departamentoId === deptoId && p.fase === fase).sort((a, b) => a.orden - b.orden);
  }

  // --- mutaciones optimistas + persistencia ---
  function patchLocal(id: string, patch: Partial<ProcesoNodo>) {
    setProcesos((ps) => ps.map((p) => p.id === id ? { ...p, ...patch } : p));
  }

  async function altaProceso(deptoId: string, fase: FaseMapa) {
    const nombre = window.prompt('Nombre del proceso:');
    if (!nombre?.trim()) return;
    const nuevo = await crearProceso(proyectoId, deptoId, nombre.trim(), fase);
    setProcesos((ps) => [...ps, nuevo]);
    setSelProc(nuevo.id); setSelDepto(null);
  }

  async function altaDepto() {
    if (!nuevoDepto.trim()) return;
    await crearDepartamento(proyectoId, nuevoDepto.trim());
    setNuevoDepto(''); cargar();
  }

  async function importar() {
    setMsg('Importando rutas del catálogo…');
    const r = await importarRutasCatalogo(proyectoId);
    setMsg(`Catálogo → mapa: ${r.creados} procesos creados${r.omitidos ? `, ${r.omitidos} ya estaban` : ''}.`);
    cargar();
  }

  // --- drag & drop ---
  function onDragStart(e: DragEvent, id: string) { e.dataTransfer.setData('text/proc', id); e.dataTransfer.effectAllowed = 'move'; }
  async function soltarEnCelda(e: DragEvent, deptoId: string, fase: FaseMapa, antesDeId?: string) {
    e.preventDefault(); e.stopPropagation();
    const id = e.dataTransfer.getData('text/proc'); if (!id) return;
    const lista = celda(deptoId, fase).filter((p) => p.id !== id);
    const idx = antesDeId ? Math.max(0, lista.findIndex((p) => p.id === antesDeId)) : lista.length;
    const arrastrado = procesos.find((p) => p.id === id); if (!arrastrado) return;
    lista.splice(idx, 0, { ...arrastrado, departamentoId: deptoId, fase });
    // renumera la celda y persiste (celdas son chicas: pocas llamadas)
    setProcesos((ps) => ps.map((p) => {
      const i = lista.findIndex((x) => x.id === p.id);
      if (p.id === id) return { ...p, departamentoId: deptoId, fase, orden: lista.findIndex((x) => x.id === id) + 1 };
      return i >= 0 ? { ...p, orden: i + 1 } : p;
    }));
    for (let i = 0; i < lista.length; i++) await moverProceso(lista[i]!.id, deptoId, fase, i + 1);
  }

  // --- contenido de tarjeta según la lente ---
  function lenteCard(p: ProcesoNodo): string {
    if (vista === 'instructivo') return p.instructivo ? p.instructivo.slice(0, 60) : (p.entrada || p.salida ? `${p.entrada ?? '—'} → ${p.salida ?? '—'}` : 'sin instructivo');
    if (vista === 'roles') return p.roles.length ? p.roles.join(' · ') : 'sin rol';
    if (vista === 'espacios') return p.espacios.length ? p.espacios.map((e) => e.nombre + (e.horario ? ` (${e.horario})` : '')).join(' · ') : 'sin espacio';
    if (vista === 'herramientas') return p.herramientas.length ? p.herramientas.join(' · ') : 'sin herramientas';
    if (vista === 'tiempos') return p.tiempoMin ? `${p.tiempoMin} min` : 'sin tiempo';
    return p.descripcion ? p.descripcion.slice(0, 50) : '';
  }

  // --- flechas (ramas) ---
  const edges: { from: Rect; to: Rect; evento: string; key: string }[] = [];
  for (const p of procesos) {
    const from = rects[p.id]; if (!from) continue;
    for (const r of p.ramas) {
      if (!r.destinoProcesoId) continue;
      const to = rects[r.destinoProcesoId]; if (!to) continue;
      edges.push({ from, to, evento: r.evento, key: `${p.id}-${r.id}` });
    }
  }

  const totalPorDepto = (id: string) => procesos.filter((p) => p.departamentoId === id).reduce((s, p) => s + (p.tiempoMin ?? 0), 0);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>🗺️ Mapa Operativo <span style={{ fontSize: 13, color: '#888' }}>· {nombreProyecto ?? 'proyecto'} · departamentos y flujos de procesos</span></h2>
        <button style={btn} onClick={onVolver}>← Proyecto</button>
      </div>

      {/* barra de herramientas */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', margin: '0.6rem 0' }}>
        {VISTAS_MAPA.map((v) => (
          <button key={v.id} style={{ ...btnSm, background: vista === v.id ? '#33415c' : '#fff', color: vista === v.id ? '#fff' : '#333', borderColor: vista === v.id ? '#33415c' : '#bbb' }} onClick={() => setVista(v.id)}>{v.label}</button>
        ))}
        <span style={{ flex: 1 }} />
        <button style={btnSm} onClick={() => void importar()} title="Siembra en el mapa los pasos de las rutas del catálogo (por UC)">⬇ Importar rutas del catálogo</button>
        <input style={{ ...inp, width: 180 }} placeholder="＋ Departamento admin…" value={nuevoDepto} onChange={(e) => setNuevoDepto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void altaDepto(); }} />
        <button style={btnSm} onClick={() => void altaDepto()} disabled={!nuevoDepto.trim()}>＋</button>
      </div>
      {msg && <p style={{ fontSize: 12, color: '#2b5a97', margin: '0 0 0.4rem' }}>{msg}</p>}
      {loading && <p style={{ color: '#666' }}>Cargando…</p>}

      <div style={{ display: 'grid', gridTemplateColumns: proc || depto ? 'minmax(0, 1fr) 330px' : '1fr', gap: '0.75rem', alignItems: 'start' }}>
        {/* ==== CANVAS ==== */}
        <div ref={contRef} style={{ position: 'relative', border: '1px solid #ddd', borderRadius: 10, background: '#fcfcfd', overflowX: 'auto' }}>
          {/* cabecera de fases */}
          <div style={{ display: 'grid', gridTemplateColumns: '150px repeat(3, minmax(210px, 1fr))', borderBottom: '2px solid #e5e5e5', position: 'sticky', top: 0, background: '#fcfcfd', zIndex: 2 }}>
            <div style={{ padding: '0.5rem 0.6rem', fontSize: 12, color: '#888', fontWeight: 'bold' }}>Departamento</div>
            {FASES_MAPA.map((f) => (
              <div key={f.id} style={{ padding: '0.5rem 0.6rem', fontSize: 12, fontWeight: 'bold', color: '#33415c', borderLeft: '1px dashed #e5e5e5' }}>{f.label}</div>
            ))}
          </div>

          {/* carriles */}
          {deptos.map((d, i) => {
            const color = colorDepto(d, i);
            return (
              <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '150px repeat(3, minmax(210px, 1fr))', borderBottom: '1px solid #eee', minHeight: 86 }}>
                {/* etiqueta del carril */}
                <div onClick={() => { setSelDepto(d.id); setSelProc(null); }}
                  style={{ padding: '0.5rem 0.6rem', borderLeft: `5px solid ${color}`, cursor: 'pointer', background: selDepto === d.id ? '#f2f6ff' : 'transparent' }}>
                  <div style={{ fontSize: 13, fontWeight: 'bold', color }}>{d.nombre}</div>
                  <div style={{ fontSize: 10, color: '#999' }}>{d.tipo === 'uc' ? 'Unidad Comercial' : 'Administración'}</div>
                  {vista === 'tiempos' && <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>Σ {totalPorDepto(d.id)} min</div>}
                  {(d.espacios.length > 0 || d.herramientas.length > 0) && <div style={{ fontSize: 10, color: '#777', marginTop: 2 }}>📐{d.espacios.length} 🔧{d.herramientas.length}</div>}
                </div>
                {/* celdas por fase */}
                {FASES_MAPA.map((f) => (
                  <div key={f.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => void soltarEnCelda(e, d.id, f.id)}
                    style={{ padding: '0.45rem', borderLeft: '1px dashed #eee', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {celda(d.id, f.id).map((p) => (
                      <div key={p.id}
                        ref={(el) => { if (el) cardRefs.current.set(p.id, el); else cardRefs.current.delete(p.id); }}
                        draggable
                        onDragStart={(e) => onDragStart(e, p.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => void soltarEnCelda(e, d.id, f.id, p.id)}
                        onClick={() => { setSelProc(p.id); setSelDepto(null); }}
                        style={{
                          border: `1.5px solid ${selProc === p.id ? color : '#d5d9e2'}`, borderTop: `3px solid ${color}`,
                          borderRadius: 8, background: '#fff', padding: '0.35rem 0.5rem', cursor: 'grab',
                          boxShadow: selProc === p.id ? `0 0 0 2px ${color}33` : '0 1px 2px rgba(0,0,0,0.05)',
                        }}>
                        <div style={{ fontSize: 12.5, fontWeight: 'bold', color: '#222' }}>
                          {p.nombre}
                          {p.ramas.filter((r) => r.destinoProcesoId).length > 1 && <span title="Se divide en varios caminos" style={{ color: '#b06be0', marginLeft: 4 }}>⑂</span>}
                          {p.origen && <span title="Sembrado desde el catálogo" style={{ marginLeft: 4 }}>🧬</span>}
                        </div>
                        {lenteCard(p) && <div style={{ fontSize: 11, color: '#777', marginTop: 1 }}>{lenteCard(p)}</div>}
                      </div>
                    ))}
                    <button style={{ ...btnSm, border: '1px dashed #bbb', color: '#888', background: 'transparent', alignSelf: 'flex-start' }} onClick={() => void altaProceso(d.id, f.id)}>＋ proceso</button>
                  </div>
                ))}
              </div>
            );
          })}

          {/* flechas de las ramas */}
          <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }} width="100%" height="100%">
            <defs>
              <marker id="flecha" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#8a93a8" /></marker>
            </defs>
            {edges.map((e) => {
              const haciaDerecha = e.to.x >= e.from.x + e.from.w - 4;
              const x1 = haciaDerecha ? e.from.x + e.from.w : e.from.x + e.from.w / 2;
              const y1 = haciaDerecha ? e.from.y + e.from.h / 2 : e.from.y + e.from.h;
              const x2 = haciaDerecha ? e.to.x : e.to.x + e.to.w / 2;
              const y2 = haciaDerecha ? e.to.y + e.to.h / 2 : e.to.y;
              const dx = Math.max(28, Math.abs(x2 - x1) / 2);
              const path = haciaDerecha
                ? `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
                : `M ${x1} ${y1} C ${x1} ${y1 + 24}, ${x2} ${y2 - 24}, ${x2} ${y2}`;
              const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
              return (
                <g key={e.key}>
                  <path d={path} fill="none" stroke="#8a93a8" strokeWidth={1.6} markerEnd="url(#flecha)" />
                  {e.evento && e.evento !== 'continúa' && (
                    <>
                      <rect x={mx - e.evento.length * 3.2 - 4} y={my - 9} width={e.evento.length * 6.4 + 8} height={15} rx={7} fill="#fff" stroke="#d5d9e2" />
                      <text x={mx} y={my + 2.5} textAnchor="middle" fontSize={10} fill="#7a4fbf">{e.evento}</text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>

          {!loading && deptos.length === 0 && <p style={{ padding: '1rem', color: '#888', fontSize: 13 }}>Sin departamentos aún.</p>}
          <p style={{ fontSize: 11, color: '#999', padding: '0.4rem 0.6rem' }}>
            Arrastra procesos entre departamentos y fases · clic en un proceso o departamento para editarlo · ⑂ = se divide en caminos por disparador · 🧬 = sembrado del catálogo.
          </p>
        </div>

        {/* ==== PANEL PROCESO ==== */}
        {proc && (
          <PanelProceso key={proc.id} proyectoId={proyectoId} proc={proc} procesos={procesos} deptos={deptos} recursos={recursos}
            onPatch={(patch) => { patchLocal(proc.id, patch); void actualizarProceso(proc.id, patch); }}
            onRecargarRecursos={() => { listarRecursosProyecto(proyectoId).then(setRecursos).catch(() => {}); }}
            onEliminar={async () => { await eliminarProceso(proc.id); setSelProc(null); cargar(); }}
            onCerrar={() => setSelProc(null)} onIrSedes={onIrSedes} />
        )}

        {/* ==== PANEL DEPARTAMENTO ==== */}
        {depto && !proc && (
          <PanelDepartamento key={depto.id} depto={depto} recursos={recursos} compartidos={compartidos}
            onPatch={(patch) => {
              setDeptos((ds) => ds.map((d) => d.id === depto.id ? { ...d, ...patch } : d));
              void actualizarDepartamento(depto.id, patch);
            }}
            onEliminar={depto.tipo === 'admin' ? async () => { await eliminarDepartamento(depto.id); setSelDepto(null); cargar(); } : undefined}
            onCerrar={() => setSelDepto(null)} onIrSedes={onIrSedes} />
        )}
      </div>
    </section>
  );
}

// =================== PANEL: PROCESO ===================

function PanelProceso({ proyectoId, proc, procesos, deptos, recursos, onPatch, onRecargarRecursos, onEliminar, onCerrar, onIrSedes }: {
  proyectoId: string; proc: ProcesoNodo; procesos: ProcesoNodo[]; deptos: Departamento[]; recursos: RecursosProyecto;
  onPatch: (p: Partial<ProcesoNodo>) => void; onRecargarRecursos: () => void;
  onEliminar: () => Promise<void>; onCerrar: () => void; onIrSedes: () => void;
}) {
  const [nuevoRol, setNuevoRol] = useState('');
  const [nuevaHerr, setNuevaHerr] = useState('');
  const [nuevoEspacio, setNuevoEspacio] = useState('');
  const [horarioEspacio, setHorarioEspacio] = useState('');
  const deptoDe = (id: string) => deptos.find((d) => d.id === id)?.nombre ?? '?';

  // "Crear y volver": si el rol/herramienta no existe en el maestro, se crea al vuelo y queda seleccionable.
  async function addRol() {
    const r = nuevoRol.trim(); if (!r) return;
    if (!proc.roles.includes(r)) onPatch({ roles: [...proc.roles, r] });
    if (!recursos.roles.some((x) => x.toLowerCase() === r.toLowerCase())) { await crearRolMaestro(proyectoId, r); onRecargarRecursos(); }
    setNuevoRol('');
  }
  async function addHerr() {
    const h = nuevaHerr.trim(); if (!h) return;
    if (!proc.herramientas.includes(h)) onPatch({ herramientas: [...proc.herramientas, h] });
    if (!recursos.herramientas.some((x) => x.toLowerCase() === h.toLowerCase())) { await crearHerramientaMaestro(proyectoId, h); onRecargarRecursos(); }
    setNuevaHerr('');
  }
  function addEspacio() {
    const n = nuevoEspacio.trim(); if (!n) return;
    const real = recursos.espacios.find((e) => e.nombre.toLowerCase() === n.toLowerCase());
    const asig: AsignacionRecurso = { ref: real?.id, nombre: real?.nombre ?? n, horario: horarioEspacio.trim() || undefined };
    onPatch({ espacios: [...proc.espacios, asig] });
    setNuevoEspacio(''); setHorarioEspacio('');
  }

  return (
    <div style={{ border: '1px solid #cdd8ef', borderRadius: 10, padding: '0.7rem', background: '#f7f9ff', position: 'sticky', top: 8, maxHeight: '82vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 14 }}>⚙️ Proceso</strong>
        <button style={btnSm} onClick={onCerrar}>✕</button>
      </div>
      <div style={{ fontSize: 11, color: '#888' }}>{deptoDe(proc.departamentoId)} · {FASES_MAPA.find((f) => f.id === proc.fase)?.label}</div>

      <label style={lbl}>Nombre</label>
      <input style={inp} defaultValue={proc.nombre} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== proc.nombre) onPatch({ nombre: e.target.value.trim() }); }} />

      <label style={lbl}>Descripción</label>
      <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={proc.descripcion ?? ''} onBlur={(e) => onPatch({ descripcion: e.target.value })} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        <div>
          <label style={lbl}>Entrada</label>
          <input style={inp} defaultValue={proc.entrada ?? ''} placeholder="qué recibe" onBlur={(e) => onPatch({ entrada: e.target.value })} />
        </div>
        <div>
          <label style={lbl}>Salida</label>
          <input style={inp} defaultValue={proc.salida ?? ''} placeholder="qué produce" onBlur={(e) => onPatch({ salida: e.target.value })} />
        </div>
      </div>

      <label style={lbl}>Tiempo (min)</label>
      <input style={inp} type="number" defaultValue={proc.tiempoMin ?? ''} onBlur={(e) => onPatch({ tiempoMin: e.target.value === '' ? 0 : Number(e.target.value) })} />

      <label style={lbl}>Instructivo (paso a paso)</label>
      <textarea style={{ ...inp, resize: 'vertical' }} rows={3} defaultValue={proc.instructivo ?? ''} onBlur={(e) => onPatch({ instructivo: e.target.value })} />

      {/* ROLES */}
      <label style={lbl}>👤 Roles {proc.roles.length > 0 && <span style={{ color: '#999' }}>({proc.roles.length})</span>}</label>
      <div>{proc.roles.map((r) => <span key={r} style={tag}>{r} <span style={{ cursor: 'pointer', color: '#b33' }} onClick={() => onPatch({ roles: proc.roles.filter((x) => x !== r) })}>×</span></span>)}</div>
      <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
        <input style={{ ...inp, flex: 1 }} list={`roles-${proc.id}`} placeholder="rol existente o nuevo…" value={nuevoRol} onChange={(e) => setNuevoRol(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addRol(); }} />
        <datalist id={`roles-${proc.id}`}>{recursos.roles.map((r) => <option key={r} value={r} />)}</datalist>
        <button style={btnSm} onClick={() => void addRol()} disabled={!nuevoRol.trim()}>＋</button>
      </div>

      {/* HERRAMIENTAS */}
      <label style={lbl}>🔧 Herramientas / muebles</label>
      <div>{proc.herramientas.map((h) => <span key={h} style={tag}>{h} <span style={{ cursor: 'pointer', color: '#b33' }} onClick={() => onPatch({ herramientas: proc.herramientas.filter((x) => x !== h) })}>×</span></span>)}</div>
      <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
        <input style={{ ...inp, flex: 1 }} list={`herr-${proc.id}`} placeholder="herramienta existente o nueva…" value={nuevaHerr} onChange={(e) => setNuevaHerr(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addHerr(); }} />
        <datalist id={`herr-${proc.id}`}>{recursos.herramientas.map((h) => <option key={h} value={h} />)}</datalist>
        <button style={btnSm} onClick={() => void addHerr()} disabled={!nuevaHerr.trim()}>＋</button>
      </div>

      {/* ESPACIOS */}
      <label style={lbl}>📐 Espacios (del plano/render) — compartibles por horario</label>
      <div>{proc.espacios.map((e, i) => (
        <span key={`${e.nombre}-${i}`} style={tag}>{e.nombre}{e.horario ? ` · ${e.horario}` : ''} <span style={{ cursor: 'pointer', color: '#b33' }} onClick={() => onPatch({ espacios: proc.espacios.filter((_, j) => j !== i) })}>×</span></span>
      ))}</div>
      <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
        <input style={{ ...inp, flex: 2 }} list={`esp-${proc.id}`} placeholder="espacio…" value={nuevoEspacio} onChange={(e) => setNuevoEspacio(e.target.value)} />
        <datalist id={`esp-${proc.id}`}>{recursos.espacios.map((e) => <option key={e.id} value={e.nombre}>{e.sedeNombre}</option>)}</datalist>
        <input style={{ ...inp, flex: 1 }} placeholder="horario" value={horarioEspacio} onChange={(e) => setHorarioEspacio(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addEspacio(); }} />
        <button style={btnSm} onClick={addEspacio} disabled={!nuevoEspacio.trim()}>＋</button>
      </div>
      <button style={{ ...btnSm, marginTop: 4 }} onClick={onIrSedes}>Crear espacio en Sedes & Espacios →</button>

      {/* RAMAS */}
      <label style={lbl}>⑂ Ramas (caminos por disparador)</label>
      {proc.ramas.map((r) => (
        <div key={r.id} style={{ display: 'flex', gap: 4, marginTop: 3, alignItems: 'center' }}>
          <input style={{ ...inp, flex: 2 }} defaultValue={r.evento} placeholder="disparador (ej. Pago recibido)"
            onBlur={(e) => onPatch({ ramas: proc.ramas.map((x) => x.id === r.id ? { ...x, evento: e.target.value } : x) })} />
          <select style={{ ...inp, flex: 3 }} value={r.destinoProcesoId ?? ''}
            onChange={(e) => onPatch({ ramas: proc.ramas.map((x) => x.id === r.id ? { ...x, destinoProcesoId: e.target.value || undefined } : x) })}>
            <option value="">→ (sin destino)</option>
            {procesos.filter((p) => p.id !== proc.id).map((p) => (
              <option key={p.id} value={p.id}>{deptoDe(p.departamentoId)} · {p.nombre}</option>
            ))}
          </select>
          <span style={{ cursor: 'pointer', color: '#b33', fontSize: 15 }} onClick={() => onPatch({ ramas: proc.ramas.filter((x) => x.id !== r.id) })}>×</span>
        </div>
      ))}
      <button style={{ ...btnSm, marginTop: 4 }} onClick={() => onPatch({ ramas: [...proc.ramas, { id: `RAMA-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, evento: '' }] })}>＋ Rama</button>
      <p style={{ fontSize: 10.5, color: '#999', margin: '0.3rem 0 0' }}>Un proceso con 2+ ramas se divide en caminos según el disparador que se active.</p>

      <div style={{ borderTop: '1px solid #dde', marginTop: '0.7rem', paddingTop: '0.5rem' }}>
        <button style={{ ...btnSm, color: '#b33', borderColor: '#d99' }} onClick={() => { if (window.confirm(`¿Eliminar el proceso "${proc.nombre}"?`)) void onEliminar(); }}>🗑 Eliminar proceso</button>
      </div>
    </div>
  );
}

// =================== PANEL: DEPARTAMENTO ===================

function PanelDepartamento({ depto, recursos, compartidos, onPatch, onEliminar, onCerrar, onIrSedes }: {
  depto: Departamento; recursos: RecursosProyecto; compartidos: Map<string, string[]>;
  onPatch: (p: { nombre?: string; color?: string; descripcion?: string; espacios?: AsignacionRecurso[]; herramientas?: AsignacionRecurso[] }) => void;
  onEliminar?: (() => Promise<void>) | undefined; onCerrar: () => void; onIrSedes: () => void;
}) {
  const [nuevoEspacio, setNuevoEspacio] = useState('');
  const [horarioE, setHorarioE] = useState('');
  const [nuevaHerr, setNuevaHerr] = useState('');
  const [horarioH, setHorarioH] = useState('');

  function esCompartido(r: AsignacionRecurso): string[] {
    const otros = (compartidos.get((r.ref ?? r.nombre).toLowerCase()) ?? []).filter((n) => n !== depto.nombre);
    return otros;
  }
  function addEspacio() {
    const n = nuevoEspacio.trim(); if (!n) return;
    const real = recursos.espacios.find((e) => e.nombre.toLowerCase() === n.toLowerCase());
    onPatch({ espacios: [...depto.espacios, { ref: real?.id, nombre: real?.nombre ?? n, horario: horarioE.trim() || undefined }] });
    setNuevoEspacio(''); setHorarioE('');
  }
  function addHerr() {
    const n = nuevaHerr.trim(); if (!n) return;
    onPatch({ herramientas: [...depto.herramientas, { nombre: n, horario: horarioH.trim() || undefined }] });
    setNuevaHerr(''); setHorarioH('');
  }

  const fila = (r: AsignacionRecurso, i: number, campo: 'espacios' | 'herramientas') => {
    const otros = esCompartido(r);
    return (
      <div key={`${r.nombre}-${i}`} style={{ fontSize: 12, padding: '0.15rem 0', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ flex: 1 }}>· <strong>{r.nombre}</strong>{r.horario ? <span style={{ color: '#2b5a97' }}> · {r.horario}</span> : ''}
          {otros.length > 0 && <span title={`También lo usa: ${otros.join(', ')}`} style={{ color: '#b06be0', marginLeft: 4 }}>⇄ compartido</span>}
        </span>
        <span style={{ cursor: 'pointer', color: '#b33' }} onClick={() => onPatch({ [campo]: depto[campo].filter((_, j) => j !== i) } as never)}>×</span>
      </div>
    );
  };

  return (
    <div style={{ border: '1px solid #cdd8ef', borderRadius: 10, padding: '0.7rem', background: '#f7f9ff', position: 'sticky', top: 8, maxHeight: '82vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 14 }}>🏷️ Departamento</strong>
        <button style={btnSm} onClick={onCerrar}>✕</button>
      </div>
      <div style={{ fontSize: 11, color: '#888' }}>{depto.tipo === 'uc' ? 'Carril de Unidad Comercial (derivado de la UC)' : 'Departamento administrativo'}</div>

      <label style={lbl}>Nombre</label>
      <input style={inp} defaultValue={depto.nombre} disabled={depto.tipo === 'uc'}
        onBlur={(e) => { if (e.target.value.trim() && e.target.value !== depto.nombre) onPatch({ nombre: e.target.value.trim() }); }} />
      {depto.tipo === 'uc' && <p style={{ fontSize: 10.5, color: '#999', margin: '2px 0 0' }}>El nombre se hereda de la Unidad Comercial.</p>}

      <label style={lbl}>Color del carril</label>
      <input type="color" value={depto.color ?? '#33415c'} onChange={(e) => onPatch({ color: e.target.value })} style={{ width: 46, height: 28, border: '1px solid #ccc', borderRadius: 6, background: '#fff', cursor: 'pointer' }} />

      <label style={lbl}>Descripción</label>
      <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={depto.descripcion ?? ''} onBlur={(e) => onPatch({ descripcion: e.target.value })} />

      <label style={lbl}>📐 Espacios asignados (del plano/render)</label>
      {depto.espacios.map((r, i) => fila(r, i, 'espacios'))}
      <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
        <input style={{ ...inp, flex: 2 }} list={`de-${depto.id}`} placeholder="espacio…" value={nuevoEspacio} onChange={(e) => setNuevoEspacio(e.target.value)} />
        <datalist id={`de-${depto.id}`}>{recursos.espacios.map((e) => <option key={e.id} value={e.nombre}>{e.sedeNombre}</option>)}</datalist>
        <input style={{ ...inp, flex: 1 }} placeholder="horario" value={horarioE} onChange={(e) => setHorarioE(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addEspacio(); }} />
        <button style={btnSm} onClick={addEspacio} disabled={!nuevoEspacio.trim()}>＋</button>
      </div>
      <button style={{ ...btnSm, marginTop: 4 }} onClick={onIrSedes}>Crear espacio en Sedes & Espacios →</button>

      <label style={lbl}>🔧 Herramientas / muebles asignados</label>
      {depto.herramientas.map((r, i) => fila(r, i, 'herramientas'))}
      <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
        <input style={{ ...inp, flex: 2 }} list={`dh-${depto.id}`} placeholder="herramienta/mueble…" value={nuevaHerr} onChange={(e) => setNuevaHerr(e.target.value)} />
        <datalist id={`dh-${depto.id}`}>{recursos.herramientas.map((h) => <option key={h} value={h} />)}</datalist>
        <input style={{ ...inp, flex: 1 }} placeholder="horario" value={horarioH} onChange={(e) => setHorarioH(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addHerr(); }} />
        <button style={btnSm} onClick={addHerr} disabled={!nuevaHerr.trim()}>＋</button>
      </div>
      <p style={{ fontSize: 10.5, color: '#999', margin: '0.3rem 0 0' }}>⇄ = recurso compartido con otro departamento (en horarios distintos).</p>

      {onEliminar && (
        <div style={{ borderTop: '1px solid #dde', marginTop: '0.7rem', paddingTop: '0.5rem' }}>
          <button style={{ ...btnSm, color: '#b33', borderColor: '#d99' }} onClick={() => { if (window.confirm(`¿Eliminar "${depto.nombre}"? Sus procesos pasan a Administración.`)) void onEliminar(); }}>🗑 Eliminar departamento</button>
        </div>
      )}
    </div>
  );
}
