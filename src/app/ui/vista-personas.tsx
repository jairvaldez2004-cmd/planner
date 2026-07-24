'use client';

// PERSONAS & RH — superficie de captura del roster. Das de alta a cada persona una vez con
// su puesto, departamento, estado, roles, procesos, responsabilidades, nómina, KPIs y
// competencias; desde aquí alimenta el plano RH (puestos) y ORG/OPE (roles). Los
// departamentos y procesos vienen del Mapa Operativo (no se re-teclean).

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { listarEmpleados, guardarEmpleado, eliminarEmpleado } from '@/app/actions/rh.actions';
import { listarDepartamentos, listarProcesos } from '@/app/actions/mapa.actions';
import { ESTADOS_EMPLEADO, estadoEmpleado, empleadoVacio } from '@/domain/rh';
import type { Empleado } from '@/domain/rh';
import { flujoDePersona, flujoDeRol, indiceRoles, rolesConocidos, quienesHacen } from '@/domain/flujo-persona';
import type { PasoFlujoPersona } from '@/domain/flujo-persona';
import { FASES_MAPA, ordenFaseMapa } from '@/domain/mapa';
import type { ProcesoNodo } from '@/domain/mapa';
import { useEsMovil } from './use-movil';

const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };
const btnSm: CSSProperties = { ...btn, padding: '0.15rem 0.5rem', fontSize: 12 };
const inp: CSSProperties = { padding: '0.35rem 0.55rem', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const lbl: CSSProperties = { display: 'block', fontSize: 11, color: '#666', marginTop: '0.5rem', fontWeight: 'bold' };
const tag: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f2ecfb', border: '1px solid #ddcdef', borderRadius: 12, padding: '0.1rem 0.5rem', fontSize: 12, margin: '2px 3px 0 0' };

export function VistaPersonas({ proyectoId }: { proyectoId: string }) {
  const [emps, setEmps] = useState<Empleado[]>([]);
  const [depts, setDepts] = useState<string[]>([]);
  const [procs, setProcs] = useState<string[]>([]);
  const [procesosFull, setProcesosFull] = useState<ProcesoNodo[]>([]);
  const [deptoNombreMap, setDeptoNombreMap] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [verFlujo, setVerFlujo] = useState(false);
  const [vista, setVista] = useState<'personas' | 'roles'>('personas');
  const [rolSel, setRolSel] = useState<string | null>(null);
  const [buscarRol, setBuscarRol] = useState('');
  const [loading, setLoading] = useState(true);
  const movil = useEsMovil();

  const cargar = () => {
    setLoading(true);
    Promise.all([listarEmpleados(proyectoId), listarDepartamentos(proyectoId), listarProcesos(proyectoId)])
      .then(([e, d, p]) => {
        setEmps(e); setDepts(d.map((x) => x.nombre));
        setDeptoNombreMap(Object.fromEntries(d.map((x) => [x.id, x.nombre])));
        setProcesosFull(p); setProcs(p.filter((x) => !x.padreProcesoId).map((x) => x.nombre));
      })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [proyectoId]);

  const se = emps.find((e) => e.id === sel) ?? null;
  const nombreDepto = (id: string) => deptoNombreMap[id] ?? id;
  const rolesIdx = indiceRoles(procesosFull, emps);
  const rolesNombres = rolesConocidos(procesosFull, emps);

  // Vista de FLUJO de una persona (su n8n: procesos + disparadores + quién los entrega).
  if (se && verFlujo) {
    return <FlujoPersona emp={se} procesos={procesosFull} empleados={emps} nombreDepto={nombreDepto} onVolver={() => setVerFlujo(false)} />;
  }
  // Vista de FLUJO de un rol (solo lo que involucra ese rol).
  if (vista === 'roles' && rolSel) {
    return <FlujoRol rol={rolSel} procesos={procesosFull} empleados={emps} nombreDepto={nombreDepto} onVolver={() => setRolSel(null)} />;
  }

  async function agregar() {
    const nuevo = await guardarEmpleado(proyectoId, { ...empleadoVacio(''), nombre: 'Nueva persona', estado: 'candidato' });
    setEmps((l) => [...l, nuevo]); setSel(nuevo.id);
  }
  async function patch(partial: Partial<Empleado>) {
    if (!se) return;
    const upd = { ...se, ...partial };
    setEmps((l) => l.map((e) => e.id === upd.id ? upd : e));
    await guardarEmpleado(proyectoId, upd);
  }
  async function borrar() {
    if (!se) return;
    if (!window.confirm(`¿Eliminar a "${se.nombre || 'esta persona'}"?`)) return;
    await eliminarEmpleado(proyectoId, se.id); setSel(null); cargar();
  }

  const activos = emps.filter((e) => e.estado === 'activo').length;

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>👥 Personas & RH <span style={{ fontSize: 13, color: '#888' }}>· plantilla del negocio</span></h2>
        {vista === 'personas' && <button style={btn} onClick={() => void agregar()}>＋ Dar de alta persona</button>}
      </div>

      {/* Tabs: Personas | Roles */}
      <div style={{ display: 'flex', gap: '0.4rem', margin: '0.5rem 0 0.4rem' }}>
        {([['personas', '👥 Personas'], ['roles', '🏷️ Roles']] as const).map(([id, label]) => (
          <button key={id} onClick={() => { setVista(id); setRolSel(null); }}
            style={{ ...btn, background: vista === id ? '#8a4fbf' : '#fff', color: vista === id ? '#fff' : '#4a3a63', borderColor: vista === id ? '#8a4fbf' : '#d5cde2', fontWeight: 'bold' }}>{label}</button>
        ))}
      </div>

      {loading && <p style={{ color: '#666' }}>Cargando…</p>}

      {vista === 'roles' && <RolesLista roles={rolesIdx} buscar={buscarRol} onBuscar={setBuscarRol} onAbrir={setRolSel} />}

      {vista === 'personas' && (
       <>
      <p style={{ fontSize: 12, color: '#777', margin: '0 0 0.6rem' }}>
        {emps.length} personas ({activos} activas). Cada alta alimenta <strong>RH</strong>, <strong>Organizacional</strong>, <strong>Operativo</strong> y (con datos fiscales) <strong>Jurídico</strong> / <strong>Financiero</strong>.
      </p>
      {!loading && emps.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Aún no hay nadie. Pulsa <strong>＋ Dar de alta persona</strong> para empezar.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: movil || !se ? '1fr' : 'minmax(0, 1fr) 360px', gap: '0.75rem', alignItems: 'start' }}>
        {/* Lista de personas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem', alignContent: 'start' }}>
          {emps.map((e) => {
            const est = estadoEmpleado(e.estado);
            return (
              <div key={e.id} onClick={() => setSel(e.id)}
                style={{ border: `1px solid ${sel === e.id ? '#8a4fbf' : '#e0dae8'}`, borderLeft: `4px solid ${est.color}`, borderRadius: 9, padding: '0.5rem 0.6rem', background: sel === e.id ? '#faf7ff' : '#fff', cursor: 'pointer', boxShadow: sel === e.id ? '0 0 0 2px #8a4fbf22' : '0 1px 2px rgba(0,0,0,0.05)' }}>
                <div style={{ fontWeight: 'bold', fontSize: 13.5 }}>{e.nombre || '(sin nombre)'}</div>
                <div style={{ fontSize: 12, color: '#555' }}>{e.puesto || '— sin puesto —'}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                  {e.externo ? <span style={{ color: '#b5651d' }}>🏢 {e.proveedor || 'externo'}</span> : (e.departamento && <span style={{ color: '#8a4fbf' }}>{e.departamento}</span>)}
                  <span style={{ background: est.color, color: '#fff', borderRadius: 8, padding: '0 6px', fontSize: 10 }}>{est.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Editor de la persona */}
        {se && (
          <div style={{ border: '1px solid #ddcdef', borderRadius: 10, padding: '0.7rem', background: '#faf7ff', position: 'sticky', top: 8, maxHeight: '84vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 14 }}>👤 Persona</strong>
              <button style={btnSm} onClick={() => setSel(null)}>✕</button>
            </div>

            <button style={{ ...btnSm, width: '100%', marginTop: 6, background: '#eef4ff', borderColor: '#cdd8ef', color: '#2b5a97', fontWeight: 'bold' }} onClick={() => setVerFlujo(true)}>🔀 Ver sus flujos de trabajo</button>

            <label style={lbl}>Nombre</label>
            <input style={inp} defaultValue={se.nombre} key={`n-${se.id}`} onBlur={(ev) => { if (ev.target.value !== se.nombre) void patch({ nombre: ev.target.value }); }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
              <div>
                <label style={lbl}>Puesto</label>
                <input style={inp} defaultValue={se.puesto} key={`p-${se.id}`} placeholder="ej. Perforador/a" onBlur={(ev) => { if (ev.target.value !== se.puesto) void patch({ puesto: ev.target.value }); }} />
              </div>
              <div>
                <label style={lbl}>Estado</label>
                <select style={inp} value={se.estado} onChange={(ev) => void patch({ estado: ev.target.value as Empleado['estado'] })}>
                  {ESTADOS_EMPLEADO.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <label style={lbl}>🏷️ Departamento</label>
            <select style={inp} value={depts.includes(se.departamento) ? se.departamento : ''} onChange={(ev) => void patch({ departamento: ev.target.value })}>
              <option value="">— sin asignar —</option>
              {depts.map((d) => <option key={d} value={d}>{d}</option>)}
              {se.departamento && !depts.includes(se.departamento) && <option value={se.departamento}>{se.departamento}</option>}
            </select>
            <p style={{ fontSize: 10, color: '#999', margin: '2px 0 0' }}>Los departamentos vienen del Mapa Operativo.</p>

            {/* TERCERIZACIÓN: el rol lo ejecuta un tercero (Girly Zone hacia arriba u otra empresa) */}
            <label style={{ fontSize: 12, color: '#8a5a1f', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: '0.6rem' }}>
              <input type="checkbox" checked={se.externo} onChange={(ev) => void patch({ externo: ev.target.checked })} /> 🏢 Tercerizado (lo hace Girly Zone u otra empresa)
            </label>
            {se.externo && (
              <div style={{ background: '#fff7ee', border: '1px solid #ecd9a0', borderRadius: 8, padding: '0.4rem 0.55rem', marginTop: 4 }}>
                <label style={lbl}>Proveedor (quién lo ejecuta)</label>
                <input style={inp} defaultValue={se.proveedor} key={`prov-${se.id}`} placeholder="ej. Girly Zone · Despacho contable X" onBlur={(ev) => void patch({ proveedor: ev.target.value })} />
                <label style={lbl}>➡️ Qué le entregamos (datos de salida)</label>
                <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={se.entregamos} key={`ent-${se.id}`} placeholder="facturas del mes, accesos, información…" onBlur={(ev) => void patch({ entregamos: ev.target.value })} />
                <label style={lbl}>⬅️ Qué recibimos a cambio</label>
                <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={se.recibimos} key={`rec-${se.id}`} placeholder="declaración, reporte, servicio terminado…" onBlur={(ev) => void patch({ recibimos: ev.target.value })} />
                <p style={{ fontSize: 10, color: '#a5813f', margin: '3px 0 0' }}>Define el flujo con el tercero: lo que sale de nosotros ↔ lo que recibimos.</p>
              </div>
            )}

            <TagField label="👤 Roles que desempeña" valores={se.roles} onChange={(v) => void patch({ roles: v })} placeholder="busca o crea un rol…" opciones={rolesNombres} />
            <TagField label="🛠️ Procesos que ejecuta" valores={se.procesos} onChange={(v) => void patch({ procesos: v })} placeholder="proceso del mapa…" opciones={procs} />
            <TagField label="⭐ Competencias" valores={se.competencias} onChange={(v) => void patch({ competencias: v })} placeholder="competencia…" />

            <label style={lbl}>Responsabilidades</label>
            <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={se.responsabilidades} key={`r-${se.id}`} placeholder="qué es suyo" onBlur={(ev) => void patch({ responsabilidades: ev.target.value })} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
              <div>
                <label style={lbl}>💵 Nómina / esquema</label>
                <input style={inp} defaultValue={se.nomina} key={`sal-${se.id}`} placeholder="sueldo o comisión" onBlur={(ev) => void patch({ nomina: ev.target.value })} />
              </div>
              <div>
                <label style={lbl}>📊 KPIs</label>
                <input style={inp} defaultValue={se.kpis} key={`k-${se.id}`} placeholder="cómo se mide" onBlur={(ev) => void patch({ kpis: ev.target.value })} />
              </div>
            </div>

            <label style={lbl}>Notas (entrevistas, pruebas, evaluación, carrera…)</label>
            <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={se.notas} key={`no-${se.id}`} onBlur={(ev) => void patch({ notas: ev.target.value })} />

            {/* Datos personales y fiscales (alimentan Jurídico / Financiero) */}
            <details style={{ marginTop: '0.6rem', borderTop: '1px solid #e6ddf2', paddingTop: '0.4rem' }}>
              <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 'bold', color: '#7a4fbf' }}>📇 Datos personales y fiscales (Jurídico / Financiero)</summary>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <div><label style={lbl}>Correo</label><input style={inp} type="email" defaultValue={se.email} key={`em-${se.id}`} placeholder="correo@…" onBlur={(ev) => void patch({ email: ev.target.value })} /></div>
                <div><label style={lbl}>Teléfono</label><input style={inp} defaultValue={se.telefono} key={`tel-${se.id}`} placeholder="+52…" onBlur={(ev) => void patch({ telefono: ev.target.value })} /></div>
                <div><label style={lbl}>RFC</label><input style={inp} defaultValue={se.rfc} key={`rfc-${se.id}`} onBlur={(ev) => void patch({ rfc: ev.target.value })} /></div>
                <div><label style={lbl}>CURP</label><input style={inp} defaultValue={se.curp} key={`cu-${se.id}`} onBlur={(ev) => void patch({ curp: ev.target.value })} /></div>
                <div><label style={lbl}>NSS</label><input style={inp} defaultValue={se.nss} key={`ns-${se.id}`} onBlur={(ev) => void patch({ nss: ev.target.value })} /></div>
                <div><label style={lbl}>Nacimiento</label><input style={inp} type="date" defaultValue={se.nacimiento} key={`na-${se.id}`} onBlur={(ev) => void patch({ nacimiento: ev.target.value })} /></div>
              </div>
              <label style={lbl}>Dirección</label>
              <input style={inp} defaultValue={se.direccion} key={`dir-${se.id}`} onBlur={(ev) => void patch({ direccion: ev.target.value })} />
              <label style={lbl}>Contacto de emergencia</label>
              <input style={inp} defaultValue={se.emergencia} key={`eme-${se.id}`} onBlur={(ev) => void patch({ emergencia: ev.target.value })} />
              <p style={{ fontSize: 10, color: '#999', margin: '3px 0 0' }}>Datos sensibles (PII). Se usan para contratos (Jurídico) y nómina (Financiero).</p>
            </details>

            <div style={{ borderTop: '1px solid #e6ddf2', marginTop: '0.7rem', paddingTop: '0.5rem' }}>
              <button style={{ ...btnSm, color: '#b33', borderColor: '#d99' }} onClick={() => void borrar()}>🗑 Eliminar persona</button>
            </div>
          </div>
        )}
      </div>
       </>
      )}
    </section>
  );
}

// ===== Lista de pasos del flujo (compartida por persona y por rol) =====
function FlujoLista({ pasos, yo, externos }: { pasos: PasoFlujoPersona[]; yo?: string | undefined; externos?: Set<string> }) {
  const faseLabel = (f: string) => (FASES_MAPA.find((x) => x.id === f)?.label ?? f).split(' · ')[0];
  const quienTxt = (quien: string[], depto: string) =>
    quien.length ? quien.map((n) => externos?.has(n) ? `🏢 ${n} (externo)` : ((yo && n === yo) ? `${n} (tú)` : n)).join(', ') : `sin responsable · ${depto}`;
  const linea: CSSProperties = { fontSize: 12, padding: '0.15rem 0.5rem', borderRadius: 6, margin: '2px 0' };
  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
      {pasos.map((p, i) => (
        <li key={p.id} style={{ border: '1px solid #e2ddea', borderRadius: 10, padding: '0.5rem 0.7rem', background: '#fff' }}>
          {p.recibeDe.length === 0
            ? <div style={{ ...linea, color: '#2e9e63', background: '#eefaf2' }}>▶ Inicia el flujo (nadie se lo dispara)</div>
            : p.recibeDe.map((d, j) => (
              <div key={j} style={{ ...linea, color: '#2b5a97', background: '#eef4ff' }}>
                ⤶ cuando <strong>«{d.evento || 'continúa'}»</strong> — lo entrega <strong>{quienTxt(d.quien, d.departamento)}</strong> <span style={{ color: '#888' }}>(«{d.proceso}»)</span>
              </div>
            ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.35rem 0' }}>
            <span style={{ background: '#8a4fbf', color: '#fff', borderRadius: 9, fontSize: 11, fontWeight: 'bold', padding: '1px 7px', flexShrink: 0 }}>{i + 1}</span>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 13.5 }}>{p.nombre}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{faseLabel(p.fase)} · {p.departamento} · roles: {p.roles.join(', ') || '—'}</div>
            </div>
          </div>
          {p.entregaA.length === 0
            ? <div style={{ ...linea, color: '#888', background: '#f5f5f7' }}>⏹ Cierra aquí (no dispara nada más)</div>
            : p.entregaA.map((d, j) => (
              <div key={j} style={{ ...linea, color: '#7a4fbf', background: '#f6f2fb' }}>
                ⤷ al terminar dispara <strong>«{d.evento || 'continúa'}»</strong> → <strong>«{d.proceso}»</strong> <span style={{ color: '#888' }}>(lo hace {quienTxt(d.quien, d.departamento)})</span>
              </div>
            ))}
        </li>
      ))}
    </ol>
  );
}

// ===== LIENZO n8n del flujo (nodos + flechas con disparadores) =====
function FlujoCanvas({ pasos, procesos, empleados, nombreDepto, yo }: {
  pasos: PasoFlujoPersona[]; procesos: ProcesoNodo[]; empleados: Empleado[]; nombreDepto: (id: string) => string; yo?: string | undefined;
}) {
  const top = procesos.filter((p) => !p.padreProcesoId);
  const byId = new Map(top.map((p) => [p.id, p]));
  const own = new Set(pasos.map((p) => p.id));
  const externos = new Set(empleados.filter((e) => e.externo).map((e) => e.nombre));

  const ids = new Set<string>(pasos.map((p) => p.id));
  for (const p of pasos) { p.recibeDe.forEach((d) => ids.add(d.procesoId)); p.entregaA.forEach((d) => ids.add(d.procesoId)); }
  const nodos = Array.from(ids).map((id) => {
    const pr = byId.get(id);
    return { id, nombre: pr?.nombre ?? id, fase: pr?.fase ?? 'durante', orden: pr?.orden ?? 0, depto: pr ? nombreDepto(pr.departamentoId) : '', quien: pr ? quienesHacen(pr, empleados) : [], propio: own.has(id) };
  }).sort((a, b) => ordenFaseMapa(a.fase) - ordenFaseMapa(b.fase) || a.orden - b.orden);

  const W = 190, H = 78, GAPX = 66, X0 = 16, LANEY = 160;
  const pos = new Map<string, { x: number; y: number; col: number }>();
  nodos.forEach((n, i) => pos.set(n.id, { x: X0 + i * (W + GAPX), y: LANEY, col: i }));

  const edges: { from: string; to: string; label: string }[] = [];
  const seen = new Set<string>();
  const push = (from: string, to: string, label: string) => { const k = `${from}|${to}|${label}`; if (!seen.has(k) && pos.has(from) && pos.has(to)) { seen.add(k); edges.push({ from, to, label }); } };
  for (const p of pasos) { p.recibeDe.forEach((d) => push(d.procesoId, p.id, d.evento)); p.entregaA.forEach((d) => push(p.id, d.procesoId, d.evento)); }

  const width = Math.max(600, X0 * 2 + nodos.length * (W + GAPX));
  const height = 300;
  const quienStr = (quien: string[]) => quien.length ? quien.map((n) => externos.has(n) ? `${n} (ext)` : (yo && n === yo ? `${n} (tú)` : n)).join(', ') : '—';

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e2ddea', borderRadius: 10, background: '#fcfcfd', backgroundImage: 'radial-gradient(#e6e8ee 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
      <div style={{ position: 'relative', width, height }}>
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <defs><marker id="fa-p" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#8a93a8" /></marker></defs>
          {edges.map((e, idx) => {
            const a = pos.get(e.from)!, b = pos.get(e.to)!;
            const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2;
            const dist = Math.abs(b.col - a.col);
            const cy = LANEY - Math.min(130, 26 + dist * 20);
            const path = `M ${x1} ${y1} C ${x1 + 40} ${cy}, ${x2 - 40} ${cy}, ${x2} ${y2}`;
            const mx = (x1 + x2) / 2, my = cy + 6;
            return (
              <g key={idx}>
                <path d={path} fill="none" stroke="#8a93a8" strokeWidth={1.5} markerEnd="url(#fa-p)" />
                {e.label && <>
                  <rect x={mx - (e.label.length * 3.1 + 6)} y={my - 9} width={e.label.length * 6.2 + 12} height={16} rx={8} fill="#fff" stroke="#d5d9e2" />
                  <text x={mx} y={my + 3} textAnchor="middle" fontSize={10} fill="#7a4fbf">{e.label}</text>
                </>}
              </g>
            );
          })}
        </svg>
        {nodos.map((n) => {
          const p = pos.get(n.id)!;
          const ext = n.quien.some((q) => externos.has(q));
          const bc = n.propio ? '#8a4fbf' : (ext ? '#c97a3b' : '#c9cfdd');
          return (
            <div key={n.id} title={`${n.nombre}\n${n.depto}\n${n.propio ? 'suyo' : 'de otro'}: ${quienStr(n.quien)}`}
              style={{ position: 'absolute', left: p.x, top: p.y, width: W, height: H, border: `2px solid ${bc}`, borderRadius: 10, background: n.propio ? '#faf7ff' : '#fff', padding: '0.35rem 0.5rem', boxSizing: 'border-box', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
              <div style={{ fontWeight: 'bold', fontSize: 12, lineHeight: 1.15, maxHeight: 28, overflow: 'hidden' }}>{n.nombre}</div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{n.depto}</div>
              <div style={{ fontSize: 10, color: ext ? '#b5651d' : '#555', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ext ? '🏢 ' : '👤 '}{quienStr(n.quien)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Vista de flujo con toggle Grafo/Lista (compartida por persona y rol).
function FlujoVista({ pasos, procesos, empleados, nombreDepto, yo }: {
  pasos: PasoFlujoPersona[]; procesos: ProcesoNodo[]; empleados: Empleado[]; nombreDepto: (id: string) => string; yo?: string | undefined;
}) {
  const [modo, setModo] = useState<'grafo' | 'lista'>('grafo');
  const externos = new Set(empleados.filter((e) => e.externo).map((e) => e.nombre));
  return (
    <>
      <div style={{ display: 'flex', gap: '0.4rem', margin: '0 0 0.6rem' }}>
        {([['grafo', '🕸 Grafo'], ['lista', '☰ Lista']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setModo(id)} style={{ ...btnSm, background: modo === id ? '#5b6b8c' : '#fff', color: modo === id ? '#fff' : '#333', borderColor: modo === id ? '#5b6b8c' : '#bbb' }}>{label}</button>
        ))}
      </div>
      {modo === 'grafo'
        ? <FlujoCanvas pasos={pasos} procesos={procesos} empleados={empleados} nombreDepto={nombreDepto} yo={yo} />
        : <FlujoLista pasos={pasos} yo={yo} externos={externos} />}
    </>
  );
}

// ===== FLUJO DE UNA PERSONA =====
function FlujoPersona({ emp, procesos, empleados, nombreDepto, onVolver }: {
  emp: Empleado; procesos: ProcesoNodo[]; empleados: Empleado[]; nombreDepto: (id: string) => string; onVolver: () => void;
}) {
  const pasos = flujoDePersona(emp, procesos, empleados, nombreDepto);
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>🔀 Flujo de trabajo de {emp.nombre || 'la persona'}</h2>
        <button style={btn} onClick={onVolver}>← Personas</button>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', margin: '0.4rem 0 0.7rem' }}>
        <span style={{ fontSize: 12, color: '#666' }}>Roles:</span>
        {emp.roles.length ? emp.roles.map((r) => <span key={r} style={tag}>{r}</span>) : <span style={{ fontSize: 12, color: '#a60' }}>sin roles — asígnalos en su ficha</span>}
        <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{pasos.length} procesos a su cargo</span>
      </div>
      {pasos.length === 0
        ? <p style={{ color: '#999', fontSize: 13 }}>No tiene procesos asignados. Dale <strong>roles</strong> que coincidan con los del Mapa o asígnale procesos por nombre.</p>
        : <FlujoVista pasos={pasos} procesos={procesos} empleados={empleados} nombreDepto={nombreDepto} yo={emp.nombre} />}
    </section>
  );
}

// ===== FLUJO DE UN ROL (solo lo que involucra ese rol) =====
function FlujoRol({ rol, procesos, empleados, nombreDepto, onVolver }: {
  rol: string; procesos: ProcesoNodo[]; empleados: Empleado[]; nombreDepto: (id: string) => string; onVolver: () => void;
}) {
  const pasos = flujoDeRol(rol, procesos, empleados, nombreDepto);
  const quienes = empleados.filter((e) => e.roles.some((r) => r.toLowerCase() === rol.toLowerCase()));
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>🏷️ Flujo del rol «{rol}»</h2>
        <button style={btn} onClick={onVolver}>← Roles</button>
      </div>
      <div style={{ fontSize: 12, color: '#666', margin: '0.4rem 0 0.7rem' }}>
        {pasos.length} procesos · lo desempeñan: {quienes.length ? <strong>{quienes.map((q) => q.externo ? `🏢 ${q.nombre} (externo)` : q.nombre).join(', ')}</strong> : <span style={{ color: '#a60' }}>nadie aún (rol vacante — tercerízalo o asígnalo)</span>}
      </div>
      {pasos.length === 0
        ? <p style={{ color: '#999', fontSize: 13 }}>Ningún proceso del Mapa usa este rol todavía.</p>
        : <FlujoVista pasos={pasos} procesos={procesos} empleados={empleados} nombreDepto={nombreDepto} />}
    </section>
  );
}

// ===== LISTA DE ROLES (con buscador) =====
function RolesLista({ roles, buscar, onBuscar, onAbrir }: {
  roles: { rol: string; procesos: number; personas: number }[]; buscar: string; onBuscar: (v: string) => void; onAbrir: (r: string) => void;
}) {
  const filtro = buscar.trim().toLowerCase();
  const vis = filtro ? roles.filter((r) => r.rol.toLowerCase().includes(filtro)) : roles;
  return (
    <div>
      <input style={{ ...inp, maxWidth: 340, marginBottom: '0.5rem' }} placeholder="🔎 Buscar rol…" value={buscar} onChange={(e) => onBuscar(e.target.value)} />
      <p style={{ fontSize: 12, color: '#777', margin: '0 0 0.5rem' }}>{roles.length} roles (del Mapa Operativo y del roster). Clic en un rol para ver su flujo n8n.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
        {vis.map((r) => (
          <div key={r.rol} onClick={() => onAbrir(r.rol)}
            style={{ border: '1px solid #e0dae8', borderLeft: '4px solid #8a4fbf', borderRadius: 9, padding: '0.5rem 0.6rem', background: '#fff', cursor: 'pointer' }}>
            <div style={{ fontWeight: 'bold', fontSize: 13.5 }}>{r.rol}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{r.procesos} proceso{r.procesos !== 1 ? 's' : ''} · {r.personas} persona{r.personas !== 1 ? 's' : ''}</div>
          </div>
        ))}
        {vis.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Sin roles que coincidan con «{buscar}».</p>}
      </div>
    </div>
  );
}

// Campo de etiquetas reutilizable (con datalist opcional).
function TagField({ label, valores, onChange, placeholder, opciones }: {
  label: string; valores: string[]; onChange: (v: string[]) => void; placeholder: string; opciones?: string[];
}) {
  const [nuevo, setNuevo] = useState('');
  const id = `dl-${label.replace(/\W/g, '')}`;
  function add() {
    const v = nuevo.trim(); if (!v) return;
    if (!valores.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...valores, v]);
    setNuevo('');
  }
  return (
    <>
      <label style={lbl}>{label}</label>
      <div>{valores.map((v) => <span key={v} style={tag}>{v} <span style={{ cursor: 'pointer', color: '#b33' }} onClick={() => onChange(valores.filter((x) => x !== v))}>×</span></span>)}</div>
      <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
        <input style={{ ...inp, flex: 1 }} list={opciones ? id : undefined} placeholder={placeholder} value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        {opciones && <datalist id={id}>{opciones.map((o) => <option key={o} value={o} />)}</datalist>}
        <button style={btnSm} onClick={add} disabled={!nuevo.trim()}>＋</button>
      </div>
    </>
  );
}
