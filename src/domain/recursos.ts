// Dominio de RECURSOS & PROVEEDORES (ADITIVO). Catálogo maestro de TODO lo que el negocio
// necesita: insumos, herramientas, equipo, muebles, materiales (construcción), servicios…
// con costo, cantidad, unidad, impuesto, proveedor y un GRUPO libre para agrupar como se
// quiera. Es una superficie de captura: alimenta Financiero (costos), Tecnológico (inventario
// de equipo) y Comercial (proveedores). Se guarda como filas JSON en TablaProyecto.

export type CategoriaRecurso = 'insumo' | 'herramienta' | 'equipo' | 'mueble' | 'material' | 'servicio' | 'otro';

export const CATEGORIAS_RECURSO: { id: CategoriaRecurso; label: string; emoji: string }[] = [
  { id: 'insumo', label: 'Insumo', emoji: '🧴' },
  { id: 'herramienta', label: 'Herramienta', emoji: '🔧' },
  { id: 'equipo', label: 'Equipo / maquinaria', emoji: '🛠️' },
  { id: 'mueble', label: 'Mueble', emoji: '🪑' },
  { id: 'material', label: 'Material / construcción', emoji: '🧱' },
  { id: 'servicio', label: 'Servicio', emoji: '🧰' },
  { id: 'otro', label: 'Otro', emoji: '📦' },
];
export function categoriaRecurso(id: string) {
  return CATEGORIAS_RECURSO.find((c) => c.id === id) ?? CATEGORIAS_RECURSO[CATEGORIAS_RECURSO.length - 1]!;
}

export const TIPOS_PROVEEDOR = ['insumos', 'herramientas', 'equipo', 'muebles', 'materiales / construcción', 'diseño de interiores', 'servicios', 'otro'];

export interface Recurso {
  id: string;
  nombre: string;
  categoria: CategoriaRecurso;
  grupo: string;        // agrupación LIBRE (ej. "Cabina de perforación", "Obra 1ª planta")
  proveedor: string;    // nombre del proveedor
  unidad: string;       // pza · ml · kg · m² · servicio…
  costo: string;        // costo unitario (texto: número o "PENDIENTE")
  cantidad: string;     // cantidad requerida / en stock
  impuesto: string;     // ej. "16% IVA"
  logistica: string;    // dónde se consigue / tiempo de entrega
  notas: string;
}

export interface Proveedor {
  id: string;
  nombre: string;
  tipo: string;         // qué provee (uno de TIPOS_PROVEEDOR, o libre)
  contacto: string;
  telefono: string;
  email: string;
  rfc: string;
  notas: string;
}

export function recursoVacio(id: string): Recurso {
  return { id, nombre: '', categoria: 'insumo', grupo: '', proveedor: '', unidad: '', costo: '', cantidad: '', impuesto: '', logistica: '', notas: '' };
}
export function proveedorVacio(id: string): Proveedor {
  return { id, nombre: '', tipo: 'insumos', contacto: '', telefono: '', email: '', rfc: '', notas: '' };
}

function s(v: unknown): string { return typeof v === 'string' ? v : (typeof v === 'number' ? String(v) : ''); }

export function normalizarRecurso(v: unknown): Recurso {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  const cat = CATEGORIAS_RECURSO.some((c) => c.id === d.categoria) ? d.categoria as CategoriaRecurso : 'insumo';
  return {
    id: s(d.id) || `REC-${s(d.nombre).slice(0, 6)}`, nombre: s(d.nombre), categoria: cat,
    grupo: s(d.grupo), proveedor: s(d.proveedor), unidad: s(d.unidad), costo: s(d.costo),
    cantidad: s(d.cantidad), impuesto: s(d.impuesto), logistica: s(d.logistica), notas: s(d.notas),
  };
}
export function normalizarProveedor(v: unknown): Proveedor {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  return {
    id: s(d.id) || `PRV-${s(d.nombre).slice(0, 6)}`, nombre: s(d.nombre), tipo: s(d.tipo) || 'otro',
    contacto: s(d.contacto), telefono: s(d.telefono), email: s(d.email), rfc: s(d.rfc), notas: s(d.notas),
  };
}

// Parsea un texto de dinero/número ("$1,200.50", "1200") a número, o null.
export function numero(txt: string): number | null {
  const limpio = (txt || '').replace(/[^0-9.,-]/g, '').replace(/,/g, '');
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

// Subtotal = costo unitario × cantidad (null si no hay números).
export function subtotalRecurso(r: Recurso): number | null {
  const c = numero(r.costo), q = numero(r.cantidad);
  if (c === null) return null;
  return q === null ? c : c * q;
}

export function formatoMoneda(n: number): string {
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
