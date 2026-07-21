'use client';

// Chat con el CURADOR del workspace. Identifica proyectos y cura el grafo (renombrar/
// relacionar/archivar/mover) ejecutando acciones reales server-side. Conversación continua.
// Cuando una acción cambia el grafo, llama onCambio para que el padre lo recargue.

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { MensajeChat } from '@/adapters/ai/arquitecto-agent';
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

// Reescala la foto a máx 1568 px (el tamaño óptimo para el modelo) y JPEG: una foto
// de celular de 4 MB baja a ~200-400 KB sin perder lo que el agente necesita ver.
async function comprimirFoto(f: File): Promise<{ mime: string; base64: string } | null> {
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
  const [foto, setFoto] = useState<{ mime: string; base64: string } | null>(null);
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

  async function enviar() {
    const texto = entrada.trim();
    if ((!texto && !foto) || pensando) return;
    const nuevo: MensajeChat[] = [...historial, { role: 'user', content: texto, ...(foto ? { imagen: foto } : {}) }];
    setHistorial(nuevo);
    setEntrada('');
    setFoto(null);
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
            {m.imagen && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`data:${m.imagen.mime};base64,${m.imagen.base64}`} alt="foto de referencia" style={{ maxWidth: 180, borderRadius: 8, display: 'block', marginBottom: m.content ? 6 : 0 }} />
            )}
            {m.content}
          </div>
        ))}
        {pensando && <div style={burbuja('assistant')}>…</div>}
        <div ref={finRef} />
      </div>
      {foto && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '0.4rem' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:${foto.mime};base64,${foto.base64}`} alt="adjunta" style={{ height: 44, borderRadius: 6 }} />
          <span style={{ fontSize: 12, color: '#666' }}>Foto lista para enviar — describe qué quieres de ella.</span>
          <button style={{ ...btn, padding: '0.15rem 0.5rem' }} onClick={() => setFoto(null)}>✕</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        {permitirFotos && (
          <>
            <input ref={fotoRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void comprimirFoto(f).then((r) => { if (r) setFoto(r); }); e.target.value = ''; }} />
            <button style={btn} title="Adjuntar foto de referencia (el agente la ve)" onClick={() => fotoRef.current?.click()} disabled={pensando}>📷</button>
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
        <button style={btn} onClick={() => void enviar()} disabled={pensando || (!entrada.trim() && !foto)}>Enviar</button>
      </div>
    </div>
  );
}
