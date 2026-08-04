'use client';

// SECCIÓN DE PLANOS (2D + 3D) para el entregable de Arquitectura. Carga las sedes del proyecto
// y, por sede y nivel, muestra el plano 2D (read-only) + un botón para abrir el visor 3D
// interactivo (Vista3D, que ya trae la descarga .glb reutilizable en el editor 3D).

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { listarSedes, listarEspacios, listarObjetos, listarElementos } from '@/app/actions/espacios.actions';
import { Plano2D } from './plano-2d';
import type { EspacioLite, ObjetoLite, ElementoLite } from './plano-2d';
import { Vista3D } from './vista-3d';

type Sede = Awaited<ReturnType<typeof listarSedes>>[number];
type Esp = Awaited<ReturnType<typeof listarEspacios>>[number];
type Obj = Awaited<ReturnType<typeof listarObjetos>>[number];
type Elem = Awaited<ReturnType<typeof listarElementos>>[number];

interface SedeData { sede: Sede; espacios: Esp[]; objetos: Obj[]; elementos: Elem[]; footAncho: number; footAlto: number }

const btnGold: CSSProperties = { padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid var(--bp-gold)', background: 'var(--bp-gold-soft)', color: 'var(--bp-gold)', cursor: 'pointer', fontSize: 12.5, fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap' };
const capaN = (x: { capa?: number }) => x.capa ?? 0;

export function ArqPlanoSection({ proyectoId, idPrefix = 'arq' }: { proyectoId: string; idPrefix?: string }) {
  const [datos, setDatos] = useState<SedeData[] | null>(null);
  const [ver3D, setVer3D] = useState<{ si: number; capa: number } | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const sedes = await listarSedes(proyectoId);
      const out: SedeData[] = [];
      for (const s of sedes) {
        const [espacios, objetos, elementos] = await Promise.all([listarEspacios(s.id), listarObjetos(s.id), listarElementos(s.id)]);
        out.push({ sede: s, espacios, objetos, elementos, footAncho: s.footAncho ?? 20, footAlto: s.footAlto ?? 15 });
      }
      if (vivo) setDatos(out);
    })().catch(() => { if (vivo) setDatos([]); });
    return () => { vivo = false; };
  }, [proyectoId]);

  if (datos === null) return <p style={{ color: 'var(--bp-muted)', fontFamily: 'system-ui, sans-serif' }}>Cargando planos…</p>;

  return (
    <section id={`${idPrefix}-planos`} style={{ borderTop: '4px double var(--bp-border)', paddingTop: '1rem', marginTop: '1.6rem' }}>
      <h2 style={{ fontSize: 25, margin: '0 0 4px' }}>📐 Planos de la sede — 2D y 3D</h2>
      <div style={{ fontSize: 13, color: 'var(--bp-muted)', fontFamily: 'system-ui, sans-serif', marginBottom: 12 }}>
        Plano 2D por nivel + visor 3D interactivo con descarga <strong>.glb</strong> (reutilizable en el editor de planos 3D y en cualquier visor glTF).
      </div>

      {datos.length === 0 && <p style={{ color: 'var(--bp-muted)', fontFamily: 'system-ui, sans-serif' }}>Este proyecto aún no tiene sedes/planos capturados en el editor de espacios.</p>}

      {datos.map((d, si) => {
        const capas = Array.from(new Set([...d.espacios, ...d.elementos, ...d.objetos].map(capaN))).sort((a, b) => a - b);
        const niveles = capas.length ? capas : [0];
        return (
          <div key={d.sede.id} style={{ marginBottom: '1.4rem' }}>
            <h3 style={{ fontSize: 20, margin: '0.6rem 0 0.3rem' }}>🏠 {d.sede.nombre} <span style={{ fontSize: 12.5, color: 'var(--bp-muted)', fontFamily: 'system-ui, sans-serif' }}>· {d.footAncho}×{d.footAlto} m</span></h3>
            {niveles.map((capa) => {
              const esp = d.espacios.filter((e) => capaN(e) === capa);
              const obj = d.objetos.filter((o) => capaN(o) === capa);
              const el = d.elementos.filter((e) => capaN(e) === capa);
              return (
                <div key={capa} style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--bp-muted)', fontFamily: 'system-ui, sans-serif', flex: 1 }}>Nivel {capa} · {esp.length} espacios · {el.length} muros/puertas/ventanas · {obj.length} objetos</span>
                    <button className="no-pdf no-print" style={btnGold} onClick={() => setVer3D({ si, capa })}>🧊 Ver y descargar en 3D</button>
                  </div>
                  <Plano2D
                    espacios={esp as unknown as EspacioLite[]}
                    objetos={obj as unknown as ObjetoLite[]}
                    elementos={el as unknown as ElementoLite[]}
                    footAncho={d.footAncho} footAlto={d.footAlto}
                    muroExt={d.sede.muroExterior ?? 0.30} muroInt={d.sede.muroInterior ?? 0.15}
                  />
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Overlay del visor 3D interactivo (con descarga .glb dentro) */}
      {ver3D && datos[ver3D.si] && (() => {
        const d = datos[ver3D.si]!;
        const esp = d.espacios.filter((e) => capaN(e) === ver3D.capa);
        const obj = d.objetos.filter((o) => capaN(o) === ver3D.capa);
        const el = d.elementos.filter((e) => capaN(e) === ver3D.capa);
        return (
          <div className="no-pdf no-print" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(6,6,9,0.92)', overflow: 'auto', padding: '1rem' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', background: 'var(--bp-panel)', border: '1px solid var(--bp-border)', borderRadius: 12, padding: '1rem' }}>
              <Vista3D
                sede={d.sede} espacios={esp} objetos={obj} elementos={el}
                footAncho={d.footAncho} footAlto={d.footAlto}
                proyectoId={proyectoId} capa={ver3D.capa}
                onCambio={() => {}} onCerrar={() => setVer3D(null)}
              />
            </div>
          </div>
        );
      })()}
    </section>
  );
}
