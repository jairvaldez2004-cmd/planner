'use client';

// Sedes: mapa REAL (Leaflet/OSM) con la huella del proyecto superpuesta + lista + editor 2D.

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { listarSedes, crearSede, actualizarSede, eliminarSede, listarEspacios, listarObjetos } from '@/app/actions/espacios.actions';
import type { Sede, Espacio, ObjetoFisico } from '@/domain/espacios';
import { EditorEspacios } from './editor-espacios';
import { registrarDeshacer, BotonDeshacer } from './deshacer';
import { rectRotado, medidasDeRect, centroide } from './huella-geo';
import type { LL } from './huella-geo';

const MapaSedes = dynamic(() => import('./mapa-sedes'), { ssr: false, loading: () => <div style={{ height: 380, background: '#eef4ee', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>Cargando mapa…</div> });

const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };
const inp: CSSProperties = { padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid #ccc', fontSize: 14 };
const card: CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: '0.6rem 0.9rem', margin: '0.4rem 0', background: '#fafafa' };

export function VistaSedes({ proyectoId }: { proyectoId: string }) {
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Espacio[]>([]);
  const [overlayObj, setOverlayObj] = useState<ObjetoFisico[]>([]);
  const [huella, setHuella] = useState<{ W: number; H: number; orient: number }>({ W: 20, H: 15, orient: 0 });
  const [alineando, setAlineando] = useState(false);

  const cargar = () => { setLoading(true); listarSedes(proyectoId).then(setSedes).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [proyectoId]);
  useEffect(() => {
    if (!selectedId) { setOverlay([]); setOverlayObj([]); return; }
    listarEspacios(selectedId).then(setOverlay).catch(() => setOverlay([]));
    listarObjetos(selectedId).then(setOverlayObj).catch(() => setOverlayObj([]));
  }, [selectedId]);

  const selSede = sedes.find((s) => s.id === selectedId) ?? null;
  // Al cambiar de sede, el tablero lee Ancho/Alto/Orientación de su huella actual (o de footAncho/Alto).
  useEffect(() => {
    setAlineando(false);
    if (!selSede) return;
    const p = selSede.poligono && selSede.poligono.length >= 4 ? (selSede.poligono as LL[]) : null;
    setHuella(p ? medidasDeRect(p) : { W: selSede.footAncho ?? 20, H: selSede.footAlto ?? 15, orient: 0 });
    /* eslint-disable-next-line */
  }, [selectedId]);

  function centroActual(): LL {
    if (selSede?.poligono && selSede.poligono.length >= 3) return centroide(selSede.poligono as LL[]);
    return [selSede?.lat ?? 19.4326, selSede?.lng ?? -99.1332];
  }
  async function aplicarHuella(h: { W: number; H: number; orient: number }) {
    if (!selSede) return;
    await setPoligono(selSede.id, rectRotado(centroActual(), Math.max(0.5, h.W), Math.max(0.5, h.H), h.orient));
  }
  function girar(delta: number) { const h = { ...huella, orient: (((huella.orient + delta) % 360) + 360) % 360 }; setHuella(h); void aplicarHuella(h); }
  function fijarOrient(a: number) { const h = { ...huella, orient: a }; setHuella(h); void aplicarHuella(h); }
  function leerDelMapa() { const p = selSede?.poligono && selSede.poligono.length >= 4 ? (selSede.poligono as LL[]) : null; if (p) setHuella(medidasDeRect(p)); }
  // 2 clics en el mapa a lo largo de la cuadra → el rumbo se fija como orientación y se regenera la huella.
  function alinearACalle(bearingN: number) { const h = { ...huella, orient: Math.round(bearingN) }; setAlineando(false); setHuella(h); void aplicarHuella(h); }

  if (abierta) return <EditorEspacios proyectoId={proyectoId} sedeId={abierta} onVolver={() => { setAbierta(null); cargar(); }} />;

  async function crear() { if (!nombre.trim()) return; const s = await crearSede(proyectoId, nombre.trim()); setNombre(''); cargar(); setSelectedId(s.id); }
  async function mover(id: string, lat: number, lng: number) {
    const prev = sedes.find((s) => s.id === id);
    if (prev && typeof prev.lat === 'number' && typeof prev.lng === 'number') {
      const pl = prev.lat, pg = prev.lng;
      registrarDeshacer('mover la sede en el mapa', async () => { await actualizarSede(id, { lat: pl, lng: pg }); });
    }
    setSedes((arr) => arr.map((s) => s.id === id ? { ...s, lat, lng } : s));
    await actualizarSede(id, { lat, lng });
  }
  async function setPoligono(id: string, pts: [number, number][]) {
    const prev = sedes.find((s) => s.id === id);
    if (prev) {
      const pPoly = prev.poligono ? prev.poligono.map((p) => [...p] as [number, number]) : [];
      registrarDeshacer('cambiar la huella en el mapa', async () => { await actualizarSede(id, { poligono: pPoly }); });
    }
    setSedes((arr) => arr.map((s) => s.id === id ? { ...s, poligono: pts } : s));
    await actualizarSede(id, { poligono: pts });
  }
  async function setFoot(id: string, patch: Partial<Sede>) { setSedes((arr) => arr.map((s) => s.id === id ? { ...s, ...patch } : s)); await actualizarSede(id, patch); }

  return (
    <section>
      <h3 style={{ marginTop: 0 }}>Sedes & Espacios</h3>
      <p style={{ fontSize: 13, color: '#555', marginTop: 0 }}>
        Ubica cada sede en el mapa real y ajusta su <strong>huella</strong> (tamaño en metros). Selecciona una para ver su <strong>layout interior superpuesto</strong> en el mapa, y entra al editor 2D para diseñarlo.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.5rem 0' }}>
        <input style={{ ...inp, flex: 2, minWidth: 160 }} placeholder="Nombre de la sede (ej. Local centro)" value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void crear(); }} />
        <button style={btn} onClick={() => void crear()} disabled={!nombre.trim()}>＋ Nueva sede</button>
        <BotonDeshacer onDespues={cargar} />
      </div>

      {/* Mapa real */}
      <MapaSedes sedes={sedes} selectedId={selectedId} overlaySpaces={overlay} overlayObjetos={overlayObj} onSelect={setSelectedId} onMove={(id, lat, lng) => void mover(id, lat, lng)} onPolygon={(id, pts) => void setPoligono(id, pts)} alinearActivo={alineando} onAlinear={alinearACalle} />
      <p style={{ fontSize: 12, color: '#888', margin: '0.35rem 0 0.5rem' }}>
        Cada sede aparece como una <strong>huella editable</strong> (rectángulo punteado por defecto, según su ancho×alto). Con las herramientas de Geoman (arriba-izq) puedes <strong>editar vértices</strong> ✎, <strong>rotarla</strong> ↻ o redibujarla con la de <strong>polígono</strong>. Para <strong>mover</strong> toda la huella (incluso tras rotarla) arrastra el <strong>recuadro central ✥</strong>. El recuadro muestra <strong>área</strong>, <strong>orientación</strong> (∠° vs Norte) y cada lado su medida; los <strong>ángulos</strong> de cada esquina se ven en la sede seleccionada. Usa el tablero de abajo para medidas exactas y alinear a las cuadras. El layout azul = tus espacios superpuestos. Tiles © OpenStreetMap.
      </p>

      {/* Tablero de huella (sede seleccionada): medidas exactas + orientación/alineación */}
      {selSede && (
        <div style={{ border: '1px solid #e0795b', borderRadius: 8, padding: '0.6rem 0.9rem', margin: '0 0 0.6rem', background: '#fff6f2' }}>
          <strong style={{ fontSize: 13 }}>📐 Tablero de huella · {selSede.nombre}</strong>
          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'flex-end', marginTop: '0.4rem' }}>
            <label style={{ fontSize: 12, color: '#555' }}>Ancho (m)<br /><input style={{ ...inp, width: 90 }} type="number" step="0.5" value={huella.W} onChange={(e) => setHuella((h) => ({ ...h, W: Number(e.target.value) }))} /></label>
            <label style={{ fontSize: 12, color: '#555' }}>Alto (m)<br /><input style={{ ...inp, width: 90 }} type="number" step="0.5" value={huella.H} onChange={(e) => setHuella((h) => ({ ...h, H: Number(e.target.value) }))} /></label>
            <label style={{ fontSize: 12, color: '#555' }}>Orientación (° vs Norte)<br /><input style={{ ...inp, width: 110 }} type="number" step="1" value={huella.orient} onChange={(e) => setHuella((h) => ({ ...h, orient: Number(e.target.value) }))} /></label>
            <button style={{ ...btn, borderColor: '#e0795b', color: '#e0795b', fontWeight: 'bold' }} onClick={() => void aplicarHuella(huella)}>Aplicar</button>
            <span style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center', fontSize: 12, color: '#777' }}>
              girar: <button style={btn} onClick={() => girar(-5)}>−5°</button><button style={btn} onClick={() => girar(-1)}>−1°</button><button style={btn} onClick={() => girar(1)}>+1°</button><button style={btn} onClick={() => girar(5)}>+5°</button>
            </span>
            <span style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center', fontSize: 12, color: '#777' }}>
              alinear: <button style={btn} onClick={() => fijarOrient(0)}>N–S</button><button style={btn} onClick={() => fijarOrient(90)}>E–O</button>
            </span>
            <button style={btn} onClick={leerDelMapa} title="Leer medidas del polígono actual del mapa">↻ Leer del mapa</button>
            <button style={{ ...btn, ...(alineando ? { background: '#e0795b', color: '#fff', borderColor: '#e0795b', fontWeight: 'bold' } : { borderColor: '#e0795b', color: '#e0795b' }) }} onClick={() => setAlineando((v) => !v)} title="Haz 2 clics en el mapa a lo largo de la calle para adoptar su rumbo">{alineando ? '✕ Cancelar alineación' : '🎯 Alinear a la calle (2 clics)'}</button>
          </div>
          {alineando && <p style={{ fontSize: 12, color: '#e0795b', fontWeight: 'bold', margin: '0.4rem 0 0' }}>🎯 Haz <strong>2 clics</strong> en el mapa a lo largo de la cuadra (primero un extremo, luego el otro). La huella adoptará ese rumbo manteniendo su ancho×alto.</p>}
          <p style={{ fontSize: 11, color: '#888', margin: '0.35rem 0 0' }}>Área ≈ <strong>{Math.round(huella.W * huella.H)} m²</strong>. Para <strong>alinear a la cuadra</strong>: usa <strong>🎯 Alinear a la calle</strong> (2 clics sobre la calle) o ajusta la <strong>orientación</strong> en grados (girar ±1°/±5°) hasta que la huella calce. «Aplicar» regenera el rectángulo centrado en su posición actual.</p>
        </div>
      )}

      {loading && <p style={{ color: '#666' }}>Cargando…</p>}
      {!loading && sedes.length === 0 && <p style={{ color: '#666' }}>Sin sedes aún. Crea la primera arriba.</p>}
      {sedes.map((s) => {
        const sel = s.id === selectedId;
        return (
          <div key={s.id} style={{ ...card, borderColor: sel ? '#e0795b' : '#ddd', background: sel ? '#fff6f2' : '#fafafa' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input style={{ ...inp, fontWeight: 'bold', flex: 1, minWidth: 140 }} defaultValue={s.nombre} onBlur={(e) => { if (e.target.value !== s.nombre) void setFoot(s.id, { nombre: e.target.value }); }} />
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button style={{ ...btn, ...(sel ? { borderColor: '#e0795b', color: '#e0795b' } : {}) }} onClick={() => setSelectedId(s.id)}>{sel ? '● Seleccionada' : 'Ver en mapa'}</button>
                <button style={btn} onClick={() => setAbierta(s.id)}>Editor 2D →</button>
                <button style={{ ...btn, color: '#a00' }} onClick={() => { if (confirm(`¿Eliminar sede "${s.nombre}" y su interior?`)) void eliminarSede(s.id).then(() => { if (selectedId === s.id) setSelectedId(null); cargar(); }); }}>Eliminar</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem', fontSize: 12, color: '#666', alignItems: 'center' }}>
              <input style={{ ...inp, flex: 2, minWidth: 160, fontSize: 13 }} placeholder="Dirección" defaultValue={s.direccion ?? ''} onBlur={(e) => void setFoot(s.id, { direccion: e.target.value })} />
              <label>Huella ancho (m)<input style={{ ...inp, width: 80, marginLeft: 4, fontSize: 13 }} type="number" defaultValue={s.footAncho ?? 20} onBlur={(e) => void setFoot(s.id, { footAncho: Number(e.target.value) || 20 })} /></label>
              <label>alto (m)<input style={{ ...inp, width: 80, marginLeft: 4, fontSize: 13 }} type="number" defaultValue={s.footAlto ?? 15} onBlur={(e) => void setFoot(s.id, { footAlto: Number(e.target.value) || 15 })} /></label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem', fontSize: 12, color: '#666', alignItems: 'center' }}>
              <label>🏗️ ¿Ya hay instalaciones?
                <select style={{ ...inp, width: 'auto', marginLeft: 4, fontSize: 13 }} value={s.existe === true ? 'si' : s.existe === false ? 'no' : ''} onChange={(e) => void setFoot(s.id, { existe: e.target.value === 'si' ? true : false })}>
                  <option value="">— definir —</option>
                  <option value="si">Sí, ya existe</option>
                  <option value="no">No, por construir</option>
                </select>
              </label>
              {s.existe === true && <span style={{ color: '#2e7a4d' }}>→ escanéala con LiDAR en <strong>Editor 2D → 🧊 Ver 3D → 🏠 Subir escaneo</strong>; revisa <strong>📐 Reporte</strong>. Alimenta el plano Jurídico.</span>}
              {s.existe === false && <span style={{ color: '#a67c00' }}>→ diséñala en el Editor 2D o con el Diseñador 3D antes de construir.</span>}
            </div>
          </div>
        );
      })}
    </section>
  );
}
