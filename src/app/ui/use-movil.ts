'use client';

// Hook responsive: true cuando la pantalla es angosta (celular).
// Las vistas de 2 columnas (panel/chat | gráfico) pasan a 1 columna
// y el gráfico aparece ABAJO del chat, a ancho completo.

import { useEffect, useState } from 'react';

export function useEsMovil(breakpoint = 760): boolean {
  const [movil, setMovil] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const h = () => setMovil(mq.matches);
    h();
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [breakpoint]);
  return movil;
}
