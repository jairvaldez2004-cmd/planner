'use client';

// Chat con el ESPECIALISTA de un plano. Pregunta lo de su plantilla en orden lógico y
// registra campos. Cuando cambia el readiness, avisa al padre para refrescar el detalle.

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { MensajeChat } from '@/adapters/ai/especialista-agent';
import type { Readiness } from '@/app/readiness/readiness-engine';
import { conversarEspecialista } from '@/app/actions/especialista.actions';

const card: CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem 1rem', background: '#fff' };
const btn: CSSProperties = { padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 14 };
const inp: CSSProperties = { padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid #ccc' };
const burbuja = (rol: 'user' | 'assistant'): CSSProperties => ({
  alignSelf: rol === 'user' ? 'flex-end' : 'flex-start',
  background: rol === 'user' ? '#e8f0fe' : '#f1f1f1',
  borderRadius: 10, padding: '0.5rem 0.75rem', margin: '0.25rem 0', maxWidth: '92%', whiteSpace: 'pre-wrap', fontSize: 14,
});

interface Props {
  proyectoId: string;
  planoId: string;
  nombrePlano: string;
  onReadiness?: (r: Readiness) => void;
  altura?: number;
}

export function ChatEspecialista({ proyectoId, planoId, nombrePlano, onReadiness, altura = 420 }: Props) {
  const saludo = `Hola, soy el especialista del plano ${nombrePlano}. Te haré las preguntas necesarias en orden para armarlo. Cuéntame y voy registrando; los datos repetitivos (catálogos) los subes por la sección de Tablas. ¿Empezamos?`;
  const [historial, setHistorial] = useState<MensajeChat[]>([{ role: 'assistant', content: saludo }]);
  const [entrada, setEntrada] = useState('');
  const [pensando, setPensando] = useState(false);
  const finRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [historial, pensando]);
  // reiniciar al cambiar de plano
  useEffect(() => { setHistorial([{ role: 'assistant', content: saludo }]); /* eslint-disable-next-line */ }, [planoId]);

  async function enviar() {
    const texto = entrada.trim();
    if (!texto || pensando) return;
    const nuevo: MensajeChat[] = [...historial, { role: 'user', content: texto }];
    setHistorial(nuevo);
    setEntrada('');
    setPensando(true);
    try {
      const r = await conversarEspecialista(proyectoId, planoId, nuevo);
      setHistorial([...nuevo, { role: 'assistant', content: r.reply }]);
      if (r.readiness && onReadiness) onReadiness(r.readiness);
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
        <input style={{ ...inp, flex: 1 }} value={entrada} onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void enviar(); }} placeholder="Responde al especialista…" disabled={pensando} />
        <button style={btn} onClick={() => void enviar()} disabled={pensando || !entrada.trim()}>Enviar</button>
      </div>
    </div>
  );
}
