// Contrato de agente (alpha). Declara CAPABILITY, nunca modelo (TEC-R6 / IAI-R5).
// Agente ⇏ Runtime (IAI-R1): el agente PROPONE; nunca escribe ni publica.

export type Capability =
  | 'clasificacion'      // p.ej. sugerir HS code / restricción
  | 'sugerencia'         // p.ej. sugerir Incoterm / puerto
  | 'deteccion_duplicados'
  | 'resumen';

export interface Sugerencia {
  campo: string;
  valor: string;
  confianza: 'baja' | 'media' | 'alta';
  fuente: 'mock';        // alpha: solo mock
  // El humano/formulario decide si la acepta. El agente no escribe.
}

export interface Agente {
  readonly nombre: string;
  readonly capabilities: ReadonlyArray<Capability>; // capability, NO modelo
  /** Propone (solo lectura). Nunca persiste ni cambia estado. */
  proponer(input: Record<string, unknown>): Promise<Sugerencia[]>;
}
