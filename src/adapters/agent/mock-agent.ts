// Agente MOCK (alpha). Sugiere desde tablas de dominio REALES (Incoterms/puertos).
// NO LLM · NO autónomo · NO escribe (Agente ⇏ Runtime). Determinista.

import type { Agente, Capability, Sugerencia } from './agent.contract';
import type { Incoterm, PuertoMX } from '@/domain/plano-com-exp';

// Recomendación puerto→destino (subconjunto real, domain_trade_knowledge).
const PUERTO_POR_DESTINO: Record<string, PuertoMX> = {
  asia: 'MXLZC',
  europa: 'MXVER',
  usa_oeste: 'MXLZC',
  usa_centro: 'MXNLD',
  caribe: 'MXPBC',
};

// Incoterm sugerido por defecto para marketplace B2B marítimo (sugerencia, no regla dura).
const INCOTERM_DEFAULT: Incoterm = 'FOB';

export class MockAgent implements Agente {
  readonly nombre = 'mock-operador-bp';
  readonly capabilities: ReadonlyArray<Capability> = ['clasificacion', 'sugerencia'];

  async proponer(input: Record<string, unknown>): Promise<Sugerencia[]> {
    const sugerencias: Sugerencia[] = [];

    const destino = typeof input.destino === 'string' ? input.destino.toLowerCase() : undefined;
    // Acceso por índice con noUncheckedIndexedAccess → PuertoMX | undefined; se narrowea aquí.
    const puerto = destino ? PUERTO_POR_DESTINO[destino] : undefined;
    if (puerto) {
      sugerencias.push({
        campo: 'puertoSalida',
        valor: puerto,
        confianza: 'media',
        fuente: 'mock',
      });
    }

    sugerencias.push({
      campo: 'incotermSugerido',
      valor: INCOTERM_DEFAULT,
      confianza: 'baja',
      fuente: 'mock',
    });

    // El agente NO escribe: devuelve sugerencias para que el humano/formulario decida.
    return sugerencias;
  }
}
