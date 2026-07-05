// Contrato del Plano Comercial-EXP (FROZEN) como tipos — alpha.
// Fuente: Especializaciones/MODULO_COM_EXP_EXPORTACION_v0.1.md (FROZEN, estructural).
// NO INVENTAR: los catálogos de dominio (Incoterms, puertos) son reales;
// los valores de negocio (precios, productos concretos) son opcionales → PENDIENTE.

// --- Catálogos de dominio (reales) ---
export type Incoterm =
  | 'EXW' | 'FCA' | 'FAS' | 'FOB' | 'CFR' | 'CIF'
  | 'CPT' | 'CIP' | 'DAP' | 'DPU' | 'DDP';

export type PuertoMX =
  | 'MXLZC' | 'MXVER' | 'MXMZT' | 'MXPBC' | 'MXNLD' | 'MXCDJ';

export type RestriccionCarga =
  | 'general' | 'hazmat' | 'perecedero' | 'automotriz' | 'ganado' | 'granel';

// Modelo de comisión real (CommissionPayer × ClientCommissionVisibility)
export type CommissionPayer = 'CLIENT' | 'PROVIDER' | 'INCLUDED_IN_PRICE' | 'SPLIT';
export type CommissionVisibility = 'VISIBLE' | 'EXEMPT' | 'INCLUDED' | 'HIDDEN_ADMIN_ONLY';

// Regla congelada: si PROVIDER paga → el cliente ve "Exento".
export function visibilidadComisionCliente(payer: CommissionPayer): CommissionVisibility {
  return payer === 'PROVIDER' ? 'EXEMPT' : 'VISIBLE';
}

// Valor marcado como pendiente (no se inventa).
export type Pendiente = { __pendiente: 'DATO_REAL' | 'DECISION_PROPIETARIO' };
export type ConPendiente<T> = T | Pendiente;
export const PENDIENTE = (
  clase: Pendiente['__pendiente'] = 'DATO_REAL',
): Pendiente => ({ __pendiente: clase });

export function esPendiente(v: unknown): v is Pendiente {
  return typeof v === 'object' && v !== null && '__pendiente' in v;
}

// --- Entidades del plano COM-EXP ---
export interface Producto {
  id: string;
  sku: string;
  nombre: string;
  categoria: string;
  hsCode: ConPendiente<string>;            // fracción arancelaria
  incotermSugerido: ConPendiente<Incoterm>;
  puertoSalida: ConPendiente<PuertoMX>;
  restriccion: RestriccionCarga;
  certificadoOrigenRequerido: ConPendiente<boolean>;
  precio: ConPendiente<{ monto: number; moneda: string }>; // valores → PENDIENTE
}

export interface Cotizacion {
  id: string;
  productoIds: string[];
  incoterm: Incoterm;
  puerto: PuertoMX;
  comisionPayer: CommissionPayer;
  // visibilidad derivada por regla (no se captura a mano)
}

// Documento de exportación (estructura real)
export type TipoDocumento =
  | 'pedimento' | 'certificado_origen' | 'factura_comercial'
  | 'packing_list' | 'bill_of_lading' | 'fitosanitario' | 'ispm15';

export interface PlanoComExp {
  id: string;
  entidad: string;          // p.ej. "ALV Exports Hub" (datos de dominio)
  productos: Producto[];
  cotizaciones: Cotizacion[];
  documentos: TipoDocumento[];
  version: number;          // snapshot inmutable; el OS versiona
  publicado: boolean;       // solo el OS publica
}
