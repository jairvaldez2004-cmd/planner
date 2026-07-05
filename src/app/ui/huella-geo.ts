// Geometría de huellas en lat/lng (pura, sin Leaflet). Metros locales por proyección plana:
// exacta para huellas de edificios (pocas decenas de metros).

export type LL = [number, number]; // [lat, lng]
const R = 111320; // metros por grado de latitud

// vector (este, norte) en metros de A→B
function vec(from: LL, to: LL): [number, number] {
  const latMid = (from[0] + to[0]) / 2;
  return [(to[1] - from[1]) * R * Math.cos(latMid * Math.PI / 180), (to[0] - from[0]) * R];
}

export function distM(a: LL, b: LL): number {
  const v = vec(a, b); return Math.hypot(v[0], v[1]);
}

// rumbo de A→B respecto al NORTE, en grados 0–360 (0 = norte, 90 = este)
export function bearingDeg(a: LL, b: LL): number {
  const v = vec(a, b);
  const deg = Math.atan2(v[0], v[1]) * 180 / Math.PI; // atan2(este, norte)
  return (deg + 360) % 360;
}

export function centroide(poly: LL[]): LL {
  const n = Math.max(1, poly.length);
  return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
}

// ángulo interior (grados) en el vértice v, entre v→prev y v→next
export function anguloInterior(prev: LL, v: LL, next: LL): number {
  const a = vec(v, prev), b = vec(v, next);
  const ma = Math.hypot(a[0], a[1]), mb = Math.hypot(b[0], b[1]);
  if (ma === 0 || mb === 0) return 0;
  const dot = (a[0] * b[0] + a[1] * b[1]) / (ma * mb);
  return Math.round(Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI);
}

// Rectángulo W×H (m) centrado en `center`, con el lado "ancho" orientado a `angleDeg` respecto al norte.
export function rectRotado(center: LL, W: number, H: number, angleDeg: number): LL[] {
  const th = angleDeg * Math.PI / 180;
  const s = Math.sin(th), c = Math.cos(th);
  const cosLat = Math.cos(center[0] * Math.PI / 180) || 1;
  const corner = (a: number, b: number): LL => {
    const x = a * (W / 2) * s + b * (H / 2) * c; // este (m)
    const y = a * (W / 2) * c - b * (H / 2) * s; // norte (m)
    return [center[0] + y / R, center[1] + x / (R * cosLat)];
  };
  return [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
}

// Ancho/Alto/Orientación de un polígono ~rectangular (4 vértices: lado 0-1 = ancho, 1-2 = alto).
export function medidasDeRect(poly: LL[]): { W: number; H: number; orient: number } {
  if (poly.length < 4) return { W: 0, H: 0, orient: 0 };
  return {
    W: Math.round(distM(poly[0]!, poly[1]!) * 10) / 10,
    H: Math.round(distM(poly[1]!, poly[2]!) * 10) / 10,
    orient: Math.round(bearingDeg(poly[0]!, poly[1]!)),
  };
}
