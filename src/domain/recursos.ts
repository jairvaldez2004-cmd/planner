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

// Clasificación MÚLTIPLE de un proveedor (un proveedor puede pertenecer a varias). Sección 2.
export const CATEGORIAS_PROVEEDOR = [
  'materia prima', 'insumos', 'herramientas', 'maquinaria', 'equipo', 'refacciones',
  'uniformes', 'servicios', 'software', 'consultoría', 'transporte', 'construcción',
  'marketing', 'limpieza', 'seguridad', 'mantenimiento', 'diseño de interiores', 'muebles', 'otro',
];

// Adjunto (foto/video/documento/ficha/MSDS/manual…) — se guarda como URL + título.
export type TipoAdjunto = 'foto' | 'video' | 'documento';
export interface Adjunto { tipo: TipoAdjunto; titulo: string; url: string }

// Criterios de evaluación del proveedor (Sección 9). Todos "más alto = mejor" (0–100).
export const CRITERIOS_EVAL = [
  { id: 'calidad', label: 'Calidad' },
  { id: 'precio', label: 'Precio' },
  { id: 'tiempo', label: 'Tiempo de entrega' },
  { id: 'comunicacion', label: 'Comunicación' },
  { id: 'garantia', label: 'Garantía' },
  { id: 'servicio', label: 'Servicio' },
  { id: 'flexibilidad', label: 'Flexibilidad' },
  { id: 'disponibilidad', label: 'Disponibilidad' },
  { id: 'innovacion', label: 'Innovación' },
  { id: 'confiabilidad', label: 'Bajo riesgo / confiabilidad' },
] as const;

// Tipos de riesgo (Sección 15) y de incidencia de calidad (Sección 8).
export const RIESGOS = ['político', 'climático', 'financiero', 'logístico', 'cambiario', 'legal'];
export const DEPENDENCIAS = ['alta', 'media', 'baja'];
export const TIPOS_INCIDENCIA = ['rechazo', 'retraso', 'defecto', 'incidencia', 'auditoría'];

// Relación comercial: estados de la relación y tipos de interacción de la bitácora.
export const ESTADOS_RELACION = ['prospecto', 'activo', 'preferente', 'inactivo'];
export const TIPOS_INTERACCION = ['correo enviado', 'respuesta', 'llamada', 'whatsapp', 'cita', 'cotización', 'nota'];

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
  existe: boolean;      // true = YA lo tenemos (inventario actual); false = por adquirir
  notas: string;
}

// PROVEEDOR (rico) — Secciones 1 (información general) y 2 (clasificación múltiple).
export interface Proveedor {
  id: string;
  nombre: string;         // nombre comercial
  razonSocial: string;
  rfc: string;            // RFC o identificación fiscal
  // Ubicación
  pais: string;
  estado: string;
  ciudad: string;
  direccion: string;
  gps: string;            // "lat, lng"
  zonas: string[];        // zonas donde opera
  // Contacto
  contacto: string;       // persona de contacto
  puesto: string;
  telefono: string;
  whatsapp: string;
  email: string;
  sitioWeb: string;
  idiomas: string[];
  horario: string;        // horario de atención
  // Comercial base
  moneda: string;         // moneda con la que trabaja
  incoterms: string[];    // incoterms que maneja
  aniosMercado: string;
  tamano: string;         // tamaño de la empresa
  certificaciones: string[];
  // Clasificación múltiple (un proveedor puede ser de varias categorías)
  categorias: string[];
  tipo: string;           // LEGACY: qué provee (compatibilidad; se mapea a categorias)
  // Calidad (Sección 8) — resumen; las incidencias viven en su propia entidad.
  cumplimiento: string;   // % de cumplimiento
  tiempoPromedio: string; // tiempo promedio de entrega observado
  // Evaluación (Sección 9): calificación 0–100 por criterio → Score General automático.
  evaluacion: Record<string, number>;
  // Riesgo (Sección 15)
  proveedorUnico: boolean;    // ¿es el único que nos da esto?
  dependencia: string;        // alta / media / baja
  riesgos: string[];          // político, climático, financiero, logístico, cambiario, legal
  planB: string;              // plan alternativo si falla
  proveedorAlternativo: string;
  // Relación comercial (CRM): seguimiento continuo a cada proveedor, compremos o no.
  estadoRelacion: string;      // prospecto / activo / preferente / inactivo
  proximoSeguimiento: string;  // fecha del próximo contacto (motor de seguimiento)
  responsable: string;         // quién lleva la relación (firma los correos, da voz humana)
  // Multimedia y docs
  adjuntos: Adjunto[];    // fotografías, videos, documentos
  notas: string;
}

// PRODUCTO (maestro) — Sección 4 (información de cada producto). Vive una vez y se vincula a
// N proveedores (muchos-a-muchos). SKU de proveedor y precio viven en el VÍNCULO, no aquí.
export interface Producto {
  id: string;
  nombre: string;
  skuInterno: string;
  codigoFabricante: string;
  marca: string;
  modelo: string;
  categoria: string;      // materia prima, insumo, herramienta… (libre / CATEGORIAS_PROVEEDOR)
  unidad: string;         // pza · kg · L · m²…
  // Físico
  peso: string;
  volumen: string;
  dimensiones: string;
  color: string;
  material: string;
  presentacion: string;
  empaque: string;
  cantidadPorCaja: string;
  cantidadPorPallet: string;
  // Vida y almacenamiento
  vidaUtil: string;
  caducidad: string;
  tiempoAnaquel: string;
  almacenamiento: string;
  temperatura: string;
  humedad: string;
  rotacion: string;       // rotación recomendada
  garantia: string;
  // Inventario y planeación (Secciones 11–12): stock, umbrales y consumo del producto.
  stockActual: string;
  stockMinimo: string;
  stockMaximo: string;
  puntoReorden: string;   // nivel al que hay que recomprar
  stockSeguridad: string; // colchón bajo el cual es urgente
  ubicacion: string;      // dónde está el inventario
  consumoMensual: string; // cuánto se consume por mes (para pronóstico)
  frecuenciaCompra: string; // cada cuánto se compra (texto)
  leadTimeDias: string;   // días típicos de reabasto
  // Docs: fichas técnicas, MSDS, manual, fotografías
  adjuntos: Adjunto[];
  notas: string;
}

// Cada cambio de precio (Sección 6). Historial dentro del VÍNCULO producto↔proveedor.
export interface PrecioHistorico {
  fecha: string;       // ISO o "2026-07"
  precio: string;
  moneda: string;
  quien: string;       // quién lo modificó
  motivo: string;
  documento: string;   // cotización / soporte (URL o referencia)
}

// VÍNCULO producto ↔ proveedor (Secciones 3 y 5) — la información COMERCIAL vive aquí, porque
// el mismo producto puede costar/entregarse distinto según el proveedor.
export interface ProductoProveedor {
  id: string;
  productoId: string;
  proveedorId: string;
  skuProveedor: string;
  // Precio y condiciones
  precio: string;
  moneda: string;
  precioVolumen: string;   // texto: "1000+ pzas → $X"
  descuentos: string;
  promociones: string;
  tiempoEntrega: string;   // lead time
  cantidadMinima: string;
  cantidadMaxima: string;
  capacidadMensual: string;
  capacidadAnual: string;
  formaPago: string;
  credito: boolean;
  diasCredito: string;
  penalizaciones: string;
  incoterms: string;
  costoEnvio: string;
  lugarEntrega: string;
  lugarRecoleccion: string;
  historial: PrecioHistorico[];  // cambios de precio (Sección 6)
  notas: string;
}

export function recursoVacio(id: string): Recurso {
  return { id, nombre: '', categoria: 'insumo', grupo: '', proveedor: '', unidad: '', costo: '', cantidad: '', impuesto: '', logistica: '', existe: false, notas: '' };
}
export function proveedorVacio(id: string): Proveedor {
  return {
    id, nombre: '', razonSocial: '', rfc: '', pais: '', estado: '', ciudad: '', direccion: '', gps: '', zonas: [],
    contacto: '', puesto: '', telefono: '', whatsapp: '', email: '', sitioWeb: '', idiomas: [], horario: '',
    moneda: '', incoterms: [], aniosMercado: '', tamano: '', certificaciones: [], categorias: [], tipo: 'insumos',
    cumplimiento: '', tiempoPromedio: '', evaluacion: {}, proveedorUnico: false, dependencia: '', riesgos: [], planB: '', proveedorAlternativo: '',
    estadoRelacion: '', proximoSeguimiento: '', responsable: '',
    adjuntos: [], notas: '',
  };
}
export function productoVacio(id: string): Producto {
  return {
    id, nombre: '', skuInterno: '', codigoFabricante: '', marca: '', modelo: '', categoria: 'insumos', unidad: '',
    peso: '', volumen: '', dimensiones: '', color: '', material: '', presentacion: '', empaque: '',
    cantidadPorCaja: '', cantidadPorPallet: '', vidaUtil: '', caducidad: '', tiempoAnaquel: '', almacenamiento: '',
    temperatura: '', humedad: '', rotacion: '', garantia: '',
    stockActual: '', stockMinimo: '', stockMaximo: '', puntoReorden: '', stockSeguridad: '', ubicacion: '',
    consumoMensual: '', frecuenciaCompra: '', leadTimeDias: '', adjuntos: [], notas: '',
  };
}
export function vinculoVacio(id: string, productoId: string, proveedorId: string): ProductoProveedor {
  return {
    id, productoId, proveedorId, skuProveedor: '', precio: '', moneda: '', precioVolumen: '', descuentos: '', promociones: '',
    tiempoEntrega: '', cantidadMinima: '', cantidadMaxima: '', capacidadMensual: '', capacidadAnual: '', formaPago: '',
    credito: false, diasCredito: '', penalizaciones: '', incoterms: '', costoEnvio: '', lugarEntrega: '', lugarRecoleccion: '',
    historial: [], notas: '',
  };
}

function s(v: unknown): string { return typeof v === 'string' ? v : (typeof v === 'number' ? String(v) : ''); }
function sa(v: unknown): string[] { return Array.isArray(v) ? v.map(s).map((x) => x.trim()).filter(Boolean) : []; }
function normAdjunto(v: unknown): Adjunto {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  const tipo = (['foto', 'video', 'documento'].includes(s(d.tipo)) ? s(d.tipo) : 'documento') as TipoAdjunto;
  return { tipo, titulo: s(d.titulo), url: s(d.url) };
}
function normPrecioHist(v: unknown): PrecioHistorico {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  return { fecha: s(d.fecha), precio: s(d.precio), moneda: s(d.moneda), quien: s(d.quien), motivo: s(d.motivo), documento: s(d.documento) };
}

export function normalizarRecurso(v: unknown): Recurso {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  const cat = CATEGORIAS_RECURSO.some((c) => c.id === d.categoria) ? d.categoria as CategoriaRecurso : 'insumo';
  return {
    id: s(d.id) || `REC-${s(d.nombre).slice(0, 6)}`, nombre: s(d.nombre), categoria: cat,
    grupo: s(d.grupo), proveedor: s(d.proveedor), unidad: s(d.unidad), costo: s(d.costo),
    cantidad: s(d.cantidad), impuesto: s(d.impuesto), logistica: s(d.logistica), existe: d.existe === true, notas: s(d.notas),
  };
}
export function normalizarProveedor(v: unknown): Proveedor {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  const tipo = s(d.tipo) || 'otro';
  // Retrocompat: los proveedores viejos solo tenían `tipo`; se siembra en categorias.
  let categorias = sa(d.categorias);
  if (!categorias.length && tipo && tipo !== 'otro') categorias = [tipo];
  return {
    id: s(d.id) || `PRV-${s(d.nombre).slice(0, 6)}`, nombre: s(d.nombre), razonSocial: s(d.razonSocial), rfc: s(d.rfc),
    pais: s(d.pais), estado: s(d.estado), ciudad: s(d.ciudad), direccion: s(d.direccion), gps: s(d.gps), zonas: sa(d.zonas),
    contacto: s(d.contacto), puesto: s(d.puesto), telefono: s(d.telefono), whatsapp: s(d.whatsapp), email: s(d.email),
    sitioWeb: s(d.sitioWeb), idiomas: sa(d.idiomas), horario: s(d.horario), moneda: s(d.moneda), incoterms: sa(d.incoterms),
    aniosMercado: s(d.aniosMercado), tamano: s(d.tamano), certificaciones: sa(d.certificaciones), categorias, tipo,
    cumplimiento: s(d.cumplimiento), tiempoPromedio: s(d.tiempoPromedio), evaluacion: normEvaluacion(d.evaluacion),
    proveedorUnico: d.proveedorUnico === true, dependencia: s(d.dependencia), riesgos: sa(d.riesgos),
    planB: s(d.planB), proveedorAlternativo: s(d.proveedorAlternativo),
    estadoRelacion: s(d.estadoRelacion), proximoSeguimiento: s(d.proximoSeguimiento), responsable: s(d.responsable),
    adjuntos: Array.isArray(d.adjuntos) ? d.adjuntos.map(normAdjunto) : [], notas: s(d.notas),
  };
}

// Lee el objeto de evaluación: solo criterios conocidos con valor numérico 0–100.
function normEvaluacion(v: unknown): Record<string, number> {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  const out: Record<string, number> = {};
  for (const c of CRITERIOS_EVAL) {
    const n = typeof d[c.id] === 'number' ? d[c.id] as number : Number(d[c.id]);
    if (Number.isFinite(n) && n > 0) out[c.id] = Math.max(0, Math.min(100, Math.round(n)));
  }
  return out;
}

export function normalizarProducto(v: unknown): Producto {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  return {
    id: s(d.id) || `PROD-${s(d.nombre).slice(0, 6)}`, nombre: s(d.nombre), skuInterno: s(d.skuInterno),
    codigoFabricante: s(d.codigoFabricante), marca: s(d.marca), modelo: s(d.modelo), categoria: s(d.categoria) || 'insumos',
    unidad: s(d.unidad), peso: s(d.peso), volumen: s(d.volumen), dimensiones: s(d.dimensiones), color: s(d.color),
    material: s(d.material), presentacion: s(d.presentacion), empaque: s(d.empaque), cantidadPorCaja: s(d.cantidadPorCaja),
    cantidadPorPallet: s(d.cantidadPorPallet), vidaUtil: s(d.vidaUtil), caducidad: s(d.caducidad), tiempoAnaquel: s(d.tiempoAnaquel),
    almacenamiento: s(d.almacenamiento), temperatura: s(d.temperatura), humedad: s(d.humedad), rotacion: s(d.rotacion),
    garantia: s(d.garantia),
    stockActual: s(d.stockActual), stockMinimo: s(d.stockMinimo), stockMaximo: s(d.stockMaximo), puntoReorden: s(d.puntoReorden),
    stockSeguridad: s(d.stockSeguridad), ubicacion: s(d.ubicacion), consumoMensual: s(d.consumoMensual),
    frecuenciaCompra: s(d.frecuenciaCompra), leadTimeDias: s(d.leadTimeDias),
    adjuntos: Array.isArray(d.adjuntos) ? d.adjuntos.map(normAdjunto) : [], notas: s(d.notas),
  };
}

export function normalizarVinculo(v: unknown): ProductoProveedor {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  return {
    id: s(d.id) || `PP-${Math.random().toString(36).slice(2, 8)}`, productoId: s(d.productoId), proveedorId: s(d.proveedorId),
    skuProveedor: s(d.skuProveedor), precio: s(d.precio), moneda: s(d.moneda), precioVolumen: s(d.precioVolumen),
    descuentos: s(d.descuentos), promociones: s(d.promociones), tiempoEntrega: s(d.tiempoEntrega), cantidadMinima: s(d.cantidadMinima),
    cantidadMaxima: s(d.cantidadMaxima), capacidadMensual: s(d.capacidadMensual), capacidadAnual: s(d.capacidadAnual),
    formaPago: s(d.formaPago), credito: d.credito === true, diasCredito: s(d.diasCredito), penalizaciones: s(d.penalizaciones),
    incoterms: s(d.incoterms), costoEnvio: s(d.costoEnvio), lugarEntrega: s(d.lugarEntrega), lugarRecoleccion: s(d.lugarRecoleccion),
    historial: Array.isArray(d.historial) ? d.historial.map(normPrecioHist) : [], notas: s(d.notas),
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

// ---------- Muchos-a-muchos: vínculos producto ↔ proveedor ----------

export function vinculosDeProducto(vinculos: ProductoProveedor[], productoId: string): ProductoProveedor[] {
  return vinculos.filter((v) => v.productoId === productoId);
}
export function vinculosDeProveedor(vinculos: ProductoProveedor[], proveedorId: string): ProductoProveedor[] {
  return vinculos.filter((v) => v.proveedorId === proveedorId);
}

// Precio vigente = último cambio del historial (si hay), o el precio del vínculo.
export function precioVigente(v: ProductoProveedor): string {
  return v.historial.length ? (v.historial[v.historial.length - 1]!.precio || v.precio) : v.precio;
}

// Registra un cambio de precio: agrega al historial y actualiza el precio vigente del vínculo.
export function registrarCambioPrecio(v: ProductoProveedor, cambio: PrecioHistorico): ProductoProveedor {
  return { ...v, precio: cambio.precio || v.precio, moneda: cambio.moneda || v.moneda, historial: [...v.historial, cambio] };
}

// Proveedor "más barato" de un producto (por precio vigente numérico; ignora los sin precio).
export function proveedorMasBarato(vinculos: ProductoProveedor[], productoId: string): ProductoProveedor | null {
  const conPrecio = vinculosDeProducto(vinculos, productoId)
    .map((v) => ({ v, n: numero(precioVigente(v)) }))
    .filter((x): x is { v: ProductoProveedor; n: number } => x.n !== null);
  if (!conPrecio.length) return null;
  return conPrecio.reduce((min, x) => x.n < min.n ? x : min).v;
}

// ---------- Inventario y planeación de compras (Secciones 11–12) ----------

export type AccionCompra = 'comprar-urgente' | 'comprar-hoy' | 'comprar-pronto' | 'ok' | 'exceso' | 'sin-datos';

export const ACCIONES_COMPRA: Record<AccionCompra, { label: string; color: string; emoji: string }> = {
  'comprar-urgente': { label: 'Comprar YA', color: '#c0392b', emoji: '🔴' },
  'comprar-hoy': { label: 'Comprar hoy', color: '#d9781f', emoji: '🟠' },
  'comprar-pronto': { label: 'Comprar pronto', color: '#c9a13b', emoji: '🟡' },
  'ok': { label: 'OK', color: '#2e9e63', emoji: '🟢' },
  'exceso': { label: 'Exceso de stock', color: '#8a6db0', emoji: '🟣' },
  'sin-datos': { label: 'Sin datos', color: '#8a93a8', emoji: '⚪' },
};

export interface PlanCompra {
  accion: AccionCompra;
  etiqueta: string;
  diasCobertura: number | null;   // días que dura el stock al ritmo de consumo
  seAgotaEn: string;              // fecha estimada (YYYY-MM-DD) o "—"
  cantidadSugerida: number | null; // cuánto pedir para llegar al máximo
  motivo: string;
}

// Suma días a una fecha ISO (YYYY-MM-DD o ISO completo). Determinista: se le pasa "hoy".
function addDias(iso: string, n: number): string {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (isNaN(d.getTime())) return '—';
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Recomendación de compra para un producto según stock, umbrales, consumo y lead time.
// `hoyISO` se pasa para que el cálculo sea determinista (y testeable).
export function planearCompra(p: Producto, hoyISO: string): PlanCompra {
  const stock = numero(p.stockActual);
  const consumoMes = numero(p.consumoMensual);
  const consumoDia = consumoMes !== null && consumoMes > 0 ? consumoMes / 30 : null;
  const reorder = numero(p.puntoReorden);
  const min = numero(p.stockMinimo);
  const seg = numero(p.stockSeguridad);
  const max = numero(p.stockMaximo);
  const lead = numero(p.leadTimeDias) ?? 0;

  const diasCobertura = (stock !== null && consumoDia) ? Math.round((stock / consumoDia) * 10) / 10 : null;
  const seAgotaEn = diasCobertura !== null ? addDias(hoyISO, Math.floor(diasCobertura)) : '—';
  const cantidadSugerida = (max !== null && stock !== null) ? Math.max(0, max - stock) : null;
  const base = { diasCobertura, seAgotaEn, cantidadSugerida };

  if (stock === null || (reorder === null && min === null && seg === null && consumoDia === null)) {
    return { accion: 'sin-datos', etiqueta: ACCIONES_COMPRA['sin-datos'].label, ...base, motivo: 'Faltan datos de stock, umbrales o consumo.' };
  }

  let accion: AccionCompra = 'ok';
  let motivo = 'Cobertura suficiente.';
  const umbralUrgente = seg ?? min;
  if (umbralUrgente !== null && stock <= umbralUrgente) {
    accion = 'comprar-urgente'; motivo = `Stock (${stock}) en o bajo el mínimo/seguridad (${umbralUrgente}).`;
  } else if (reorder !== null && stock <= reorder) {
    accion = 'comprar-hoy'; motivo = `Stock (${stock}) llegó al punto de reorden (${reorder}).`;
  } else if (diasCobertura !== null && lead > 0 && diasCobertura <= lead) {
    accion = 'comprar-hoy'; motivo = `Se agota en ~${diasCobertura}d, menos que el lead time (${lead}d).`;
  } else if (diasCobertura !== null && lead > 0 && diasCobertura <= lead * 2) {
    accion = 'comprar-pronto'; motivo = `Se agota en ~${diasCobertura}d; conviene pedir pronto (lead ${lead}d).`;
  } else if (max !== null && stock > max) {
    accion = 'exceso'; motivo = `Stock (${stock}) por encima del máximo (${max}).`;
  }
  return { accion, etiqueta: ACCIONES_COMPRA[accion].label, ...base, motivo };
}

// ---------- Flujo de compras (Sección 13) ----------
// Una orden recorre el ciclo: solicitud → cotización → comparación → aprobación → OC →
// confirmación → envío → recepción → inspección → pago → evaluación → cerrada.
export const ETAPAS_COMPRA_INFO = [
  { id: 'solicitud', label: 'Solicitud', emoji: '📝' },
  { id: 'cotizacion', label: 'Cotización', emoji: '💬' },
  { id: 'comparacion', label: 'Comparación', emoji: '⚖️' },
  { id: 'aprobacion', label: 'Aprobación', emoji: '✅' },
  { id: 'orden', label: 'Orden de compra', emoji: '🧾' },
  { id: 'confirmacion', label: 'Confirmación', emoji: '📨' },
  { id: 'envio', label: 'Envío', emoji: '🚚' },
  { id: 'recepcion', label: 'Recepción', emoji: '📦' },
  { id: 'inspeccion', label: 'Inspección', emoji: '🔍' },
  { id: 'pago', label: 'Pago', emoji: '💵' },
  { id: 'evaluacion', label: 'Evaluación', emoji: '⭐' },
  { id: 'cerrada', label: 'Cerrada', emoji: '🏁' },
] as const;
export type EtapaCompra = typeof ETAPAS_COMPRA_INFO[number]['id'];
export function etapaCompraInfo(id: string) {
  return ETAPAS_COMPRA_INFO.find((e) => e.id === id) ?? ETAPAS_COMPRA_INFO[0];
}
export function siguienteEtapaCompra(id: EtapaCompra): EtapaCompra {
  const i = ETAPAS_COMPRA_INFO.findIndex((e) => e.id === id);
  return ETAPAS_COMPRA_INFO[Math.min(i + 1, ETAPAS_COMPRA_INFO.length - 1)]!.id;
}

export interface OrdenCompra {
  id: string;
  folio: string;
  etapa: EtapaCompra;
  productoId: string;   // opcional: producto del catálogo
  proveedorId: string;  // opcional: proveedor elegido
  descripcion: string;  // qué se compra (libre si no es un producto del catálogo)
  cantidad: string;
  cantidadRecibida: string; // recepción parcial: cuánto llegó (vs cantidad pedida)
  unidad: string;
  precioUnitario: string;
  moneda: string;
  fechaSolicitud: string;
  fechaRequerida: string;
  aprobadaPor: string;
  recibidoOk: boolean;  // pasó inspección
  evaluacion: string;   // nota final al proveedor/compra
  notas: string;
}
export function ordenVacia(id: string): OrdenCompra {
  return {
    id, folio: '', etapa: 'solicitud', productoId: '', proveedorId: '', descripcion: '', cantidad: '', cantidadRecibida: '', unidad: '',
    precioUnitario: '', moneda: '', fechaSolicitud: '', fechaRequerida: '', aprobadaPor: '', recibidoOk: false, evaluacion: '', notas: '',
  };
}
export function normalizarOrden(v: unknown): OrdenCompra {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  const etapa = (ETAPAS_COMPRA_INFO.some((e) => e.id === d.etapa) ? d.etapa : 'solicitud') as EtapaCompra;
  return {
    id: s(d.id) || `OC-${Math.random().toString(36).slice(2, 8)}`, folio: s(d.folio), etapa,
    productoId: s(d.productoId), proveedorId: s(d.proveedorId), descripcion: s(d.descripcion), cantidad: s(d.cantidad),
    cantidadRecibida: s(d.cantidadRecibida), unidad: s(d.unidad), precioUnitario: s(d.precioUnitario), moneda: s(d.moneda), fechaSolicitud: s(d.fechaSolicitud),
    fechaRequerida: s(d.fechaRequerida), aprobadaPor: s(d.aprobadaPor), recibidoOk: d.recibidoOk === true, evaluacion: s(d.evaluacion), notas: s(d.notas),
  };
}
export function totalOrden(o: OrdenCompra): number | null {
  const c = numero(o.precioUnitario), q = numero(o.cantidad);
  if (c === null) return null;
  return q === null ? c : c * q;
}
// Recepción parcial: compara lo recibido contra lo pedido.
export function estadoRecepcion(o: OrdenCompra): { estado: 'sin-datos' | 'parcial' | 'completa'; recibido: number | null; pedido: number | null; faltante: number } {
  const pedido = numero(o.cantidad), recibido = numero(o.cantidadRecibida);
  if (recibido === null || pedido === null) return { estado: 'sin-datos', recibido, pedido, faltante: 0 };
  if (recibido >= pedido) return { estado: 'completa', recibido, pedido, faltante: 0 };
  return { estado: 'parcial', recibido, pedido, faltante: pedido - recibido };
}

// ---------- Contratos (Sección 7) + alertas de vencimiento ----------
export interface Contrato {
  id: string;
  titulo: string;
  proveedorId: string;
  tipo: string;                 // suministro / servicio / arrendamiento…
  fechaInicio: string;
  fechaVencimiento: string;
  renovacionAutomatica: boolean;
  monto: string;
  moneda: string;
  responsables: string;
  clausulas: string;            // cláusulas importantes
  multas: string;
  exclusividad: boolean;
  confidencialidad: boolean;
  garantias: string;
  alertaDias: string;           // avisar N días antes del vencimiento (default 30)
  documento: string;            // URL del PDF
  notas: string;
}
export function contratoVacio(id: string): Contrato {
  return {
    id, titulo: '', proveedorId: '', tipo: '', fechaInicio: '', fechaVencimiento: '', renovacionAutomatica: false,
    monto: '', moneda: '', responsables: '', clausulas: '', multas: '', exclusividad: false, confidencialidad: false,
    garantias: '', alertaDias: '30', documento: '', notas: '',
  };
}
export function normalizarContrato(v: unknown): Contrato {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  return {
    id: s(d.id) || `CTR-${Math.random().toString(36).slice(2, 8)}`, titulo: s(d.titulo), proveedorId: s(d.proveedorId),
    tipo: s(d.tipo), fechaInicio: s(d.fechaInicio), fechaVencimiento: s(d.fechaVencimiento), renovacionAutomatica: d.renovacionAutomatica === true,
    monto: s(d.monto), moneda: s(d.moneda), responsables: s(d.responsables), clausulas: s(d.clausulas), multas: s(d.multas),
    exclusividad: d.exclusividad === true, confidencialidad: d.confidencialidad === true, garantias: s(d.garantias),
    alertaDias: s(d.alertaDias) || '30', documento: s(d.documento), notas: s(d.notas),
  };
}

export type EstadoContrato = 'vigente' | 'por-vencer' | 'vencido' | 'sin-fecha';
export const ESTADOS_CONTRATO: Record<EstadoContrato, { label: string; color: string; emoji: string }> = {
  'vigente': { label: 'Vigente', color: '#2e9e63', emoji: '🟢' },
  'por-vencer': { label: 'Por vencer', color: '#d9781f', emoji: '🟠' },
  'vencido': { label: 'Vencido', color: '#c0392b', emoji: '🔴' },
  'sin-fecha': { label: 'Sin fecha', color: '#8a93a8', emoji: '⚪' },
};
export interface InfoContrato { estado: EstadoContrato; diasRestantes: number | null; alerta: boolean }

// Días entre dos fechas ISO (b - a). null si alguna no es válida.
function diffDias(aIso: string, bIso: string): number | null {
  if (!aIso || !bIso) return null;
  const a = new Date(aIso.length <= 10 ? `${aIso}T00:00:00` : aIso);
  const b = new Date(bIso.length <= 10 ? `${bIso}T00:00:00` : bIso);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
export function estadoContrato(c: Contrato, hoyISO: string): InfoContrato {
  if (!c.fechaVencimiento) return { estado: 'sin-fecha', diasRestantes: null, alerta: false };
  const dias = diffDias(hoyISO, c.fechaVencimiento);
  if (dias === null) return { estado: 'sin-fecha', diasRestantes: null, alerta: false };
  if (dias < 0) return { estado: 'vencido', diasRestantes: dias, alerta: !c.renovacionAutomatica };
  const alertaDias = numero(c.alertaDias) ?? 30;
  if (dias <= alertaDias) return { estado: 'por-vencer', diasRestantes: dias, alerta: !c.renovacionAutomatica };
  return { estado: 'vigente', diasRestantes: dias, alerta: false };
}

// Automatización (Sección 17): genera una SOLICITUD de compra desde un producto bajo mínimo.
export function solicitudDesdeProducto(id: string, p: Producto, cantidad: number | null, proveedorId: string, fechaSolicitud: string): OrdenCompra {
  return {
    ...ordenVacia(id), etapa: 'solicitud', productoId: p.id, proveedorId,
    descripcion: p.nombre, cantidad: cantidad !== null ? String(cantidad) : '', unidad: p.unidad,
    fechaSolicitud, notas: 'Generada automáticamente por stock bajo.',
  };
}

// Redacta un correo de SOLICITUD DE COTIZACIÓN (RFQ) para un producto y proveedor. Puro y
// testeable; el envío real lo hace el adaptador de correo.
export function redactarSolicitudCotizacion(prod: Producto, proveedorNombre: string, cantidad: number | null, remitente: string, extra: string): { asunto: string; cuerpo: string } {
  const cant = cantidad !== null && cantidad > 0 ? `${cantidad}${prod.unidad ? ' ' + prod.unidad : ''}` : 'la cantidad a definir';
  const specs = [
    prod.marca && `Marca: ${prod.marca}`,
    prod.modelo && `Modelo: ${prod.modelo}`,
    prod.codigoFabricante && `Código fabricante: ${prod.codigoFabricante}`,
    prod.presentacion && `Presentación: ${prod.presentacion}`,
    prod.dimensiones && `Dimensiones: ${prod.dimensiones}`,
  ].filter(Boolean).join(' · ');
  const asunto = `Solicitud de cotización — ${prod.nombre}`;
  const cuerpo = [
    `Estimado equipo de ${proveedorNombre}:`,
    ``,
    `Por medio del presente solicitamos su cotización para el siguiente producto:`,
    ``,
    `• Producto: ${prod.nombre}`,
    `• Cantidad: ${cant}`,
    specs ? `• Especificaciones: ${specs}` : '',
    ``,
    `Agradeceríamos incluir: precio unitario, moneda, tiempo de entrega, cantidad mínima, vigencia de la cotización y condiciones de pago.`,
    extra ? `\n${extra}\n` : '',
    `Quedamos atentos a su respuesta.`,
    ``,
    `Saludos cordiales,`,
    remitente || 'Departamento de Compras',
  ].filter((l) => l !== '').join('\n');
  return { asunto, cuerpo };
}

// ---------- LOGÍSTICA: embarques + landed cost (costo puesto en tienda) ----------
// Un EMBARQUE consolida una o varias órdenes de compra en un envío, con transportista,
// fechas, estado/tracking y costos logísticos (flete/seguro/aduana/maniobras). El "landed
// cost" = valor de la mercancía + logística; se prorratea entre las órdenes por su valor.
export const ESTADOS_EMBARQUE = [
  { id: 'preparando', label: 'Preparando', emoji: '📦' },
  { id: 'recoleccion', label: 'Recolección', emoji: '🏭' },
  { id: 'transito', label: 'En tránsito', emoji: '🚚' },
  { id: 'aduana', label: 'Aduana', emoji: '🛃' },
  { id: 'entregado', label: 'Entregado', emoji: '✅' },
] as const;
export type EstadoEmbarque = typeof ESTADOS_EMBARQUE[number]['id'];
export function estadoEmbarqueInfo(id: string) {
  return ESTADOS_EMBARQUE.find((e) => e.id === id) ?? ESTADOS_EMBARQUE[0];
}

// MODALIDAD de envío: no todo va en tráiler. La paquetería (courier) cobra por GUÍA/peso/
// volumen y no se consolida en tarima; la carga (flete/tráiler) sí. También local/recolección.
export const MODALIDADES_ENVIO = [
  { id: 'paqueteria', label: 'Paquetería (courier)', emoji: '📮' },
  { id: 'carga', label: 'Carga / flete (tráiler)', emoji: '🚚' },
  { id: 'mensajeria', label: 'Mensajería local', emoji: '🛵' },
  { id: 'recoleccion', label: 'Recolección propia', emoji: '🚗' },
  { id: 'digital', label: 'Digital / sin envío', emoji: '💾' },
] as const;
export type ModalidadEnvio = typeof MODALIDADES_ENVIO[number]['id'];
export function modalidadEnvioInfo(id: string) {
  return MODALIDADES_ENVIO.find((m) => m.id === id) ?? MODALIDADES_ENVIO[0];
}
export function siguienteEstadoEmbarque(id: EstadoEmbarque): EstadoEmbarque {
  const i = ESTADOS_EMBARQUE.findIndex((e) => e.id === id);
  return ESTADOS_EMBARQUE[Math.min(i + 1, ESTADOS_EMBARQUE.length - 1)]!.id;
}

// IMPORTACIÓN (aduana): datos y cálculo de impuestos de importación (México). Cuando un
// embarque es internacional, la aduana se DESGLOSA y su total se suma al landed cost.
export interface Importacion {
  esImportacion: boolean;
  paisOrigen: string;
  fraccionArancelaria: string; // HS / fracción
  pedimento: string;
  agenteAduanal: string;
  valorAduana: string;         // base de los impuestos
  arancelPct: string;          // IGI (% de arancel de importación)
  ivaPct: string;              // IVA de importación (típico 16)
  dta: string;                 // Derecho de Trámite Aduanero (monto)
  honorariosAgente: string;
  otros: string;               // otros gastos aduanales
}
export function importacionVacia(): Importacion {
  return { esImportacion: false, paisOrigen: '', fraccionArancelaria: '', pedimento: '', agenteAduanal: '', valorAduana: '', arancelPct: '', ivaPct: '16', dta: '', honorariosAgente: '', otros: '' };
}
export function normalizarImportacion(v: unknown): Importacion {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  return {
    esImportacion: d.esImportacion === true, paisOrigen: s(d.paisOrigen), fraccionArancelaria: s(d.fraccionArancelaria),
    pedimento: s(d.pedimento), agenteAduanal: s(d.agenteAduanal), valorAduana: s(d.valorAduana), arancelPct: s(d.arancelPct),
    ivaPct: s(d.ivaPct) || '16', dta: s(d.dta), honorariosAgente: s(d.honorariosAgente), otros: s(d.otros),
  };
}
// Desglose de impuestos de importación: arancel (IGI), IVA sobre (valor+arancel+DTA), DTA,
// honorarios del agente y otros. Total = lo que cuesta "nacionalizar" la mercancía.
export function desgloseAduana(imp: Importacion): { valor: number; arancel: number; iva: number; dta: number; honorarios: number; otros: number; total: number } {
  if (!imp.esImportacion) return { valor: 0, arancel: 0, iva: 0, dta: 0, honorarios: 0, otros: 0, total: 0 };
  const valor = numero(imp.valorAduana) ?? 0;
  const arancel = valor * (numero(imp.arancelPct) ?? 0) / 100;
  const dta = numero(imp.dta) ?? 0;
  const iva = (valor + arancel + dta) * (numero(imp.ivaPct) ?? 0) / 100;
  const honorarios = numero(imp.honorariosAgente) ?? 0;
  const otros = numero(imp.otros) ?? 0;
  return { valor, arancel, iva, dta, honorarios, otros, total: arancel + iva + dta + honorarios + otros };
}
export function costoAduana(imp: Importacion): number { return desgloseAduana(imp).total; }

export interface Embarque {
  id: string;
  folio: string;
  modalidad: ModalidadEnvio; // paquetería / carga / mensajería / recolección / digital
  importacion: Importacion;  // datos de aduana si es internacional
  ordenIds: string[];       // órdenes de compra que consolida (paquetería suele ser 1)
  transportista: string;    // courier o línea de carga
  origen: string;
  destino: string;
  incoterm: string;
  estado: EstadoEmbarque;
  fechaRecoleccion: string;
  fechaEstimada: string;    // ETA
  fechaEntrega: string;     // entrega real
  tracking: string;         // número de guía (paquetería) / carta porte (carga)
  peso: string;             // kg (base del cobro en paquetería)
  bultos: string;           // nº de paquetes/cajas
  // Costos logísticos (texto numérico)
  flete: string;
  seguro: string;
  aduana: string;
  maniobras: string;
  otros: string;
  notas: string;
}
export function embarqueVacio(id: string): Embarque {
  return {
    id, folio: '', modalidad: 'paqueteria', importacion: importacionVacia(), ordenIds: [], transportista: '', origen: '', destino: '', incoterm: '', estado: 'preparando',
    fechaRecoleccion: '', fechaEstimada: '', fechaEntrega: '', tracking: '', peso: '', bultos: '', flete: '', seguro: '', aduana: '', maniobras: '', otros: '', notas: '',
  };
}
export function normalizarEmbarque(v: unknown): Embarque {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  const estado = (ESTADOS_EMBARQUE.some((e) => e.id === d.estado) ? d.estado : 'preparando') as EstadoEmbarque;
  const modalidad = (MODALIDADES_ENVIO.some((m) => m.id === d.modalidad) ? d.modalidad : 'paqueteria') as ModalidadEnvio;
  return {
    id: s(d.id) || `EMB-${Math.random().toString(36).slice(2, 8)}`, folio: s(d.folio), modalidad, importacion: normalizarImportacion(d.importacion), ordenIds: sa(d.ordenIds),
    transportista: s(d.transportista), origen: s(d.origen), destino: s(d.destino), incoterm: s(d.incoterm), estado,
    fechaRecoleccion: s(d.fechaRecoleccion), fechaEstimada: s(d.fechaEstimada), fechaEntrega: s(d.fechaEntrega), tracking: s(d.tracking),
    peso: s(d.peso), bultos: s(d.bultos),
    flete: s(d.flete), seguro: s(d.seguro), aduana: s(d.aduana), maniobras: s(d.maniobras), otros: s(d.otros), notas: s(d.notas),
  };
}
// Costo logístico total del embarque (flete + seguro + aduana + maniobras + otros).
export function costoLogisticoEmbarque(e: Embarque): number {
  return [e.flete, e.seguro, e.aduana, e.maniobras, e.otros].reduce((s2, x) => s2 + (numero(x) ?? 0), 0);
}
// Valor de la mercancía = suma del total de las órdenes que incluye.
export function valorMercanciaEmbarque(e: Embarque, ordenes: OrdenCompra[]): number {
  const ids = new Set(e.ordenIds);
  return ordenes.filter((o) => ids.has(o.id)).reduce((s2, o) => s2 + (totalOrden(o) ?? 0), 0);
}
// Landed cost = valor de mercancía + logística; factor = cuánto encarece la logística.
export function landedCostEmbarque(e: Embarque, ordenes: OrdenCompra[]): { valor: number; logistica: number; total: number; factor: number } {
  const valor = valorMercanciaEmbarque(e, ordenes);
  const logistica = costoLogisticoEmbarque(e);
  const total = valor + logistica;
  return { valor, logistica, total, factor: valor > 0 ? total / valor : 1 };
}
// Prorrateo de la logística entre las órdenes, proporcional a su valor.
export function prorrateoLanded(e: Embarque, ordenes: OrdenCompra[]): { ordenId: string; descripcion: string; valor: number; logistica: number; landed: number }[] {
  const ids = new Set(e.ordenIds);
  const incluidas = ordenes.filter((o) => ids.has(o.id));
  const valorTotal = incluidas.reduce((s2, o) => s2 + (totalOrden(o) ?? 0), 0);
  const logisticaTotal = costoLogisticoEmbarque(e);
  return incluidas.map((o) => {
    const valor = totalOrden(o) ?? 0;
    const logistica = valorTotal > 0 ? logisticaTotal * (valor / valorTotal) : 0;
    return { ordenId: o.id, descripcion: o.descripcion, valor, logistica, landed: valor + logistica };
  });
}
// ¿El embarque va retrasado? (ETA ya pasó y no está entregado).
export function embarqueRetrasado(e: Embarque, hoyISO: string): boolean {
  return !!e.fechaEstimada && e.estado !== 'entregado' && e.fechaEstimada < hoyISO;
}

// ---------- Transportistas + tarifas (F2) ----------
// Una TARIFA cotiza según la modalidad: paquetería/mensajería = base + por kg; carga = por viaje.
export interface Tarifa {
  modalidad: string;   // paqueteria / carga / mensajeria
  zona: string;        // "Local", "Bajío", "Nacional", "CDMX"…
  base: string;        // costo fijo
  porKg: string;       // costo por kg (paquetería/mensajería)
  porViaje: string;    // costo por viaje (carga)
  tiempoDias: string;  // días estimados de entrega
  notas: string;
}
export interface Transportista {
  id: string;
  nombre: string;
  modalidades: string[];  // qué modos maneja (paqueteria/carga/mensajeria/recoleccion)
  contacto: string;
  telefono: string;
  email: string;
  sitioWeb: string;
  zonas: string[];
  tarifas: Tarifa[];
  notas: string;
}
export function transportistaVacio(id: string): Transportista {
  return { id, nombre: '', modalidades: ['paqueteria'], contacto: '', telefono: '', email: '', sitioWeb: '', zonas: [], tarifas: [], notas: '' };
}
function normTarifa(v: unknown): Tarifa {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  return {
    modalidad: (['paqueteria', 'carga', 'mensajeria'].includes(s(d.modalidad)) ? s(d.modalidad) : 'paqueteria'),
    zona: s(d.zona), base: s(d.base), porKg: s(d.porKg), porViaje: s(d.porViaje), tiempoDias: s(d.tiempoDias), notas: s(d.notas),
  };
}
export function normalizarTransportista(v: unknown): Transportista {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  return {
    id: s(d.id) || `TRP-${Math.random().toString(36).slice(2, 8)}`, nombre: s(d.nombre), modalidades: sa(d.modalidades),
    contacto: s(d.contacto), telefono: s(d.telefono), email: s(d.email), sitioWeb: s(d.sitioWeb), zonas: sa(d.zonas),
    tarifas: Array.isArray(d.tarifas) ? d.tarifas.map(normTarifa) : [], notas: s(d.notas),
  };
}
// Cotiza el flete de un transportista para una modalidad/zona/peso. null si no hay tarifa.
export function cotizarFlete(t: Transportista, modalidad: string, zona: string, pesoKg: number | null): number | null {
  const cands = t.tarifas.filter((x) => x.modalidad === modalidad);
  if (!cands.length) return null;
  const z = zona.trim().toLowerCase();
  const tar = cands.find((x) => x.zona.trim().toLowerCase() === z) ?? cands[0]!;
  const base = numero(tar.base) ?? 0;
  if (modalidad === 'carga') return base + (numero(tar.porViaje) ?? 0);
  return base + (numero(tar.porKg) ?? 0) * (pesoKg ?? 1);
}
// Mejor (más barato) transportista para una modalidad/zona/peso.
export function mejorTransportista(ts: Transportista[], modalidad: string, zona: string, pesoKg: number | null): { t: Transportista; costo: number } | null {
  const cot = ts.map((t) => ({ t, costo: cotizarFlete(t, modalidad, zona, pesoKg) }))
    .filter((x): x is { t: Transportista; costo: number } => x.costo !== null);
  if (!cot.length) return null;
  return cot.reduce((min, x) => x.costo < min.costo ? x : min);
}

// ---------- ARRANQUE del negocio: checklist de apertura ----------
// Todo lo que hace falta ADQUIRIR para abrir: activos por comprar (Recursos con existe=false)
// + inventario inicial (Productos: llenar de stockActual a su objetivo). Con costo total.
export interface ItemArranque {
  tipo: 'activo' | 'insumo';
  nombre: string;
  grupo: string;
  cantidad: number;
  unidad: string;
  costoUnit: number | null;
  subtotal: number | null;
  productoId?: string;      // si viene de un Producto
  proveedorId?: string;     // proveedor sugerido (más barato)
  proveedorNombre?: string; // nombre del proveedor (activos: texto del recurso)
}
export interface PlanArranque {
  activos: ItemArranque[];
  insumos: ItemArranque[];
  totalActivos: number;
  totalInsumos: number;
  total: number;
}
export function planArranque(recursos: Recurso[], productos: Producto[], vinculos: ProductoProveedor[]): PlanArranque {
  const activos: ItemArranque[] = recursos.filter((r) => !r.existe && r.nombre.trim()).map((r) => {
    const cantidad = numero(r.cantidad) ?? 1;
    const costoUnit = numero(r.costo);
    return { tipo: 'activo' as const, nombre: r.nombre, grupo: r.grupo || categoriaRecurso(r.categoria).label, cantidad, unidad: r.unidad, costoUnit, subtotal: costoUnit !== null ? costoUnit * cantidad : null, ...(r.proveedor ? { proveedorNombre: r.proveedor } : {}) };
  });
  const insumos: ItemArranque[] = [];
  for (const p of productos) {
    if (!p.nombre.trim()) continue;
    const objetivo = numero(p.stockMaximo) ?? numero(p.puntoReorden) ?? numero(p.stockMinimo);
    if (objetivo === null) continue;
    const actual = numero(p.stockActual) ?? 0;
    const cantidad = Math.max(0, objetivo - actual);
    if (cantidad <= 0) continue;
    const barato = proveedorMasBarato(vinculos, p.id);
    const costoUnit = barato ? numero(precioVigente(barato)) : null;
    insumos.push({ tipo: 'insumo', nombre: p.nombre, grupo: p.categoria || 'Insumos', cantidad, unidad: p.unidad, costoUnit, subtotal: costoUnit !== null ? costoUnit * cantidad : null, productoId: p.id, ...(barato ? { proveedorId: barato.proveedorId } : {}) });
  }
  const suma = (xs: ItemArranque[]) => xs.reduce((s2, x) => s2 + (x.subtotal ?? 0), 0);
  const totalActivos = suma(activos), totalInsumos = suma(insumos);
  return { activos, insumos, totalActivos, totalInsumos, total: totalActivos + totalInsumos };
}

// ---------- Calidad (Sección 8): incidencias del proveedor ----------
export type GravedadIncidencia = 'leve' | 'media' | 'grave';
export interface Incidencia {
  id: string;
  proveedorId: string;
  tipo: string;         // rechazo / retraso / defecto / incidencia / auditoría
  gravedad: GravedadIncidencia;
  fecha: string;
  descripcion: string;
  ordenId: string;      // orden de compra relacionada (opcional)
  evidencia: string;    // URL de foto/documento
}
export function incidenciaVacia(id: string, proveedorId: string): Incidencia {
  return { id, proveedorId, tipo: 'incidencia', gravedad: 'media', fecha: '', descripcion: '', ordenId: '', evidencia: '' };
}
export function normalizarIncidencia(v: unknown): Incidencia {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  const gravedad = (['leve', 'media', 'grave'].includes(s(d.gravedad)) ? s(d.gravedad) : 'media') as GravedadIncidencia;
  return {
    id: s(d.id) || `INC-${Math.random().toString(36).slice(2, 8)}`, proveedorId: s(d.proveedorId),
    tipo: s(d.tipo) || 'incidencia', gravedad, fecha: s(d.fecha), descripcion: s(d.descripcion), ordenId: s(d.ordenId), evidencia: s(d.evidencia),
  };
}

// ---------- Relación comercial: bitácora de interacciones + seguimiento ----------
export interface Interaccion {
  id: string;
  proveedorId: string;
  tipo: string;                          // correo enviado / respuesta / llamada / cita / nota…
  canal: string;                         // correo / teléfono / whatsapp / presencial
  direccion: 'saliente' | 'entrante';
  fecha: string;
  resumen: string;
  ordenId: string;                       // orden de compra relacionada (opcional)
}
export function interaccionVacia(id: string, proveedorId: string): Interaccion {
  return { id, proveedorId, tipo: 'nota', canal: '', direccion: 'saliente', fecha: '', resumen: '', ordenId: '' };
}
export function normalizarInteraccion(v: unknown): Interaccion {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  return {
    id: s(d.id) || `INT-${Math.random().toString(36).slice(2, 8)}`, proveedorId: s(d.proveedorId),
    tipo: s(d.tipo) || 'nota', canal: s(d.canal), direccion: d.direccion === 'entrante' ? 'entrante' : 'saliente',
    fecha: s(d.fecha), resumen: s(d.resumen), ordenId: s(d.ordenId),
  };
}
// Interacciones de un proveedor, más recientes primero.
export function interaccionesDeProveedor(ints: Interaccion[], proveedorId: string): Interaccion[] {
  return ints.filter((i) => i.proveedorId === proveedorId).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}
// Fecha del último contacto registrado (o '' si nunca).
export function ultimoContacto(proveedorId: string, ints: Interaccion[]): string {
  const fechas = ints.filter((i) => i.proveedorId === proveedorId).map((i) => i.fecha).filter(Boolean).sort();
  return fechas.length ? fechas[fechas.length - 1]! : '';
}
// ¿Toca dar seguimiento hoy? (tiene fecha de próximo seguimiento y ya llegó/pasó).
export function requiereSeguimiento(p: Proveedor, hoyISO: string): boolean {
  return !!p.proximoSeguimiento && p.proximoSeguimiento <= hoyISO;
}
// Proveedores con seguimiento pendiente, del más atrasado al más reciente.
export function seguimientosPendientes(provs: Proveedor[], hoyISO: string): Proveedor[] {
  return provs.filter((p) => requiereSeguimiento(p, hoyISO)).sort((a, b) => (a.proximoSeguimiento < b.proximoSeguimiento ? -1 : 1));
}

// ---------- Evaluación (Sección 9): Score General automático ----------
export type NivelScore = 'excelente' | 'bueno' | 'regular' | 'critico' | 'sin-evaluar';
export const NIVELES_SCORE: Record<NivelScore, { label: string; color: string; emoji: string }> = {
  'excelente': { label: 'Excelente', color: '#2e9e63', emoji: '🟢' },
  'bueno': { label: 'Bueno', color: '#7aa53b', emoji: '🟢' },
  'regular': { label: 'Regular', color: '#d9a13b', emoji: '🟡' },
  'critico': { label: 'Crítico', color: '#c0392b', emoji: '🔴' },
  'sin-evaluar': { label: 'Sin evaluar', color: '#8a93a8', emoji: '⚪' },
};
export interface ScoreProveedor {
  score: number | null;   // 0–100 (null si no hay criterios calificados)
  nivel: NivelScore;
  base: number | null;    // promedio de criterios antes de penalizar
  penalizacion: number;   // puntos restados por incidencias
  nCriterios: number;
  incidencias: number;
}
// Score = promedio de los criterios calificados, penalizado por incidencias recientes
// (grave −8 · media −4 · leve −2, tope −40). Es determinista y explicable.
export function scoreProveedor(p: Proveedor, incidencias: Incidencia[]): ScoreProveedor {
  const vals = CRITERIOS_EVAL.map((c) => p.evaluacion[c.id]).filter((v): v is number => typeof v === 'number' && v > 0);
  const base = vals.length ? Math.round(vals.reduce((s2, v) => s2 + v, 0) / vals.length) : null;
  const incs = incidencias.filter((i) => i.proveedorId === p.id);
  const penalizacion = Math.min(40, incs.reduce((s2, i) => s2 + (i.gravedad === 'grave' ? 8 : i.gravedad === 'media' ? 4 : 2), 0));
  let score: number | null = null;
  let nivel: NivelScore = 'sin-evaluar';
  if (base !== null) {
    score = Math.max(0, Math.min(100, base - penalizacion));
    nivel = score >= 80 ? 'excelente' : score >= 60 ? 'bueno' : score >= 40 ? 'regular' : 'critico';
  }
  return { score, nivel, base, penalizacion, nCriterios: vals.length, incidencias: incs.length };
}
