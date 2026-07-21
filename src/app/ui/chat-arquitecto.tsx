'use client';

// Chat con el CURADOR del workspace. Identifica proyectos y cura el grafo (renombrar/
// relacionar/archivar/mover) ejecutando acciones reales server-side. Conversación continua.
// Cuando una acción cambia el grafo, llama onCambio para que el padre lo recargue.

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { MensajeChat, ImagenChat } from '@/adapters/ai/arquitecto-agent';
import { conversarCurador } from '@/app/actions/arquitecto.actions';

const card: CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem 1rem', background: '#fff' };
const btn: CSSProperties = { padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 14 };
const inp: CSSProperties = { padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid #ccc' };
const burbuja = (rol: 'user' | 'assistant'): CSSProperties => ({
  alignSelf: rol === 'user' ? 'flex-end' : 'flex-start',
  background: rol === 'user' ? '#e8f0fe' : '#f1f1f1',
  borderRadius: 10, padding: '0.5rem 0.75rem', margin: '0.25rem 0', maxWidth: '90%', whiteSpace: 'pre-wrap', fontSize: 14,
});

const SALUDO = 'Hola, soy el Curador del workspace. Dime qué proyecto quieres acomodar (qué es, a qué se dedica, qué quieres lograr) y lo coloco en el grafo. También puedo renombrar, relacionar, archivar o mover proyectos — solo pídemelo.';

interface Props {
  workspaceId?: string;
  // Conversación a usar. Por defecto, el Curador del workspace (usa workspaceId).
  // Se puede inyectar otra (p. ej. el Curador de un proyecto que crea Unidades Comerciales).
  conversar?: (historial: MensajeChat[]) => Promise<{ reply: string; refrescar: boolean }>;
  saludo?: string;
  placeholder?: string;
  contexto?: { workspace?: string; proyectos?: string[] };
  // Memoria: carga el historial persistido al montar. `historialKey` = id estable del
  // alcance (workspaceId/proyectoId) para recargar al cambiar de scope.
  cargarHistorial?: () => Promise<MensajeChat[]>;
  historialKey?: string;
  onCambio?: () => void;
  altura?: number;
  permitirFotos?: boolean;   // adjuntar fotos de referencia (el agente las VE)
}

// Máximo de fotos por mensaje: suficientes para "así quiero los muebles + acabados +
// diseño" sin disparar el costo del turno (cada foto son tokens de visión).
const MAX_FOTOS = 6;

// Reescala la foto a máx 1568 px (el tamaño óptimo para el modelo) y JPEG: una foto
// de celular de 4 MB baja a ~200-400 KB sin perder lo que el agente necesita ver.
async function comprimirFoto(f: File): Promise<ImagenChat | null> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i); i.onerror = rej; i.src = url;
    });
    const MAX = 1568;
    const esc = Math.min(1, MAX / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.85);
    return { mime: 'image/jpeg', base64: dataUrl.split(',')[1] ?? '' };
  } catch { return null; }
  finally { URL.revokeObjectURL(url); }
}

export function ChatArquitecto({ workspaceId, conversar, saludo, placeholder, cargarHistorial, historialKey, onCambio, altura = 380, permitirFotos }: Props) {
  const [historial, setHistorial] = useState<MensajeChat[]>([{ role: 'assistant', content: saludo ?? SALUDO }]);
  const [entrada, setEntrada] = useState('');
  const [pensando, setPensando] = useState(false);
  const [fotos, setFotos] = useState<ImagenChat[]>([]);
  const fotoRef = useRef<HTMLInputElement | null>(null);
  const finRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [historial, pensando]);

  // Recupera la conversación guardada (memoria) al montar o al cambiar de alcance.
  useEffect(() => {
    if (!cargarHistorial) return;
    let vivo = true;
    cargarHistorial().then((h) => { if (vivo && h.length) setHistorial(h); }).catch(() => {});
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historialKey]);

  async function agregarFotos(files: FileList) {
    const espacio = MAX_FOTOS - fotos.length;
    const lote = Array.from(files).slice(0, espacio);
    const nuevas = (await Promise.all(lote.map(comprimirFoto))).filter((x): x is ImagenChat => x !== null);
    setFotos((fs) => [...fs, ...nuevas].slice(0, MAX_FOTOS));
  }

  async function enviar() {
    const texto = entrada.trim();
    if ((!texto && !fotos.length) || pensando) return;
    const nuevo: MensajeChat[] = [...historial, { role: 'user', content: texto, ...(fotos.length ? { imagenes: fotos } : {}) }];
    setHistorial(nuevo);
    setEntrada('');
    setFotos([]);
    setPensando(true);
    try {
      const r = conversar ? await conversar(nuevo) : await conversarCurador(nuevo, workspaceId ?? '');
      setHistorial([...nuevo, { role: 'assistant', content: r.reply }]);
      if (r.refrescar && onCambio) onCambio();
    } finally {
      setPensando(false);
    }
  }

  return (
    <div>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', height: altura, overflowY: 'auto' }}>
        {historial.map((m, i) => (
          <div key={i} style={burbuja(m.role)}>
            {m.imagenes && m.imagenes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: m.content ? 6 : 0 }}>
                {m.imagenes.map((img, j) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={j} src={`data:${img.mime};base64,${img.base64}`} alt={`foto ${j + 1}`} style={{ maxWidth: m.imagenes!.length > 1 ? 90 : 180, borderRadius: 8 }} />
                ))}
              </div>
            )}
            {m.content}
          </div>
        ))}
        {pensando && <div style={burbuja('assistant')}>…</div>}
        <div ref={finRef} />
      </div>
      {fotos.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: '0.4rem', flexWrap: 'wrap' }}>
          {fotos.map((f, i) => (
            <span key={i} style={{ position: 'relative', display: 'inline-block' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`data:${f.mime};base64,${f.base64}`} alt={`adjunta ${i + 1}`} style={{ height: 44, borderRadius: 6, display: 'block' }} />
              <button style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, border: '1px solid #999', background: '#fff', fontSize: 10, lineHeight: '15px', cursor: 'pointer', padding: 0 }}
                title="Quitar esta foto" onClick={() => setFotos((fs) => fs.filter((_, j) => j !== i))}>✕</button>
            </span>
          ))}
          <span style={{ fontSize: 11.5, color: '#666' }}>
            {fotos.length}/{MAX_FOTOS} — describe qué quieres de ellas.
          </span>
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        {permitirFotos && (
          <>
            <input ref={fotoRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files?.length) void agregarFotos(e.target.files); e.target.value = ''; }} />
            <button style={{ ...btn, opacity: fotos.length >= MAX_FOTOS ? 0.5 : 1 }} title={`Adjuntar fotos de referencia (hasta ${MAX_FOTOS}; el agente las ve todas)`}
              onClick={() => fotoRef.current?.click()} disabled={pensando || fotos.length >= MAX_FOTOS}>📷{fotos.length ? ` ${fotos.length}` : ''}</button>
          </>
        )}
        <input
          style={{ ...inp, flex: 1 }}
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void enviar(); }}
          placeholder={placeholder ?? 'Escribe al Curador…'}
          disabled={pensando}
        />
        <button style={btn} onClick={() => void enviar()} disabled={pensando || (!entrada.trim() && !fotos.length)}>Enviar</button>
      </div>
    </div>
  );
}
