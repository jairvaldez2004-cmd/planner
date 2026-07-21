// ACABADOS de pisos y muros (ADITIVO). Un acabado = tipo de material + color, y se
// codifica como "tipo:#rrggbb" (string simple: viaja bien en data JSON y en campos de
// texto). La vista 3D genera la textura procedural correspondiente (ui/texturas.ts);
// aquí vive todo lo puro: catálogo, codificación y colores en español.

export const TIPOS_PISO = ['duela', 'porcelanato', 'azulejo', 'cemento', 'alfombra', 'pintura'] as const;
export const TIPOS_MURO = ['pintura', 'azulejo', 'ladrillo', 'cemento', 'yeso'] as const;
export type TipoPiso = typeof TIPOS_PISO[number];
export type TipoMuro = typeof TIPOS_MURO[number];

export interface Acabado { tipo: string; color: string } // color siempre #rrggbb

// Color por defecto de cada tipo (si el usuario/agente no da color).
const COLOR_DEF: Record<string, string> = {
  duela: '#a67c52', porcelanato: '#d8d2c8', azulejo: '#e8ecec', cemento: '#b9bcbf',
  alfombra: '#8b8f99', pintura: '#f2efe9', ladrillo: '#a85f43', yeso: '#f4f1ea',
};

// Nombres de color en español → hex (los que la gente dice al describir acabados).
const COLORES: Record<string, string> = {
  blanco: '#f5f4f0', negro: '#232323', gris: '#9a9da1', 'gris claro': '#c9ccd0', 'gris oscuro': '#5c6064',
  beige: '#e0d5c0', arena: '#d9c6a5', crema: '#efe7d6', hueso: '#efeadd',
  cafe: '#7a5537', 'café': '#7a5537', chocolate: '#5d4030', madera: '#a67c52', 'madera clara': '#c49a6c', 'madera oscura': '#7c5a3a',
  rojo: '#b6423a', terracota: '#c16b4f', rosa: '#e6b7c1', 'rosa palo': '#dcc0c4',
  naranja: '#d98e4a', amarillo: '#e5c95c', mostaza: '#c9a53c',
  verde: '#5f8f68', 'verde menta': '#a8d5c2', 'verde olivo': '#79804d', esmeralda: '#2f7d64',
  azul: '#4a6f9c', 'azul marino': '#2e3f5c', 'azul cielo': '#a9c8e0', turquesa: '#57b0ad',
  morado: '#7a5f9e', lila: '#c1aed6', violeta: '#6d4b93',
  dorado: '#c9a53c', plateado: '#c0c4c8',
};

// Interpreta un color dicho por humano/agente: hex directo o nombre en español.
// null si no se entiende (mejor que inventar un color equivocado).
export function colorDesdeTexto(txt: string | undefined | null): string | null {
  if (!txt) return null;
  const t = txt.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(t)) return t;
  if (/^#[0-9a-f]{3}$/.test(t)) return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`;
  return COLORES[t] ?? null;
}

// "duela" + "madera clara" → "duela:#c49a6c". El tipo inválido devuelve null.
export function codificarAcabado(tipo: string, color: string | undefined, superficie: 'piso' | 'muro'): string | null {
  const t = tipo.trim().toLowerCase();
  const validos: readonly string[] = superficie === 'piso' ? TIPOS_PISO : TIPOS_MURO;
  if (!validos.includes(t)) return null;
  const c = colorDesdeTexto(color) ?? COLOR_DEF[t] ?? '#cccccc';
  return `${t}:${c}`;
}

export function parseAcabado(encoded: string | undefined | null): Acabado | null {
  if (!encoded) return null;
  const m = /^([a-z]+):(#[0-9a-f]{6})$/.exec(encoded.trim().toLowerCase());
  return m ? { tipo: m[1]!, color: m[2]! } : null;
}

export function describeAcabado(encoded: string | undefined | null): string {
  const a = parseAcabado(encoded);
  if (!a) return 'sin acabado definido';
  const nombre = Object.entries(COLORES).find(([, v]) => v === a.color)?.[0];
  return `${a.tipo}${nombre ? ` ${nombre}` : ` ${a.color}`}`;
}
