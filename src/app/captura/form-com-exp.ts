// Tipos del formulario de captura COM-EXP (bloque 5, alpha).
// Lo que el humano captura. Campos export opcionales → si faltan se rellenan con PENDIENTE().
// Fuente: MODULO_COM_EXP_EXPORTACION_v0.1.md (FROZEN). NO INVENTAR valores.

import type {
  Cotizacion,
  Incoterm,
  PuertoMX,
  RestriccionCarga,
  TipoDocumento,
} from '@/domain/plano-com-exp';

export interface CapturaProducto {
  // Requeridos (el formulario gobierna):
  sku: string;
  nombre: string;
  categoria: string;
  restriccion: RestriccionCarga;
  // Export-específicos (si faltan → PENDIENTE al construir el plano):
  hsCode?: string;
  incotermSugerido?: Incoterm;
  puertoSalida?: PuertoMX;
  certificadoOrigenRequerido?: boolean;
  precio?: { monto: number; moneda: string };
}

export interface CapturaComExp {
  entidad: string;
  productos: CapturaProducto[];
  cotizaciones?: Cotizacion[];
  documentos?: TipoDocumento[];
}

export interface ResultadoValidacion {
  ok: boolean;
  errores: string[];   // requeridos ausentes (bloquean)
  pendientes: string[]; // export-específicos ausentes → PENDIENTE (no bloquean)
}
