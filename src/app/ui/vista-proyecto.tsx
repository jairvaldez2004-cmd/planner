'use client';

// Vista de Proyecto = GRAFO FRACTAL con JERARQUÍA.
// Nodo central = este proyecto (un desarrollo/empresa o un negocio). Alrededor:
//   · Administración (planos)  · Sedes & Espacios
//   · NEGOCIOS que contiene (sub-empresas → se abren de forma anidada, recursiva)
//   · UNIDADES COMERCIALES (líneas de venta directa de este proyecto)
// Ej.: "Girly Zone" (desarrollo) contiene los negocios "Altercing Studio" y "Macao Pilates";
// al entrar a un negocio, este mismo componente lo muestra con SUS unidades comerciales.

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { listarUnidades, crearUnidad } from '@/app/actions/espacios.actions';
import { obtenerGrafoPlanos } from '@/app/actions/especialista.actions';
import { conversarCuradorProyecto } from '@/app/actions/arquitecto.actions';
import { cargarConversacionProyecto } from '@/app/actions/contexto.actions';
import { listarHijosDeProyecto, crearNegocioHijo, obtenerProyectoBase } from '@/app/actions/workspace.actions';
import type { GrafoPlanos } from '@/app/actions/especialista.actions';
import type { ProyectoNodo } from '@/app/actions/workspace.actions';
import type { UnidadComercial } from '@/domain/espacios';
import { ChatArquitecto } from './chat-arquitecto';
import { VistaPlanos } from './vista-planos';
import { VistaSedes } from './vista-sedes';
import { VistaUnidad } from './vista-unidad';

const btn: CSSProperties = { padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 14 };
const inp: CSSProperties = { padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid #ccc', fontSize: 14 };

type Nodo = { tipo: 'admin' | 'sedes' | 'uc'; id?: string } | null;
type NodoGrafo = { key: string; tipo: 'admin' | 'sedes' | 'uc' | 'negocio'; id?: string; label: string; color: string };

export function VistaProyecto({ proyectoId, onVolver, volverLabel = '← Grafo del workspace' }: { proyectoId: string; onVolver: () => void; volverLabel?: string }) {
  const [nombre, setNombre] = useState('');
  const [ucs, setUcs] = useState<UnidadComercial[]>([]);
  const [hijos, setHijos] = useState<ProyectoNodo[]>([]);
  const [grafo, setGrafo] = useState<GrafoPlanos | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodo, setNodo] = useState<Nodo>(null);
  const [hijoAbierto, setHijoAbierto] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [nuevaUC, setNuevaUC] = useState('');
  const [nuevoNegocio, setNuevoNegocio] = useState('');

  const cargar = () => {
    setLoading(true);
    Promise.all([listarUnidades(proyectoId), obtenerGrafoPlanos(proyectoId), listarHijosDeProyecto(proyectoId), obtenerProyectoBase(proyectoId)])
      .then(([u, g, h, base]) => { setUcs(u); setGrafo(g); setHijos(h); setNombre(base?.nombre ?? ''); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [proyectoId]);

  // --- negocio hijo abierto (navegación jerárquica, recursiva) ---
  if (hijoAbierto) {
    return <VistaProyecto proyectoId={hijoAbierto} onVolver={() => { setHijoAbierto(null); cargar(); }} volverLabel={`← ${nombre || 'Contenedor'}`} />;
  }

  // --- sub-vistas por nodo ---
  if (nodo?.tipo === 'admin') return <VistaPlanos proyectoId={proyectoId} onVolver={() => { setNodo(null); cargar(); }} />;
  if (nodo?.tipo === 'sedes') return (
    <section>
      <button style={btn} onClick={() => { setNodo(null); cargar(); }}>← {nombre || 'Proyecto'}</button>
      <div style={{ marginTop: '0.5rem' }}><VistaSedes proyectoId={proyectoId} /></div>
    </section>
  );
  if (nodo?.tipo === 'uc') {
    const uc = ucs.find((u) => u.id === nodo.id);
    if (uc) return <VistaUnidad proyectoId={proyectoId} uc={uc} onVolver={() => { setNodo(null); cargar(); }} onIrSedes={() => setNodo({ tipo: 'sedes' })} />;
  }

  // --- grafo del proyecto ---
  const nodos: NodoGrafo[] = [
    { key: 'admin', tipo: 'admin', label: 'Administración', color: '#33415c' },
    { key: 'sedes', tipo: 'sedes', label: 'Sedes & Espacios', color: '#e0795b' },
    ...hijos.map((h): NodoGrafo => ({ key: h.proyectoId, tipo: 'negocio', id: h.proyectoId, label: h.nombre, color: '#b06be0' })),
    ...ucs.map((u): NodoGrafo => ({ key: u.id, tipo: 'uc', id: u.id, label: u.nombre, color: '#3b9e63' })),
  ];

  const W = 780, H = 560, cx = W / 2, cy = H / 2;
  const R = Math.min(220, 120 + nodos.length * 10);
  const posOf = (i: number, n: number) => { const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2; return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; };
  const abrev = (t: NodoGrafo['tipo']) => t === 'uc' ? 'UC' : t === 'admin' ? 'ADM' : t === 'sedes' ? 'SED' : 'NEG';

  function abrirNodo(n: NodoGrafo) {
    if (n.tipo === 'negocio' && n.id) { setHijoAbierto(n.id); return; }
    if (n.tipo === 'uc' && n.id) { setNodo({ tipo: 'uc', id: n.id }); return; }
    if (n.tipo === 'admin' || n.tipo === 'sedes') setNodo({ tipo: n.tipo });
  }

  async function crearUC() { if (!nuevaUC.trim()) return; await crearUnidad(proyectoId, nuevaUC.trim()); setNuevaUC(''); cargar(); }
  async function crearNeg() { if (!nuevoNegocio.trim()) return; await crearNegocioHijo(proyectoId, nuevoNegocio.trim()); setNuevoNegocio(''); cargar(); }

  const seleccionados = grafo?.nodos.filter((n) => n.seleccionado).length ?? 0;

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>{nombre || 'Proyecto'} <span style={{ fontSize: 13, color: '#888' }}>· negocios y unidades comerciales</span></h2>
        <button style={btn} onClick={onVolver}>{volverLabel}</button>
      </div>

      {loading && <p style={{ color: '#666' }}>Cargando…</p>}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 4fr) 8fr', gap: '1rem', alignItems: 'start', marginTop: '0.75rem' }}>
          {/* Panel */}
          <div style={{ border: '1px solid #cdd8ef', borderRadius: 10, padding: '0.75rem', background: '#f7f9ff' }}>
            <strong style={{ fontSize: 14 }}>Estructura</strong>
            <p style={{ margin: '0.25rem 0 0.5rem', fontSize: 12, color: '#555' }}>
              Un proyecto tiene <strong>Administración</strong> (transversal) y puede contener <strong>Negocios</strong> (sub-empresas, cada una con lo suyo) y/o <strong>Unidades Comerciales</strong> (líneas de venta directa). Clic en un nodo para entrar.
            </p>
            <div style={{ fontSize: 12, color: '#777', marginBottom: '0.5rem' }}>Administración: {seleccionados} planos · {hijos.length} negocios · {ucs.length} unidades comerciales.</div>

            {/* Crear negocio (sub-empresa) */}
            <label style={{ fontSize: 11, color: '#8a4fbf', fontWeight: 'bold' }}>Negocio dentro de este proyecto</label>
            <div style={{ display: 'flex', gap: '0.4rem', margin: '0.2rem 0 0.5rem' }}>
              <input style={{ ...inp, flex: 1 }} placeholder="Nuevo negocio (ej. Altercing Studio)" value={nuevoNegocio} onChange={(e) => setNuevoNegocio(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void crearNeg(); }} />
              <button style={btn} onClick={() => void crearNeg()} disabled={!nuevoNegocio.trim()}>＋</button>
            </div>

            {/* Crear unidad comercial */}
            <label style={{ fontSize: 11, color: '#2f7a4d', fontWeight: 'bold' }}>Unidad comercial de este proyecto</label>
            <div style={{ display: 'flex', gap: '0.4rem', margin: '0.2rem 0 0.5rem' }}>
              <input style={{ ...inp, flex: 1 }} placeholder="Nueva UC (ej. Tatuajes)" value={nuevaUC} onChange={(e) => setNuevaUC(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void crearUC(); }} />
              <button style={btn} onClick={() => void crearUC()} disabled={!nuevaUC.trim()}>＋</button>
            </div>

            <div style={{ marginTop: '0.6rem', borderTop: '1px solid #dde6fb', paddingTop: '0.5rem' }}>
              <strong style={{ fontSize: 13 }}>🟢 Curador de este proyecto</strong>
              <p style={{ fontSize: 11, color: '#777', margin: '0.2rem 0 0.4rem' }}>Dile qué negocios contiene o qué vende, y crea negocios o unidades comerciales conversando.</p>
              <ChatArquitecto
                conversar={(h) => conversarCuradorProyecto(h, proyectoId)}
                cargarHistorial={() => cargarConversacionProyecto(proyectoId)}
                historialKey={proyectoId}
                saludo="Soy el Curador de este proyecto. Si es un desarrollo o empresa que agrupa varios negocios (ej. Girly Zone → Altercing, Macao Pilates), dime cuáles son y los creo dentro. Si es un negocio, definimos sus unidades comerciales. Recuerdo todo y veo el estado del proyecto."
                placeholder="Ej: dentro de Girly Zone están Altercing Studio y Macao Pilates…"
                onCambio={cargar}
                altura={280}
              />
            </div>
          </div>

          {/* Grafo */}
          <div style={{ border: '1px solid #eee', borderRadius: 10, background: '#fcfcfc' }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
              {nodos.map((n, i) => { const p = posOf(i, nodos.length); return <line key={`e-${n.key}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={hover === n.key ? '#888' : '#dcdcdc'} strokeWidth={hover === n.key ? 2 : 1} />; })}
              {/* centro */}
              <circle cx={cx} cy={cy} r={48} fill="#1a1a1a" />
              <text x={cx} y={cy + 4} textAnchor="middle" fill="#fff" fontSize={12} fontWeight="bold">{(nombre || 'Proyecto').slice(0, 14)}</text>
              {/* nodos */}
              {nodos.map((n, i) => {
                const p = posOf(i, nodos.length); const activo = hover === n.key;
                return (
                  <g key={n.key} style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHover(n.key)} onMouseLeave={() => setHover(null)}
                    onClick={() => abrirNodo(n)}>
                    <circle cx={p.x} cy={p.y} r={activo ? 40 : 34} fill={n.color} stroke="#fff" strokeWidth={2} />
                    <text x={p.x} y={p.y + 4} textAnchor="middle" fill="#fff" fontSize={11} fontWeight="bold">{abrev(n.tipo)}</text>
                    <text x={p.x} y={p.y + 52} textAnchor="middle" fill="#333" fontSize={12}>{n.label.slice(0, 18)}</text>
                  </g>
                );
              })}
            </svg>
            <p style={{ fontSize: 12, color: '#888', padding: '0 0.75rem 0.5rem' }}>ADM = Administración · SED = Sedes & Espacios · <span style={{ color: '#8a4fbf' }}>NEG = Negocio (sub-empresa)</span> · UC = Unidad Comercial. Clic para entrar.</p>
          </div>
        </div>
      )}
    </section>
  );
}
