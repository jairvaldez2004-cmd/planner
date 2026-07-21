'use client';

// Editor 2D del Módulo de Espacios (plano arquitectónico). En METROS a escala dentro
// de la huella. Niveles (sótano/PB/pisos), muros perimetrales automáticos, dibujo de
// muros/puertas/ventanas (con huecos reales) editables por extremos, habitaciones
// rectangulares o POLIGONALES, objetos, y LENTES por plano.

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  obtenerSede, listarEspacios, listarObjetos, listarUnidades, listarElementos,
  crearEspacio, actualizarEspacio, eliminarEspacio,
  crearObjeto, actualizarObjeto, eliminarObjeto,
  crearElemento, actualizarElemento, eliminarElemento, costeoSede,
} from '@/app/actions/espacios.actions';
import {
  LENTES, lente as getLente, TIPOS_ESPACIO, CATEGORIAS_OBJETO, ESTILO_ELEMENTO, etiquetaNivel, poligonoAMetros,
  centroDe, normalizarGrados,
} from '@/domain/espacios';
import type {
  Sede, Espacio, ObjetoFisico, ElementoArq, UnidadComercial, LenteId, TipoEspacio, CategoriaObjeto, TipoElemento,
} from '@/domain/espacios';
import { Vista3D } from './vista-3d';
import { VistaRenders } from './vista-renders';
import { subirModelo3D, idsConModelo3D, eliminarModelo3D } from '@/app/actions/modelo3d.actions';
import { MAX_GLB_BYTES } from '@/domain/render';
import { useEsMovil } from './use-movil';

const VBW = 900, VBH = 600;
const btn: CSSProperties = { padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };
const inp: CSSProperties = { padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, width: '100%' };
const lbl: CSSProperties = { display: 'block', fontSize: 11, color: '#666', marginTop: '0.4rem' };

// Etiqueta de medida sobre el lienzo (fondo claro para legibilidad).
function Etiqueta({ x, y, text }: { x: number; y: number; text: string }) {
  const w = text.length * 6.2 + 8;
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect x={x - 2} y={y - 11} width={w} height={14} rx={3} fill="#fff" fillOpacity={0.85} stroke="#e0e0e0" />
      <text x={x + 2} y={y} fontSize={11} fill="#333">{text}</text>
    </g>
  );
}

type Sel = { tipo: 'espacio' | 'objeto' | 'elemento'; id: string } | null;
type Drag = { tipo: 'espacio' | 'objeto'; id: string; offsetX: number; offsetY: number } | null;
type DragEl = { id: string; cual: 'a' | 'b' } | null;
// Giro: se arrastra la manija y el ángulo sale del vector centro→cursor.
type Giro = { tipo: 'espacio' | 'objeto'; id: string; base: number } | null;
type Modo = 'sel' | TipoElemento | 'habitacion';
type Pt = { x: number; y: number };

export function EditorEspacios({ proyectoId, sedeId, onVolver }: { proyectoId: string; sedeId: string; onVolver: () => void }) {
  const [sede, setSede] = useState<Sede | null>(null);
  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [objetos, setObjetos] = useState<ObjetoFisico[]>([]);
  const [elementos, setElementos] = useState<ElementoArq[]>([]);
  const [ucs, setUcs] = useState<UnidadComercial[]>([]);
  const [lenteId, setLenteId] = useState<LenteId>('espacios');
  const [capa, setCapa] = useState(0);
  const movil = useEsMovil();
  const [sel, setSel] = useState<Sel>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [dragEl, setDragEl] = useState<DragEl>(null);
  const [giro, setGiro] = useState<Giro>(null);
  const [modo, setModo] = useState<Modo>('sel');
  const [panel, setPanel] = useState<'2d' | '3d' | 'renders'>('2d');
  const primeraCarga = useRef(true);
  const [pend, setPend] = useState<Pt | null>(null);
  const [roomPts, setRoomPts] = useState<Pt[]>([]);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [costeo, setCosteo] = useState<{ total: number; objetos: number; espacios: number }>({ total: 0, objetos: 0, espacios: 0 });
  const [conModelo, setConModelo] = useState<Set<string>>(new Set()); // objetos con escaneo .glb
  const svgRef = useRef<SVGSVGElement | null>(null);

  const lente = getLente(lenteId);
  const poly = sede?.poligono && sede.poligono.length >= 3 ? poligonoAMetros(sede.poligono) : null;
  const footAncho = poly ? poly.ancho : (sede?.footAncho ?? 20);
  const footAlto = poly ? poly.alto : (sede?.footAlto ?? 15);
  const scale = Math.min(VBW / footAncho, VBH / footAlto);
  const polyPts = poly ? poly.puntos.map((p) => `${p.x * scale},${p.y * scale}`).join(' ') : '';
  const muroExt = sede?.muroExterior ?? 0.30; // m
  const muroInt = sede?.muroInterior ?? 0.15; // m
  const gPx = (m: number) => Math.max(2, m * scale); // grosor en px (mínimo visible)
  const dim = (a: Pt, b: Pt) => { const dx = b.x - a.x, dy = b.y - a.y; return { L: Math.hypot(dx, dy), ang: Math.atan2(dy, dx) * 180 / Math.PI }; };

  const cargar = async () => {
    const [s, e, o, el, u, c] = await Promise.all([
      obtenerSede(sedeId), listarEspacios(sedeId), listarObjetos(sedeId), listarElementos(sedeId), listarUnidades(proyectoId), costeoSede(sedeId),
    ]);
    setSede(s); setEspacios(e); setObjetos(o); setElementos(el); setUcs(u); setCosteo(c);
    idsConModelo3D(o.map((x) => x.id)).then((ids) => setConModelo(new Set(ids))).catch(() => {});
    // Abrir en el NIVEL que tiene contenido: si el layout vive en Piso 1 y el editor
    // abre en Planta baja, el usuario ve un lienzo vacío y cree que no hay nada.
    if (primeraCarga.current) {
      primeraCarga.current = false;
      const conContenido = [...e.map((x) => x.capa), ...o.map((x) => x.capa), ...el.map((x) => x.capa)];
      if (conContenido.length && !conContenido.includes(0)) {
        // el nivel con más elementos gana
        const cuenta = new Map<number, number>();
        for (const cp of conContenido) cuenta.set(cp, (cuenta.get(cp) ?? 0) + 1);
        setCapa([...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]![0]);
      }
    }
  };
  useEffect(() => { void cargar(); /* eslint-disable-next-line */ }, [sedeId]);

  const capas = Array.from(new Set([0, ...espacios.map((e) => e.capa), ...objetos.map((o) => o.capa), ...elementos.map((e) => e.capa)])).sort((a, b) => a - b);
  const espCapa = espacios.filter((e) => e.capa === capa);
  const objCapa = objetos.filter((o) => o.capa === capa);
  const elCapa = [...elementos.filter((e) => e.capa === capa)].sort((a, b) => (a.tipo === 'muro' ? -1 : 1) - (b.tipo === 'muro' ? -1 : 1));

  function svgCoords(e: React.MouseEvent): Pt { const r = svgRef.current!.getBoundingClientRect(); return { x: (e.clientX - r.left) * (VBW / r.width), y: (e.clientY - r.top) * (VBH / r.height) }; }
  const snap = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(v / 0.25) * 0.25));
  function metros(e: React.MouseEvent): Pt { const p = svgCoords(e); return { x: snap(p.x / scale, footAncho), y: snap(p.y / scale, footAlto) }; }

  // --- arrastre (modo selección) ---
  function iniciarDrag(e: React.MouseEvent, tipo: 'espacio' | 'objeto', item: { id: string; x: number; y: number }) {
    if (modo !== 'sel') return;
    e.stopPropagation(); setSel({ tipo, id: item.id });
    const p = svgCoords(e); setDrag({ tipo, id: item.id, offsetX: p.x / scale - item.x, offsetY: p.y / scale - item.y });
  }
  function iniciarDragEl(e: React.MouseEvent, id: string, cual: 'a' | 'b') { if (modo !== 'sel') return; e.stopPropagation(); setSel({ tipo: 'elemento', id }); setDragEl({ id, cual }); }

  // --- giro ---
  function iniciarGiro(e: React.MouseEvent, tipo: 'espacio' | 'objeto', item: { id: string; rot: number }) {
    if (modo !== 'sel') return;
    e.stopPropagation(); setSel({ tipo, id: item.id }); setGiro({ tipo, id: item.id, base: item.rot });
  }
  // Ángulo del centro de la figura al cursor. Con Shift se imanta a múltiplos de 15°
  // (y por tanto a los ejes 0/90/180/270), que es como se alinea a un muro real.
  function anguloDesdeCursor(e: React.MouseEvent, f: { x: number; y: number; ancho: number; alto: number }): number {
    const p = svgCoords(e);
    const c = centroDe(f);
    const g = (Math.atan2(p.y / scale - c.y, p.x / scale - c.x) * 180) / Math.PI + 90; // 0° = manija arriba
    return normalizarGrados(e.shiftKey ? Math.round(g / 15) * 15 : Math.round(g));
  }

  function moverDrag(e: React.MouseEvent) {
    if (giro) {
      if (giro.tipo === 'espacio') setEspacios((arr) => arr.map((s) => s.id === giro.id ? { ...s, rot: anguloDesdeCursor(e, s) } : s));
      else setObjetos((arr) => arr.map((o) => o.id === giro.id ? { ...o, rot: anguloDesdeCursor(e, o) } : o));
      return;
    }
    if (dragEl) { const p = metros(e); setElementos((arr) => arr.map((el) => el.id !== dragEl.id ? el : (dragEl.cual === 'a' ? { ...el, x1: p.x, y1: p.y } : { ...el, x2: p.x, y2: p.y }))); return; }
    if (!drag) return;
    const p = svgCoords(e); const nx = Math.max(0, p.x / scale - drag.offsetX), ny = Math.max(0, p.y / scale - drag.offsetY);
    if (drag.tipo === 'espacio') setEspacios((arr) => arr.map((s) => { if (s.id !== drag.id) return s; const dx = nx - s.x, dy = ny - s.y; return { ...s, x: nx, y: ny, poligono: s.poligono ? s.poligono.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) : s.poligono }; }));
    else setObjetos((arr) => arr.map((o) => o.id === drag.id ? { ...o, x: nx, y: ny } : o));
  }
  async function soltarDrag() {
    if (giro) {
      const g = giro; setGiro(null);
      if (g.tipo === 'espacio') { const s = espacios.find((x) => x.id === g.id); if (s) await actualizarEspacio(s.id, { rot: Math.round(s.rot) }); }
      else { const o = objetos.find((x) => x.id === g.id); if (o) await actualizarObjeto(o.id, { rot: Math.round(o.rot) }); }
      return;
    }
    if (dragEl) { const d = dragEl; setDragEl(null); const el = elementos.find((x) => x.id === d.id); if (el) await actualizarElemento(el.id, d.cual === 'a' ? { x1: Number(el.x1.toFixed(2)), y1: Number(el.y1.toFixed(2)) } : { x2: Number(el.x2.toFixed(2)), y2: Number(el.y2.toFixed(2)) }); return; }
    if (!drag) return; const d = drag; setDrag(null);
    if (d.tipo === 'espacio') { const s = espacios.find((x) => x.id === d.id); if (s) await actualizarEspacio(s.id, { x: Number(s.x.toFixed(2)), y: Number(s.y.toFixed(2)), ...(s.poligono ? { poligono: s.poligono.map((p) => ({ x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)) })) } : {}) }); }
    else { const o = objetos.find((x) => x.id === d.id); if (o) await actualizarObjeto(o.id, { x: Number(o.x.toFixed(2)), y: Number(o.y.toFixed(2)) }); }
  }

  // --- dibujo ---
  async function lienzoDown(e: React.MouseEvent) {
    if (modo === 'sel') return;
    const p = metros(e);
    if (modo === 'habitacion') { setRoomPts((a) => [...a, p]); return; }
    if (!pend) { setPend(p); return; }
    if (p.x === pend.x && p.y === pend.y) return;
    await crearElemento(proyectoId, sedeId, { capa, tipo: modo, x1: pend.x, y1: pend.y, x2: p.x, y2: p.y, ...(modo === 'muro' ? { grosor: muroInt } : {}) });
    setPend(null); await cargar();
  }
  async function cerrarHabitacion() {
    if (roomPts.length < 3) return;
    const xs = roomPts.map((p) => p.x), ys = roomPts.map((p) => p.y);
    const minx = Math.min(...xs), miny = Math.min(...ys);
    const e = await crearEspacio(proyectoId, sedeId, { tipo: 'habitacion', nombre: 'Habitación', capa, x: minx, y: miny, ancho: Number((Math.max(...xs) - minx).toFixed(2)), alto: Number((Math.max(...ys) - miny).toFixed(2)), poligono: roomPts.map((p) => ({ x: p.x, y: p.y })) });
    setRoomPts([]); await cargar(); setSel({ tipo: 'espacio', id: e.id });
  }

  async function agregarEspacio() { const e = await crearEspacio(proyectoId, sedeId, { tipo: 'habitacion', nombre: 'Nueva área', capa, x: 1, y: 1 }); await cargar(); setSel({ tipo: 'espacio', id: e.id }); }
  async function agregarObjeto() {
    const espacioId = (sel?.tipo === 'espacio' ? sel.id : espCapa[0]?.id);
    if (!espacioId) { alert('Crea o selecciona un espacio primero.'); return; }
    const o = await crearObjeto(proyectoId, sedeId, { espacioId, nombre: 'Objeto', categoria: 'mueble', capa, x: 0.5, y: 0.5 });
    await cargar(); setSel({ tipo: 'objeto', id: o.id });
  }

  const selEspacio = sel?.tipo === 'espacio' ? espacios.find((e) => e.id === sel.id) ?? null : null;
  const selObjeto = sel?.tipo === 'objeto' ? objetos.find((o) => o.id === sel.id) ?? null : null;
  const selElemento = sel?.tipo === 'elemento' ? elementos.find((e) => e.id === sel.id) ?? null : null;

  const MODOS: { id: Modo; label: string }[] = [{ id: 'sel', label: '↖ Seleccionar' }, { id: 'muro', label: '▬ Muro' }, { id: 'puerta', label: '🚪 Puerta' }, { id: 'ventana', label: '🪟 Ventana' }, { id: 'habitacion', label: '⬠ Habitación' }];

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>🏢 {sede?.nombre ?? 'Sede'} · editor 2D</h3>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button style={{ ...btn, background: panel === '3d' ? '#33415c' : '#fff', color: panel === '3d' ? '#fff' : '#333', borderColor: panel === '3d' ? '#33415c' : '#999', fontWeight: 'bold' }}
            onClick={() => setPanel(panel === '3d' ? '2d' : '3d')} title="Escena 3D con luces y materiales">🧊 {panel === '3d' ? 'Ver 2D' : 'Ver 3D'}</button>
          <button style={{ ...btn, background: panel === 'renders' ? '#33415c' : '#fff', color: panel === 'renders' ? '#fff' : '#333', borderColor: panel === 'renders' ? '#33415c' : '#999', fontWeight: 'bold' }}
            onClick={() => setPanel(panel === 'renders' ? '2d' : 'renders')} title="Sube tu render/plano/foto y únelo al modelo">🖼 Renders</button>
          <button style={btn} onClick={onVolver}>← Sedes</button>
        </div>
      </div>

      {panel === '3d' && sede && (
        <Vista3D sede={sede} espacios={espCapa} objetos={objCapa} footAncho={footAncho} footAlto={footAlto}
          proyectoId={proyectoId} capa={capa} onCambio={() => void cargar()} onCerrar={() => setPanel('2d')} />
      )}
      {panel === 'renders' && (
        <VistaRenders proyectoId={proyectoId} sedeId={sedeId} espacios={espacios} objetos={objetos} onCerrar={() => setPanel('2d')} />
      )}
      {panel === '2d' && (<>

      {/* Lentes */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', margin: '0.5rem 0' }}>
        <span style={{ fontSize: 13, color: '#555' }}>Alimentando:</span>
        {LENTES.map((l) => (<button key={l.id} onClick={() => setLenteId(l.id)} style={{ ...btn, borderColor: l.color, background: lenteId === l.id ? l.color : '#fff', color: lenteId === l.id ? '#fff' : '#333', fontWeight: lenteId === l.id ? 'bold' : 'normal' }}>{l.etiqueta}</button>))}
      </div>

      {/* Herramienta */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.4rem' }}>
        <span style={{ fontSize: 13, color: '#555' }}>Herramienta:</span>
        {MODOS.map((m) => (<button key={m.id} onClick={() => { setModo(m.id); setPend(null); setRoomPts([]); }} style={{ ...btn, background: modo === m.id ? '#1a1a1a' : '#fff', color: modo === m.id ? '#fff' : '#333', fontWeight: modo === m.id ? 'bold' : 'normal' }}>{m.label}</button>))}
        {(modo === 'muro' || modo === 'puerta' || modo === 'ventana') && <span style={{ fontSize: 12, color: '#a60' }}>Clic inicio → clic fin. {pend ? '(inicio puesto)' : ''}</span>}
        {modo === 'habitacion' && <>
          <span style={{ fontSize: 12, color: '#a60' }}>Clic por cada esquina ({roomPts.length}).</span>
          {roomPts.length >= 3 && <button style={{ ...btn, borderColor: '#2e9e63', color: '#2e9e63' }} onClick={() => void cerrarHabitacion()}>✓ Cerrar habitación</button>}
          {roomPts.length > 0 && <button style={{ ...btn, color: '#a00' }} onClick={() => setRoomPts([])}>✗ Cancelar</button>}
        </>}
      </div>

      {/* Nivel + agregar */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: 13, color: '#555' }}>Nivel:</span>
        {capas.map((c) => <button key={c} style={{ ...btn, background: capa === c ? '#1a1a1a' : '#fff', color: capa === c ? '#fff' : '#333' }} onClick={() => setCapa(c)}>{etiquetaNivel(c)}</button>)}
        <button style={btn} onClick={() => setCapa(Math.max(...capas) + 1)}>＋ piso</button>
        <button style={btn} onClick={() => setCapa(Math.min(...capas) - 1)}>＋ sótano</button>
        <span style={{ marginLeft: 'auto' }} />
        <button style={btn} onClick={() => void agregarEspacio()}>＋ Área (rect)</button>
        <button style={btn} onClick={() => void agregarObjeto()}>＋ Objeto</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '8fr 4fr', gap: '1rem', alignItems: 'start' }}>
        <div style={{ border: '1px solid #ddd', borderRadius: 10, background: '#fcfcfc' }}>
          <svg ref={svgRef} viewBox={`0 0 ${VBW} ${VBH}`} style={{ width: '100%', height: 'auto', display: 'block', cursor: modo !== 'sel' ? 'crosshair' : (drag || dragEl ? 'grabbing' : 'default') }}
            onMouseMove={moverDrag} onMouseUp={() => void soltarDrag()} onMouseLeave={() => void soltarDrag()}>
            <rect x={0} y={0} width={VBW} height={VBH} fill="#f2f2f2" onMouseDown={() => modo === 'sel' && setSel(null)} />
            {poly ? <polygon points={polyPts} fill="#fcfcfc" stroke="#e6dcc8" strokeWidth={1} onMouseDown={() => modo === 'sel' && setSel(null)} /> : <rect x={0} y={0} width={footAncho * scale} height={footAlto * scale} fill="#fcfcfc" stroke="#e6dcc8" strokeWidth={1} onMouseDown={() => modo === 'sel' && setSel(null)} />}
            {Array.from({ length: Math.floor(footAncho) + 1 }).map((_, i) => <line key={`v${i}`} x1={i * scale} y1={0} x2={i * scale} y2={footAlto * scale} stroke="#eee" style={{ pointerEvents: 'none' }} />)}
            {Array.from({ length: Math.floor(footAlto) + 1 }).map((_, i) => <line key={`h${i}`} x1={0} y1={i * scale} x2={footAncho * scale} y2={i * scale} stroke="#eee" style={{ pointerEvents: 'none' }} />)}
            {poly ? <polygon points={polyPts} fill="none" stroke="#333" strokeWidth={gPx(muroExt)} strokeLinejoin="round" style={{ pointerEvents: 'none' }} /> : <rect x={0} y={0} width={footAncho * scale} height={footAlto * scale} fill="none" stroke="#333" strokeWidth={gPx(muroExt)} style={{ pointerEvents: 'none' }} />}

            {/* habitaciones (rect o polígono) */}
            {espCapa.map((e) => {
              const activo = sel?.tipo === 'espacio' && sel.id === e.id;
              const stroke = activo ? lente.color : '#c8d3e6';
              const c = centroDe(e);
              return (
                <g key={e.id} onMouseDown={(ev) => iniciarDrag(ev, 'espacio', e)} style={{ cursor: modo === 'sel' ? 'grab' : 'crosshair' }}
                  transform={e.rot ? `rotate(${e.rot} ${c.x * scale} ${c.y * scale})` : undefined}>
                  {e.poligono && e.poligono.length >= 3
                    ? <polygon points={e.poligono.map((p) => `${p.x * scale},${p.y * scale}`).join(' ')} fill="#eef2f8" fillOpacity={0.85} stroke={stroke} strokeWidth={activo ? 3 : 1.5} />
                    : <rect x={e.x * scale} y={e.y * scale} width={e.ancho * scale} height={e.alto * scale} rx={4} fill="#eef2f8" fillOpacity={0.85} stroke={stroke} strokeWidth={activo ? 3 : 1.5} />}
                  <text x={e.x * scale + 6} y={e.y * scale + 16} fontSize={12} fontWeight="bold" fill="#33415c" style={{ pointerEvents: 'none' }}>{e.nombre}</text>
                  <text x={e.x * scale + 6} y={e.y * scale + 31} fontSize={9} fill="#8a97ad" style={{ pointerEvents: 'none' }}>{e.tipo}{e.poligono ? ` · polígono ${e.poligono.length}v` : ` · ${e.ancho}×${e.alto} m`}</text>
                </g>
              );
            })}
            {/* objetos */}
            {objCapa.map((o) => {
              const activo = sel?.tipo === 'objeto' && sel.id === o.id;
              const c = centroDe(o);
              return (
                <g key={o.id} onMouseDown={(ev) => iniciarDrag(ev, 'objeto', o)} style={{ cursor: modo === 'sel' ? 'grab' : 'crosshair' }}
                  transform={o.rot ? `rotate(${o.rot} ${c.x * scale} ${c.y * scale})` : undefined}>
                  <rect x={o.x * scale} y={o.y * scale} width={o.ancho * scale} height={o.alto * scale} rx={3} fill="#fff3e0" stroke={activo ? lente.color : '#e0a96b'} strokeWidth={activo ? 3 : 1.5} />
                  {/* marca del frente: sin ella, girado 180° se ve igual */}
                  <line x1={o.x * scale + 3} y1={o.y * scale + 3} x2={(o.x + o.ancho) * scale - 3} y2={o.y * scale + 3} stroke="#c98a3b" strokeWidth={2} style={{ pointerEvents: 'none' }} />
                  <text x={c.x * scale} y={c.y * scale + 3} textAnchor="middle" fontSize={9} fill="#8a5a2b" style={{ pointerEvents: 'none' }}>{o.nombre.slice(0, 10)}</text>
                </g>
              );
            })}
            {/* muros / puertas / ventanas (huecos reales) */}
            {elCapa.map((el) => {
              const X1 = el.x1 * scale, Y1 = el.y1 * scale, X2 = el.x2 * scale, Y2 = el.y2 * scale;
              const activo = sel?.tipo === 'elemento' && sel.id === el.id;
              const dx = X2 - X1, dy = Y2 - Y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy, py = ux;
              const leafX = X1 + px * L, leafY = Y1 + py * L;
              return (
                <g key={el.id}>
                  {el.tipo === 'muro' && <line x1={X1} y1={Y1} x2={X2} y2={Y2} stroke={activo ? '#e0795b' : '#333'} strokeWidth={gPx(el.grosor ?? muroInt)} strokeLinecap="round" style={{ pointerEvents: 'none' }} />}
                  {el.tipo !== 'muro' && <line x1={X1} y1={Y1} x2={X2} y2={Y2} stroke="#fcfcfc" strokeWidth={gPx(muroExt) + 2} style={{ pointerEvents: 'none' }} />}
                  {el.tipo === 'ventana' && <line x1={X1} y1={Y1} x2={X2} y2={Y2} stroke={activo ? '#e0795b' : '#3b86c9'} strokeWidth={3} style={{ pointerEvents: 'none' }} />}
                  {el.tipo === 'puerta' && <>
                    <line x1={X1} y1={Y1} x2={leafX} y2={leafY} stroke={activo ? '#e0795b' : '#b5651d'} strokeWidth={3} style={{ pointerEvents: 'none' }} />
                    <path d={`M ${leafX} ${leafY} A ${L} ${L} 0 0 1 ${X2} ${Y2}`} fill="none" stroke={activo ? '#e0795b' : '#b5651d'} strokeWidth={1.5} strokeDasharray="3 3" style={{ pointerEvents: 'none' }} />
                  </>}
                  <line x1={X1} y1={Y1} x2={X2} y2={Y2} stroke="rgba(0,0,0,0)" strokeWidth={12} style={{ pointerEvents: 'all', cursor: modo === 'sel' ? 'pointer' : 'crosshair' }} onMouseDown={(ev) => { if (modo === 'sel') { ev.stopPropagation(); setSel({ tipo: 'elemento', id: el.id }); } }} />
                </g>
              );
            })}
            {/* handles de extremos del elemento seleccionado */}
            {selElemento && modo === 'sel' && ([['a', selElemento.x1, selElemento.y1], ['b', selElemento.x2, selElemento.y2]] as const).map(([cual, hx, hy]) => (
              <circle key={cual} cx={hx * scale} cy={hy * scale} r={6} fill="#fff" stroke="#e0795b" strokeWidth={2} style={{ cursor: 'grab', pointerEvents: 'all' }} onMouseDown={(ev) => iniciarDragEl(ev, selElemento.id, cual)} />
            ))}
            {/* manija de GIRO de la figura seleccionada (espacio o objeto) */}
            {modo === 'sel' && (selEspacio ?? selObjeto) && (() => {
              const f = (selEspacio ?? selObjeto)!;
              const tipo: 'espacio' | 'objeto' = selEspacio ? 'espacio' : 'objeto';
              const c = centroDe(f);
              const cx = c.x * scale, cy = c.y * scale;
              const brazo = (f.alto * scale) / 2 + 22;
              return (
                <g transform={`rotate(${f.rot} ${cx} ${cy})`}>
                  <line x1={cx} y1={cy - (f.alto * scale) / 2} x2={cx} y2={cy - brazo} stroke="#7a4fbf" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
                  <circle cx={cx} cy={cy - brazo} r={7} fill="#fff" stroke="#7a4fbf" strokeWidth={2}
                    style={{ cursor: 'grab', pointerEvents: 'all' }}
                    onMouseDown={(ev) => iniciarGiro(ev, tipo, f)}>
                    <title>Arrastra para girar · mantén Shift para imantar a 15°</title>
                  </circle>
                </g>
              );
            })()}
            {/* ángulo en vivo mientras se gira */}
            {giro && (selEspacio ?? selObjeto) && (() => {
              const f = (selEspacio ?? selObjeto)!;
              const c = centroDe(f);
              return <Etiqueta x={c.x * scale + 12} y={c.y * scale - 10} text={`${Math.round(f.rot)}°`} />;
            })()}

            {/* preview muro/puerta/ventana */}
            {(modo === 'muro' || modo === 'puerta' || modo === 'ventana') && pend && cursor && <line x1={pend.x * scale} y1={pend.y * scale} x2={cursor.x * scale} y2={cursor.y * scale} stroke={ESTILO_ELEMENTO[modo].color} strokeWidth={ESTILO_ELEMENTO[modo].grosor} strokeDasharray="4 4" opacity={0.6} style={{ pointerEvents: 'none' }} />}
            {(modo === 'muro' || modo === 'puerta' || modo === 'ventana') && pend && <circle cx={pend.x * scale} cy={pend.y * scale} r={4} fill={ESTILO_ELEMENTO[modo].color} style={{ pointerEvents: 'none' }} />}
            {/* preview habitación poligonal */}
            {modo === 'habitacion' && roomPts.length > 0 && <>
              <polyline points={[...roomPts, ...(cursor ? [cursor] : [])].map((p) => `${p.x * scale},${p.y * scale}`).join(' ')} fill="none" stroke="#5b8def" strokeWidth={2} strokeDasharray="4 4" style={{ pointerEvents: 'none' }} />
              {roomPts.map((p, i) => <circle key={i} cx={p.x * scale} cy={p.y * scale} r={4} fill="#5b8def" style={{ pointerEvents: 'none' }} />)}
            </>}

            {/* medidas en vivo */}
            {(modo === 'muro' || modo === 'puerta' || modo === 'ventana') && pend && cursor && (() => { const d = dim(pend, cursor); return <Etiqueta x={cursor.x * scale + 10} y={cursor.y * scale - 8} text={`${d.L.toFixed(2)} m · ${Math.round(d.ang)}°`} />; })()}
            {modo === 'habitacion' && roomPts.map((p, i) => { if (i >= roomPts.length - 1) return null; const b = roomPts[i + 1]!; const d = dim(p, b); return <Etiqueta key={`d${i}`} x={(p.x + b.x) / 2 * scale + 4} y={(p.y + b.y) / 2 * scale - 4} text={`${d.L.toFixed(2)} m`} />; })}
            {modo === 'habitacion' && roomPts.length > 0 && cursor && (() => { const d = dim(roomPts[roomPts.length - 1]!, cursor); return <Etiqueta x={cursor.x * scale + 10} y={cursor.y * scale - 8} text={`${d.L.toFixed(2)} m · ${Math.round(d.ang)}°`} />; })()}
            {selElemento && modo === 'sel' && (() => { const d = dim({ x: selElemento.x1, y: selElemento.y1 }, { x: selElemento.x2, y: selElemento.y2 }); return <Etiqueta x={(selElemento.x1 + selElemento.x2) / 2 * scale + 4} y={(selElemento.y1 + selElemento.y2) / 2 * scale - 4} text={`${d.L.toFixed(2)} m`} />; })()}

            {/* overlay de captura en modos de dibujo */}
            {modo !== 'sel' && <rect x={0} y={0} width={VBW} height={VBH} fill="#000" fillOpacity={0} style={{ pointerEvents: 'all', cursor: 'crosshair' }} onMouseMove={(e) => setCursor(metros(e))} onMouseDown={(e) => void lienzoDown(e)} onDoubleClick={() => { if (modo === 'habitacion') void cerrarHabitacion(); }} />}
          </svg>
          <p style={{ fontSize: 12, color: '#888', padding: '0 0.75rem 0.5rem' }}>Nivel: <strong>{etiquetaNivel(capa)}</strong> · huella {footAncho.toFixed(1)}×{footAlto.toFixed(1)} m · 1 cuadro = 1 m. Dibuja muros/puertas/ventanas (puertas y ventanas = huecos) o una habitación poligonal; en Seleccionar arrastra áreas/objetos y los <strong>extremos</strong> de un muro seleccionado.</p>
        </div>

        {/* Panel */}
        <div style={{ border: '1px solid #ddd', borderRadius: 10, padding: '0.75rem', background: '#fafafa', minHeight: 200 }}>
          {!sel && <p style={{ color: '#666', fontSize: 13 }}>Selecciona un elemento en el lienzo para editar su ficha.<br />Lente activa: <strong style={{ color: lente.color }}>{lente.etiqueta}</strong>.</p>}
          {selEspacio && <FichaEspacio key={selEspacio.id} espacio={selEspacio} ucs={ucs} lenteId={lenteId} onCambio={cargar} onEliminar={async () => { await eliminarEspacio(selEspacio.id); setSel(null); cargar(); }} />}
          {selObjeto && <FichaObjeto key={selObjeto.id} objeto={selObjeto} espacios={espacios} lenteId={lenteId} proyectoId={proyectoId} tieneModelo={conModelo.has(selObjeto.id)} onCambio={cargar} onEliminar={async () => { await eliminarObjeto(selObjeto.id); setSel(null); cargar(); }} />}
          {selElemento && (
            <div>
              <strong style={{ fontSize: 14 }}>{ESTILO_ELEMENTO[selElemento.tipo].label}</strong>
              <p style={{ fontSize: 13, color: '#666', margin: '0.3rem 0' }}>Longitud: <strong>{Math.hypot(selElemento.x2 - selElemento.x1, selElemento.y2 - selElemento.y1).toFixed(2)} m</strong> · arrastra los círculos naranjas para editar sus extremos.</p>
              <button style={{ ...btn, color: '#a00' }} onClick={async () => { await eliminarElemento(selElemento.id); setSel(null); cargar(); }}>Eliminar {ESTILO_ELEMENTO[selElemento.tipo].label.toLowerCase()}</button>
            </div>
          )}
          <div style={{ marginTop: '1rem', borderTop: '1px solid #e3e3e3', paddingTop: '0.5rem', fontSize: 13 }}>
            <strong>💰 Costeo de la sede</strong>
            <div style={{ color: '#2e9e63', fontSize: 18, fontWeight: 'bold' }}>${costeo.total.toLocaleString()}</div>
            <div style={{ color: '#777', fontSize: 12 }}>objetos ${costeo.objetos.toLocaleString()} · espacios ${costeo.espacios.toLocaleString()}</div>
          </div>
        </div>
      </div>
      </>)}
    </section>
  );
}

// --- ficha de un espacio ---
function FichaEspacio({ espacio, ucs, lenteId, onCambio, onEliminar }: { espacio: Espacio; ucs: UnidadComercial[]; lenteId: LenteId; onCambio: () => void; onEliminar: () => void }) {
  const lente = getLente(lenteId);
  const [ucIds, setUcIds] = useState<string[]>(espacio.ucIds);
  const esPoligono = !!(espacio.poligono && espacio.poligono.length >= 3);
  return (
    <div>
      <strong style={{ fontSize: 14 }}>Espacio {esPoligono ? '(polígono)' : ''}</strong>
      <label style={lbl}>Nombre</label>
      <input style={inp} defaultValue={espacio.nombre} onBlur={(e) => { if (e.target.value !== espacio.nombre) void actualizarEspacio(espacio.id, { nombre: e.target.value }).then(onCambio); }} />
      <label style={lbl}>Tipo</label>
      <select style={inp} defaultValue={espacio.tipo} onChange={(e) => void actualizarEspacio(espacio.id, { tipo: e.target.value as TipoEspacio }).then(onCambio)}>
        {TIPOS_ESPACIO.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      {esPoligono
        ? <div style={{ fontSize: 12, color: '#777', marginTop: '0.4rem' }}>Polígono de {espacio.poligono!.length} vértices · bbox {espacio.ancho}×{espacio.alto} m (arrastra la habitación para moverla).</div>
        : <div style={{ display: 'flex', gap: '0.4rem' }}>
            <div style={{ flex: 1 }}><label style={lbl}>Ancho (m)</label><input style={inp} type="number" defaultValue={espacio.ancho} onBlur={(e) => void actualizarEspacio(espacio.id, { ancho: Number(e.target.value) || espacio.ancho }).then(onCambio)} /></div>
            <div style={{ flex: 1 }}><label style={lbl}>Alto (m)</label><input style={inp} type="number" defaultValue={espacio.alto} onBlur={(e) => void actualizarEspacio(espacio.id, { alto: Number(e.target.value) || espacio.alto }).then(onCambio)} /></div>
          </div>}
      <Giro rot={espacio.rot} onCambio={(rot) => void actualizarEspacio(espacio.id, { rot }).then(onCambio)} />
      <label style={lbl}>Unidades Comerciales asignadas</label>
      {ucs.length === 0 && <div style={{ fontSize: 12, color: '#999' }}>(crea UCs en el proyecto)</div>}
      {ucs.map((uc) => (
        <label key={uc.id} style={{ display: 'block', fontSize: 13 }}>
          <input type="checkbox" checked={ucIds.includes(uc.id)} onChange={(e) => { const next = e.target.checked ? [...ucIds, uc.id] : ucIds.filter((x) => x !== uc.id); setUcIds(next); void actualizarEspacio(espacio.id, { ucIds: next }).then(onCambio); }} /> {uc.nombre}
        </label>
      ))}
      <CamposLente elementoData={espacio.data} soloObjeto={false} lenteId={lenteId} onGuardar={(campos) => void actualizarEspacio(espacio.id, { campos }).then(onCambio)} />
      <button style={{ ...btn, color: '#a00', marginTop: '0.6rem' }} onClick={onEliminar}>Eliminar espacio</button>
      <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Lente: <span style={{ color: lente.color }}>{lente.etiqueta}</span></div>
    </div>
  );
}

// --- ficha de un objeto ---
function FichaObjeto({ objeto, espacios, lenteId, proyectoId, tieneModelo, onCambio, onEliminar }: { objeto: ObjetoFisico; espacios: Espacio[]; lenteId: LenteId; proyectoId: string; tieneModelo: boolean; onCambio: () => void; onEliminar: () => void }) {
  const lente = getLente(lenteId);
  const glbRef = useRef<HTMLInputElement | null>(null);
  const [msgGlb, setMsgGlb] = useState('');

  async function subirGlb(f: File) {
    if (f.size > MAX_GLB_BYTES) { setMsgGlb(`Pesa ${(f.size / 1024 / 1024).toFixed(1)} MB; máximo 25 MB. Exporta con menos resolución.`); return; }
    setMsgGlb('Subiendo escaneo…');
    const b64 = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(',')[1] ?? '');
      fr.onerror = rej;
      fr.readAsDataURL(f);
    });
    const r = await subirModelo3D(proyectoId, objeto.id, f.name.replace(/\.[^.]+$/, ''), b64);
    setMsgGlb(r.ok ? 'Escaneo guardado: en la vista 3D este objeto ya se ve real.' : r.error);
    if (r.ok) onCambio();
  }
  return (
    <div>
      <strong style={{ fontSize: 14 }}>Objeto físico</strong>
      <label style={lbl}>Nombre</label>
      <input style={inp} defaultValue={objeto.nombre} onBlur={(e) => { if (e.target.value !== objeto.nombre) void actualizarObjeto(objeto.id, { nombre: e.target.value }).then(onCambio); }} />
      <label style={lbl}>Categoría</label>
      <select style={inp} defaultValue={objeto.categoria} onChange={(e) => void actualizarObjeto(objeto.id, { categoria: e.target.value as CategoriaObjeto }).then(onCambio)}>
        {CATEGORIAS_OBJETO.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <label style={lbl}>Está en el espacio</label>
      <select style={inp} defaultValue={objeto.espacioId} onChange={(e) => void actualizarObjeto(objeto.id, { espacioId: e.target.value }).then(onCambio)}>
        {espacios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select>
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <div style={{ flex: 1 }}><label style={lbl}>Ancho (m)</label><input style={inp} type="number" defaultValue={objeto.ancho} onBlur={(e) => void actualizarObjeto(objeto.id, { ancho: Number(e.target.value) || objeto.ancho }).then(onCambio)} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>Alto (m)</label><input style={inp} type="number" defaultValue={objeto.alto} onBlur={(e) => void actualizarObjeto(objeto.id, { alto: Number(e.target.value) || objeto.alto }).then(onCambio)} /></div>
      </div>
      <Giro rot={objeto.rot} onCambio={(rot) => void actualizarObjeto(objeto.id, { rot }).then(onCambio)} />

      {/* Escaneo 3D real del objeto (LiDAR/fotogrametría del teléfono → .glb) */}
      <label style={lbl}>🧊 Modelo 3D real {tieneModelo && <span style={{ color: '#2e9e63' }}>✓ tiene escaneo</span>}</label>
      <input ref={glbRef} type="file" accept=".glb,model/gltf-binary" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirGlb(f); e.target.value = ''; }} />
      <div style={{ display: 'flex', gap: 4 }}>
        <button style={btn} onClick={() => glbRef.current?.click()}>⬆ Subir escaneo (.glb)</button>
        {tieneModelo && <button style={{ ...btn, color: '#b33' }} onClick={() => void eliminarModelo3D(objeto.id).then(() => { setMsgGlb('Escaneo eliminado.'); onCambio(); })}>×</button>}
      </div>
      <p style={{ fontSize: 10.5, color: msgGlb.includes('guardado') ? '#2e9e63' : '#8a6d3b', margin: '2px 0 0' }}>
        {msgGlb || 'Sube un ".glb" de cualquiera de estas fuentes: (1) escaneo del objeto REAL con Polycam/Scaniverse (LiDAR o fotos); (2) si AÚN NO LO TIENES: descárgalo gratis de poly.pizza o sketchfab.com, o genéralo por IA con meshy.ai/tripo3d.ai escribiendo qué es. Sin GLB, la vista 3D usa una forma genérica según el nombre (camilla, silla, mostrador…).'}
      </p>

      <CamposLente elementoData={objeto.data} soloObjeto lenteId={lenteId} onGuardar={(campos) => void actualizarObjeto(objeto.id, { campos }).then(onCambio)} />
      <button style={{ ...btn, color: '#a00', marginTop: '0.6rem' }} onClick={onEliminar}>Eliminar objeto</button>
      <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Lente: <span style={{ color: lente.color }}>{lente.etiqueta}</span></div>
    </div>
  );
}

// --- control de giro (numérico + atajos) ---
function Giro({ rot, onCambio }: { rot: number; onCambio: (rot: number) => void }) {
  const set = (g: number) => onCambio(normalizarGrados(Math.round(g)));
  return (
    <>
      <label style={lbl}>Giro (°)</label>
      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
        <input style={{ ...inp, flex: 1 }} type="number" value={Math.round(rot)}
          onChange={(e) => set(Number(e.target.value) || 0)} />
        <button style={btn} title="Girar 90° a la izquierda" onClick={() => set(rot - 90)}>↺</button>
        <button style={btn} title="Girar 90° a la derecha" onClick={() => set(rot + 90)}>↻</button>
        <button style={btn} title="Volver a 0°" onClick={() => set(0)}>⌐</button>
      </div>
      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>También puedes arrastrar la manija morada del lienzo (Shift = imantar a 15°).</div>
    </>
  );
}

// --- campos de la lente activa ---
function CamposLente({ elementoData, soloObjeto, lenteId, onGuardar }: { elementoData: Record<string, string>; soloObjeto: boolean; lenteId: LenteId; onGuardar: (campos: Record<string, string>) => void }) {
  const lente = getLente(lenteId);
  const campos = lente.campos.filter((c) => soloObjeto || !c.soloObjeto);
  if (campos.length === 0) return null;
  return (
    <div style={{ marginTop: '0.6rem', borderTop: `2px solid ${lente.color}`, paddingTop: '0.4rem' }}>
      <div style={{ fontSize: 12, fontWeight: 'bold', color: lente.color }}>{lente.etiqueta}</div>
      {campos.map((c) => (
        <div key={c.id}>
          <label style={lbl}>{c.label}</label>
          {c.tipo === 'opcion' ? (
            <select style={inp} defaultValue={elementoData[c.id] ?? ''} onChange={(e) => onGuardar({ [c.id]: e.target.value })}>
              <option value="">—</option>
              {(c.opciones ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : c.tipo === 'parrafo' ? (
            <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={elementoData[c.id] ?? ''} onBlur={(e) => { if (e.target.value !== (elementoData[c.id] ?? '')) onGuardar({ [c.id]: e.target.value }); }} />
          ) : (
            <input style={inp} type={c.tipo === 'numero' ? 'number' : 'text'} defaultValue={elementoData[c.id] ?? ''} onBlur={(e) => { if (e.target.value !== (elementoData[c.id] ?? '')) onGuardar({ [c.id]: e.target.value }); }} />
          )}
        </div>
      ))}
    </div>
  );
}
