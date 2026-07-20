// DURACIONES en texto libre → estructura (ADITIVO).
// Los catálogos reales traen el tiempo como frase: "10–20 min", "20–40 min + valoración
// privada", "1 h", "45min", "1.5 horas". Ese dato existía en las 69 presentaciones de
// Altercing desde su carga y nunca se usó porque nadie lo interpretaba.
// Se conserva el RANGO (no solo el promedio) para poder simular el mejor y el peor caso.

export interface Duracion {
  min: number;   // minutos
  max: number;   // minutos (= min si es un valor único)
  prom: number;  // promedio, el que se usa por defecto
}

// Convierte un número + unidad a minutos. Sin unidad se asumen minutos.
function aMinutos(valor: number, unidad: string | undefined): number {
  const u = (unidad ?? '').toLowerCase();
  if (u.startsWith('h')) return valor * 60;          // h · hr · hrs · hora(s)
  if (u.startsWith('d')) return valor * 60 * 24;     // día(s)
  if (u.startsWith('seg') || u === 's') return valor / 60;
  return valor;                                       // min · minutos · (vacío)
}

// Acepta coma o punto decimal ("1,5 h" y "1.5 h").
function aNumero(txt: string): number {
  return Number(txt.replace(',', '.'));
}

const UNIDAD = '(?:minutos?|mins?|m|horas?|hrs?|hr|h|d[ií]as?|d|segundos?|segs?|s)';

// Interpreta la duración. Devuelve null si no hay un número reconocible: así el
// dato ausente se nota, en vez de inventar un cero que parecería real.
export function parseDuracion(texto: string | undefined | null): Duracion | null {
  if (!texto) return null;
  // Normaliza guiones tipográficos (– —) y espacios raros; el catálogo usa "–".
  const t = String(texto).toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  if (!t) return null;

  // 1) RANGO: "10-20 min" · "20 a 35 minutos" · "1-2 h" · "10 min - 1 h"
  const rango = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNIDAD})?\\s*(?:-|a|hasta)\\s*(\\d+(?:[.,]\\d+)?)\\s*(${UNIDAD})?`).exec(t);
  if (rango) {
    const uFin = rango[4];
    // "1-2 h": la unidad va al final y aplica a ambos extremos.
    const a = aMinutos(aNumero(rango[1]!), rango[2] ?? uFin);
    const b = aMinutos(aNumero(rango[3]!), uFin ?? rango[2]);
    const min = Math.min(a, b), max = Math.max(a, b);
    if (!isFinite(min) || !isFinite(max) || max <= 0) return null;
    return { min, max, prom: Math.round(((min + max) / 2) * 100) / 100 };
  }

  // 2) VALOR ÚNICO: "30 min" · "1 h" · "45min" · "1.5 horas"
  const uno = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNIDAD})?`).exec(t);
  if (uno) {
    const v = aMinutos(aNumero(uno[1]!), uno[2]);
    if (!isFinite(v) || v <= 0) return null;
    return { min: v, max: v, prom: v };
  }
  return null;
}

// Texto corto para mostrar ("15 min" · "10–20 min" · "1 h 30 min").
export function formatDuracion(d: Duracion | null): string {
  if (!d) return '—';
  if (d.min === d.max) return hm(d.min);
  // Si ambos extremos caen en la misma unidad, la unidad se dice una sola vez:
  // "10–20 min" en vez de "10 min–20 min".
  if (d.min < 60 && d.max < 60) return `${Math.round(d.min)}–${Math.round(d.max)} min`;
  return `${hm(d.min)}–${hm(d.max)}`;
}

function hm(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

// Reparte la duración TOTAL de un servicio entre los pasos de su ruta. Se usa cuando
// los pasos no declaran tiempo propio: es una ESTIMACIÓN, y quien la muestre debe
// decirlo. Los pasos que sí tienen tiempo lo conservan y solo se reparte el resto.
export function repartirDuracion(totalMin: number, pasos: { tiempoMin?: number | undefined }[]): number[] {
  if (!pasos.length) return [];
  const declarado = pasos.reduce((s, p) => s + (p.tiempoMin ?? 0), 0);
  const sinTiempo = pasos.filter((p) => !p.tiempoMin).length;
  if (!sinTiempo) return pasos.map((p) => p.tiempoMin ?? 0);
  const resto = Math.max(0, totalMin - declarado);
  const cada = Math.round((resto / sinTiempo) * 100) / 100;
  return pasos.map((p) => p.tiempoMin ?? cada);
}
