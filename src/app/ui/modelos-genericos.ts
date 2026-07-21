// MODELOS 3D GENÉRICOS PARAMÉTRICOS (ADITIVO). Para los objetos que AÚN NO EXISTEN
// físicamente (no hay nada que escanear): en vez de una caja, la vista 3D construye una
// forma reconocible según el nombre/categoría — camilla con patas, silla, mostrador,
// vitrina, lámpara… — ajustada a la huella declarada (ancho×fondo en metros).
// Primitivas de Three.js puras (sin assets externos); si nada aplica, cae a la caja.

import * as THREE from 'three';

const M = {
  madera: (c = 0xb98b5a) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.05 }),
  maderaOscura: () => new THREE.MeshStandardMaterial({ color: 0x8a6740, roughness: 0.65, metalness: 0.05 }),
  metal: (c = 0x9fb0bf) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.7 }),
  metalOscuro: () => new THREE.MeshStandardMaterial({ color: 0x5a646e, roughness: 0.35, metalness: 0.6 }),
  colchon: () => new THREE.MeshStandardMaterial({ color: 0x2f3640, roughness: 0.85, metalness: 0 }),   // vinil negro de estudio
  tela: (c = 0x7d8ba1) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0 }),
  blanco: () => new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5, metalness: 0.05 }),
  cristal: () => new THREE.MeshPhysicalMaterial({ color: 0xcfe4ef, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.32 }),
  emisivo: () => new THREE.MeshStandardMaterial({ color: 0xfffbe8, emissive: 0xfff3c0, emissiveIntensity: 1.4, roughness: 0.4 }),
};

function caja(g: THREE.Group, w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
function cilindro(g: THREE.Group, r: number, h: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
// 4 patas en las esquinas de una huella w×d, de altura h.
function patas(g: THREE.Group, w: number, d: number, h: number, r: number, mat: THREE.Material): void {
  const px = w / 2 - r * 1.6, pz = d / 2 - r * 1.6;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    cilindro(g, r, h, mat, sx * px, h / 2, sz * pz);
  }
}

// ---------- constructores (cada uno llena un Group centrado en origen, apoyado en y=0,
// con huella w(x) × d(z) en metros) ----------

function camilla(g: THREE.Group, w: number, d: number): void {
  patas(g, w, d, 0.5, 0.03, M.metalOscuro());
  caja(g, w, 0.06, d, M.metal(), 0, 0.53, 0);                       // bastidor
  caja(g, w * 0.98, 0.12, d * 0.94, M.colchon(), 0, 0.62, 0);       // colchoneta
  const cab = caja(g, w * 0.22, 0.1, d * 0.9, M.colchon(), -w * 0.36, 0.72, 0); // respaldo reclinado
  cab.rotation.z = 0.35;
}

function sillas(g: THREE.Group, w: number, d: number): void {
  // llena el frente con sillas de ~0.45 m
  const n = Math.max(1, Math.floor(w / 0.5));
  const paso = w / n;
  for (let i = 0; i < n; i++) {
    const s = new THREE.Group();
    const cx = -w / 2 + paso * (i + 0.5);
    const sw = Math.min(0.42, paso * 0.85), sd = Math.min(0.42, d * 0.9);
    patas(s, sw, sd, 0.42, 0.02, M.metalOscuro());
    caja(s, sw, 0.05, sd, M.tela(), 0, 0.45, 0);                    // asiento
    caja(s, sw, 0.4, 0.05, M.tela(), 0, 0.68, -sd / 2 + 0.025);     // respaldo
    s.position.x = cx;
    g.add(s);
  }
}

function banco(g: THREE.Group, w: number, d: number): void {
  const r = Math.min(w, d) / 2 * 0.8;
  cilindro(g, 0.04, 0.5, M.metalOscuro(), 0, 0.25, 0);
  cilindro(g, r * 0.75, 0.03, M.metalOscuro(), 0, 0.03, 0);         // base
  cilindro(g, r, 0.07, M.colchon(), 0, 0.55, 0);                    // asiento giratorio
}

function mostrador(g: THREE.Group, w: number, d: number): void {
  caja(g, w, 1.0, d * 0.85, M.maderaOscura(), 0, 0.5, d * 0.075);   // cuerpo
  caja(g, w * 1.04, 0.05, d, M.madera(0xd9c9a8), 0, 1.05, 0);       // cubierta con volado
}

function vitrina(g: THREE.Group, w: number, d: number): void {
  caja(g, w, 0.55, d, M.maderaOscura(), 0, 0.275, 0);               // base
  caja(g, w * 0.97, 0.7, d * 0.9, M.cristal(), 0, 0.92, 0);         // urna de cristal
  caja(g, w * 0.93, 0.02, d * 0.85, M.blanco(), 0, 0.85, 0);        // repisa
  caja(g, w * 0.93, 0.02, d * 0.85, M.blanco(), 0, 1.08, 0);
}

function mesa(g: THREE.Group, w: number, d: number): void {
  patas(g, w, d, 0.72, 0.03, M.maderaOscura());
  caja(g, w, 0.04, d, M.madera(), 0, 0.74, 0);
}

function lampara(g: THREE.Group, w: number, d: number): void {
  // Todo proporcional a la huella declarada para NO salirse de ella.
  const r = Math.min(w, d) / 2;
  cilindro(g, r * 0.8, 0.04, M.metalOscuro(), 0, 0.02, 0);          // base rodante
  cilindro(g, Math.min(0.025, r * 0.2), 1.5, M.metal(), 0, 0.79, 0); // poste
  const bx = r * 0.35;                                               // alcance del brazo
  const brazo = cilindro(g, Math.min(0.02, r * 0.15), r * 0.9, M.metal(), bx / 2, 1.58, 0);
  brazo.rotation.z = -1.2;
  const foco = new THREE.Mesh(new THREE.CylinderGeometry(0.02, r * 0.55, 0.14, 20), M.emisivo());
  foco.position.set(bx, 1.64, 0); foco.rotation.z = -1.2;
  g.add(foco);
}

function autoclave(g: THREE.Group, w: number, d: number): void {
  caja(g, w, 0.5, d, M.metal(0xdfe4e8), 0, 0.25, 0);                // gabinete
  const puerta = cilindro(g, Math.min(0.18, w * 0.3), 0.04, M.metalOscuro(), 0, 0.28, d / 2);
  puerta.rotation.x = Math.PI / 2;                                   // escotilla al frente
  caja(g, w * 0.8, 0.06, 0.02, M.metalOscuro(), 0, 0.08, d / 2 + 0.005); // panel
}

function tarja(g: THREE.Group, w: number, d: number): void {
  caja(g, w, 0.85, d, M.blanco(), 0, 0.425, 0);                     // mueble
  caja(g, w * 0.8, 0.1, d * 0.7, M.metal(0xc9d2d8), 0, 0.9, 0);     // cubeta
  const cuello = cilindro(g, 0.015, 0.3, M.metal(), -w * 0.25, 1.05, 0);
  cuello.rotation.z = 0.15;                                          // grifo
}

function carrito(g: THREE.Group, w: number, d: number): void {
  for (const y of [0.25, 0.55, 0.85]) caja(g, w, 0.03, d, M.metal(0xdfe4e8), 0, y, 0); // charolas
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    cilindro(g, 0.012, 0.85, M.metalOscuro(), sx * (w / 2 - 0.02), 0.44, sz * (d / 2 - 0.02)); // postes
    const rueda = cilindro(g, 0.04, 0.03, M.metalOscuro(), sx * (w / 2 - 0.05), 0.04, sz * (d / 2 - 0.05));
    rueda.rotation.x = Math.PI / 2;
  }
}

function estante(g: THREE.Group, w: number, d: number): void {
  caja(g, 0.03, 1.6, d, M.maderaOscura(), -w / 2 + 0.015, 0.8, 0);  // costados
  caja(g, 0.03, 1.6, d, M.maderaOscura(), w / 2 - 0.015, 0.8, 0);
  for (const y of [0.1, 0.55, 1.0, 1.45]) caja(g, w - 0.06, 0.03, d, M.madera(), 0, y, 0);
}

// ---------- selección por nombre (patrones en domain/espacios FORMAS_3D) ----------

import { claveForma3D } from '@/domain/espacios';

const POR_CLAVE: Record<string, (g: THREE.Group, w: number, d: number) => void> = {
  camilla, sillas, banco, mostrador, vitrina, lampara, autoclave, tarja, carrito, estante, mesa,
};

// ¿Hay forma reconocible para este nombre? (para que la UI pueda decirlo)
export function tieneModeloGenerico(nombre: string): boolean {
  return claveForma3D(nombre) !== null;
}

// Construye el modelo genérico apoyado en y=0, centrado en origen, huella w×d.
// Devuelve null si no hay forma para ese nombre (el llamador usa su caja).
export function modeloGenerico(nombre: string, ancho: number, fondo: number): THREE.Group | null {
  const clave = claveForma3D(nombre);
  const construir = clave ? POR_CLAVE[clave] : undefined;
  if (!construir) return null;
  const g = new THREE.Group();
  construir(g, Math.max(0.1, ancho), Math.max(0.1, fondo));
  g.traverse((n) => { n.castShadow = true; n.receiveShadow = true; });
  return g;
}
