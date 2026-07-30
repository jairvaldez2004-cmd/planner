// CONTINGENCIAS / MANUALES DE EMERGENCIA por riesgo (ADITIVO). "¿Qué hacer si…?": el
// pedido no llega, roban la mercancía, viene sin seguro, se daña, la detiene aduana, el
// proveedor incumple… Cada contingencia es un protocolo (disparador → pasos) que se puede
// ANCLAR a un proceso del Mapa Operativo (procesoId) para que viva dentro del workflow.
// Se guarda como filas JSON en TablaProyecto ref 'contingencias'.

export type GravedadContingencia = 'baja' | 'media' | 'alta' | 'critica';

export const GRAVEDADES_CONTINGENCIA: { id: GravedadContingencia; label: string; color: string }[] = [
  { id: 'baja', label: 'Baja', color: '#7aa53b' },
  { id: 'media', label: 'Media', color: '#d9a13b' },
  { id: 'alta', label: 'Alta', color: '#d9781f' },
  { id: 'critica', label: 'Crítica', color: '#c0392b' },
];
export function gravedadContingencia(id: string) {
  return GRAVEDADES_CONTINGENCIA.find((g) => g.id === id) ?? GRAVEDADES_CONTINGENCIA[1]!;
}

export const CATEGORIAS_CONTINGENCIA = ['logística', 'seguridad', 'financiero', 'calidad', 'suministro', 'operación', 'legal'];

export interface Contingencia {
  id: string;
  titulo: string;        // "El pedido no llega a tiempo"
  disparador: string;    // el evento/riesgo que la activa
  categoria: string;     // logística / seguridad / financiero / calidad…
  gravedad: GravedadContingencia;
  pasos: string;         // qué hacer (protocolo paso a paso)
  responsable: string;   // quién ejecuta el protocolo
  prevencion: string;    // cómo evitar que ocurra
  procesoId: string;     // proceso del Mapa al que se ancla ('' = general)
}

export function contingenciaVacia(id: string, procesoId = ''): Contingencia {
  return { id, titulo: '', disparador: '', categoria: 'logística', gravedad: 'media', pasos: '', responsable: '', prevencion: '', procesoId };
}

export function normalizarContingencia(v: unknown): Contingencia {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  const s = (x: unknown) => typeof x === 'string' ? x : '';
  const gravedad = (GRAVEDADES_CONTINGENCIA.some((g) => g.id === d.gravedad) ? d.gravedad : 'media') as GravedadContingencia;
  return {
    id: s(d.id) || `CON-${Math.random().toString(36).slice(2, 8)}`, titulo: s(d.titulo), disparador: s(d.disparador),
    categoria: s(d.categoria) || 'logística', gravedad, pasos: s(d.pasos), responsable: s(d.responsable),
    prevencion: s(d.prevencion), procesoId: s(d.procesoId),
  };
}

export function contingenciasDeProceso(lista: Contingencia[], procesoId: string): Contingencia[] {
  return lista.filter((c) => c.procesoId === procesoId);
}

// ---------- Plantillas de riesgos comunes (se instancian con un clic) ----------
export interface PlantillaContingencia {
  id: string; titulo: string; categoria: string; gravedad: GravedadContingencia;
  disparador: string; pasos: string; prevencion: string;
}

export const RIESGOS_LOGISTICA: PlantillaContingencia[] = [
  {
    id: 'retraso', titulo: 'El pedido no llega a tiempo', categoria: 'logística', gravedad: 'media',
    disparador: 'La fecha estimada (ETA) se venció o el transportista confirma retraso.',
    pasos: '1. Rastrear con la guía y exigir al transportista una nueva fecha por escrito.\n2. Avisar al proveedor y confirmar que ya despachó.\n3. Medir el impacto en operación (¿alcanza el stock de seguridad?).\n4. Si es crítico, activar proveedor alternativo o compra urgente local.\n5. Registrar la incidencia al transportista/proveedor.',
    prevencion: 'Margen de lead time + stock de seguridad + proveedor alterno por insumo crítico.',
  },
  {
    id: 'robo', titulo: 'Roban la mercancía', categoria: 'seguridad', gravedad: 'critica',
    disparador: 'Robo o extravío del embarque en tránsito.',
    pasos: '1. Reportar de inmediato al transportista y abrir reclamación con la guía.\n2. Levantar denuncia ante la autoridad.\n3. Reclamar al seguro con guía, factura y valor declarado.\n4. Notificar al proveedor y gestionar reposición del pedido.\n5. Ajustar inventario y avisar a operación; registrar incidencia.',
    prevencion: 'Asegurar TODO envío de valor, usar transportistas confiables y no exhibir contenido/valor en el paquete.',
  },
  {
    id: 'sin-seguro', titulo: 'La mercancía no viene asegurada', categoria: 'financiero', gravedad: 'alta',
    disparador: 'Un embarque de valor va o llegó sin seguro.',
    pasos: '1. NO despachar mercancía de valor alto sin seguro.\n2. Contratar el seguro ANTES de que salga el embarque.\n3. Si ya va en camino, evaluar un seguro puente / declaración de valor.\n4. Documentar la decisión y el riesgo asumido, y quién lo autoriza.',
    prevencion: 'Política: asegurar todo envío por encima de un monto definido; casilla obligatoria de seguro antes de crear el embarque.',
  },
  {
    id: 'danada', titulo: 'La mercancía llega dañada o defectuosa', categoria: 'calidad', gravedad: 'media',
    disparador: 'El pedido llega roto, dañado o fuera de especificación.',
    pasos: '1. NO firmar la recepción como conforme; anotar "recibido con reserva".\n2. Tomar fotos/video como evidencia al abrir.\n3. Reclamación al transportista y/o al seguro.\n4. Iniciar devolución (RMA) o reposición con el proveedor.\n5. Registrar incidencia de calidad (baja el score del proveedor).',
    prevencion: 'Empaque adecuado, seguro, e inspección obligatoria en recepción contra la orden de compra.',
  },
  {
    id: 'aduana', titulo: 'La mercancía se detiene en aduana', categoria: 'logística', gravedad: 'alta',
    disparador: 'Retención en aduana (importación).',
    pasos: '1. Contactar al agente aduanal y ubicar el pedimento.\n2. Verificar documentos, fracción arancelaria y valor declarado.\n3. Pagar impuestos pendientes o regularizar lo que falte.\n4. Estimar la nueva fecha de liberación y avisar el impacto.',
    prevencion: 'Agente aduanal confiable, documentación completa y clasificación arancelaria correcta desde el pedido.',
  },
  {
    id: 'proveedor-falla', titulo: 'El proveedor no cumple / se cae', categoria: 'suministro', gravedad: 'alta',
    disparador: 'El proveedor incumple entregas o deja de operar.',
    pasos: '1. Activar el proveedor alternativo / plan B del insumo.\n2. Escalar con el proveedor y renegociar.\n3. Levantar incidencia y bajar su score.\n4. Evaluar cambio definitivo de proveedor.',
    prevencion: 'Multi-sourcing, plan B por insumo crítico y contratos con penalización por incumplimiento.',
  },
  {
    id: 'faltante', titulo: 'Llega incompleto (recepción parcial)', categoria: 'logística', gravedad: 'media',
    disparador: 'La cantidad recibida es menor a la pedida.',
    pasos: '1. Registrar cantidad recibida vs. pedida en la orden.\n2. Documentar el faltante con evidencia.\n3. Reclamar el resto al proveedor y acordar fecha del complemento.\n4. Ajustar el inventario a lo realmente recibido.\n5. No pagar el total hasta completar (o pagar solo lo recibido).',
    prevencion: 'Verificar cada recepción contra la orden de compra antes de firmar.',
  },
];

export function contingenciaDesdePlantilla(id: string, p: PlantillaContingencia, procesoId = ''): Contingencia {
  return { id, titulo: p.titulo, disparador: p.disparador, categoria: p.categoria, gravedad: p.gravedad, pasos: p.pasos, responsable: '', prevencion: p.prevencion, procesoId };
}
