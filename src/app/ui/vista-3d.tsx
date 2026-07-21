'use client';

// VISTA 3D (isométrica "casa de muñecas") del plano de una sede. ADITIVO.
// Extruye la geometría 2D que ya existe (huella + áreas + objetos con altura estimada)
// a un volumen que se puede girar a los 4 lados. NO es fotorrealismo: es la misma data,
// vista en 3D, para revisar el espacio. Se genera con SVG puro (sin dependencias 3D).

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { iso, rotarCuarto, profundidad, tapaCaja, caraVertical, sombra } from '@/domain/iso';
import type { Iso, P2 } from '@/domain/iso';
import { centroDe, esquinasDe, alturaObjeto } from '@/domain/espacios';
import type { Espacio, ObjetoFisico, Sede } from '@/domain/espacios';

const btn: CSSProperties = { padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };

interface Cara { pts: Iso[]; fill: string; stroke: string; depth: number; z: number; label?: { x: number; y: number; t: string } | undefined }

interface Props {
  sede: Sede;
  espacios: Espacio[];
  objetos: ObjetoFisico[];
  footAncho: number;
  footAlto: number;
  onCerrar?: (() => void) | undefined;
}

export function Vista3D({ sede, espacios, objetos, footAncho, footAlto, onCerrar }: Props) {
  const [q, setQ] = useState(0);          // giro de cámara (0..3 = 90° cada uno)
  const [muroAlt, setMuroAlt] = useState(2.6); // altura de muro (m)
  const centro: P2 = { x: footAncho / 2, y: footAlto / 2 };

  const escena = useMemo(() => construirEscena({ espacios, objetos, footAncho, footAlto, muroAlt, q, centro }),
    [espacios, objetos, footAncho, footAlto, muroAlt, q]);

  const S = 46; // px por metro
  const PAD = 30;
  const pts = escena.flatMap((c) => c.pts);
  const minX = Math.min(...pts.map((p) => p.sx)), maxX = Math.max(...pts.map((p) => p.sx));
  const minY = Math.min(...pts.map((p) => p.sy)), maxY = Math.max(...pts.map((p) => p.sy));
  const W = (maxX - minX) * S + PAD * 2, H = (maxY - minY) * S + PAD * 2;
  const px = (p: Iso) => `${(p.sx - minX) * S + PAD},${(p.sy - minY) * S + PAD}`;
  const poly = (c: Cara) => c.pts.map(px).join(' ');

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>🧊 Vista 3D <span style={{ fontSize: 12.5, color: '#888' }}>· {sede.nombre} · isométrica del plano</span></h3>
        {onCerrar && <button style={btn} onClick={onCerrar}>← Editor 2D</button>}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', margin: '0.5rem 0' }}>
        <button style={btn} onClick={() => setQ((v) => (v + 3) % 4)} title="Girar la cámara">↺ Girar</button>
        <button style={btn} onClick={() => setQ((v) => (v + 1) % 4)}>Girar ↻</button>
        <span style={{ fontSize: 12, color: '#666' }}>Vista {q * 90}°</span>
        <span style={{ marginLeft: 12, fontSize: 12, color: '#666' }}>Altura de muro</span>
        <input type="range" min={0} max={3.5} step={0.1} value={muroAlt} onChange={(e) => setMuroAlt(Number(e.target.value))} />
        <span style={{ fontSize: 12, color: '#666' }}>{muroAlt.toFixed(1)} m</span>
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 10, background: 'linear-gradient(#f4f6fa,#eaeef4)', overflow: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '72vh' }}>
          {escena.map((c, i) => (
            <polygon key={i} points={poly(c)} fill={c.fill} stroke={c.stroke} strokeWidth={0.8} strokeLinejoin="round" />
          ))}
          {escena.filter((c) => c.label).map((c, i) => (
            <text key={`l${i}`} x={(c.label!.x - minX) * S + PAD} y={(c.label!.y - minY) * S + PAD}
              textAnchor="middle" fontSize={10} fill="#3a4a63" fontWeight="bold" style={{ pointerEvents: 'none' }}>{c.label!.t}</text>
          ))}
        </svg>
      </div>
      <p style={{ fontSize: 11.5, color: '#888', margin: '0.4rem 0 0' }}>
        Vista 3D generada del plano 2D (áreas y objetos extruidos por su altura estimada). No es un render fotorrealista;
        es tu mismo modelo en volumen para revisarlo. Gira la cámara para ver detrás de los muros.
      </p>
    </section>
  );
}

function construirEscena({ espacios, objetos, footAncho, footAlto, muroAlt, q, centro }: {
  espacios: Espacio[]; objetos: ObjetoFisico[]; footAncho: number; footAlto: number; muroAlt: number; q: number; centro: P2;
}): Cara[] {
  const R = (x: number, y: number) => rotarCuarto({ x, y }, centro, q);
  const caras: Cara[] = [];

  // --- piso (huella completa) ---
  const e0 = R(0, 0), e1 = R(footAncho, 0), e2 = R(footAncho, footAlto), e3 = R(0, footAlto);
  caras.push({
    pts: [e0, e1, e2, e3].map((p) => iso(p.x, p.y, 0)),
    fill: '#e9ecf2', stroke: '#cfd6e2', depth: -Infinity, z: 0,
  });

  // --- áreas (losas de color a ras de piso) ---
  for (const s of espacios) {
    const puntos = (s.poligono && s.poligono.length >= 3)
      ? s.poligono.map((p) => R(p.x, p.y))
      : esquinasDe({ x: s.x, y: s.y, ancho: s.ancho, alto: s.alto, rot: s.rot }).map((p) => R(p.x, p.y));
    const c = puntos.reduce((a, p) => ({ x: a.x + p.x / puntos.length, y: a.y + p.y / puntos.length }), { x: 0, y: 0 });
    const li = iso(c.x, c.y, 0.02);
    // Las losas son planas a ras de piso: se dibujan TODAS antes que muros y objetos
    // (offset grande negativo) para que nada quede tapado por una losa más cercana.
    caras.push({
      pts: puntos.map((p) => iso(p.x, p.y, 0.02)),
      fill: '#dbe6f5', stroke: '#a9c0e0', depth: -100000 + profundidad(c.x, c.y), z: 0.02,
      label: { x: li.sx, y: li.sy, t: s.nombre.length > 16 ? s.nombre.slice(0, 15) + '…' : s.nombre },
    });
  }

  // --- muros perimetrales: solo los 2 del fondo (dollhouse abierto) ---
  const esquinas = [R(0, 0), R(footAncho, 0), R(footAncho, footAlto), R(0, footAlto)];
  // ordena las aristas por profundidad de su punto medio; dibuja solo las 2 más lejanas
  const aristas: [P2, P2][] = [[esquinas[0]!, esquinas[1]!], [esquinas[1]!, esquinas[2]!], [esquinas[2]!, esquinas[3]!], [esquinas[3]!, esquinas[0]!]];
  const conProf = aristas.map((ar) => ({ ar, d: profundidad((ar[0].x + ar[1].x) / 2, (ar[0].y + ar[1].y) / 2) })).sort((a, b) => a.d - b.d);
  for (const { ar, d } of conProf.slice(0, 2)) {
    caras.push({ pts: caraVertical(ar[0], ar[1], 0, muroAlt), fill: '#f2f4f8', stroke: '#c7cfdc', depth: d - 5, z: muroAlt });
  }

  // --- objetos: cajas extruidas ---
  for (const o of objetos) {
    const h = alturaObjeto(o.nombre, o.categoria);
    // esquinas del objeto (ya con su rot propia) y luego rotadas por la cámara
    const esq = esquinasDe({ x: o.x, y: o.y, ancho: o.ancho, alto: o.alto, rot: o.rot }).map((p) => R(p.x, p.y));
    const cx = esq.reduce((a, p) => a + p.x, 0) / 4, cy = esq.reduce((a, p) => a + p.y, 0) / 4;
    const base = '#e0a96b';
    // 4 caras laterales, ordenadas para pintar de atrás hacia adelante
    const lados: [P2, P2][] = [[esq[0]!, esq[1]!], [esq[1]!, esq[2]!], [esq[2]!, esq[3]!], [esq[3]!, esq[0]!]];
    const ladosProf = lados.map((ar) => ({ ar, d: profundidad((ar[0].x + ar[1].x) / 2, (ar[0].y + ar[1].y) / 2) }))
      .sort((a, b) => a.d - b.d);
    for (const { ar, d } of ladosProf) {
      caras.push({ pts: caraVertical(ar[0], ar[1], 0, h), fill: sombra(base, d <= profundidad(cx, cy) ? 0.72 : 0.88), stroke: '#b5813f', depth: profundidad(cx, cy) - 0.3 + (d - profundidad(cx, cy)) * 0.001, z: h });
    }
    // tapa
    caras.push({
      pts: esq.map((p) => iso(p.x, p.y, h)), fill: sombra(base, 1.12), stroke: '#b5813f',
      depth: profundidad(cx, cy), z: h,
      label: (() => { const li = iso(cx, cy, h); return { x: li.sx, y: li.sy, t: o.nombre.length > 12 ? o.nombre.slice(0, 11) + '…' : o.nombre }; })(),
    });
  }

  // painter's algorithm: de más lejano (menor profundidad) a más cercano
  return caras.sort((a, b) => a.depth - b.depth || a.z - b.z);
}
