// ENTREGABLES / PAQUETES (config, ADITIVO). Cuando los planos están llenos, el Planner
// puede "empaquetar" sus documentos en artefactos finales: el Documento Maestro (Plano ALV)
// y paquetes por audiencia (arquitectos, operaciones, RH, marketing, inversionistas, software).
// Cada paquete = un bundle de los documentos de un grupo de planos (ref: manual PARTE II.6).
// Es solo config: qué planos entran en cada paquete y con qué orden.

import { ORDEN_PLANOS } from './diagnostico';

export interface Paquete {
  id: string;
  nombre: string;
  icono: string;
  descripcion: string;
  planos: string[]; // planoIds, en el orden en que se arma el documento
}

export const PAQUETES: Paquete[] = [
  { id: 'maestro', nombre: 'Documento Maestro (Plano ALV)', icono: '📘',
    descripcion: 'Todos los planos en un solo documento — la configuración inicial completa de la empresa.',
    planos: [...ORDEN_PLANOS] },
  { id: 'inversionistas', nombre: 'Paquete Inversionistas', icono: '💰',
    descripcion: 'Memorandum de inversión: negocio, mercado, finanzas, uso del capital.',
    planos: ['META', 'EST', 'COM', 'MKT', 'FIN', 'INV'] },
  { id: 'arquitectos', nombre: 'Paquete Arquitectos e Ingenieros', icono: '📐',
    descripcion: 'Para que una constructora diseñe, cotice y construya (programa + casa de muñecas + doc por espacio).',
    planos: ['ARQ'] },
  { id: 'operaciones', nombre: 'Paquete Operaciones', icono: '⚙️',
    descripcion: 'Manual operativo: procesos, SOPs, KPIs y control.',
    planos: ['OPE', 'PRO', 'CTR', 'IMP'] },
  { id: 'rh', nombre: 'Paquete Recursos Humanos', icono: '👥',
    descripcion: 'Estructura, puestos, ciclo del empleado y cultura.',
    planos: ['ORG', 'RH', 'CUL'] },
  { id: 'marketing', nombre: 'Paquete Marketing y Comercial', icono: '📣',
    descripcion: 'Plan de marketing, laboratorio de validación y sistema comercial.',
    planos: ['MKT', 'COM'] },
  { id: 'software', nombre: 'Paquete Tecnológico / Software', icono: '🧩',
    descripcion: 'Configuración inicial para el software operativo: componentes, agentes, escalamiento.',
    planos: ['TEC', 'IA', 'ESC'] },
  { id: 'legal', nombre: 'Paquete Legal / Jurídico', icono: '⚖️',
    descripcion: 'Constitución, contratos, permisos, PI y checklist legal.',
    planos: ['JUR'] },
];

export function paquete(id: string): Paquete | undefined {
  return PAQUETES.find((p) => p.id === id);
}
