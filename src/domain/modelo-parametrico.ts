// MODELO 3D PARAMÉTRICO (ADITIVO, puro). Para que el chat (Diseñador 3D) construya CUALQUIER
// objeto desde cero, sin catálogo fijo: describe el objeto como una lista de PRIMITIVAS
// (cajas/cilindros/esferas/conos con tamaño, posición, color y material) y el builder de
// Three.js lo arma con funciones reales. También lleva una ficha técnica (marca/modelo/…).
// El agente infiere dimensiones y materiales realistas al colocar un producto concreto.
//
// Convención: metros; y = altura desde el piso; el objeto se centra en su huella (x,z ~ 0).

export type FormaPrim = 'caja' | 'cilindro' | 'esfera' | 'cono';
export const FORMAS_PRIM: FormaPrim[] = ['caja', 'cilindro', 'esfera', 'cono'];

// materiales predefinidos (además de un color libre)
export const MATERIALES_PRIM = ['madera', 'maderaOscura', 'metal', 'metalOscuro', 'tela', 'blanco', 'negro', 'cristal', 'vidrio', 'emisivo', 'plastico'];

export interface Primitiva {
  forma: FormaPrim;
  w: number; h: number; d: number;   // caja (m)
  r: number;                          // cilindro/esfera/cono radio (m); h = altura
  x: number; y: number; z: number;    // posición (m); y = altura desde el piso
  rotX: number; rotY: number; rotZ: number; // rotación (radianes)
  color?: string | undefined;         // "#rrggbb"
  material?: string | undefined;      // uno de MATERIALES_PRIM
}

export type FichaTecnica = Record<string, string>; // marca, modelo, dimensiones, consumo, capacidad…

function nnum(v: unknown, def = 0): number { return typeof v === 'number' && Number.isFinite(v) ? v : def; }
function clamp(v: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, v)); }
function hex(v: unknown): string | undefined { return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined; }

export function normalizarPrimitiva(v: unknown): Primitiva {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  const forma = (FORMAS_PRIM as string[]).includes(d.forma as string) ? d.forma as FormaPrim : 'caja';
  return {
    forma,
    w: clamp(nnum(d.w, 0.2), 0.001, 12), h: clamp(nnum(d.h, 0.2), 0.001, 12), d: clamp(nnum(d.d, 0.2), 0.001, 12),
    r: clamp(nnum(d.r, 0.1), 0.001, 6),
    x: clamp(nnum(d.x), -12, 12), y: clamp(nnum(d.y, 0.1), 0, 12), z: clamp(nnum(d.z), -12, 12),
    rotX: nnum(d.rotX), rotY: nnum(d.rotY), rotZ: nnum(d.rotZ),
    ...(hex(d.color) ? { color: hex(d.color) } : {}),
    ...(typeof d.material === 'string' && MATERIALES_PRIM.includes(d.material) ? { material: d.material } : {}),
  };
}

// Lista de primitivas saneada (tope de 60 para no romper la escena).
export function normalizarPrimitivas(v: unknown): Primitiva[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 60).map(normalizarPrimitiva);
}

// Altura total del modelo (m) — para ubicarlo y para "no salirse".
export function alturaModelo(prims: Primitiva[]): number {
  let max = 0;
  for (const p of prims) {
    const semi = p.forma === 'esfera' ? p.r : (p.forma === 'caja' ? p.h / 2 : p.h / 2);
    max = Math.max(max, p.y + semi);
  }
  return max;
}

// Huella (ancho×fondo, m) que ocupa el modelo — para ajustar el objeto.
export function huellaModelo(prims: Primitiva[]): { ancho: number; fondo: number } {
  let ax = 0.1, az = 0.1;
  for (const p of prims) {
    const rx = p.forma === 'caja' ? p.w / 2 : p.r;
    const rz = p.forma === 'caja' ? p.d / 2 : p.r;
    ax = Math.max(ax, Math.abs(p.x) + rx);
    az = Math.max(az, Math.abs(p.z) + rz);
  }
  return { ancho: ax * 2, fondo: az * 2 };
}

// ¿El objeto trae un modelo paramétrico válido en su data?
export function leerModelo3D(data: unknown): Primitiva[] {
  const d = (data && typeof data === 'object') ? data as Record<string, unknown> : {};
  const raw = d.modelo3d;
  // Puede venir como array directo o como string JSON (si data se aplanó a strings).
  if (Array.isArray(raw)) return normalizarPrimitivas(raw);
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try { return normalizarPrimitivas(JSON.parse(raw)); } catch { return []; }
  }
  return [];
}
