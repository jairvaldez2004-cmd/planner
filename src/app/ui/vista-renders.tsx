'use client';

// RENDERS EXTERNOS de una sede (ADITIVO). Ref: domain/render.ts + render.actions.ts.
// Sube tu render/plano/foto (hecho en cualquier herramienta) y adáptalo al modelo:
//   1) CALIBRAR: 2 clics sobre una distancia conocida → la imagen queda a escala
//      (medir sobre ella da metros reales).
//   2) ANCLAR: clic en la imagen → elegir a qué Espacio u Objeto real apunta ese punto.
//      El pin queda unido a la entidad del modelo (misma ficha en 2D, 3D y render).

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { listarRenders, subirRender, actualizarRender, eliminarRender } from '@/app/actions/render.actions';
import type { RenderInfo } from '@/app/actions/render.actions';
import { distanciaMetros, formatoMetros, metrosPorPixel, MAX_RENDER_BYTES } from '@/domain/render';
import type { AnclajeRender, PuntoPx } from '@/domain/render';
import type { Espacio, ObjetoFisico } from '@/domain/espacios';

const btn: CSSProperties = { padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };
const inp: CSSProperties = { padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 };

type Modo = 'ver' | 'calibrar' | 'anclar';

interface Props {
  proyectoId: string;
  sedeId: string;
  espacios: Espacio[];
  objetos: ObjetoFisico[];
  onCerrar: () => void;
}

export function VistaRenders({ proyectoId, sedeId, espacios, objetos, onCerrar }: Props) {
  const [renders, setRenders] = useState<RenderInfo[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>('ver');
  const [calibPts, setCalibPts] = useState<PuntoPx[]>([]);
  const [pendiente, setPendiente] = useState<PuntoPx | null>(null); // clic esperando destino
  const [destino, setDestino] = useState('');
  const [msg, setMsg] = useState('');
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const cargar = () => { listarRenders(sedeId).then((rs) => { setRenders(rs); setSelId((s) => s ?? rs[0]?.id ?? null); }).catch(() => {}); };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [sedeId]);

  const render = renders.find((r) => r.id === selId) ?? null;
  const mpp = render?.calibracion ? metrosPorPixel(render.calibracion) : null;

  async function subir(f: File) {
    if (f.size > MAX_RENDER_BYTES) { setMsg(`"${f.name}" pesa ${(f.size / 1024 / 1024).toFixed(1)} MB; el máximo es 5 MB.`); return; }
    setMsg('Subiendo…');
    const b64 = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(',')[1] ?? '');
      fr.onerror = rej;
      fr.readAsDataURL(f);
    });
    const r = await subirRender(proyectoId, sedeId, f.name.replace(/\.[^.]+$/, ''), f.type, b64);
    if (!r.ok) { setMsg(r.error); return; }
    setMsg('Render subido. Ahora calíbralo (2 clics sobre una distancia conocida) y ancla tus espacios.');
    setSelId(r.id); cargar();
  }

  // clic sobre la imagen → coordenadas en px NATURALES (independientes del zoom/pantalla)
  function pxNatural(e: React.MouseEvent): PuntoPx | null {
    const img = imgRef.current; if (!img || !natural) return null;
    const r = img.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * natural.w, y: ((e.clientY - r.top) / r.height) * natural.h };
  }

  async function clicImagen(e: React.MouseEvent) {
    if (!render) return;
    const p = pxNatural(e); if (!p) return;
    if (modo === 'calibrar') {
      const pts = [...calibPts, p];
      if (pts.length < 2) { setCalibPts(pts); setMsg('Punto 1 puesto. Clic en el segundo punto de la distancia conocida.'); return; }
      const metros = Number(window.prompt('¿Cuántos METROS hay entre los 2 puntos? (ej. 3 o 2.5)') ?? '');
      setCalibPts([]);
      setModo('ver');
      if (!(metros > 0)) { setMsg('Calibración cancelada.'); return; }
      const calibracion = { x1: pts[0]!.x, y1: pts[0]!.y, x2: pts[1]!.x, y2: pts[1]!.y, metros };
      await actualizarRender(render.id, { calibracion });
      setMsg(`Calibrado: esa distancia son ${metros} m. Ya puedes medir y los pines mostrarán distancias reales.`);
      cargar();
    } else if (modo === 'anclar') {
      setPendiente(p);
      setMsg('Elige a qué espacio u objeto del modelo apunta ese punto (panel derecho).');
    }
  }

  async function confirmarAnclaje() {
    if (!render || !pendiente || !destino) return;
    const [tipo, ref] = destino.split(':') as ['espacio' | 'objeto', string];
    const ent = tipo === 'espacio' ? espacios.find((x) => x.id === ref) : objetos.find((x) => x.id === ref);
    if (!ent) return;
    const anclaje: AnclajeRender = {
      id: `ANC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      x: pendiente.x, y: pendiente.y, tipo, ref, nombre: ent.nombre,
    };
    await actualizarRender(render.id, { anclajes: [...render.anclajes, anclaje] });
    setPendiente(null); setDestino(''); setModo('ver');
    setMsg(`Anclado: ese punto del render ES "${ent.nombre}" del modelo.`);
    cargar();
  }

  async function quitarAnclaje(id: string) {
    if (!render) return;
    await actualizarRender(render.id, { anclajes: render.anclajes.filter((a) => a.id !== id) });
    cargar();
  }

  // posición de un punto natural sobre la imagen mostrada (en %)
  const pct = (p: PuntoPx) => natural ? { left: `${(p.x / natural.w) * 100}%`, top: `${(p.y / natural.h) * 100}%` } : { left: '0%', top: '0%' };

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>🖼 Renders externos <span style={{ fontSize: 12.5, color: '#888' }}>· sube tu render/plano/foto y únelo al modelo</span></h3>
        <button style={btn} onClick={onCerrar}>← Editor 2D</button>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', margin: '0.5rem 0' }}>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void subir(f); e.target.value = ''; }} />
        <button style={{ ...btn, fontWeight: 'bold' }} onClick={() => fileRef.current?.click()}>⬆ Subir render</button>
        {renders.map((r) => (
          <button key={r.id} style={{ ...btn, background: selId === r.id ? '#33415c' : '#fff', color: selId === r.id ? '#fff' : '#333' }}
            onClick={() => { setSelId(r.id); setModo('ver'); setCalibPts([]); setPendiente(null); }}>{r.nombre}</button>
        ))}
      </div>

      {msg && <p style={{ fontSize: 12.5, color: '#2b5a97', margin: '0 0 0.5rem' }}>{msg}</p>}
      {!render && renders.length === 0 && (
        <p style={{ color: '#888', fontSize: 13, border: '1px dashed #ddd', borderRadius: 8, padding: '1rem' }}>
          Sube el render, plano del arquitecto o una foto del local (PNG/JPG/WebP, máx. 5 MB). Después lo calibras a escala con 2 clics y le anclas tus espacios y objetos reales.
        </p>
      )}

      {render && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 290px', gap: '0.75rem', alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
              <button style={{ ...btn, background: modo === 'calibrar' ? '#b06be0' : '#fff', color: modo === 'calibrar' ? '#fff' : '#333' }}
                onClick={() => { setModo(modo === 'calibrar' ? 'ver' : 'calibrar'); setCalibPts([]); setPendiente(null); setMsg(modo === 'calibrar' ? '' : 'Clic en el PRIMER punto de una distancia que conozcas (ej. un muro de 3 m).'); }}>
                📏 {render.calibracion ? 'Recalibrar' : 'Calibrar escala'}
              </button>
              <button style={{ ...btn, background: modo === 'anclar' ? '#2e9e63' : '#fff', color: modo === 'anclar' ? '#fff' : '#333' }}
                onClick={() => { setModo(modo === 'anclar' ? 'ver' : 'anclar'); setCalibPts([]); setPendiente(null); setMsg(modo === 'anclar' ? '' : 'Clic sobre el render donde está un espacio u objeto de tu modelo.'); }}>
                📌 Anclar espacio/objeto
              </button>
              {mpp !== null && <span style={{ fontSize: 12, color: '#2e9e63', alignSelf: 'center' }}>✓ a escala ({formatoMetros(mpp * 100)} por cada 100 px)</span>}
            </div>

            <div style={{ position: 'relative', border: '1px solid #ddd', borderRadius: 10, overflow: 'hidden', cursor: modo === 'ver' ? 'default' : 'crosshair', lineHeight: 0 }}
              onClick={(e) => void clicImagen(e)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={imgRef} src={render.dataUrl} alt={render.nombre} style={{ width: '100%', height: 'auto', display: 'block' }}
                onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
              {/* puntos de calibración en curso */}
              {calibPts.map((p, i) => (
                <span key={i} style={{ position: 'absolute', ...pct(p), transform: 'translate(-50%,-50%)', width: 12, height: 12, borderRadius: 6, background: '#b06be0', border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,.4)' }} />
              ))}
              {/* línea de calibración guardada */}
              {render.calibracion && natural && (
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox={`0 0 ${natural.w} ${natural.h}`} preserveAspectRatio="none">
                  <line x1={render.calibracion.x1} y1={render.calibracion.y1} x2={render.calibracion.x2} y2={render.calibracion.y2} stroke="#b06be0" strokeWidth={Math.max(2, natural.w / 400)} strokeDasharray="8 6" />
                </svg>
              )}
              {/* pin pendiente */}
              {pendiente && <span style={{ position: 'absolute', ...pct(pendiente), transform: 'translate(-50%,-100%)', fontSize: 22 }}>📍</span>}
              {/* anclajes */}
              {render.anclajes.map((a) => (
                <span key={a.id} title={`${a.nombre} (${a.tipo})`}
                  style={{ position: 'absolute', ...pct(a), transform: 'translate(-50%,-100%)', fontSize: 12, background: a.tipo === 'espacio' ? '#33415c' : '#b5813f', color: '#fff', borderRadius: 10, padding: '1px 8px', whiteSpace: 'nowrap', boxShadow: '0 1px 4px rgba(0,0,0,.4)', lineHeight: '16px' }}>
                  📌 {a.nombre}
                </span>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: '#888', margin: '0.35rem 0 0' }}>
              📏 Calibrar = 2 clics sobre una distancia conocida (la imagen queda a escala). 📌 Anclar = unir un punto del render con un espacio u objeto REAL del modelo — comparten ficha, costos y procesos.
            </p>
          </div>

          {/* panel */}
          <div style={{ border: '1px solid #cdd8ef', borderRadius: 10, padding: '0.7rem', background: '#f7f9ff' }}>
            <strong style={{ fontSize: 14 }}>{render.nombre}</strong>
            <div style={{ fontSize: 11.5, color: '#888', marginBottom: 6 }}>{render.calibracion ? `Calibrado: ${render.calibracion.metros} m de referencia.` : 'Sin calibrar todavía.'}</div>

            {pendiente && (
              <div style={{ border: '1px solid #bfe3cf', background: '#effaf3', borderRadius: 8, padding: '0.5rem', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>¿Qué hay en ese punto?</div>
                <select style={{ ...inp, width: '100%' }} value={destino} onChange={(e) => setDestino(e.target.value)}>
                  <option value="">— elegir del modelo —</option>
                  <optgroup label="Espacios">
                    {espacios.map((s) => <option key={s.id} value={`espacio:${s.id}`}>{s.nombre}</option>)}
                  </optgroup>
                  <optgroup label="Objetos">
                    {objetos.map((o) => <option key={o.id} value={`objeto:${o.id}`}>{o.nombre}</option>)}
                  </optgroup>
                </select>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  <button style={{ ...btn, background: '#2e9e63', color: '#fff', borderColor: '#2e9e63' }} disabled={!destino} onClick={() => void confirmarAnclaje()}>✓ Anclar</button>
                  <button style={btn} onClick={() => { setPendiente(null); setDestino(''); }}>Cancelar</button>
                </div>
              </div>
            )}

            <div style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>📌 Anclajes ({render.anclajes.length})</div>
            {render.anclajes.length === 0 && <div style={{ fontSize: 12, color: '#999' }}>Ninguno todavía.</div>}
            {render.anclajes.map((a, i) => {
              const prev = render.anclajes[i - 1];
              const d = prev && render.calibracion ? distanciaMetros(prev, a, render.calibracion) : null;
              return (
                <div key={a.id} style={{ fontSize: 12.5, padding: '0.2rem 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ flex: 1 }}>· <strong>{a.nombre}</strong> <span style={{ color: '#999' }}>({a.tipo})</span>{d !== null && <span style={{ color: '#2b5a97' }}> · a {formatoMetros(d)} del anterior</span>}</span>
                  <span style={{ cursor: 'pointer', color: '#b33' }} onClick={() => void quitarAnclaje(a.id)}>×</span>
                </div>
              );
            })}

            <div style={{ borderTop: '1px solid #dde', marginTop: '0.6rem', paddingTop: '0.5rem' }}>
              <button style={{ ...btn, color: '#b33', borderColor: '#d99' }}
                onClick={() => { if (window.confirm(`¿Eliminar el render "${render.nombre}"?`)) { void eliminarRender(render.id).then(() => { setSelId(null); cargar(); }); } }}>
                🗑 Eliminar render
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
