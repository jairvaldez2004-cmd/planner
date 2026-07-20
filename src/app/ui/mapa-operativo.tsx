'use client';

// MAPA OPERATIVO V2 — flujo cronológico estilo n8n (ADITIVO). Ref: domain/mapa.ts.
//   · CADA FASE (Antes · Durante · Después) es una PÁGINA ENTERA con canvas libre.
//   · El DEPARTAMENTO es una ETIQUETA del proceso (color + chip), no un contenedor:
//     el flujo es UNO solo — Dirección abre, Marketing da de alta, Dirección revisa…
//   · Nodos con posición libre (arrastrables) · flecha = rama por disparador (bifurcable).
//   · Conexiones ENTRE FASES: portales clicables en el nodo (⤷ salida / ⤶ entrada).
//   · Numeración cronológica global siguiendo las flechas: ▶ #1 = el primer paso de todos.
//   · Lentes: general/instructivo/roles/espacios/herramientas/tiempos.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as RPointerEvent } from 'react';
import {
  listarDepartamentos, crearDepartamento, actualizarDepartamento, eliminarDepartamento,
  listarProcesos, crearProceso, actualizarProceso, eliminarProceso,
  importarRutasCatalogo, listarRecursosProyecto, crearRolMaestro, crearHerramientaMaestro,
} from '@/app/actions/mapa.actions';
import type { RecursosProyecto } from '@/app/actions/mapa.actions';
import { obtenerProyectoBase } from '@/app/actions/workspace.actions';
import { FASES_MAPA, VISTAS_MAPA, ETAPA_BASE, colorDepto, ordenCronologico, recursosCompartidos, vigenteEn, naceEn, seRetiraEn, procesosDeEtapa, nEtapa } from '@/domain/mapa';
import type { AsignacionRecurso, Departamento, FaseMapa, ProcesoNodo, VistaMapa } from '@/domain/mapa';
import { ETAPAS_OBJETIVO, etapaInfo } from '@/domain/etapas';
import type { EtapaObjetivo } from '@/domain/etapas';
import { InstructivoMapa } from './instructivo-mapa';
import { AgendaRecursos } from './agenda-recursos';
import { useEsMovil } from './use-movil';

const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };
const btnSm: CSSProperties = { ...btn, padding: '0.15rem 0.5rem', fontSize: 12 };
const inp: CSSProperties = { padding: '0.35rem 0.55rem', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const lbl: CSSProperties = { display: 'block', fontSize: 11, color: '#666', marginTop: '0.5rem', fontWeight: 'bold' };
const tag: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eef2fb', border: '1px solid #cdd8ef', borderRadius: 12, padding: '0.1rem 0.5rem', fontSize: 12, margin: '2px 3px 0 0' };

const ANCHO_NODO = 200;

interface Props { proyectoId: string; onVolver: () => void; onIrSedes: () => void; nombreProyecto?: string }

type Rect = { x: number; y: number; w: number; h: number };

// `etapaHasta: null` = quitar la jubilación (vuelve a ser vigente para siempre).
type PatchProceso = Partial<Omit<ProcesoNodo, 'etapaHasta'>> & { etapaHasta?: EtapaObjetivo | null | undefined };

export function MapaOperativo({ proyectoId, onVolver, onIrSedes, nombreProyecto }: Props) {
  const [deptos, setDeptos] = useState<Departamento[]>([]);
  const [procesos, setProcesos] = useState<ProcesoNodo[]>([]);
  const [recursos, setRecursos] = useState<RecursosProyecto>({ espacios: [], roles: [], herramientas: [] });
  const [loading, setLoading] = useState(true);
  const [fase, setFase] = useState<FaseMapa>('antes');
  const [etapa, setEtapa] = useState<EtapaObjetivo>(ETAPA_BASE);   // etapa que se está viendo
  const [etapaMeta, setEtapaMeta] = useState<EtapaObjetivo | null>(null); // etapa objetivo del negocio
  const [vista, setVista] = useState<VistaMapa>('general');
  const [selProc, setSelProc] = useState<string | null>(null);
  const [selDepto, setSelDepto] = useState<string | null>(null);
  const [nuevoDepto, setNuevoDepto] = useState('');
  const [panel, setPanel] = useState<'mapa' | 'instructivo' | 'agenda'>('mapa');
  const [msg, setMsg] = useState('');
  const movil = useEsMovil();

  // drag de nodos (posición libre)
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  // refs de tarjetas para dibujar flechas
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const [rects, setRects] = useState<Record<string, Rect>>({});

  const cargar = () => {
    setLoading(true);
    Promise.all([listarDepartamentos(proyectoId), listarProcesos(proyectoId), listarRecursosProyecto(proyectoId), obtenerProyectoBase(proyectoId)])
      .then(([d, p, r, base]) => { setDeptos(d); setProcesos(p); setRecursos(r); setEtapaMeta(base?.etapaObjetivo ?? null); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [proyectoId]);

  const medir = () => {
    const cont = canvasRef.current; if (!cont) return;
    const cr = cont.getBoundingClientRect();
    const out: Record<string, Rect> = {};
    for (const [id, el] of cardRefs.current) {
      if (!el.isConnected) continue;
      const r = el.getBoundingClientRect();
      out[id] = { x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height };
    }
    setRects(out);
  };
  useLayoutEffect(() => { medir(); /* eslint-disable-next-line */ }, [procesos, deptos, vista, fase, loading]);
  useEffect(() => {
    const h = () => medir();
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const proc = procesos.find((p) => p.id === selProc) ?? null;
  const depto = deptos.find((d) => d.id === selDepto) ?? null;
  const compartidos = recursosCompartidos(deptos);
  // El mapa de una etapa = lo acumulado hasta ella (herencia). La numeración cronológica
  // se calcula SOLO sobre lo vigente, para que cada etapa tenga su propio "primer paso".
  const vigentes = procesosDeEtapa(procesos, etapa);
  const numeracion = ordenCronologico(vigentes);
  const byId = new Map(procesos.map((p) => [p.id, p]));
  const colorDe = (deptoId: string) => { const i = deptos.findIndex((d) => d.id === deptoId); return i >= 0 ? colorDepto(deptos[i]!, i) : '#888'; };
  const deptoNombre = (id: string) => deptos.find((d) => d.id === id)?.nombre ?? '?';
  const enFase = vigentes.filter((p) => p.fase === fase);

  // entrantes desde OTRAS fases (misma etapa) hacia nodos de esta página (portales de entrada)
  const entrantesDe = (destId: string) => vigentes
    .filter((p) => p.fase !== fase)
    .flatMap((p) => p.ramas.filter((r) => r.destinoProcesoId === destId).map((r) => ({ desde: p, evento: r.evento })));

  // Ramas que apuntan a un proceso que TODAVÍA NO NACE en esta etapa: el trabajo de hoy
  // que alimenta una etapa futura (ej. guardar la factura hoy → contabilidad en la etapa 2).
  const salientesFuturas = (p: ProcesoNodo) => p.ramas
    .map((r) => ({ r, dest: r.destinoProcesoId ? byId.get(r.destinoProcesoId) : undefined }))
    .filter((x): x is { r: typeof x.r; dest: ProcesoNodo } => !!x.dest && !vigenteEn(x.dest, etapa) && nEtapa(x.dest.etapaDesde) > nEtapa(etapa));

  function patchLocal(id: string, patch: Partial<ProcesoNodo>) {
    setProcesos((ps) => ps.map((p) => p.id === id ? { ...p, ...patch } : p));
  }
  function guardar(id: string, patch: PatchProceso) {
    const { etapaHasta, ...resto } = patch;
    const local: Partial<ProcesoNodo> = etapaHasta !== undefined ? { ...resto, etapaHasta: etapaHasta ?? undefined } : resto;
    patchLocal(id, local);
    void actualizarProceso(id, patch);
  }

  async function altaProceso(x?: number, y?: number) {
    const nombre = window.prompt('Nombre del proceso:');
    if (!nombre?.trim()) return;
    const admin = deptos.find((d) => d.tipo === 'admin') ?? deptos[0];
    if (!admin) return;
    const nuevo = await crearProceso(proyectoId, admin.id, nombre.trim(), fase, x !== undefined && y !== undefined ? { x, y } : undefined, etapa);
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
    const r = await importarRutasCatalogo(proyectoId, etapa);
    setMsg(`Catálogo → mapa: ${r.creados} procesos creados${r.omitidos ? `, ${r.omitidos} ya estaban` : ''}.`);
    cargar();
  }

  // --- drag de nodos ---
  function onNodoPointerDown(e: RPointerEvent<HTMLDivElement>, p: ProcesoNodo) {
    const t = e.target as HTMLElement;
    if (t.closest('button,input,select,textarea,a,[data-portal]')) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragRef.current = { id: p.id, sx: e.clientX, sy: e.clientY, ox: p.posX ?? 40, oy: p.posY ?? 40, moved: false };
  }
  function onNodoPointerMove(e: RPointerEvent<HTMLDivElement>) {
    const d = dragRef.current; if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    d.moved = true;
    patchLocal(d.id, { posX: Math.max(0, d.ox + dx), posY: Math.max(0, d.oy + dy) });
  }
  function onNodoPointerUp(e: RPointerEvent<HTMLDivElement>) {
    const d = dragRef.current; dragRef.current = null;
    if (!d) return;
    const p = procesos.find((x) => x.id === d.id);
    if (d.moved && p) void actualizarProceso(d.id, { posX: p.posX, posY: p.posY });
    if (!d.moved) { setSelProc(d.id); setSelDepto(null); }
    void e;
  }

  // --- flechas dentro de la fase actual ---
  const edges: { from: Rect; to: Rect; evento: string; key: string }[] = [];
  for (const p of enFase) {
    const from = rects[p.id]; if (!from) continue;
    for (const r of p.ramas) {
      if (!r.destinoProcesoId) continue;
      const dest = byId.get(r.destinoProcesoId);
      // cross-fase o de otra etapa = portal, no flecha
      if (!dest || dest.fase !== fase || !vigenteEn(dest, etapa)) continue;
      const to = rects[r.destinoProcesoId]; if (!to) continue;
      edges.push({ from, to, evento: r.evento, key: `${p.id}-${r.id}` });
    }
  }

  // tamaño del canvas según nodos
  const maxX = Math.max(760, ...enFase.map((p) => (p.posX ?? 40) + ANCHO_NODO + 80));
  const maxY = Math.max(480, ...enFase.map((p) => (p.posY ?? 40) + 220));

  function lenteCard(p: ProcesoNodo): string {
    if (vista === 'instructivo') return p.instructivo ? p.instructivo.slice(0, 60) : (p.entrada || p.salida ? `${p.entrada ?? '—'} → ${p.salida ?? '—'}` : 'sin instructivo');
    if (vista === 'roles') return p.roles.length ? p.roles.join(' · ') : 'sin rol';
    if (vista === 'espacios') return p.espacios.length ? p.espacios.map((e) => e.nombre + (e.horario ? ` (${e.horario})` : '')).join(' · ') : 'sin espacio';
    if (vista === 'herramientas') return p.herramientas.length ? p.herramientas.join(' · ') : 'sin herramientas';
    if (vista === 'tiempos') return p.tiempoMin ? `${p.tiempoMin} min` : 'sin tiempo';
    return p.descripcion ? p.descripcion.slice(0, 50) : '';
  }

  const faseLabel = (f: FaseMapa) => FASES_MAPA.find((x) => x.id === f)?.label ?? f;
  const cuentaFase = (f: FaseMapa) => vigentes.filter((p) => p.fase === f).length;
  const etapaLabel = (e: EtapaObjetivo) => etapaInfo(e)?.label ?? e;
  const etapaN = (e: EtapaObjetivo) => nEtapa(e);
  // por etapa: cuántos procesos hay vigentes (acumulado) y cuántos nacen ahí (lo nuevo)
  const cuentaEtapa = (e: EtapaObjetivo) => ({
    total: procesosDeEtapa(procesos, e).length,
    nuevos: procesos.filter((p) => p.etapaDesde === e).length,
  });
  const info = etapaInfo(etapa);
  const heredados = vigentes.filter((p) => !naceEn(p, etapa)).length;
  const nuevosAqui = vigentes.filter((p) => naceEn(p, etapa)).length;

  // Vistas derivadas del mismo mapa (documento imprimible / agenda de recursos).
  if (panel === 'instructivo') {
    return <InstructivoMapa procesos={procesos} deptos={deptos} etapa={etapa} nombreProyecto={nombreProyecto} onCerrar={() => setPanel('mapa')} />;
  }
  if (panel === 'agenda') {
    return <AgendaRecursos procesos={procesos} deptos={deptos} etapa={etapa}
      onCerrar={() => setPanel('mapa')}
      onIrProceso={(id) => { const p = procesos.find((x) => x.id === id); if (p) { setFase(p.fase); setSelProc(id); } setPanel('mapa'); }} />;
  }

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>🗺️ Mapa Operativo <span style={{ fontSize: 13, color: '#888' }}>· {nombreProyecto ?? 'proyecto'} · un solo flujo cronológico</span></h2>
        <button style={btn} onClick={onVolver}>← Proyecto</button>
      </div>

      {/* ETAPAS de la ruta — cada una es SU mapa (acumulativo: hereda las anteriores) */}
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', margin: '0.6rem 0 0.3rem' }}>
        {ETAPAS_OBJETIVO.map((e) => {
          const c = cuentaEtapa(e.id);
          const act = etapa === e.id;
          const meta = etapaMeta === e.id;
          return (
            <button key={e.id} onClick={() => { setEtapa(e.id); setSelProc(null); }}
              title={`${e.descripcion}${meta ? ' · etapa objetivo del negocio' : ''}`}
              style={{ ...btn, flex: '1 1 130px', padding: '0.4rem 0.5rem', textAlign: 'left', lineHeight: 1.25,
                background: act ? '#7a4fbf' : '#fff', color: act ? '#fff' : '#4a3a63',
                borderColor: act ? '#7a4fbf' : (meta ? '#c3a8e6' : '#d5cde2'),
                borderWidth: meta && !act ? 2 : 1 }}>
              <div style={{ fontSize: 12, fontWeight: 'bold' }}>{meta ? '🎯 ' : ''}{e.n}. {e.label}</div>
              <div style={{ fontSize: 10, opacity: 0.8 }}>{c.total} vigentes{c.nuevos ? ` · +${c.nuevos} nuevos` : ''}</div>
            </button>
          );
        })}
      </div>
      {info && (
        <p style={{ fontSize: 11.5, color: '#6b5a85', margin: '0 0 0.4rem', background: '#f6f2fb', border: '1px solid #e6dcf3', borderRadius: 7, padding: '0.35rem 0.55rem' }}>
          <strong>Etapa {info.n} · {info.label}</strong> — {info.descripcion}{' '}
          {etapaN(etapa) > 1
            ? <>Ves <strong>{heredados}</strong> procesos heredados de etapas anteriores (atenuados) + <strong>{nuevosAqui}</strong> que nacen aquí. Lo que crees ahora nace en esta etapa.</>
            : <>Es la operación base: todo lo que crees aquí seguirá vigente en las etapas siguientes.</>}
        </p>
      )}

      {/* PÁGINAS por fase */}
      <div style={{ display: 'flex', gap: '0.4rem', margin: '0.6rem 0 0.35rem' }}>
        {FASES_MAPA.map((f) => (
          <button key={f.id} onClick={() => { setFase(f.id); setSelProc(null); }}
            style={{ ...btn, flex: 1, padding: '0.55rem 0.6rem', fontWeight: 'bold',
              background: fase === f.id ? '#33415c' : '#fff', color: fase === f.id ? '#fff' : '#33415c',
              borderColor: fase === f.id ? '#33415c' : '#c5cbd8' }}>
            {f.label} <span style={{ fontWeight: 'normal', opacity: 0.75 }}>({cuentaFase(f.id)})</span>
          </button>
        ))}
      </div>

      {/* barra: lentes + etiquetas de departamento + acciones */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', margin: '0.35rem 0' }}>
        {VISTAS_MAPA.map((v) => (
          <button key={v.id} style={{ ...btnSm, background: vista === v.id ? '#5b6b8c' : '#fff', color: vista === v.id ? '#fff' : '#333', borderColor: vista === v.id ? '#5b6b8c' : '#bbb' }} onClick={() => setVista(v.id)}>{v.label}</button>
        ))}
        <span style={{ flex: 1 }} />
        <button style={btnSm} onClick={() => void altaProceso()}>＋ Proceso</button>
        <button style={btnSm} onClick={() => setPanel('instructivo')} title="Documento imprimible con el paso a paso de esta etapa">🖨️ Instructivo</button>
        <button style={btnSm} onClick={() => setPanel('agenda')} title="Semana de los recursos compartidos y sus choques">🗓️ Agenda</button>
        <button style={btnSm} onClick={() => void importar()} title="Siembra en el mapa los pasos de las rutas del catálogo">⬇ Importar catálogo</button>
      </div>

      {/* etiquetas de departamento */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', margin: '0.2rem 0 0.5rem' }}>
        <span style={{ fontSize: 11, color: '#888', fontWeight: 'bold' }}>Departamentos (etiquetas):</span>
        {deptos.map((d, i) => (
          <span key={d.id} onClick={() => { setSelDepto(d.id); setSelProc(null); }}
            style={{ ...tag, cursor: 'pointer', borderColor: colorDepto(d, i), background: selDepto === d.id ? colorDepto(d, i) : '#fff', color: selDepto === d.id ? '#fff' : colorDepto(d, i), fontWeight: 'bold' }}>
            {d.nombre}
          </span>
        ))}
        <input style={{ ...inp, width: 150, fontSize: 12, padding: '0.2rem 0.45rem' }} placeholder="＋ nuevo departamento…" value={nuevoDepto} onChange={(e) => setNuevoDepto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void altaDepto(); }} />
        {nuevoDepto.trim() && <button style={btnSm} onClick={() => void altaDepto()}>＋</button>}
      </div>

      {msg && <p style={{ fontSize: 12, color: '#2b5a97', margin: '0 0 0.4rem' }}>{msg}</p>}
      {loading && <p style={{ color: '#666' }}>Cargando…</p>}

      <div style={{ display: 'grid', gridTemplateColumns: movil || !(proc || depto) ? '1fr' : 'minmax(0, 1fr) 330px', gap: '0.75rem', alignItems: 'start' }}>
        {/* ==== CANVAS DE LA FASE ==== */}
        <div style={{ border: '1px solid #ddd', borderRadius: 10, background: '#fcfcfd', overflow: 'auto', maxHeight: '74vh' }}>
          <div ref={canvasRef}
            onDoubleClick={(e) => {
              if (e.target !== e.currentTarget) return;
              const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              void altaProceso(e.clientX - r.left - ANCHO_NODO / 2, e.clientY - r.top - 20);
            }}
            style={{ position: 'relative', width: maxX, height: maxY,
              backgroundImage: 'radial-gradient(#e6e8ee 1px, transparent 1px)', backgroundSize: '22px 22px' }}>

            {/* flechas de la fase */}
            <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }} width={maxX} height={maxY}>
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
                  : `M ${x1} ${y1} C ${x1} ${y1 + 26}, ${x2} ${y2 - 26}, ${x2} ${y2}`;
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

            {/* nodos */}
            {enFase.map((p) => {
              const color = colorDe(p.departamentoId);
              const n = numeracion.get(p.id);
              const entrantes = entrantesDe(p.id);
              const salientesCrossFase = p.ramas.filter((r) => { const d = r.destinoProcesoId ? byId.get(r.destinoProcesoId) : undefined; return d && vigenteEn(d, etapa) && d.fase !== fase; });
              const futuras = salientesFuturas(p);
              const bifurca = p.ramas.filter((r) => r.destinoProcesoId).length > 1;
              const nuevo = naceEn(p, etapa);
              const seRetira = seRetiraEn(p, etapa);
              return (
                <div key={p.id}
                  ref={(el) => { if (el) cardRefs.current.set(p.id, el); else cardRefs.current.delete(p.id); }}
                  onPointerDown={(e) => onNodoPointerDown(e, p)}
                  onPointerMove={onNodoPointerMove}
                  onPointerUp={onNodoPointerUp}
                  style={{ position: 'absolute', left: p.posX ?? 40, top: p.posY ?? 40, width: ANCHO_NODO, zIndex: selProc === p.id ? 3 : 2,
                    // heredado de una etapa anterior = atenuado y punteado; lo que nace aquí resalta
                    border: `1.5px ${nuevo ? 'solid' : 'dashed'} ${selProc === p.id ? color : (nuevo ? '#c9cfdd' : '#dfe3ea')}`,
                    borderTop: `4px solid ${seRetira ? '#c0392b' : color}`,
                    opacity: nuevo ? 1 : 0.72,
                    borderRadius: 9, background: '#fff', padding: '0.35rem 0.5rem', cursor: 'grab', touchAction: 'none',
                    boxShadow: selProc === p.id ? `0 0 0 2px ${color}33` : '0 1px 3px rgba(0,0,0,0.07)' }}>
                  {/* portales de ENTRADA desde otras fases */}
                  {entrantes.map((x, i) => (
                    <div key={i} data-portal onClick={() => { setFase(x.desde.fase); setSelProc(x.desde.id); }}
                      style={{ fontSize: 10, color: '#2b5a97', cursor: 'pointer', marginBottom: 2 }}
                      title={`Viene de ${faseLabel(x.desde.fase)} · clic para ir`}>
                      ⤶ {x.desde.nombre}{x.evento && x.evento !== 'continúa' ? ` (${x.evento})` : ''} · {faseLabel(x.desde.fase).split(' ·')[0]}
                    </div>
                  ))}
                  <div style={{ fontSize: 12.5, fontWeight: 'bold', color: '#222', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {n !== undefined && <span style={{ background: n === 1 ? '#2e9e63' : '#5b6b8c', color: '#fff', borderRadius: 9, fontSize: 10, padding: '0 5px', flexShrink: 0 }}>{n === 1 ? '▶ 1' : n}</span>}
                    <span style={{ flex: 1, textDecoration: seRetira ? 'line-through' : 'none' }}>{p.nombre}</span>
                    {bifurca && <span title="Se divide en caminos por disparador" style={{ color: '#b06be0' }}>⑂</span>}
                    {p.origen && <span title="Sembrado desde el catálogo">🧬</span>}
                  </div>
                  <div style={{ fontSize: 10, marginTop: 1, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ color, fontWeight: 'bold' }}>{deptoNombre(p.departamentoId)}</span>
                    {nuevo && etapaN(etapa) > 1 && <span style={{ background: '#7a4fbf', color: '#fff', borderRadius: 8, padding: '0 5px', fontSize: 9 }}>NUEVO E{etapaN(etapa)}</span>}
                    {!nuevo && (
                      <span onClick={(ev) => { ev.stopPropagation(); setEtapa(p.etapaDesde); }} data-portal
                        title={`Nació en la etapa ${etapaN(p.etapaDesde)} · ${etapaLabel(p.etapaDesde)} — clic para ir`}
                        style={{ color: '#8a93a8', cursor: 'pointer', fontSize: 9 }}>desde E{etapaN(p.etapaDesde)}</span>
                    )}
                    {seRetira && <span title="Se retira al pasar a la siguiente etapa" style={{ background: '#c0392b', color: '#fff', borderRadius: 8, padding: '0 5px', fontSize: 9 }}>⊘ último uso</span>}
                  </div>
                  {lenteCard(p) && <div style={{ fontSize: 11, color: '#777', marginTop: 1 }}>{lenteCard(p)}</div>}
                  {/* portales de SALIDA hacia otras fases */}
                  {salientesCrossFase.map((r) => {
                    const dest = byId.get(r.destinoProcesoId!)!;
                    return (
                      <div key={r.id} data-portal onClick={() => { setFase(dest.fase); setSelProc(dest.id); }}
                        style={{ fontSize: 10, color: '#7a4fbf', cursor: 'pointer', marginTop: 2 }}
                        title={`Sigue en ${faseLabel(dest.fase)} · clic para ir`}>
                        ⤷ {r.evento && r.evento !== 'continúa' ? `${r.evento} → ` : '→ '}{dest.nombre} · {faseLabel(dest.fase).split(' ·')[0]}
                      </div>
                    );
                  })}
                  {/* portales hacia ETAPAS FUTURAS: lo que se hace hoy para habilitar el mañana */}
                  {futuras.map(({ r, dest }) => (
                    <div key={r.id} data-portal onClick={() => { setEtapa(dest.etapaDesde); setFase(dest.fase); setSelProc(dest.id); }}
                      style={{ fontSize: 10, color: '#7a4fbf', cursor: 'pointer', marginTop: 2, background: '#f6f2fb', borderRadius: 5, padding: '1px 4px' }}
                      title={`Alimenta la etapa ${etapaN(dest.etapaDesde)} (${etapaLabel(dest.etapaDesde)}) · clic para ir`}>
                      ⏭ alimenta <strong>E{etapaN(dest.etapaDesde)}</strong> · {dest.nombre}{r.evento && r.evento !== 'continúa' ? ` (${r.evento})` : ''}
                    </div>
                  ))}
                </div>
              );
            })}

            {!loading && enFase.length === 0 && (
              <p style={{ position: 'absolute', top: 24, left: 24, color: '#999', fontSize: 13 }}>
                Página vacía en la etapa {etapaN(etapa)}. Doble clic en el lienzo (o ＋ Proceso) para crear el primer proceso de esta fase.
              </p>
            )}
          </div>
          <p style={{ fontSize: 11, color: '#999', padding: '0.4rem 0.6rem', margin: 0, borderTop: '1px solid #eee' }}>
            Doble clic = nuevo proceso (nace en la etapa {etapaN(etapa)}) · arrastra los nodos · clic = editar · <span style={{ color: '#2e9e63', fontWeight: 'bold' }}>▶ 1</span> = primer paso de todos · ⑂ = se divide por disparador · ⤶/⤷ = viene de / sigue en otra fase · <span style={{ color: '#7a4fbf' }}>⏭</span> = alimenta una etapa futura · nodo punteado y atenuado = heredado de una etapa anterior · 🧬 = del catálogo.
          </p>
        </div>

        {/* ==== PANEL PROCESO ==== */}
        {proc && (
          <PanelProceso key={proc.id} proyectoId={proyectoId} proc={proc} procesos={procesos} deptos={deptos} recursos={recursos}
            onPatch={(patch) => guardar(proc.id, patch)}
            onRecargarRecursos={() => { listarRecursosProyecto(proyectoId).then(setRecursos).catch(() => {}); }}
            onEliminar={async () => { await eliminarProceso(proc.id); setSelProc(null); cargar(); }}
            onCerrar={() => setSelProc(null)} onIrSedes={onIrSedes} />
        )}

        {/* ==== PANEL DEPARTAMENTO (etiqueta) ==== */}
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
  onPatch: (p: PatchProceso) => void; onRecargarRecursos: () => void;
  onEliminar: () => Promise<void>; onCerrar: () => void; onIrSedes: () => void;
}) {
  const [nuevoRol, setNuevoRol] = useState('');
  const [nuevaHerr, setNuevaHerr] = useState('');
  const [nuevoInsumo, setNuevoInsumo] = useState('');
  const [nuevoEspacio, setNuevoEspacio] = useState('');
  const [horarioEspacio, setHorarioEspacio] = useState('');
  const deptoDe = (id: string) => deptos.find((d) => d.id === id)?.nombre ?? '?';

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

      <label style={lbl}>Nombre</label>
      <input style={inp} defaultValue={proc.nombre} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== proc.nombre) onPatch({ nombre: e.target.value.trim() }); }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        <div>
          <label style={lbl}>🏷️ Departamento</label>
          <select style={inp} value={proc.departamentoId} onChange={(e) => onPatch({ departamentoId: e.target.value })}>
            {deptos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Fase (página)</label>
          <select style={inp} value={proc.fase} onChange={(e) => onPatch({ fase: e.target.value as FaseMapa })}>
            {FASES_MAPA.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
      </div>

      {/* VIGENCIA POR ETAPA — el proceso existe desde que nace hacia adelante */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        <div>
          <label style={lbl}>🚀 Nace en la etapa</label>
          <select style={inp} value={proc.etapaDesde} onChange={(e) => onPatch({ etapaDesde: e.target.value as EtapaObjetivo })}>
            {ETAPAS_OBJETIVO.map((x) => <option key={x.id} value={x.id}>{x.n}. {x.label}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>⊘ Vigente hasta</label>
          <select style={inp} value={proc.etapaHasta ?? ''} onChange={(e) => onPatch({ etapaHasta: e.target.value ? e.target.value as EtapaObjetivo : null })}>
            <option value="">Siempre (no se retira)</option>
            {ETAPAS_OBJETIVO.filter((x) => x.n >= nEtapa(proc.etapaDesde)).map((x) => <option key={x.id} value={x.id}>{x.n}. {x.label}</option>)}
          </select>
        </div>
      </div>
      <p style={{ fontSize: 10.5, color: '#999', margin: '2px 0 0' }}>
        Existe desde su etapa en adelante (se hereda). Usa &quot;vigente hasta&quot; para los procesos que otra etapa reemplaza (ej. el manual que la automatización jubila).
      </p>

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

      {/* INSUMOS (se consumen; distintos de las herramientas, que se reusan) */}
      <label style={lbl}>🧴 Insumos (se consumen)</label>
      <div>{proc.insumos.map((x) => <span key={x} style={tag}>{x} <span style={{ cursor: 'pointer', color: '#b33' }} onClick={() => onPatch({ insumos: proc.insumos.filter((y) => y !== x) })}>×</span></span>)}</div>
      <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
        <input style={{ ...inp, flex: 1 }} placeholder="gasas, solución salina…" value={nuevoInsumo} onChange={(e) => setNuevoInsumo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && nuevoInsumo.trim()) { if (!proc.insumos.includes(nuevoInsumo.trim())) onPatch({ insumos: [...proc.insumos, nuevoInsumo.trim()] }); setNuevoInsumo(''); } }} />
        <button style={btnSm} disabled={!nuevoInsumo.trim()} onClick={() => { const v = nuevoInsumo.trim(); if (v && !proc.insumos.includes(v)) onPatch({ insumos: [...proc.insumos, v] }); setNuevoInsumo(''); }}>＋</button>
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
      <label style={lbl}>⑂ Ramas (caminos por disparador) — pueden cruzar de fase y de etapa</label>
      {proc.ramas.map((r) => (
        <div key={r.id} style={{ display: 'flex', gap: 4, marginTop: 3, alignItems: 'center' }}>
          <input style={{ ...inp, flex: 2 }} defaultValue={r.evento} placeholder="disparador (ej. Pago recibido)"
            onBlur={(e) => onPatch({ ramas: proc.ramas.map((x) => x.id === r.id ? { ...x, evento: e.target.value } : x) })} />
          <select style={{ ...inp, flex: 3 }} value={r.destinoProcesoId ?? ''}
            onChange={(e) => onPatch({ ramas: proc.ramas.map((x) => x.id === r.id ? { ...x, destinoProcesoId: e.target.value || undefined } : x) })}>
            <option value="">→ (sin destino)</option>
            {procesos.filter((p) => p.id !== proc.id)
              .slice().sort((a, b) => nEtapa(a.etapaDesde) - nEtapa(b.etapaDesde))
              .map((p) => (
                <option key={p.id} value={p.id}>E{nEtapa(p.etapaDesde)} · {FASES_MAPA.find((f) => f.id === p.fase)?.label.split(' ·')[0]} · {p.nombre} ({deptoDe(p.departamentoId)})</option>
              ))}
          </select>
          <span style={{ cursor: 'pointer', color: '#b33', fontSize: 15 }} onClick={() => onPatch({ ramas: proc.ramas.filter((x) => x.id !== r.id) })}>×</span>
        </div>
      ))}
      <button style={{ ...btnSm, marginTop: 4 }} onClick={() => onPatch({ ramas: [...proc.ramas, { id: `RAMA-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, evento: '' }] })}>＋ Rama</button>
      <p style={{ fontSize: 10.5, color: '#999', margin: '0.3rem 0 0' }}>Un proceso con 2+ ramas se divide en caminos según el disparador que se active. Si el destino está en otra fase aparece como portal ⤷; si nace en una etapa posterior, como ⏭ (el trabajo de hoy que alimenta el mañana — ej. guardar la factura hoy para Contabilidad en la etapa 2).</p>

      <div style={{ borderTop: '1px solid #dde', marginTop: '0.7rem', paddingTop: '0.5rem' }}>
        <button style={{ ...btnSm, color: '#b33', borderColor: '#d99' }} onClick={() => { if (window.confirm(`¿Eliminar el proceso "${proc.nombre}"?`)) void onEliminar(); }}>🗑 Eliminar proceso</button>
      </div>
    </div>
  );
}

// =================== PANEL: DEPARTAMENTO (etiqueta) ===================

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
    return (compartidos.get((r.ref ?? r.nombre).toLowerCase()) ?? []).filter((n) => n !== depto.nombre);
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
        <strong style={{ fontSize: 14 }}>🏷️ Departamento (etiqueta)</strong>
        <button style={btnSm} onClick={onCerrar}>✕</button>
      </div>
      <div style={{ fontSize: 11, color: '#888' }}>{depto.tipo === 'uc' ? 'Etiqueta derivada de una Unidad Comercial' : 'Etiqueta administrativa'} · los procesos se etiquetan con ella en el panel del proceso.</div>

      <label style={lbl}>Nombre</label>
      <input style={inp} defaultValue={depto.nombre} disabled={depto.tipo === 'uc'}
        onBlur={(e) => { if (e.target.value.trim() && e.target.value !== depto.nombre) onPatch({ nombre: e.target.value.trim() }); }} />
      {depto.tipo === 'uc' && <p style={{ fontSize: 10.5, color: '#999', margin: '2px 0 0' }}>El nombre se hereda de la Unidad Comercial.</p>}

      <label style={lbl}>Color de la etiqueta</label>
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
          <button style={{ ...btnSm, color: '#b33', borderColor: '#d99' }} onClick={() => { if (window.confirm(`¿Eliminar "${depto.nombre}"? Sus procesos pasan a Administración.`)) void onEliminar(); }}>🗑 Eliminar etiqueta</button>
        </div>
      )}
    </div>
  );
}
