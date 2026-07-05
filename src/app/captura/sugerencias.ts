// Integración del agente MOCK como sugerencias OPCIONALES (bloque 5, alpha).
// El agente solo sugiere (Agente⇏Runtime). El humano decide cuáles aceptar; solo se aplican a campos vacíos.

import type { Incoterm, PuertoMX } from '@/domain/plano-com-exp';
import { MockAgent } from '@/adapters/agent/mock-agent';
import type { Sugerencia } from '@/adapters/agent/agent.contract';
import type { CapturaProducto } from './form-com-exp';

const INCOTERMS: readonly Incoterm[] = [
  'EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP',
];
const PUERTOS: readonly PuertoMX[] = ['MXLZC', 'MXVER', 'MXMZT', 'MXPBC', 'MXNLD', 'MXCDJ'];

const esIncoterm = (v: string): v is Incoterm => (INCOTERMS as readonly string[]).includes(v);
const esPuerto = (v: string): v is PuertoMX => (PUERTOS as readonly string[]).includes(v);

/** Pide sugerencias al mock para un destino (no escribe nada). */
export async function sugerirParaProducto(destino: string): Promise<Sugerencia[]> {
  const agente = new MockAgent();
  return agente.proponer({ destino });
}

/** Aplica solo las sugerencias ACEPTADAS por el humano, y solo a campos vacíos y válidos. */
export function aplicarSugerencias(p: CapturaProducto, aceptadas: Sugerencia[]): CapturaProducto {
  let out: CapturaProducto = { ...p };
  for (const s of aceptadas) {
    if (s.campo === 'incotermSugerido' && out.incotermSugerido === undefined && esIncoterm(s.valor)) {
      out = { ...out, incotermSugerido: s.valor };
    }
    if (s.campo === 'puertoSalida' && out.puertoSalida === undefined && esPuerto(s.valor)) {
      out = { ...out, puertoSalida: s.valor };
    }
  }
  return out;
}
