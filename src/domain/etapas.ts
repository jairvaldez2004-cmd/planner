// Etapa OBJETIVO del negocio (la RUTA de 5 fases). Distinta de `Etapa` del diagnóstico
// (que es la MADUREZ actual: idea/validación/early/…). Esta es la etapa hacia la que el
// negocio trabaja, la fija el Curador al inicio, y define qué planos y a qué % enfocarse.
// Ref: documento "Administración y Ruta de 5 Etapas".

export type EtapaObjetivo = 'arrancar' | 'expandir' | 'replicar' | 'automatizar' | 'vender';

export interface EtapaInfo {
  id: EtapaObjetivo;
  n: number;              // 1..5
  label: string;
  descripcion: string;
  foco: string[];         // planoIds prioritarios de la etapa
}

export const ETAPAS_OBJETIVO: EtapaInfo[] = [
  { id: 'arrancar',    n: 1, label: 'Arrancar y operar',          descripcion: 'Que el negocio abra y empiece a vender con lo mínimo bien hecho.',      foco: ['COM', 'OPE', 'PRO'] },
  { id: 'expandir',    n: 2, label: 'Expandir y semi-automatizar', descripcion: 'Crecer, medir y meter los primeros sistemas y automatizaciones.',       foco: ['FIN', 'CTR', 'TEC'] },
  { id: 'replicar',    n: 3, label: 'Replicar',                    descripcion: 'Estandarizar y documentar para abrir otra sede o franquiciar.',          foco: ['PRO', 'IMP', 'ESC'] },
  { id: 'automatizar', n: 4, label: 'Automatizar al máximo',       descripcion: 'Agentes de IA operan lo repetible; tableros en vivo.',                   foco: ['IA', 'TEC', 'CTR'] },
  { id: 'vender',      n: 5, label: 'Vender el negocio',           descripcion: 'Todo completo y documentado: paquete de due diligence.',                 foco: ['FIN', 'CTR', 'ESC'] },
];

// Matriz de % objetivo por plano en cada etapa (columna de la matriz del documento).
export const MATRIZ_ETAPA: Record<EtapaObjetivo, Record<string, number>> = {
  arrancar:    { META: 60, EST: 50, COM: 80, OPE: 70, PRO: 70, ORG: 50, FIN: 50, CUL: 30, CTR: 20, TEC: 20, IA: 0,  IMP: 40, ESC: 0,  MKT: 40, RH: 30, ARQ: 50, INV: 0,  JUR: 40 },
  expandir:    { META: 80, EST: 70, COM: 95, OPE: 85, PRO: 85, ORG: 80, FIN: 80, CUL: 70, CTR: 60, TEC: 60, IA: 40, IMP: 60, ESC: 20, MKT: 70, RH: 60, ARQ: 60, INV: 20, JUR: 60 },
  replicar:    { META: 90, EST: 85, COM: 95, OPE: 90, PRO: 95, ORG: 95, FIN: 85, CUL: 85, CTR: 75, TEC: 75, IA: 55, IMP: 95, ESC: 80, MKT: 80, RH: 90, ARQ: 85, INV: 30, JUR: 85 },
  automatizar: { META: 95, EST: 90, COM: 95, OPE: 95, PRO: 95, ORG: 95, FIN: 90, CUL: 90, CTR: 95, TEC: 95, IA: 95, IMP: 95, ESC: 85, MKT: 90, RH: 90, ARQ: 90, INV: 40, JUR: 90 },
  vender:      { META: 100, EST: 100, COM: 100, OPE: 100, PRO: 100, ORG: 100, FIN: 100, CUL: 95, CTR: 100, TEC: 95, IA: 95, IMP: 100, ESC: 95, MKT: 95, RH: 100, ARQ: 90, INV: 95, JUR: 100 },
};

export function etapaInfo(e: EtapaObjetivo | undefined): EtapaInfo | undefined {
  return e ? ETAPAS_OBJETIVO.find((x) => x.id === e) : undefined;
}

// % objetivo de un plano para la etapa dada (0 si no aplica / sin etapa).
export function objetivoDe(e: EtapaObjetivo | undefined, planoId: string): number {
  if (!e) return 0;
  return MATRIZ_ETAPA[e]?.[planoId] ?? 0;
}

// ¿es este plano parte del foco de la etapa?
export function esFoco(e: EtapaObjetivo | undefined, planoId: string): boolean {
  return etapaInfo(e)?.foco.includes(planoId) ?? false;
}
