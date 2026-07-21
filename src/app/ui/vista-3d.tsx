'use client';

// VISTA 3D REAL (Three.js) del plano de una sede. ADITIVO.
// Escena interactiva con cámara orbital, luces con sombras y materiales PBR — se ve
// como un render de arquitecto EN VIVO y sigue conectada a los datos (clic en un
// objeto = su nombre). Sustituye a la isométrica SVG inicial. El fotorrealismo de
// FOTO sigue viniendo de renders externos subidos (pieza aparte del roadmap).
// Todo WebGL vive en useEffect (SSR-safe); se desmonta limpiando GPU.

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { alturaObjeto, normalizarGrados } from '@/domain/espacios';
import type { Espacio, ObjetoFisico, Sede } from '@/domain/espacios';
import { modelosDeSede, obtenerEscaneoNivel, subirEscaneoNivel, rotarEscaneoNivel, eliminarEscaneoNivel } from '@/app/actions/modelo3d.actions';
import { MAX_GLB_BYTES } from '@/domain/render';
import { actualizarObjeto, eliminarObjeto, crearObjeto } from '@/app/actions/espacios.actions';
import { registrarDeshacer, BotonDeshacer } from './deshacer';
import { conversarDisenador3D, cargarChatDisenador, aplicarInversaDisenador } from '@/app/actions/disenador.actions';
import type { InversaDisenador } from '@/app/actions/disenador.actions';
import { modeloGenerico } from './modelos-genericos';
import { materialAcabado } from './texturas';
import { ChatArquitecto } from './chat-arquitecto';
import { useEsMovil } from './use-movil';

const btn: CSSProperties = { padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };

// Material por categoría de objeto (madera/metal/plástico aproximados).
const MAT_OBJ: Record<string, { color: number; rough: number; metal: number }> = {
  mueble: { color: 0xb98b5a, rough: 0.65, metal: 0.05 },
  equipo: { color: 0x9fb0bf, rough: 0.35, metal: 0.55 },
  herramienta: { color: 0x8494a8, rough: 0.4, metal: 0.5 },
  insumo: { color: 0xcfc7ba, rough: 0.85, metal: 0 },
};
const COLORES_AREA = [0xdce7f5, 0xe8f0dd, 0xf5e9dc, 0xe9def0, 0xdff0ec, 0xf0e5de];

// ---------- deshacer PERSISTENTE de los turnos del Diseñador ----------
// El historial de deshacer en memoria se pierde al recargar la página; las inversas
// del agente SÍ son serializables, así que se guardan en localStorage por sede y se
// re-registran al volver a abrir la vista 3D. (Los cambios manuales siguen siendo de
// sesión: sus inversas son funciones, no datos.)
interface EntradaAgente { id: string; descripcion: string; grupo: string; op: InversaDisenador }
const yaRegistradas = new Set<string>(); // evita duplicar al re-montar la vista

function claveUndo(sedeId: string): string { return `bp-undo-disenador:${sedeId}`; }
function leerUndoLS(sedeId: string): EntradaAgente[] {
  try { return JSON.parse(localStorage.getItem(claveUndo(sedeId)) ?? '[]') as EntradaAgente[]; } catch { return []; }
}
function guardarUndoLS(sedeId: string, entradas: EntradaAgente[]): void {
  try { localStorage.setItem(claveUndo(sedeId), JSON.stringify(entradas.slice(-60))); } catch { /* almacenamiento lleno */ }
}
function quitarUndoLS(sedeId: string, id: string): void {
  guardarUndoLS(sedeId, leerUndoLS(sedeId).filter((e) => e.id !== id));
}

interface Props {
  sede: Sede;
  espacios: Espacio[];
  objetos: ObjetoFisico[];
  footAncho: number;
  footAlto: number;
  proyectoId: string;
  capa: number;
  onCambio: () => void;   // recargar datos tras crear/mover/editar (chat o manipulación)
  onCerrar?: (() => void) | undefined;
}

export function Vista3D({ sede, espacios, objetos, footAncho, footAlto, proyectoId, capa, onCambio, onCerrar }: Props) {
  const montRef = useRef<HTMLDivElement | null>(null);
  const [muroAlt, setMuroAlt] = useState(2.6);
  const [selId, setSelId] = useState<string | null>(null);   // objeto seleccionado (manipulación)
  const selRef = useRef<string | null>(null);
  selRef.current = selId;
  const movil = useEsMovil();
  const selObj = objetos.find((o) => o.id === selId) ?? null;
  // Escaneos .glb subidos por objeto (LiDAR/fotogrametría): se cargan una vez por sede.
  const [modelos, setModelos] = useState<Map<string, ArrayBuffer> | null>(null);
  // Escaneo del NIVEL COMPLETO (el local entero): si existe, se puede ver TAL CUAL.
  const [escaneo, setEscaneo] = useState<{ nombre: string; rot: number; buf: ArrayBuffer } | null>(null);
  const [verEscaneo, setVerEscaneo] = useState(true); // con escaneo: real por defecto
  const [msgEscaneo, setMsgEscaneo] = useState('');
  const escaneoRef = useRef<HTMLInputElement | null>(null);

  // Registra una entrada del agente en la pila de deshacer (y la limpia de
  // localStorage cuando se ejecuta su inversa).
  function registrarEntradaAgente(e: EntradaAgente) {
    if (yaRegistradas.has(e.id)) return;
    yaRegistradas.add(e.id);
    registrarDeshacer(e.descripcion, async () => {
      await aplicarInversaDisenador(proyectoId, e.op);
      quitarUndoLS(sede.id, e.id);
    }, e.grupo);
  }

  // Al abrir la vista: rehidrata los turnos del Diseñador guardados (sobreviven recargas).
  useEffect(() => {
    for (const e of leerUndoLS(sede.id)) registrarEntradaAgente(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede.id]);

  const cargarEscaneo = () => {
    obtenerEscaneoNivel(sede.id, capa).then((r) => {
      if (!r) { setEscaneo(null); return; }
      const bin = atob(r.base64);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      setEscaneo({ nombre: r.nombre, rot: r.rot, buf: buf.buffer });
    }).catch(() => setEscaneo(null));
  };
  useEffect(() => { cargarEscaneo(); /* eslint-disable-next-line */ }, [sede.id, capa]);

  async function subirEscaneo(f: File) {
    if (f.size > MAX_GLB_BYTES) { setMsgEscaneo(`Pesa ${(f.size / 1024 / 1024).toFixed(1)} MB; máximo 25 MB — exporta el escaneo en calidad media.`); return; }
    setMsgEscaneo('Subiendo escaneo del local…');
    const b64 = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(',')[1] ?? '');
      fr.onerror = rej;
      fr.readAsDataURL(f);
    });
    const r = await subirEscaneoNivel(proyectoId, sede.id, capa, f.name.replace(/\.[^.]+$/, ''), b64);
    setMsgEscaneo(r.ok ? 'Escaneo del local guardado. Si quedó girado, usa ⟳90°.' : r.error);
    if (r.ok) { setVerEscaneo(true); cargarEscaneo(); }
  }

  useEffect(() => {
    let vivo = true;
    modelosDeSede(sede.id).then((ms) => {
      if (!vivo) return;
      const map = new Map<string, ArrayBuffer>();
      for (const m of ms) {
        const bin = atob(m.base64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        map.set(m.objetoId, buf.buffer);
      }
      setModelos(map);
    }).catch(() => { if (vivo) setModelos(new Map()); });
    return () => { vivo = false; };
  }, [sede.id]);

  useEffect(() => {
    const mont = montRef.current;
    if (!mont) return;
    const W = footAncho, D = footAlto;

    // --- escena / cámara / renderer ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8edf4);
    const camera = new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 200);
    camera.position.set(W * 0.9, Math.max(W, D) * 0.85, D * 2.2);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mont.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(W / 2, 0.6, D / 2);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.03; // no bajar del suelo
    controls.minDistance = 2; controls.maxDistance = 60;

    // --- luces: hemisferio (cielo) + sol direccional con sombras ---
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a95a5, 1.0));
    const sol = new THREE.DirectionalLight(0xfff4e0, 2.2);
    sol.position.set(W * 1.2, 9, -D * 0.6);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    const sc = sol.shadow.camera;
    sc.left = -W; sc.right = W * 1.5; sc.top = D * 1.5; sc.bottom = -D; sc.far = 40;
    scene.add(sol);

    // --- terreno alrededor + piso del local ---
    const terreno = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 6, D * 8),
      new THREE.MeshStandardMaterial({ color: 0xccd3dc, roughness: 0.95 }),
    );
    terreno.rotation.x = -Math.PI / 2; terreno.position.set(W / 2, -0.01, D / 2);
    terreno.receiveShadow = true;
    scene.add(terreno);

    // ===== MODO ESCANEO REAL: el .glb del local entero sustituye al modelo dibujado
    // (piso/muros/losas/objetos dibujados se OMITEN; quedan las etiquetas de área) =====
    const modoEscaneo = verEscaneo && !!escaneo;
    if (modoEscaneo && escaneo) {
      const loaderNivel = new GLTFLoader();
      loaderNivel.parse(escaneo.buf.slice(0), '', (gltf) => {
        const g = gltf.scene;
        // giro de alineación elegido por el usuario (⟳90°)
        g.rotation.y = -escaneo.rot * Math.PI / 180;
        g.updateMatrixWorld(true);
        const caja = new THREE.Box3().setFromObject(g);
        const dim = caja.getSize(new THREE.Vector3());
        const centro = caja.getCenter(new THREE.Vector3());
        // encuadre a la huella: escala uniforme al ancho×fondo declarados
        const s = Math.min(W / Math.max(0.1, dim.x), D / Math.max(0.1, dim.z));
        const wrap = new THREE.Group();
        wrap.add(g);
        g.position.set(-centro.x, -caja.min.y, -centro.z);
        wrap.scale.setScalar(s);
        wrap.position.set(W / 2, 0.02, D / 2);
        wrap.traverse((n) => { n.castShadow = true; n.receiveShadow = true; });
        scene.add(wrap);
      }, () => { /* GLB ilegible: queda el modelo dibujado de fondo */ });
    }

    // piso general: acabado de la sede si lo hay (duela, porcelanato…), neutro si no
    if (!modoEscaneo) {
      const piso = new THREE.Mesh(
        new THREE.BoxGeometry(W, 0.05, D),
        materialAcabado(sede.acabadoPiso, W, D) ?? new THREE.MeshStandardMaterial({ color: 0xd8cfc2, roughness: 0.7 }),
      );
      piso.position.set(W / 2, 0.025, D / 2);
      piso.receiveShadow = true;
      scene.add(piso);
    }

    // --- muros perimetrales (se ocultan solos los que dan a la cámara) ---
    const T = 0.15, half = T / 2;
    const muros: { mesh: THREE.Mesh; normal: THREE.Vector3; centro: THREE.Vector3 }[] = [];
    // muros: acabado de la sede (pintura de color, ladrillo, azulejo…) o neutro
    const matMuro = materialAcabado(sede.acabadoMuros, Math.max(W, D), muroAlt)
      ?? new THREE.MeshStandardMaterial({ color: 0xf3f0ea, roughness: 0.9 });
    const defMuros: { w: number; x: number; z: number; rotY: number; n: [number, number] }[] = [
      { w: W + T, x: W / 2, z: -half, rotY: 0, n: [0, -1] },
      { w: W + T, x: W / 2, z: D + half, rotY: 0, n: [0, 1] },
      { w: D + T, x: -half, z: D / 2, rotY: Math.PI / 2, n: [-1, 0] },
      { w: D + T, x: W + half, z: D / 2, rotY: Math.PI / 2, n: [1, 0] },
    ];
    if (!modoEscaneo) {
      for (const m of defMuros) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(m.w, muroAlt, T), matMuro);
        mesh.rotation.y = m.rotY;
        mesh.position.set(m.x, muroAlt / 2 + 0.05, m.z);
        mesh.castShadow = true; mesh.receiveShadow = true;
        scene.add(mesh);
        muros.push({ mesh, normal: new THREE.Vector3(m.n[0], 0, m.n[1]), centro: mesh.position.clone() });
      }
    }

    // --- áreas: losa de color + etiqueta (sprite con texto) ---
    const etiqueta = (texto: string): THREE.Sprite => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 128;
      const g = c.getContext('2d')!;
      g.font = 'bold 44px system-ui, sans-serif';
      const tw = Math.min(480, g.measureText(texto).width + 36);
      g.fillStyle = 'rgba(255,255,255,0.88)';
      g.beginPath(); (g as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect((512 - tw) / 2, 28, tw, 72, 16); g.fill();
      g.fillStyle = '#33415c'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(texto, 256, 66, 460);
      const tex = new THREE.CanvasTexture(c);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
      sp.scale.set(2.4, 0.6, 1);
      return sp;
    };

    espacios.forEach((s, i) => {
      // en modo escaneo: solo la etiqueta flotante (el escaneo ya trae el piso real)
      if (modoEscaneo) {
        const et = etiqueta(s.nombre);
        et.position.set(s.x + s.ancho / 2, 1.9, s.y + s.alto / 2);
        scene.add(et);
        return;
      }
      const color = COLORES_AREA[i % COLORES_AREA.length]!;
      let shape: THREE.Shape;
      if (s.poligono && s.poligono.length >= 3) {
        shape = new THREE.Shape(s.poligono.map((p) => new THREE.Vector2(p.x, p.y)));
      } else {
        shape = new THREE.Shape([
          new THREE.Vector2(s.x, s.y), new THREE.Vector2(s.x + s.ancho, s.y),
          new THREE.Vector2(s.x + s.ancho, s.y + s.alto), new THREE.Vector2(s.x, s.y + s.alto),
        ]);
      }
      const geo = new THREE.ShapeGeometry(shape);
      geo.rotateX(Math.PI / 2); // plano (x,y) → suelo (x,z)
      // acabado de piso PROPIO del área (campo `acabadoPiso`) o losa de color suave.
      // ShapeGeometry genera UVs EN METROS (coords reales), así que repeat = 1.
      const matArea = materialAcabado(s.data.acabadoPiso, 1, 1);
      if (matArea) matArea.side = THREE.DoubleSide;
      const losa = new THREE.Mesh(geo, matArea ?? new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }));
      losa.position.y = 0.06;
      losa.receiveShadow = true;
      scene.add(losa);
      const et = etiqueta(s.nombre);
      et.position.set(s.x + s.ancho / 2, 0.35, s.y + s.alto / 2);
      scene.add(et);
    });

    // --- objetos: escaneo .glb si existe, caja genérica si no (ambos clicables) ---
    // En modo escaneo del local NO se dibujan (el escaneo ya trae los muebles reales).
    const clicables: THREE.Object3D[] = [];
    const loader = new GLTFLoader();
    for (const o of modoEscaneo ? [] : objetos) {
      const glb = modelos?.get(o.id);
      // ancla del objeto: su lugar y giro del plano
      const ancla = new THREE.Group();
      ancla.position.set(o.x + o.ancho / 2, 0.05, o.y + o.alto / 2);
      ancla.rotation.y = -(o.rot ?? 0) * Math.PI / 180;
      ancla.userData = { id: o.id, nombre: `${o.nombre} · ${o.categoria}${glb ? ' · escaneo' : ''}`, ancho: o.ancho, alto: o.alto };
      scene.add(ancla);
      clicables.push(ancla);
      // aro de selección bajo el objeto seleccionado
      if (selRef.current === o.id) {
        const r = Math.hypot(o.ancho, o.alto) / 2 + 0.08;
        const aro = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.05, 40), new THREE.MeshBasicMaterial({ color: 0x7a4fbf, side: THREE.DoubleSide }));
        aro.rotation.x = -Math.PI / 2; aro.position.y = 0.02;
        ancla.add(aro);
      }

      if (glb) {
        // Escaneo real: se AJUSTA a la huella declarada (ancho×alto del plano) y se
        // apoya en el piso — así un GLB de cualquier escala queda en su lugar exacto.
        loader.parse(glb.slice(0), '', (gltf) => {
          const g = gltf.scene;
          const caja = new THREE.Box3().setFromObject(g);
          const dim = caja.getSize(new THREE.Vector3());
          const centro = caja.getCenter(new THREE.Vector3());
          const s = Math.min(o.ancho / Math.max(0.01, dim.x), o.alto / Math.max(0.01, dim.z), 3 / Math.max(0.01, dim.y));
          g.scale.setScalar(s);
          g.position.set(-centro.x * s, -caja.min.y * s, -centro.z * s);
          g.traverse((n) => { n.castShadow = true; n.receiveShadow = true; });
          ancla.add(g);
        }, () => {
          // GLB ilegible (p.ej. comprimido con Draco): forma de respaldo para no dejar hueco.
          ancla.add(formaGenerica(o));
        });
      } else {
        ancla.add(formaGenerica(o));
      }
    }

    // Objeto que aún no existe físicamente (nada que escanear): forma paramétrica
    // reconocible según su nombre (camilla, silla, mostrador…); si no hay, caja.
    function formaGenerica(o: ObjetoFisico): THREE.Object3D {
      return modeloGenerico(o.nombre, o.ancho, o.alto) ?? cajaGenerica(o);
    }

    function cajaGenerica(o: ObjetoFisico): THREE.Mesh {
      const h = alturaObjeto(o.nombre, o.categoria);
      const m = MAT_OBJ[o.categoria] ?? MAT_OBJ.mueble!;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(o.ancho, h, o.alto),
        new THREE.MeshStandardMaterial({ color: m.color, roughness: m.rough, metalness: m.metal }),
      );
      mesh.position.y = h / 2;
      mesh.castShadow = true; mesh.receiveShadow = true;
      return mesh;
    }

    // --- selección + ARRASTRE sobre el piso (pointer events; el orbit se pausa al arrastrar) ---
    const ray = new THREE.Raycaster();
    const pisoPlano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05);
    let drag: { ancla: THREE.Group; offX: number; offZ: number; movido: boolean } | null = null;

    const anclaEn = (e: PointerEvent): THREE.Group | null => {
      const r = renderer.domElement.getBoundingClientRect();
      const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(p, camera);
      const hit = ray.intersectObjects(clicables, true)[0];
      let n: THREE.Object3D | null = hit?.object ?? null;
      while (n && !n.userData.id) n = n.parent;
      return (n as THREE.Group) ?? null;
    };
    const puntoPiso = (e: PointerEvent): THREE.Vector3 | null => {
      const r = renderer.domElement.getBoundingClientRect();
      const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(p, camera);
      const out = new THREE.Vector3();
      return ray.ray.intersectPlane(pisoPlano, out) ? out : null;
    };

    const onDown = (e: PointerEvent) => {
      const ancla = anclaEn(e);
      if (!ancla) return;                      // clic al vacío: orbitar normal (no deselecciona)
      setSelId(String(ancla.userData.id));
      const p = puntoPiso(e);
      if (!p) return;
      controls.enabled = false;               // arrastrar el objeto, no la cámara
      drag = { ancla, offX: ancla.position.x - p.x, offZ: ancla.position.z - p.z, movido: false };
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const p = puntoPiso(e);
      if (!p) return;
      const d = drag.ancla.userData as { ancho: number; alto: number };
      // el centro se mantiene dentro de la huella
      drag.ancla.position.x = Math.min(W - d.ancho / 2, Math.max(d.ancho / 2, p.x + drag.offX));
      drag.ancla.position.z = Math.min(D - d.alto / 2, Math.max(d.alto / 2, p.z + drag.offZ));
      drag.movido = true;
    };
    const onUp = () => {
      controls.enabled = true;
      if (!drag) return;
      const { ancla, movido } = drag;
      drag = null;
      if (!movido) return;                     // fue solo un clic de selección
      const d = ancla.userData as { id: string; ancho: number; alto: number };
      const prev = objetos.find((o) => o.id === d.id);
      if (prev) {
        const px = prev.x, py = prev.y;
        registrarDeshacer('mover objeto (3D)', async () => { await actualizarObjeto(d.id, { x: px, y: py }); });
      }
      void actualizarObjeto(d.id, {
        x: Number((ancla.position.x - d.ancho / 2).toFixed(2)),
        y: Number((ancla.position.z - d.alto / 2).toFixed(2)),
      }).then(onCambio);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointercancel', onUp);

    // --- tamaño y bucle ---
    const centro = new THREE.Vector3(W / 2, 0, D / 2);
    const ajustar = () => {
      const w = mont.clientWidth || 800;
      const h = Math.max(360, Math.min(620, Math.round(w * 0.62)));
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    ajustar();
    const ro = new ResizeObserver(ajustar); ro.observe(mont);

    let vivo = true;
    const dir = new THREE.Vector3();
    const tick = () => {
      if (!vivo) return;
      controls.update();
      // dollhouse: oculta los muros que quedan entre la cámara y el interior
      dir.copy(camera.position).sub(centro);
      for (const m of muros) m.mesh.visible = m.normal.dot(dir) <= 0.1;
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    };
    tick();

    return () => {
      vivo = false;
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointercancel', onUp);
      controls.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
      });
      renderer.dispose();
      mont.removeChild(renderer.domElement);
    };
  }, [espacios, objetos, footAncho, footAlto, muroAlt, modelos, selId, escaneo, verEscaneo]);

  // ---- acciones del panel de manipulación (todas reversibles con ↩) ----
  function girar(delta: number) {
    if (!selObj) return;
    const id = selObj.id, prevRot = selObj.rot ?? 0;
    registrarDeshacer('girar objeto (3D)', async () => { await actualizarObjeto(id, { rot: prevRot }); });
    void actualizarObjeto(id, { rot: normalizarGrados(Math.round(prevRot + delta)) }).then(onCambio);
  }
  function redimensionar(campo: 'ancho' | 'alto', v: number) {
    if (!selObj || !(v > 0)) return;
    const id = selObj.id, prev = selObj[campo];
    registrarDeshacer('redimensionar objeto (3D)', async () => { await actualizarObjeto(id, { [campo]: prev }); });
    void actualizarObjeto(id, { [campo]: Number(v.toFixed(2)) }).then(onCambio);
  }
  function quitar() {
    if (!selObj) return;
    if (!window.confirm(`¿Eliminar "${selObj.nombre}" del plano?`)) return;
    const o = selObj;
    // recrear al deshacer (el id cambia: un escaneo .glb ligado no se recupera)
    registrarDeshacer('eliminar objeto (3D)', async () => {
      const n = await crearObjeto(proyectoId, o.sedeId, { espacioId: o.espacioId, nombre: o.nombre, categoria: o.categoria, capa: o.capa, x: o.x, y: o.y });
      await actualizarObjeto(n.id, { ancho: o.ancho, alto: o.alto, rot: o.rot, campos: o.data });
    });
    setSelId(null);
    void eliminarObjeto(o.id).then(onCambio);
  }

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>🧊 Vista 3D <span style={{ fontSize: 12.5, color: '#888' }}>· {sede.nombre} · arrastra para orbitar · rueda/pellizco = zoom</span></h3>
        {onCerrar && <button style={btn} onClick={onCerrar}>← Editor 2D</button>}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', margin: '0.5rem 0' }}>
        <span style={{ fontSize: 12, color: '#666' }}>Altura de muro</span>
        <input type="range" min={0} max={3.5} step={0.1} value={muroAlt} onChange={(e) => setMuroAlt(Number(e.target.value))} />
        <span style={{ fontSize: 12, color: '#666' }}>{muroAlt.toFixed(1)} m</span>
        <span style={{ flex: 1 }} />
        {/* escaneo del local completo (fotogrametría/LiDAR del teléfono → .glb) */}
        <input ref={escaneoRef} type="file" accept=".glb,model/gltf-binary" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirEscaneo(f); e.target.value = ''; }} />
        {escaneo ? (
          <>
            <button style={{ ...btn, background: verEscaneo ? '#2e9e63' : '#fff', color: verEscaneo ? '#fff' : '#333', borderColor: verEscaneo ? '#2e9e63' : '#999', fontWeight: 'bold' }}
              onClick={() => setVerEscaneo((v) => !v)} title="Alternar entre el escaneo real y el modelo dibujado">
              {verEscaneo ? '🏠 Escaneo real' : '📐 Modelo'}
            </button>
            {verEscaneo && <button style={btn} title="Girar el escaneo 90° para alinearlo al plano"
              onClick={() => { void rotarEscaneoNivel(sede.id, capa).then(() => cargarEscaneo()); }}>⟳90°</button>}
            <button style={{ ...btn, color: '#b33' }} title="Quitar el escaneo del local"
              onClick={() => { if (window.confirm('¿Quitar el escaneo del local?')) void eliminarEscaneoNivel(sede.id, capa).then(() => { setEscaneo(null); setMsgEscaneo(''); }); }}>×</button>
          </>
        ) : (
          <button style={btn} title="Sube el escaneo .glb del local entero (Scaniverse/Polycam/Luma)"
            onClick={() => escaneoRef.current?.click()}>🏠 Subir escaneo del local</button>
        )}
        <BotonDeshacer onDespues={onCambio} />
      </div>
      {msgEscaneo && <p style={{ fontSize: 12, color: msgEscaneo.includes('guardado') ? '#2e9e63' : '#8a6d3b', margin: '0 0 0.4rem' }}>{msgEscaneo}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : 'minmax(0, 1fr) 330px', gap: '0.75rem', alignItems: 'start' }}>
        <div>
          <div ref={montRef} style={{ border: '1px solid #ddd', borderRadius: 10, overflow: 'hidden', lineHeight: 0, touchAction: 'none' }} />

          {/* panel de manipulación del objeto seleccionado */}
          {selObj && (
            <div style={{ border: '1px solid #d7c9ee', background: '#f8f5fd', borderRadius: 10, padding: '0.5rem 0.7rem', marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 13 }}>◈ {selObj.nombre}</strong>
              <span style={{ fontSize: 11, color: '#888' }}>({selObj.ancho}×{selObj.alto} m · {Math.round(selObj.rot)}°) — arrástralo en la escena para moverlo</span>
              <span style={{ flex: 1 }} />
              <button style={btn} title="Girar 90° a la izquierda" onClick={() => girar(-90)}>↺90</button>
              <button style={btn} title="Girar 15° a la izquierda" onClick={() => girar(-15)}>↺15</button>
              <button style={btn} title="Girar 15° a la derecha" onClick={() => girar(15)}>15↻</button>
              <button style={btn} title="Girar 90° a la derecha" onClick={() => girar(90)}>90↻</button>
              <label style={{ fontSize: 11.5, color: '#666' }}>ancho <input style={{ width: 52, padding: '0.2rem 0.3rem', borderRadius: 5, border: '1px solid #ccc', fontSize: 12 }} type="number" step={0.1} defaultValue={selObj.ancho} onBlur={(e) => redimensionar('ancho', Number(e.target.value))} /></label>
              <label style={{ fontSize: 11.5, color: '#666' }}>fondo <input style={{ width: 52, padding: '0.2rem 0.3rem', borderRadius: 5, border: '1px solid #ccc', fontSize: 12 }} type="number" step={0.1} defaultValue={selObj.alto} onBlur={(e) => redimensionar('alto', Number(e.target.value))} /></label>
              <button style={{ ...btn, color: '#b33', borderColor: '#d99' }} onClick={quitar}>🗑</button>
              <button style={btn} onClick={() => setSelId(null)}>✕</button>
            </div>
          )}
          <p style={{ fontSize: 11.5, color: '#888', margin: '0.4rem 0 0' }}>
            Arrastra el fondo para orbitar · <strong>toca un objeto para seleccionarlo y arrástralo para moverlo</strong> · gíralo/redimensiónalo/elimínalo en el panel · o pídeselo al Diseñador en el chat.
          </p>
        </div>

        {/* chat del Diseñador 3D: describe el objeto y lo coloca */}
        <ChatArquitecto
          conversar={async (h) => {
            const r = await conversarDisenador3D(h, proyectoId, sede.id, capa);
            // Cada operación del turno se registra en la pila de deshacer, agrupada:
            // desde el panel ▾ se revierte una, todo el turno, o todo.
            if (r.inversas.length) {
              const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
              const grupo = `Turno del Diseñador · ${hora}`;
              const entradas: EntradaAgente[] = r.inversas.map((inv) => ({
                id: crypto.randomUUID(), descripcion: inv.descripcion, grupo, op: inv.op,
              }));
              // persisten en localStorage (sobreviven recargas) y entran a la pila
              guardarUndoLS(sede.id, [...leerUndoLS(sede.id), ...entradas]);
              for (const e of entradas) registrarEntradaAgente(e);
            }
            return r;
          }}
          saludo={'Soy el Diseñador 3D. Descríbeme lo que quieres y lo construyo: "pon una camilla en la Cabina 2", "crea un área de bodega de 2×3", "gira la camilla 90°"… También puedo RECREAR tu espacio real: mándame fotos 📷 de cada ambiente y armo las áreas, acabados y muebles (estimo medidas de las fotos; corrígeme las que no cuadren).'}
          placeholder="Describe el objeto y dónde va…"
          cargarHistorial={() => cargarChatDisenador(sede.id)}
          historialKey={`${sede.id}:${capa}`}
          onCambio={onCambio}
          altura={movil ? 300 : 480}
          permitirFotos
        />
      </div>
    </section>
  );
}
