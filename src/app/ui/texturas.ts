'use client';

// TEXTURAS PROCEDURALES de acabados (ADITIVO). Ref: domain/acabados.ts.
// Genera con canvas la textura de cada tipo (duela, porcelanato, azulejo, cemento,
// alfombra, ladrillo, yeso) teñida del color del acabado, y la repite A ESCALA REAL
// (el canvas representa 1×1 m; repeat = metros de la superficie). Sin assets externos.

import * as THREE from 'three';
import { parseAcabado } from '@/domain/acabados';

const PX = 256; // resolución del parche de 1×1 m

function tinte(base: string, factor: number): string {
  const n = base.replace('#', '');
  const c = (i: number) => Math.round(Math.min(255, Math.max(0, parseInt(n.slice(i, i + 2), 16) * factor)));
  return `rgb(${c(0)},${c(2)},${c(4)})`;
}

// Dibuja el parche 1×1 m del tipo dado. Cada tipo raya su patrón sobre el color.
function dibujar(tipo: string, color: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = PX; c.height = PX;
  const g = c.getContext('2d')!;
  g.fillStyle = color; g.fillRect(0, 0, PX, PX);

  if (tipo === 'duela') {
    // tablones horizontales de ~12 cm con vetas y juntas corridas
    const alto = PX * 0.12;
    for (let y = 0, fila = 0; y < PX; y += alto, fila++) {
      g.fillStyle = tinte(color, 0.9 + (fila % 3) * 0.08);
      g.fillRect(0, y, PX, alto - 1);
      g.strokeStyle = tinte(color, 0.65); g.lineWidth = 1;
      const offset = (fila % 2) * PX * 0.5;
      g.strokeRect(offset - PX, y, PX, alto - 1); g.strokeRect(offset, y, PX, alto - 1);
      for (let i = 0; i < 3; i++) { // vetas sutiles
        g.strokeStyle = tinte(color, 0.8); g.beginPath();
        const vy = y + (i + 1) * alto / 4;
        g.moveTo(0, vy); g.bezierCurveTo(PX / 3, vy + 2, 2 * PX / 3, vy - 2, PX, vy); g.stroke();
      }
    }
  } else if (tipo === 'porcelanato') {
    // losas de 50 cm con junta fina
    g.strokeStyle = tinte(color, 0.75); g.lineWidth = 2;
    for (const v of [0, PX / 2, PX]) { g.beginPath(); g.moveTo(v, 0); g.lineTo(v, PX); g.stroke(); g.beginPath(); g.moveTo(0, v); g.lineTo(PX, v); g.stroke(); }
  } else if (tipo === 'azulejo') {
    // mosaicos de 20 cm con junta clara
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2;
    const paso = PX / 5;
    for (let v = 0; v <= PX; v += paso) { g.beginPath(); g.moveTo(v, 0); g.lineTo(v, PX); g.stroke(); g.beginPath(); g.moveTo(0, v); g.lineTo(PX, v); g.stroke(); }
  } else if (tipo === 'cemento') {
    // manchas suaves de cemento pulido
    for (let i = 0; i < 240; i++) {
      g.fillStyle = tinte(color, 0.9 + Math.random() * 0.2);
      const r = 4 + Math.random() * 16;
      g.beginPath(); g.arc(Math.random() * PX, Math.random() * PX, r, 0, Math.PI * 2); g.fill();
    }
  } else if (tipo === 'alfombra') {
    // punteado fino
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = tinte(color, 0.85 + Math.random() * 0.3);
      g.fillRect(Math.random() * PX, Math.random() * PX, 2, 2);
    }
  } else if (tipo === 'ladrillo') {
    // hiladas de ladrillo de 7×22 cm con junta de mortero
    const h = PX * 0.07, w = PX * 0.22;
    g.fillStyle = tinte(color, 1.35); g.fillRect(0, 0, PX, PX); // mortero
    for (let y = 0, fila = 0; y < PX; y += h, fila++) {
      const off = (fila % 2) * w / 2;
      for (let x = -w; x < PX + w; x += w) {
        g.fillStyle = tinte(color, 0.9 + ((fila + Math.round(x / w)) % 3) * 0.07);
        g.fillRect(x + off + 1.5, y + 1.5, w - 3, h - 3);
      }
    }
  } else if (tipo === 'yeso') {
    // textura leve de llana
    for (let i = 0; i < 120; i++) {
      g.strokeStyle = tinte(color, 0.94 + Math.random() * 0.1); g.lineWidth = 3;
      const x = Math.random() * PX, y = Math.random() * PX;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 20, y + 6, x + 40, y); g.stroke();
    }
  }
  // 'pintura' = color liso, sin patrón
  return c;
}

// Material PBR con el acabado codificado ("tipo:#hex") repetido a los metros dados.
// null si el acabado no se entiende (quien llama conserva su material por defecto).
export function materialAcabado(encoded: string | undefined | null, metrosX: number, metrosY: number): THREE.MeshStandardMaterial | null {
  const a = parseAcabado(encoded);
  if (!a) return null;
  const rugosidad: Record<string, number> = { duela: 0.55, porcelanato: 0.25, azulejo: 0.2, cemento: 0.8, alfombra: 0.98, pintura: 0.85, ladrillo: 0.9, yeso: 0.92 };
  if (a.tipo === 'pintura') {
    return new THREE.MeshStandardMaterial({ color: a.color, roughness: rugosidad.pintura ?? 0.85, metalness: 0 });
  }
  const tex = new THREE.CanvasTexture(dibujar(a.tipo, a.color));
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(Math.max(1, metrosX), Math.max(1, metrosY));
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: rugosidad[a.tipo] ?? 0.7, metalness: a.tipo === 'porcelanato' || a.tipo === 'azulejo' ? 0.06 : 0 });
}
