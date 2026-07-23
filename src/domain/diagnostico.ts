// Cabeza del Business Planner (ADITIVO — no toca FROZEN ni COM-EXP).
// Diagnóstico → Clasificación → Blueprint. Tipos compartidos por el Motor de Selección
// (reglas deterministas) y el Agente Arquitecto (IA, solo conduce el intake).
// Ref: BUSINESS_ARCHITECTURE_PIPELINE.md · SELECTION_ENGINE_DRY_RUN.md · PLANNER_OPERATIONAL_FLOW.md

export type TipoNegocio = 'producto-fisico' | 'servicio' | 'software' | 'comercio-bienes' | 'hibrido';
export type Etapa = 'idea' | 'validacion' | 'early' | 'crecimiento' | 'consolidado';
export type Objetivo = 'lanzar' | 'ordenar' | 'escalar' | 'levantar-capital' | 'exportar' | 'franquiciar';
export type Escala = 'local' | 'regional' | 'nacional' | 'internacional';
export type Presupuesto = 'bajo' | 'medio' | 'alto';
export type Recursos = 'solo-fundador' | 'equipo-pequeno' | 'equipo-completo';
export type Urgencia = 'exploratoria' | 'normal' | 'urgente';
export type Complejidad = 'simple' | 'media' | 'alta';
export type Profundidad = 'esencial' | 'estandar' | 'completo';

// Vector de diagnóstico (6 obligatorios + 4 refinadores + identidad).
export interface Diagnostico {
  nombreEntidad: string;
  resumen: string;          // 1 línea: qué es el proyecto
  tipoNegocio: TipoNegocio; // obligatorio
  industria: string;        // obligatorio
  etapa: Etapa;             // obligatorio
  objetivo: Objetivo;       // obligatorio
  escala: Escala;           // obligatorio
  presupuesto: Presupuesto; // obligatorio
  recursos?: Recursos;      // refinador
  restricciones?: string;   // refinador
  urgencia?: Urgencia;      // refinador
  complejidad?: Complejidad;// refinador
}

// Catálogo canónico: los 18 planos maestros (PLANO ALV). El motor selecciona de aquí.
export const PLANOS_MAESTROS: Record<string, string> = {
  META: 'Meta',
  EST: 'Estratégico',
  COM: 'Comercial',
  MKT: 'Marketing',
  CUL: 'Cultural',
  ORG: 'Organizacional',
  RH: 'Recursos Humanos',
  OPE: 'Operativo',
  PRO: 'Procesos',
  ARQ: 'Arquitectónico',
  TEC: 'Tecnológico',
  IA: 'IA',
  FIN: 'Financiero',
  INV: 'Inversionista',
  CTR: 'Control',
  IMP: 'Implementación',
  ESC: 'Escalamiento',
  JUR: 'Jurídico',
};

// Orden canónico de producción (por dependencias del método).
export const ORDEN_PLANOS = ['META', 'EST', 'COM', 'MKT', 'CUL', 'ORG', 'RH', 'OPE', 'PRO', 'ARQ', 'TEC', 'IA', 'FIN', 'INV', 'CTR', 'IMP', 'ESC', 'JUR'];

export interface PlanoSeleccionado {
  id: string;
  nombre: string;
  profundidad: Profundidad;
  razones: string[];
  minOperable: boolean; // ¿debe llegar a MIN_OPERABLE para arrancar?
  formulario: string;   // plantilla de captura asociada
}

export interface ModuloDecision {
  modulo: string;
  activo: boolean;
  razon: string;
}

export interface Blueprint {
  nombreEntidad: string;
  resumen: string;
  clasificacion: string[];
  profundidadProyecto: Profundidad;
  planos: PlanoSeleccionado[];
  modulos: ModuloDecision[];
  formularios: string[];
  flujosMinimos: string[]; // planos que deben llegar a MIN_OPERABLE
  generadoEn: string;
}

// Persistencia (aditiva): diagnóstico + blueprint por proyecto.
export interface ProyectoDiagnostico {
  proyectoId: string;
  diagnostico: Diagnostico;
  blueprint: Blueprint;
  actualizadoEn: string;
}
