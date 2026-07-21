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
function esfera(g: THREE.Group, r: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
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

function sofa(g: THREE.Group, w: number, d: number): void {
  caja(g, w, 0.38, d, M.tela(0x8d8d8d), 0, 0.19, 0);                            // base/asiento
  caja(g, w, 0.42, d * 0.28, M.tela(0x8d8d8d), 0, 0.6, -d / 2 + d * 0.14);      // respaldo
  caja(g, w * 0.12, 0.55, d, M.tela(0x7d7d7d), -w / 2 + w * 0.06, 0.28, 0);     // brazos
  caja(g, w * 0.12, 0.55, d, M.tela(0x7d7d7d), w / 2 - w * 0.06, 0.28, 0);
  patas(g, w, d, 0.08, 0.02, M.metalOscuro());
}

function escritorioL(g: THREE.Group, w: number, d: number): void {
  // dos cubiertas en L cubriendo la huella
  caja(g, w, 0.04, d * 0.45, M.maderaOscura(), 0, 0.74, -d / 2 + d * 0.225);
  caja(g, w * 0.4, 0.04, d, M.maderaOscura(), -w / 2 + w * 0.2, 0.74, 0);
  patas(g, w, d, 0.72, 0.025, M.metalOscuro());
}

function tv(g: THREE.Group, w: number, d: number): void {
  // panel montado (flota a la altura de muro típica; se coloca pegada a la pared)
  const h = Math.min(0.7, w * 0.56);
  caja(g, w, h, Math.min(0.06, d), new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.3, metalness: 0.4 }), 0, 1.35, 0);
  caja(g, w * 0.96, h * 0.9, 0.01, new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.1, metalness: 0.1, emissive: 0x0e1720, emissiveIntensity: 0.6 }), 0, 1.35, Math.min(0.06, d) / 2 + 0.006);
}

function pizarron(g: THREE.Group, w: number, d: number): void {
  const h = Math.min(0.95, w * 0.62);
  caja(g, w, h, Math.min(0.05, d), M.metal(0xcfd4d9), 0, 1.4, 0);               // marco
  caja(g, w * 0.95, h * 0.92, 0.015, M.blanco(), 0, 1.4, Math.min(0.05, d) / 2 + 0.008); // superficie
  caja(g, w * 0.5, 0.03, 0.06, M.metal(0xcfd4d9), 0, 1.4 - h / 2 - 0.015, 0.04); // charola
}

function refrigerador(g: THREE.Group, w: number, d: number, nombre: string): void {
  const h = /frigobar|mini/.test(nombre) ? 0.85 : 1.7;
  caja(g, w, h, d, M.metal(0xd9dde1), 0, h / 2, 0);
  caja(g, w * 0.94, 0.01, d * 0.94, M.metalOscuro(), 0, h * 0.62, 0);           // línea de puerta
  cilindro(g, 0.015, h * 0.35, M.metalOscuro(), w / 2 - 0.05, h * 0.55, d / 2 + 0.01); // manija
}

function dispensador(g: THREE.Group, w: number, d: number): void {
  const r = Math.min(w, d) / 2;
  caja(g, w, 1.0, d, M.blanco(), 0, 0.5, 0);                                     // gabinete
  caja(g, w * 0.8, 0.08, 0.04, M.metalOscuro(), 0, 0.86, d / 2 - 0.02);          // llaves
  const agua = new THREE.MeshPhysicalMaterial({ color: 0x7db9e8, roughness: 0.1, transparent: true, opacity: 0.55 });
  cilindro(g, r * 0.62, 0.3, agua, 0, 1.15, 0);                                  // botellón
  esfera(g, r * 0.62, agua, 0, 1.3, 0);
}

function impresora(g: THREE.Group, w: number, d: number): void {
  caja(g, w, 0.26, d, M.metal(0xe3e6e9), 0, 0.13, 0);
  caja(g, w * 0.86, 0.05, d * 0.8, M.metalOscuro(), 0, 0.285, 0);                // escáner/tapa
  caja(g, w * 0.6, 0.02, d * 0.3, M.metal(0xcfd4d9), 0, 0.1, d / 2 + d * 0.12);  // bandeja
}

function espejo(g: THREE.Group, w: number, d: number): void {
  const h = Math.min(1.1, w * 1.4 + 0.4);
  caja(g, w, h, Math.min(0.05, d), M.maderaOscura(), 0, 1.35, 0);                // marco
  caja(g, w * 0.9, h * 0.92, 0.01, new THREE.MeshStandardMaterial({ color: 0xdfe9ef, roughness: 0.04, metalness: 0.9 }), 0, 1.35, Math.min(0.05, d) / 2 + 0.007);
}

function computadora(g: THREE.Group, w: number, d: number): void {
  caja(g, w, 0.015, d * 0.6, M.metalOscuro(), 0, 0.008, d * 0.15);               // base/teclado
  const p = caja(g, w * 0.92, Math.min(0.35, w * 0.6), 0.015, new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.15, emissive: 0x101a24, emissiveIntensity: 0.5 }), 0, Math.min(0.35, w * 0.6) / 2 + 0.02, -d * 0.2);
  p.rotation.x = -0.28;                                                           // pantalla inclinada
}

function planta(g: THREE.Group, w: number, d: number): void {
  const r = Math.min(w, d) / 2;
  cilindro(g, r * 0.55, 0.32, M.madera(0xb0623f), 0, 0.16, 0);                   // maceta
  cilindro(g, 0.015, 0.5, M.madera(0x5d7a3a), 0, 0.55, 0);                       // tallo
  const hoja = new THREE.MeshStandardMaterial({ color: 0x4e7d46, roughness: 0.8 });
  esfera(g, r * 0.75, hoja, 0, 0.95, 0);
  esfera(g, r * 0.5, hoja, r * 0.3, 1.15, 0.1);
  esfera(g, r * 0.45, hoja, -r * 0.35, 1.1, -0.1);
}

function cortina(g: THREE.Group, w: number, d: number): void {
  cilindro(g, 0.012, w, M.metalOscuro(), 0, 2.0, 0).rotation.z = Math.PI / 2;    // barral
  const tela = caja(g, w * 0.96, 1.75, Math.min(0.04, d), M.tela(0x565b63), 0, 1.05, 0);
  tela.rotation.y = 0.02;
}

function archivero(g: THREE.Group, w: number, d: number): void {
  caja(g, w, 1.05, d, M.metalOscuro(), 0, 0.525, 0);
  for (const y of [0.25, 0.58, 0.9]) {
    caja(g, w * 0.9, 0.26, 0.015, M.metal(0x707a84), 0, y, d / 2 + 0.005);       // frentes de cajón
    caja(g, w * 0.35, 0.025, 0.02, M.metal(0xc9ced3), 0, y + 0.08, d / 2 + 0.02); // manijas
  }
}

function bote(g: THREE.Group, w: number, d: number): void {
  const r = Math.min(w, d) / 2 * 0.85;
  cilindro(g, r, 0.5, M.metalOscuro(), 0, 0.25, 0);
  cilindro(g, r * 1.05, 0.04, M.metalOscuro(), 0, 0.52, 0);                      // aro
}

function wc(g: THREE.Group, w: number, d: number): void {
  const r = Math.min(w, d) / 2 * 0.8;
  caja(g, w * 0.75, 0.42, 0.2, M.blanco(), 0, 0.5, -d / 2 + 0.1);                // tanque
  cilindro(g, r, 0.38, M.blanco(), 0, 0.19, d * 0.08);                            // base
  cilindro(g, r * 1.12, 0.06, M.blanco(), 0, 0.41, d * 0.08);                     // asiento
}

function minisplit(g: THREE.Group, w: number, d: number): void {
  // unidad montada en alto (se coloca pegada al muro)
  caja(g, w, 0.3, Math.min(0.25, d), M.blanco(), 0, 2.05, 0);
  caja(g, w * 0.92, 0.04, 0.01, M.metal(0xc9ced3), 0, 1.94, Math.min(0.25, d) / 2 + 0.006); // rejilla
}

function microondas(g: THREE.Group, w: number, d: number): void {
  caja(g, w, 0.32, d, M.metal(0xd9dde1), 0, 0.16, 0);
  caja(g, w * 0.62, 0.24, 0.01, new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.2 }), -w * 0.1, 0.16, d / 2 + 0.006); // puerta
}

// ---------- selección por nombre (patrones en domain/espacios FORMAS_3D) ----------

import { claveForma3D } from '@/domain/espacios';

const POR_CLAVE: Record<string, (g: THREE.Group, w: number, d: number, nombre: string) => void> = {
  camilla, sillas, banco, mostrador, vitrina, lampara, autoclave, tarja, carrito, estante, mesa,
  sofa, escritorioL, tv, pizarron, refrigerador, dispensador, impresora, espejo, computadora,
  planta, cortina, archivero, bote, wc, minisplit, microondas,
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
  construir(g, Math.max(0.1, ancho), Math.max(0.1, fondo), nombre.toLowerCase());
  g.traverse((n) => { n.castShadow = true; n.receiveShadow = true; });
  return g;
}
