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
}

export function ChatArquitecto({ workspaceId, conversar, saludo, placeholder, cargarHistorial, historialKey, onCambio, altura = 380 }: Props) {
  const [historial, setHistorial] = useState<MensajeChat[]>([{ role: 'assistant', content: saludo ?? SALUDO }]);
  const [entrada, setEntrada] = useState('');
  const [pensando, setPensando] = useState(false);
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
    if (!texto || pensando) return;
    const nuevo: MensajeChat[] = [...historial, { role: 'user', content: texto }];
    setHistorial(nuevo);
    setEntrada('');
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
        {historial.map((m, i) => <div key={i} style={burbuja(m.role)}>{m.content}</div>)}
        {pensando && <div style={burbuja('assistant')}>…</div>}
        <div ref={finRef} />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <input
          style={{ ...inp, flex: 1 }}
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void enviar(); }}
          placeholder={placeholder ?? 'Escribe al Curador…'}
          disabled={pensando}
        />
        <button style={btn} onClick={() => void enviar()} disabled={pensando || !entrada.trim()}>Enviar</button>
      </div>
    </div>
  );
}
