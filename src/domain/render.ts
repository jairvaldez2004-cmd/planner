// RENDERS EXTERNOS de una sede (ADITIVO). Un render/plano/foto subido se ADAPTA al
// modelo con dos primitivas:
//   · CALIBRACIÓN — 2 clics sobre una distancia conocida ("este muro mide 3 m") y los
//     píxeles de la imagen pasan a ser metros (se puede medir sobre la imagen).
//   · ANCLAJES — un punto de la imagen apunta a un Espacio u ObjetoFisico REAL: la
//     misma "Cabina 1" en el plano 2D, el 3D y el render, siempre con la misma ficha.
// Coordenadas SIEMPRE en píxeles de la imagen natural (independientes del tamaño de
// pantalla). Funciones puras, sin IO.

export interface PuntoPx { x: number; y: number }

export interface Calibracion {
  x1: number; y1: number; x2: number; y2: number; // los 2 clics (px naturales)
  metros: number;                                  // distancia real entre ellos
}

export interface AnclajeRender {
  id: string;
  x: number; y: number;              // punto en px naturales
  tipo: 'espacio' | 'objeto';
  ref: string;                       // id del Espacio/ObjetoFisico real
  nombre: string;                    // etiqueta visible (redundante para mostrar rápido)
}

export const MAX_RENDER_BYTES = 5 * 1024 * 1024; // 5 MB (viven en Postgres)
export const MIMES_RENDER = ['image/png', 'image/jpeg', 'image/webp'];

export function distanciaPx(a: PuntoPx, b: PuntoPx): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// Escala de la imagen: metros por píxel. null si la calibración no es válida
// (puntos repetidos o distancia no positiva) — mejor sin escala que con una falsa.
export function metrosPorPixel(c: Calibracion): number | null {
  const px = distanciaPx({ x: c.x1, y: c.y1 }, { x: c.x2, y: c.y2 });
  if (px <= 0 || !(c.metros > 0)) return null;
  return c.metros / px;
}

// Distancia REAL entre dos puntos de la imagen (para medir sobre el render).
export function distanciaMetros(a: PuntoPx, b: PuntoPx, c: Calibracion): number | null {
  const mpp = metrosPorPixel(c);
  return mpp === null ? null : distanciaPx(a, b) * mpp;
}

export function formatoMetros(m: number | null): string {
  if (m === null) return '—';
  return m < 1 ? `${Math.round(m * 100)} cm` : `${m.toFixed(2)} m`;
}

// Validación de subida (tipo y tamaño). Devuelve el motivo del rechazo o null si pasa.
export function validarRender(mime: string, bytes: number): string | null {
  if (!MIMES_RENDER.includes(mime)) return `Formato no soportado (${mime}). Usa PNG, JPG o WebP.`;
  if (bytes <= 0) return 'El archivo está vacío.';
  if (bytes > MAX_RENDER_BYTES) return `La imagen pesa ${(bytes / 1024 / 1024).toFixed(1)} MB; el máximo es 5 MB.`;
  return null;
}
