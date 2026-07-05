'use server';

// INC-1 · Server Actions del catálogo maestro (ADITIVO).
// La UI llama estas funciones; orquestan el PrismaCatalogoRepository.
// Reutilizan el motor de captura existente (form-engine) y guardarDraft SIN tocar FROZEN/OS.

import { prisma } from '@/adapters/persistence/prisma-client';
import { PrismaCatalogoRepository } from '@/adapters/persistence/prisma-catalogo-repository';
import type { AtributosOperativos, Catalogo, NuevoProductoInput, ProductoCatalogo } from '@/domain/catalogo';
import { CATALOGO_MAESTRO_ID } from '@/domain/catalogo';
import type { CapturaComExp } from '@/app/captura/form-com-exp';
import { catalogoACaptura } from '@/app/captura/catalogo-a-captura';
import { validarCaptura, construirPlanoDraft } from '@/app/captura/form-engine';
import { transicionar } from '@/domain/states';
import type { Instancia } from '@/domain/workspace';
import { guardarDraft } from '@/app/actions/plano.actions';

const repo = () => new PrismaCatalogoRepository(prisma);

// --- Catálogos ---
export async function listarCatalogos(): Promise<Catalogo[]> {
  return repo().listarCatalogos();
}
export async function asegurarCatalogo(c: Catalogo): Promise<Catalogo> {
  return repo().guardarCatalogo(c);
}

// --- Productos del catálogo (CRUD mínimo) ---
export async function listarProductosCatalogo(catalogoId?: string): Promise<ProductoCatalogo[]> {
  return repo().listarProductos(catalogoId);
}

export async function crearProductoCatalogo(input: NuevoProductoInput): Promise<ProductoCatalogo> {
  const now = new Date().toISOString();
  const p: ProductoCatalogo = {
    id: `CATP-${input.sku.trim().toUpperCase().replace(/\s+/g, '-')}`,
    catalogoId: input.catalogoId,
    sku: input.sku.trim(),
    nombre: input.nombre.trim(),
    categoria: input.categoria.trim(),
    restriccion: input.restriccion,
    activo: true,
    creadoEn: now,
    actualizadoEn: now,
  };
  return repo().guardarProducto(p);
}

export async function eliminarProductoCatalogo(id: string): Promise<void> {
  return repo().eliminarProducto(id);
}

// INC-2 · Editar atributos operativos (unidad/empaque/presentación/cantidad mínima) de un producto.
// Aditivo: vive en el catálogo; vacío → se borra el atributo (quedará PENDIENTE en el documento).
export async function actualizarOperativoProducto(
  id: string,
  attrs: AtributosOperativos,
): Promise<ProductoCatalogo> {
  const r = repo();
  const actual = await r.getProducto(id);
  if (!actual) throw new Error(`Producto de catálogo no encontrado: ${id}`);
  const limpio = (v?: string): string | undefined => {
    const t = (v ?? '').trim();
    return t === '' ? undefined : t;
  };
  const base: ProductoCatalogo = {
    id: actual.id,
    catalogoId: actual.catalogoId,
    sku: actual.sku,
    nombre: actual.nombre,
    categoria: actual.categoria,
    restriccion: actual.restriccion,
    activo: actual.activo,
    creadoEn: actual.creadoEn,
    actualizadoEn: new Date().toISOString(),
  };
  // conserva pistas export previas
  if (actual.hsCode !== undefined) base.hsCode = actual.hsCode;
  if (actual.incotermSugerido !== undefined) base.incotermSugerido = actual.incotermSugerido;
  if (actual.puertoSalida !== undefined) base.puertoSalida = actual.puertoSalida;
  if (actual.certificadoOrigenRequerido !== undefined) base.certificadoOrigenRequerido = actual.certificadoOrigenRequerido;
  // aplica atributos operativos (vacío => se omite => PENDIENTE)
  const unidad = limpio(attrs.unidad);
  const empaque = limpio(attrs.empaque);
  const presentacion = limpio(attrs.presentacion);
  const cantidadMinima = limpio(attrs.cantidadMinima);
  if (unidad !== undefined) base.unidad = unidad;
  if (empaque !== undefined) base.empaque = empaque;
  if (presentacion !== undefined) base.presentacion = presentacion;
  if (cantidadMinima !== undefined) base.cantidadMinima = cantidadMinima;
  return r.guardarProducto(base);
}

// --- Sembrado idempotente del catálogo maestro (22 productos reales) ---
// Mismo catálogo para Salem y Magno: SIN duplicar manualmente.
const SEMILLA_22: Array<[string, string, string]> = [
  ['FRIJOL-NEGRO-ARRINONADO', 'Frijol negro arriñonado', 'frijoles-granos'],
  ['FRIJOL-NEGRO-SAN-LUIS', 'Frijol negro San Luis', 'frijoles-granos'],
  ['CAMARON-SECO', 'Camarón seco', 'mariscos-secos'],
  ['UVA-PASA', 'Uva pasa', 'especias-otros'],
  ['CHILE-GUAJILLO', 'Chile guajillo', 'chiles-secos'],
  ['CHILE-CHIPOTLE', 'Chile chipotle', 'chiles-secos'],
  ['CHARAL-SECO', 'Charal seco', 'mariscos-secos'],
  ['NUECES-PELADAS', 'Nueces peladas', 'semillas-nueces'],
  ['SEMILLAS-DE-CALABAZA', 'Semillas de calabaza', 'semillas-nueces'],
  ['CHILE-PASILLA', 'Chile pasilla', 'chiles-secos'],
  ['CHILE-ANCHO', 'Chile ancho', 'chiles-secos'],
  ['PILONCILLO', 'Piloncillo', 'especias-otros'],
  ['FLOR-DE-HIBISCO', 'Flor de hibisco', 'especias-otros'],
  ['HABANERO-SECO', 'Habanero seco', 'chiles-secos'],
  ['CHILE-CASCABEL', 'Chile cascabel', 'chiles-secos'],
  ['GARBANZO', 'Garbanzo', 'frijoles-granos'],
  ['FRIJOL-AMARILLO-REYNA', 'Frijol amarillo (Reyna)', 'frijoles-granos'],
  ['PIMIENTA-EN-BOLA', 'Pimienta en bola', 'especias-otros'],
  ['AJO-BLANCO', 'Ajo blanco', 'ajos'],
  ['AJO-MORADO', 'Ajo morado', 'ajos'],
  ['CHILTEPIN', 'Chiltepín', 'chiles-secos'],
  ['SERRANO-SECO', 'Serrano seco', 'chiles-secos'],
];

export async function sembrarCatalogoMaestro(): Promise<{ catalogoId: string; productos: number }> {
  const r = repo();
  await r.guardarCatalogo({
    id: CATALOGO_MAESTRO_ID,
    nombre: 'Catálogo Maestro — Productos Mexicanos',
    dueno: 'Compartido — Grupo Dioquis (Salem / MagnoCommodities)',
    descripcion: 'Fuente única reutilizable. Salem y Magno seleccionan de aquí sin duplicar.',
  });
  const now = new Date().toISOString();
  for (const [sku, nombre, categoria] of SEMILLA_22) {
    await r.guardarProducto({
      id: `CATP-${sku}`,
      catalogoId: CATALOGO_MAESTRO_ID,
      sku, nombre, categoria,
      restriccion: 'general',
      activo: true,
      creadoEn: now,
      actualizadoEn: now,
    });
  }
  return { catalogoId: CATALOGO_MAESTRO_ID, productos: SEMILLA_22.length };
}

// --- Crear plano COM-EXP desde una selección del catálogo ---
// Reutiliza el motor existente: catalogoACaptura → validarCaptura → construirPlanoDraft → guardarDraft.
// El plano toma su snapshot inmutable (FROZEN intacto). El OS publica después, desde el editor.
export async function crearPlanoDesdeCatalogo(
  entidad: string,
  productoCatalogoIds: string[],
): Promise<{ planoId: string; instanciaId: string; productos: number; pendientes: number }> {
  const todos = await repo().listarProductos();
  const seleccion = productoCatalogoIds
    .map((id) => todos.find((p) => p.id === id))
    .filter((p): p is ProductoCatalogo => p !== undefined);
  if (seleccion.length === 0) throw new Error('Selecciona al menos un producto del catálogo.');

  const captura: CapturaComExp = {
    entidad: entidad.trim(),
    productos: seleccion.map(catalogoACaptura),
  };
  const vc = validarCaptura(captura);
  if (!vc.ok) throw new Error('Captura inválida: ' + vc.errores.join(' · '));

  const draft = construirPlanoDraft(captura);
  let estado = transicionar('SOLICITUD', 'CAPTURA');
  estado = transicionar(estado, 'DISENO');
  estado = transicionar(estado, 'VALIDACION');
  const instancia: Instancia = {
    id: `BP-${(entidad.trim() || 'ENTIDAD').replace(/\s+/g, '').toUpperCase()}-COM-EXP-${Date.now()}`,
    proyectoId: 'PROJ-DEFAULT',
    tipoPlano: 'COM-EXP',
    estado,
    acl: 'N3',
    planoId: null,
  };
  await guardarDraft(draft, instancia); // BUG-1 fix vincula instancia.planoId

  return { planoId: draft.id, instanciaId: instancia.id, productos: seleccion.length, pendientes: vc.pendientes.length };
}
