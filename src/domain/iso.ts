// VISTA 3D del plano (ADITIVO). NO es un motor de render ni fotorrealismo (eso lo
// descartamos: sería competir con SketchUp/Blender). Es una PROYECCIÓN ISOMÉTRICA de la
// geometría que ya tenemos (huella + áreas + objetos), extruida por alturas — una vista
// "casa de muñecas" para ver el espacio en volumen. Funciones puras, sin IO.

export interface P2 { x: number; y: number }          // metros en el plano
export interface Iso { sx: number; sy: number }        // pantalla (sin escalar)

const ANG = Math.PI / 6;   // 30° — isométrica clásica 2:1
const COS = Math.cos(ANG), SIN = Math.sin(ANG);

// Proyecta un punto (x,y en metros del plano, z altura en metros) a pantalla.
// Mayor z sube (sy menor). El escalado y el centrado los aplica quien dibuja.
export function iso(x: number, y: number, z: number): Iso {
  return { sx: (x - y) * COS, sy: (x + y) * SIN - z };
}

// Rota (x,y) 90°·q en sentido horario alrededor de un centro. Sirve para girar la
// cámara a los 4 lados y poder ver detrás de los muros/objetos.
export function rotarCuarto(p: P2, centro: P2, q: number): P2 {
  let { x, y } = p;
  const n = ((q % 4) + 4) % 4;
  for (let i = 0; i < n; i++) {
    const dx = x - centro.x, dy = y - centro.y;
    x = centro.x - dy; y = centro.y + dx;
  }
  return { x, y };
}

// Clave de profundidad (painter's algorithm): mayor (x+y) = más cerca del observador,
// se dibuja después. Se usa el centro de cada figura ya rotada.
export function profundidad(cx: number, cy: number): number {
  return cx + cy;
}

// Las 4 esquinas de la TAPA de una caja (a altura z), en orden para polígono.
export function tapaCaja(x: number, y: number, w: number, d: number, z: number): Iso[] {
  return [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)];
}

// Una CARA vertical entre dos puntos del plano, del suelo (z0) a una altura (z1).
export function caraVertical(a: P2, b: P2, z0: number, z1: number): Iso[] {
  return [iso(a.x, a.y, z0), iso(b.x, b.y, z0), iso(b.x, b.y, z1), iso(a.x, a.y, z1)];
}

// Bounding box en pantalla de un conjunto de puntos iso (para encuadrar y escalar).
export function encuadre(puntos: Iso[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = puntos.map((p) => p.sx), ys = puntos.map((p) => p.sy);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

// Aclara/oscurece un color hex para sombrear caras (tapa clara, laterales oscuros).
export function sombra(hex: string, factor: number): string {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = Math.round(Math.min(255, Math.max(0, parseInt(n.slice(0, 2), 16) * factor)));
  const g = Math.round(Math.min(255, Math.max(0, parseInt(n.slice(2, 4), 16) * factor)));
  const b = Math.round(Math.min(255, Math.max(0, parseInt(n.slice(4, 6), 16) * factor)));
  const hx = (v: number) => v.toString(16).padStart(2, '0');
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}
