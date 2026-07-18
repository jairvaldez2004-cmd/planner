'use client';

// Workspace = Curador (chat persistente) + grafo estilo Obsidian, EN LA MISMA PÁGINA.
// El Curador identifica proyectos y CURA el grafo (renombrar/relacionar/archivar/mover);
// los cambios se reflejan en vivo. Aristas: workspace→proyecto y proyecto↔proyecto (relaciones).

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Workspace } from '@/domain/workspace';
import {
  listarProyectosDeWorkspace, listarRelaciones,
} from '@/app/actions/workspace.actions';
import type { ProyectoNodo, RelacionGrafo } from '@/app/actions/workspace.actions';
import { cargarConversacionWorkspace } from '@/app/actions/contexto.actions';
import { ChatArquitecto } from './chat-arquitecto';
import { useEsMovil } from './use-movil';

const btn: CSSProperties = { padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 14 };

const PALETA = ['#5b8def', '#e0795b', '#5bbf8a', '#b06be0', '#d9a23b', '#3bb0c9', '#cf5b8f'];
function color(clase: string): string {
  let h = 0;
  for (let i = 0; i < clase.length; i++) h = (h * 31 + clase.charCodeAt(i)) >>> 0;
  return PALETA[h % PALETA.length] ?? '#5b8def';
}

interface Props {
  workspace: Workspace;
  onAbrirProyecto: (proyectoId: string) => void;
  onVolver: () => void;
}

export function VistaGrafo({ workspace, onAbrirProyecto, onVolver }: Props) {
  const [nodos, setNodos] = useState<ProyectoNodo[]>([]);
  const [relaciones, setRelaciones] = useState<RelacionGrafo[]>([]);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  const movil = useEsMovil();

  const cargar = () => {
    setLoading(true);
    Promise.all([listarProyectosDeWorkspace(workspace.id), listarRelaciones(workspace.id)])
      // Solo nivel superior: los negocios anidados se ven al entrar a su contenedor.
      .then(([ns, rs]) => { setNodos(ns.filter((n) => !n.padreId)); setRelaciones(rs); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { cargar(); }, [workspace.id]);

  // Layout radial
  const W = 720, H = 520, cx = W / 2, cy = H / 2;
  const R = Math.min(180, 90 + nodos.length * 12);
  const posOf = (i: number) => {
    if (nodos.length === 1) return { x: cx, y: cy - R };
    const a = (i / nodos.length) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  };
  const posById = new Map(nodos.map((n, i) => [n.proyectoId, posOf(i)]));

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>{workspace.nombre} <span style={{ fontSize: 13, color: '#888' }}>· Curador + grafo</span></h2>
        <button style={btn} onClick={onVolver}>← Workspaces</button>
      </div>

      {/* 2 columnas: Curador | Grafo (en celular: 1 columna, grafo abajo del chat) */}
      <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : 'minmax(320px, 5fr) 7fr', gap: '1rem', alignItems: 'start', marginTop: '0.75rem' }}>
        {/* Curador */}
        <div style={{ border: '1px solid #a5d6a7', borderRadius: 10, padding: '0.75rem', background: '#f6fff6' }}>
          <strong style={{ fontSize: 14 }}>Curador del workspace</strong>
          <p style={{ margin: '0.25rem 0 0.5rem', fontSize: 12, color: '#555' }}>
            Acomoda proyectos y cura el grafo: “renombra X a Y”, “relaciona X con Y”, “archiva X”, “mueve X al workspace Z”.
          </p>
          <ChatArquitecto
            workspaceId={workspace.id}
            contexto={{ workspace: workspace.nombre, proyectos: nodos.map((n) => n.nombre) }}
            cargarHistorial={() => cargarConversacionWorkspace(workspace.id)}
            historialKey={workspace.id}
            onCambio={cargar}
            altura={400}
          />
        </div>

        {/* Grafo */}
        <div style={{ border: '1px solid #eee', borderRadius: 10, background: '#fcfcfc', minHeight: 300 }}>
          {loading && <p style={{ color: '#666', padding: '1rem' }}>Cargando grafo…</p>}
          {!loading && (
            <>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                {/* aristas workspace → proyecto */}
                {nodos.map((n) => {
                  const p = posById.get(n.proyectoId)!;
                  return <line key={`e-${n.proyectoId}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={hover === n.proyectoId ? '#888' : '#d5d5d5'} strokeWidth={hover === n.proyectoId ? 2 : 1} />;
                })}
                {/* aristas proyecto ↔ proyecto (relaciones del Curador) */}
                {relaciones.map((r) => {
                  const a = posById.get(r.aId); const b = posById.get(r.bId);
                  if (!a || !b) return null;
                  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
                  return (
                    <g key={r.id}>
                      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#b06be0" strokeWidth={1.5} strokeDasharray="5 4" />
                      {r.etiqueta && <text x={mx} y={my - 4} textAnchor="middle" fontSize={10} fill="#8a4cb8">{r.etiqueta}</text>}
                    </g>
                  );
                })}
                {/* workspace central */}
                <circle cx={cx} cy={cy} r={44} fill="#1a1a1a" />
                <text x={cx} y={cy + 4} textAnchor="middle" fill="#fff" fontSize={13} fontWeight="bold">{workspace.nombre.slice(0, 14)}</text>
                {/* proyectos */}
                {nodos.map((n) => {
                  const p = posById.get(n.proyectoId)!;
                  const c = color(n.clasificacion[0] ?? 'General');
                  const activo = hover === n.proyectoId;
                  return (
                    <g key={n.proyectoId} style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHover(n.proyectoId)} onMouseLeave={() => setHover(null)}
                      onClick={() => onAbrirProyecto(n.proyectoId)}>
                      <circle cx={p.x} cy={p.y} r={activo ? 38 : 32} fill={c} opacity={activo ? 1 : 0.9} stroke="#fff" strokeWidth={2} />
                      {n.comExp && <text x={p.x} y={p.y - 42} textAnchor="middle" fontSize={11} fill="#a60">COM-EXP</text>}
                      <text x={p.x} y={p.y + 4} textAnchor="middle" fill="#fff" fontSize={11} fontWeight="bold">{n.totalPlanos}p</text>
                      <text x={p.x} y={p.y + 52} textAnchor="middle" fill="#333" fontSize={12}>{n.nombre.slice(0, 18)}</text>
                    </g>
                  );
                })}
              </svg>
              {nodos.length === 0 && (
                <p style={{ textAlign: 'center', color: '#666', paddingBottom: '1rem' }}>
                  Sin proyectos aún. Habla con el Curador a la izquierda para acomodar el primero.
                </p>
              )}
            </>
          )}
        </div>
      </div>
      <p style={{ fontSize: 13, color: '#888', marginTop: '0.5rem' }}>Clic en un nodo para entrar al proyecto. Líneas punteadas moradas = relaciones que creó el Curador.</p>
    </section>
  );
}
