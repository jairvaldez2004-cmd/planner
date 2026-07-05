// INC-1 · Catálogo maestro compartido (ADITIVO — no toca FROZEN).
// Fuente única reutilizable de productos. Salem, Magno y futuros planos SELECCIONAN
// de aquí en vez de re-teclear los mismos productos.
//
// Relación catálogo → plano (sin duplicar datos):
//   El catálogo es la FUENTE. Al crear un plano se eligen productos del catálogo y se
//   mapean a CapturaProducto; construirPlanoDraft toma su SNAPSHOT INMUTABLE (igual que hoy).
//   La clave compartida es el SKU. NO se muta el `Producto` del plano (FROZEN): no hay FK
//   dentro del plano. El snapshot del plano sigue siendo inmutable (requisito FROZEN).
//
// Alcance INC-1: espeja los campos que YA existen en CapturaProducto. Quedan FUERA:
//   unidad/empaque/presentación (INC-2) y precio comercial (INC-5).

import type { Incoterm, PuertoMX, RestriccionCarga } from './plano-com-exp';

// Catálogo maestro compartido (único): Salem + Magno + futuros seleccionan de aquí.
export const CATALOGO_MAESTRO_ID = 'CAT-MAESTRO';

// Entrada para crear un producto maestro (CRUD mínimo INC-1).
export interface NuevoProductoInput {
  catalogoId: string;
  sku: string;
  nombre: string;
  categoria: string;
  restriccion: RestriccionCarga;
}

// INC-2 · Atributos operativos de exportación (viven en el CATÁLOGO, no en el plano FROZEN).
// Texto libre / controlado en UI; si faltan → el documento los marca PENDIENTE.
export interface AtributosOperativos {
  unidad?: string;          // kg · ton · lb · caja · saco · contenedor…
  empaque?: string;         // p. ej. "sacos de 25 kg", "cajas de 10 kg", "a granel"
  presentacion?: string;    // p. ej. "entero", "molido", "en polvo"
  cantidadMinima?: string;  // p. ej. "1 contenedor", "500 kg" (formato comercial mínimo)
}

export interface Catalogo {
  id: string;
  nombre: string;
  dueno: string;          // entidad dueña (p. ej. "Compartido — Grupo Dioquis")
  descripcion?: string;
}

// Producto maestro reutilizable. Campos = los de CapturaProducto (requeridos + pistas export opcionales).
export interface ProductoCatalogo {
  id: string;
  catalogoId: string;
  sku: string;
  nombre: string;
  categoria: string;
  restriccion: RestriccionCarga;
  // Pistas export opcionales (mismas que CapturaProducto; si faltan → PENDIENTE al construir el plano):
  hsCode?: string;
  incotermSugerido?: Incoterm;
  puertoSalida?: PuertoMX;
  certificadoOrigenRequerido?: boolean;
  // INC-2 · atributos operativos (opcionales; no entran al snapshot del plano):
  unidad?: string;
  empaque?: string;
  presentacion?: string;
  cantidadMinima?: string;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

// Puerto de persistencia (R5D): intercambiable. Contrato NUEVO — NO modifica Repository<T> (FROZEN).
export interface CatalogoRepository {
  guardarCatalogo(c: Catalogo): Promise<Catalogo>;
  getCatalogo(id: string): Promise<Catalogo | null>;
  listarCatalogos(): Promise<Catalogo[]>;
  guardarProducto(p: ProductoCatalogo): Promise<ProductoCatalogo>;
  getProducto(id: string): Promise<ProductoCatalogo | null>;
  listarProductos(catalogoId?: string): Promise<ProductoCatalogo[]>;
  eliminarProducto(id: string): Promise<void>;
}
