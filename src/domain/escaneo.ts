// REPORTE DE MEDIDAS estilo MAKE.PLAN (ADITIVO, puro). A partir de la geometría real
// (Espacios en metros + muros/puertas/ventanas) produce el mismo entregable que una app de
// escaneo LiDAR: área por cuarto, m² totales, perímetro, longitud de muros y conteo de
// puertas/ventanas y objetos. El escaneo en sí ocurre en el teléfono (MAKE.PLAN/Polycam);
// el planner importa el .glb y aquí calcula el reporte medible.

import type { Espacio, ObjetoFisico, ElementoArq } from './espacios';

// Área de un polígono (fórmula del cordón / shoelace), en las unidades de sus puntos (m).
function areaPoligono(pts: { x: number; y: number }[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

// Área de un espacio (m²): polígono real si existe, si no el rectángulo ancho×alto.
export function areaEspacio(e: Pick<Espacio, 'ancho' | 'alto' | 'poligono'>): number {
  if (e.poligono && e.poligono.length >= 3) return areaPoligono(e.poligono);
  return Math.max(0, e.ancho) * Math.max(0, e.alto);
}

// Perímetro de un espacio (m).
export function perimetroEspacio(e: Pick<Espacio, 'ancho' | 'alto' | 'poligono'>): number {
  if (e.poligono && e.poligono.length >= 3) {
    let per = 0;
    for (let i = 0; i < e.poligono.length; i++) {
      const p = e.poligono[i]!, q = e.poligono[(i + 1) % e.poligono.length]!;
      per += Math.hypot(q.x - p.x, q.y - p.y);
    }
    return per;
  }
  return 2 * (Math.max(0, e.ancho) + Math.max(0, e.alto));
}

// Longitud de un muro/puerta/ventana (m).
export function longitudElemento(el: Pick<ElementoArq, 'x1' | 'y1' | 'x2' | 'y2'>): number {
  return Math.hypot(el.x2 - el.x1, el.y2 - el.y1);
}

export interface CuartoReporte {
  id: string; nombre: string; tipo: string; capa: number;
  ancho: number; alto: number; m2: number; perimetro: number; objetos: number;
}
export interface MurosReporte { longitudTotal: number; nMuros: number; nPuertas: number; nVentanas: number }
export interface ReporteEscaneo {
  totalM2: number; niveles: number; nCuartos: number; nObjetos: number;
  cuartos: CuartoReporte[]; muros: MurosReporte;
}

// Reporte de un nivel (o de todos si no se filtra por capa).
export function reporteEscaneo(espacios: Espacio[], objetos: ObjetoFisico[], elementos: ElementoArq[]): ReporteEscaneo {
  const cuartos: CuartoReporte[] = espacios
    .filter((e) => e.tipo === 'area' || e.tipo === 'habitacion')
    .map((e) => ({
      id: e.id, nombre: e.nombre, tipo: e.tipo, capa: e.capa,
      ancho: e.ancho, alto: e.alto, m2: areaEspacio(e), perimetro: perimetroEspacio(e),
      objetos: objetos.filter((o) => o.espacioId === e.id).length,
    }))
    .sort((a, b) => b.m2 - a.m2);
  const muro = (t: string) => elementos.filter((x) => x.tipo === t);
  return {
    totalM2: cuartos.reduce((s, c) => s + c.m2, 0),
    niveles: new Set(espacios.map((e) => e.capa)).size,
    nCuartos: cuartos.length,
    nObjetos: objetos.length,
    cuartos,
    muros: {
      longitudTotal: muro('muro').reduce((s, x) => s + longitudElemento(x), 0),
      nMuros: muro('muro').length, nPuertas: muro('puerta').length, nVentanas: muro('ventana').length,
    },
  };
}

// Formato de área/longitud para el reporte.
export function m2(n: number): string { return n.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' m²'; }
export function metros(n: number): string { return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m'; }
