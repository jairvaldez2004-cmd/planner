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
import { alturaObjeto } from '@/domain/espacios';
import type { Espacio, ObjetoFisico, Sede } from '@/domain/espacios';
import { modelosDeSede } from '@/app/actions/modelo3d.actions';
import { modeloGenerico } from './modelos-genericos';

const btn: CSSProperties = { padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };

// Material por categoría de objeto (madera/metal/plástico aproximados).
const MAT_OBJ: Record<string, { color: number; rough: number; metal: number }> = {
  mueble: { color: 0xb98b5a, rough: 0.65, metal: 0.05 },
  equipo: { color: 0x9fb0bf, rough: 0.35, metal: 0.55 },
  herramienta: { color: 0x8494a8, rough: 0.4, metal: 0.5 },
  insumo: { color: 0xcfc7ba, rough: 0.85, metal: 0 },
};
const COLORES_AREA = [0xdce7f5, 0xe8f0dd, 0xf5e9dc, 0xe9def0, 0xdff0ec, 0xf0e5de];

interface Props {
  sede: Sede;
  espacios: Espacio[];
  objetos: ObjetoFisico[];
  footAncho: number;
  footAlto: number;
  onCerrar?: (() => void) | undefined;
}

export function Vista3D({ sede, espacios, objetos, footAncho, footAlto, onCerrar }: Props) {
  const montRef = useRef<HTMLDivElement | null>(null);
  const [muroAlt, setMuroAlt] = useState(2.6);
  const [info, setInfo] = useState<string>('');
  // Escaneos .glb subidos por objeto (LiDAR/fotogrametría): se cargan una vez por sede.
  const [modelos, setModelos] = useState<Map<string, ArrayBuffer> | null>(null);

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

    const piso = new THREE.Mesh(
      new THREE.BoxGeometry(W, 0.05, D),
      new THREE.MeshStandardMaterial({ color: 0xd8cfc2, roughness: 0.7 }), // porcelanato claro
    );
    piso.position.set(W / 2, 0.025, D / 2);
    piso.receiveShadow = true;
    scene.add(piso);

    // --- muros perimetrales (se ocultan solos los que dan a la cámara) ---
    const T = 0.15, half = T / 2;
    const muros: { mesh: THREE.Mesh; normal: THREE.Vector3; centro: THREE.Vector3 }[] = [];
    const matMuro = new THREE.MeshStandardMaterial({ color: 0xf3f0ea, roughness: 0.9 });
    const defMuros: { w: number; x: number; z: number; rotY: number; n: [number, number] }[] = [
      { w: W + T, x: W / 2, z: -half, rotY: 0, n: [0, -1] },
      { w: W + T, x: W / 2, z: D + half, rotY: 0, n: [0, 1] },
      { w: D + T, x: -half, z: D / 2, rotY: Math.PI / 2, n: [-1, 0] },
      { w: D + T, x: W + half, z: D / 2, rotY: Math.PI / 2, n: [1, 0] },
    ];
    for (const m of defMuros) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(m.w, muroAlt, T), matMuro);
      mesh.rotation.y = m.rotY;
      mesh.position.set(m.x, muroAlt / 2 + 0.05, m.z);
      mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh);
      muros.push({ mesh, normal: new THREE.Vector3(m.n[0], 0, m.n[1]), centro: mesh.position.clone() });
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
      const losa = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }));
      losa.position.y = 0.06;
      losa.receiveShadow = true;
      scene.add(losa);
      const et = etiqueta(s.nombre);
      et.position.set(s.x + s.ancho / 2, 0.35, s.y + s.alto / 2);
      scene.add(et);
    });

    // --- objetos: escaneo .glb si existe, caja genérica si no (ambos clicables) ---
    const clicables: THREE.Object3D[] = [];
    const loader = new GLTFLoader();
    for (const o of objetos) {
      const glb = modelos?.get(o.id);
      // ancla del objeto: su lugar y giro del plano
      const ancla = new THREE.Group();
      ancla.position.set(o.x + o.ancho / 2, 0.05, o.y + o.alto / 2);
      ancla.rotation.y = -(o.rot ?? 0) * Math.PI / 180;
      ancla.userData.nombre = `${o.nombre} · ${o.categoria}${glb ? ' · escaneo' : ''}`;
      scene.add(ancla);
      clicables.push(ancla);

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

    // --- clic = identificar objeto (raycast) ---
    const ray = new THREE.Raycaster();
    const onClick = (e: MouseEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(p, camera);
      const hit = ray.intersectObjects(clicables, true)[0];
      // el nombre vive en el ANCLA del objeto; sube desde el mesh golpeado hasta encontrarlo
      let n: THREE.Object3D | null = hit?.object ?? null;
      while (n && !n.userData.nombre) n = n.parent;
      setInfo(n ? String(n.userData.nombre) : '');
    };
    renderer.domElement.addEventListener('click', onClick);

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
      renderer.domElement.removeEventListener('click', onClick);
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
  }, [espacios, objetos, footAncho, footAlto, muroAlt, modelos]);

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
        {info && <span style={{ fontSize: 12.5, background: '#33415c', color: '#fff', borderRadius: 12, padding: '0.15rem 0.7rem' }}>{info}</span>}
      </div>
      <div ref={montRef} style={{ border: '1px solid #ddd', borderRadius: 10, overflow: 'hidden', lineHeight: 0 }} />
      <p style={{ fontSize: 11.5, color: '#888', margin: '0.4rem 0 0' }}>
        Escena 3D generada de tu plano (luces, sombras y materiales reales; los muros hacia la cámara se ocultan solos).
        Clic en un objeto para identificarlo. Para fotorrealismo de foto, sube un render externo en 🖼 Renders.
      </p>
    </section>
  );
}
