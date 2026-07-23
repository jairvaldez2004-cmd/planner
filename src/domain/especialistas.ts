// Catálogo de Especialistas (Decisión 1 de AGENT_ARCHITECTURE_V1): 1 motor, 13 configs.
// Cada config deriva de su Plantilla de Captura (BusinessPlanner/Plantillas_Captura/*).
// Define: preguntas en orden lógico (bloques) · contrato de entrega · tablas CSV · dependencias.
// ADITIVO — no toca FROZEN/COM-EXP/OS. La selección y profundidad las decide el Motor de Selección.

import type { Profundidad } from './diagnostico';
import type { Columna } from './tablas';

export type Nivel = Profundidad; // 'esencial' | 'estandar' | 'completo'

export type TipoCampo = 'texto' | 'parrafo' | 'opcion' | 'numero' | 'lista';

export interface Campo {
  id: string;
  pregunta: string;
  tipo: TipoCampo;
  opciones?: string[];
  requeridoEn: Nivel; // nivel del proyecto a partir del cual este campo es requerido
}

// Vista de un especialista sobre una Tabla Maestra compartida (Decisiones 4 y 5).
export interface TablaVista {
  tablaRef: string;            // ref en TABLAS_BASE
  etiqueta?: string;           // cómo la llama ESTE especialista (contexto)
  columnasContexto?: Columna[]; // columnas extra que agrega este especialista
  requeridoEn: Nivel;          // ≥1 fila requerida a partir de este nivel
  disparadorCSV: number;       // si se esperan ≥N filas, el especialista ofrece CSV
}

export interface Bloque {
  id: string;
  titulo: string;
  capas?: string;        // capas ARQOS (referencia)
  campos?: Campo[];      // preguntas narrativas (chat)
  tabla?: TablaVista;    // datos repetitivos (CSV)
}

export type TipoEntrega = 'documento' | 'tabla' | 'diagrama' | 'dashboard';

export interface ContratoEntrega {
  tipo: TipoEntrega;
  descripcion: string;
}

export interface EspecialistaConfig {
  planoId: string;
  nombre: string;
  lenguajeTecnico: string;     // cómo traduce respuestas a campos del plano (system prompt)
  dependencias: string[];      // planos que deben existir antes (orden lógico)
  contratoEntrega: ContratoEntrega;
  bloques: Bloque[];
}

const E = 'esencial' as Nivel, S = 'estandar' as Nivel, C = 'completo' as Nivel;

export const ESPECIALISTAS: Record<string, EspecialistaConfig> = {
  META: {
    planoId: 'META', nombre: 'Meta (Empresarial)',
    lenguajeTecnico: 'Meta-plano que integra todos los demás. Define identidad, estrategia, mercado, organización y marco económico a alto nivel. No contradice ningún plano hijo.',
    dependencias: [],
    contratoEntrega: { tipo: 'documento', descripcion: 'Documento maestro de la entidad (integra los 12 planos).' },
    bloques: [
      { id: 'identidad', titulo: 'Identidad y propósito', capas: 'C1·C2', campos: [
        { id: 'mision', pregunta: '¿Cuál es la misión / razón de ser de la entidad?', tipo: 'parrafo', requeridoEn: E },
        { id: 'proposito', pregunta: '¿Qué propósito persigue y a quién sirve?', tipo: 'parrafo', requeridoEn: E },
      ] },
      { id: 'estrategia', titulo: 'Estrategia y valor', capas: 'C3·C4·C5', campos: [
        { id: 'tesis', pregunta: '¿Cuál es la tesis estratégica / cómo gana?', tipo: 'parrafo', requeridoEn: S },
        { id: 'valor', pregunta: '¿Cuál es la propuesta de valor central?', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'mercado', titulo: 'Mercado, oferta y canales', capas: 'C5·C6·C7', campos: [
        { id: 'mercado', pregunta: '¿Cuál es el mercado/segmento principal y la oferta?', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'organizacion', titulo: 'Organización y capacidades', capas: 'C8·C9·C11', campos: [
        { id: 'org', pregunta: '¿Cómo se organiza (áreas, roles, capacidades clave)?', tipo: 'parrafo', requeridoEn: C },
      ] },
      { id: 'economia', titulo: 'Finanzas y capital', capas: 'C15', campos: [
        { id: 'modelo', pregunta: '¿Cuál es el marco económico (cómo genera y reparte valor)?', tipo: 'parrafo', requeridoEn: C },
      ] },
    ],
  },

  EST: {
    planoId: 'EST', nombre: 'Estratégico',
    lenguajeTecnico: 'Profundiza Norte/Prioridades/Decisión sobre el META. Traduce respuestas a misión, visión, objetivos, exclusiones y sistema de decisión. No contradice META.',
    dependencias: ['META'],
    contratoEntrega: { tipo: 'documento', descripcion: 'Documento estratégico (norte, prioridades, sistema de decisión).' },
    bloques: [
      { id: 'norte', titulo: 'Norte', capas: 'C1·C2·C3', campos: [
        { id: 'vision', pregunta: '¿Cuál es la visión y el horizonte temporal?', tipo: 'parrafo', requeridoEn: E },
        { id: 'tesis', pregunta: '¿Cuál es la tesis estratégica?', tipo: 'parrafo', requeridoEn: E },
      ] },
      { id: 'prioridades', titulo: 'Prioridades', capas: 'C3·C4', campos: [
        { id: 'objetivos', pregunta: '¿Cuáles son los objetivos e iniciativas prioritarias?', tipo: 'lista', requeridoEn: E },
        { id: 'exclusiones', pregunta: '¿Qué se excluye explícitamente (no se hará)?', tipo: 'lista', requeridoEn: S },
      ] },
      { id: 'decision', titulo: 'Sistema de decisión', capas: 'C3', campos: [
        { id: 'decision', pregunta: '¿Quién decide, recomienda, ejecuta y bloquea?', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'portafolio', titulo: 'Portafolio', capas: 'C4·C5', campos: [
        { id: 'entidades', pregunta: '¿Qué entidades actuales/futuras componen el portafolio?', tipo: 'lista', requeridoEn: S },
      ] },
      { id: 'recursos', titulo: 'Recursos', capas: 'C4', campos: [
        { id: 'recursos', pregunta: '¿Con qué capital, personas, IA y tiempo se cuenta?', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'riesgos', titulo: 'Riesgos', capas: 'C3·C5', campos: [
        { id: 'riesgos', pregunta: '¿Dependencias, cuellos de botella y escenarios de riesgo?', tipo: 'lista', requeridoEn: C },
      ] },
      { id: 'cierre', titulo: 'Cierre', capas: 'C3', campos: [
        { id: 'cierre', pregunta: '¿Criterio para ganar y para abandonar?', tipo: 'parrafo', requeridoEn: C },
      ] },
    ],
  },

  COM: {
    planoId: 'COM', nombre: 'Comercial',
    lenguajeTecnico: 'Profundiza Oferta/Precios/Segmentos/Canales/Demanda. Datos repetitivos van por tabla/CSV (productos, clientes, canales, campañas). Precios → PENDIENTE. No contradice META ni EST.',
    dependencias: ['META', 'EST'],
    contratoEntrega: { tipo: 'documento', descripcion: 'Documento comercial + catálogo de oferta.' },
    bloques: [
      { id: 'valor', titulo: 'Propuesta de valor', capas: 'C3·C4', campos: [
        { id: 'oferta', pregunta: '¿Qué se ofrece y por qué se compra (diferenciador)?', tipo: 'parrafo', requeridoEn: E },
      ] },
      { id: 'catalogo', titulo: 'Catálogo de oferta', capas: 'C6',
        tabla: { tablaRef: 'productos', etiqueta: 'Catálogo de oferta', requeridoEn: E, disparadorCSV: 5,
          columnasContexto: [ { id: 'presentacion', etiqueta: 'Presentación/variante', tipo: 'texto' } ] } },
      { id: 'precios', titulo: 'Precios y condiciones', capas: 'C4·C6',
        tabla: { tablaRef: 'productos', etiqueta: 'Lista de precios', requeridoEn: S, disparadorCSV: 5,
          columnasContexto: [ { id: 'precio', etiqueta: 'Precio (PENDIENTE)', tipo: 'texto' }, { id: 'moneda', etiqueta: 'Moneda', tipo: 'texto' } ] } },
      { id: 'segmentos', titulo: 'Segmentos y clientes', capas: 'C5',
        tabla: { tablaRef: 'clientes', requeridoEn: S, disparadorCSV: 5,
          columnasContexto: [ { id: 'disposicionPago', etiqueta: 'Disposición a pagar', tipo: 'texto' } ] } },
      { id: 'canales', titulo: 'Canales', capas: 'C7',
        tabla: { tablaRef: 'canales', requeridoEn: S, disparadorCSV: 3, columnasContexto: [ { id: 'costo', etiqueta: 'Costo', tipo: 'texto' } ] } },
      { id: 'demanda', titulo: 'Demanda / Campañas', capas: 'C7',
        tabla: { tablaRef: 'campanas', requeridoEn: C, disparadorCSV: 5, columnasContexto: [ { id: 'presupuesto', etiqueta: 'Presupuesto', tipo: 'texto' } ] } },
    ],
  },

  CUL: {
    planoId: 'CUL', nombre: 'Cultural',
    lenguajeTecnico: 'Plano de baja carga (sin import masivo). Traduce a propósito, valores (máx 5), comportamientos observables, principios de decisión. No contradice META/EST/COM. No inventa comportamientos.',
    dependencias: ['META', 'EST'],
    contratoEntrega: { tipo: 'documento', descripcion: 'Documento cultural (propósito, valores, comportamientos).' },
    bloques: [
      { id: 'proposito', titulo: 'Propósito y narrativa', capas: 'C2', campos: [
        { id: 'narrativa', pregunta: '¿Cuál es el propósito y la narrativa fundacional?', tipo: 'parrafo', requeridoEn: E },
      ] },
      { id: 'valores', titulo: 'Valores', capas: 'C12', campos: [
        { id: 'valores', pregunta: '¿Cuáles son los valores (máx. 5)?', tipo: 'lista', requeridoEn: E },
      ] },
      { id: 'comportamientos', titulo: 'Comportamientos por valor', capas: 'C12', campos: [
        { id: 'comportamientos', pregunta: 'Por cada valor, ¿un comportamiento concreto y observable?', tipo: 'lista', requeridoEn: S },
      ] },
      { id: 'decision', titulo: 'Principios y estilo de decisión', capas: 'C2·C12', campos: [
        { id: 'principios', pregunta: '¿Principios de decisión y estilo (cómo se decide)?', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'limites', titulo: 'Límites y exclusiones', capas: 'C12', campos: [
        { id: 'limites', pregunta: '¿Qué NO se hace (fronteras de gobierno)?', tipo: 'lista', requeridoEn: C },
      ] },
    ],
  },

  ORG: {
    planoId: 'ORG', nombre: 'Organizacional',
    lenguajeTecnico: 'Produce ESTRUCTURA (no tareas/procesos). Roles humanos e IA son repetibles (tabla/CSV). Traduce a entidades, roles, autoridad, ACL. No inventa roles. No contradice META/EST/COM/CUL.',
    dependencias: ['META', 'EST'],
    contratoEntrega: { tipo: 'diagrama', descripcion: 'Organigrama / diagrama de estructura y autoridad.' },
    bloques: [
      { id: 'entidades', titulo: 'Entidades y espacios', capas: 'C9', campos: [
        { id: 'entidades', pregunta: '¿Qué entidades/espacios existen (workspace→área→equipo)?', tipo: 'parrafo', requeridoEn: E },
      ] },
      { id: 'roles', titulo: 'Roles humanos', capas: 'C11',
        tabla: { tablaRef: 'personas', etiqueta: 'Roles humanos', requeridoEn: E, disparadorCSV: 4,
          columnasContexto: [ { id: 'responsabilidades', etiqueta: 'Responsabilidades', tipo: 'texto' }, { id: 'autoridad', etiqueta: 'Autoridad/límites', tipo: 'texto' } ] } },
      { id: 'rolesIA', titulo: 'Roles IA', capas: 'C8·C11',
        tabla: { tablaRef: 'agentes', etiqueta: 'Roles IA', requeridoEn: S, disparadorCSV: 3,
          columnasContexto: [ { id: 'autonomia', etiqueta: 'Límite de autonomía', tipo: 'texto' }, { id: 'acl', etiqueta: 'ACL', tipo: 'texto' } ] } },
      { id: 'jerarquia', titulo: 'Jerarquía y autoridad', capas: 'C11', campos: [
        { id: 'jerarquia', pregunta: '¿Líneas de reporte y quién decide/recomienda/ejecuta/bloquea?', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'fronteras', titulo: 'Fronteras y evolución', capas: 'C9·C11', campos: [
        { id: 'fronteras', pregunta: '¿Separación CPF↔clientes, Diseñador↔Operador, reglas de evolución?', tipo: 'parrafo', requeridoEn: C },
      ] },
    ],
  },

  OPE: {
    planoId: 'OPE', nombre: 'Operativo',
    lenguajeTecnico: 'Define CÓMO se ejecuta (no el paso a paso, eso es PRO). Ejecutores/entornos repetibles. Traduce a ciclo, asignación humano/IA/mixto, estados. Validación/aprobación siempre humanas.',
    dependencias: ['META', 'EST', 'ORG'],
    contratoEntrega: { tipo: 'documento', descripcion: 'Documento operativo (ciclo, ejecutores, estados).' },
    bloques: [
      { id: 'ciclo', titulo: 'Modelo y ciclo', capas: 'C8·C13', campos: [
        { id: 'ciclo', pregunta: '¿Cuál es el principio operativo y las etapas del ciclo (entradas/salidas)?', tipo: 'parrafo', requeridoEn: E },
      ] },
      { id: 'ejecutores', titulo: 'Roles y entornos operativos', capas: 'C8·C10',
        tabla: { tablaRef: 'personas', etiqueta: 'Ejecutores por etapa', requeridoEn: S, disparadorCSV: 4,
          columnasContexto: [ { id: 'etapa', etiqueta: 'Etapa', tipo: 'texto' }, { id: 'tipoEjecutor', etiqueta: 'Tipo (humano/IA/mixto)', tipo: 'opcion', opciones: ['humano', 'IA', 'mixto'] } ] } },
      { id: 'flujos', titulo: 'Flujos y handoffs', capas: 'C13', campos: [
        { id: 'handoffs', pregunta: '¿Handoffs entre roles, ritmos y rituales?', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'estados', titulo: 'Estados y excepciones', capas: 'C13', campos: [
        { id: 'estados', pregunta: '¿Estados operativos y manejo de bloqueo/cancelación/rollback?', tipo: 'parrafo', requeridoEn: C },
      ] },
    ],
  },

  PRO: {
    planoId: 'PRO', nombre: 'Procesos',
    lenguajeTecnico: 'Define PASO A PASO (no tecnología/costos). Procesos y pasos son repetibles (tabla/CSV). Todo proceso auditable, repetible y versionable. No contradice OPE.',
    dependencias: ['OPE'],
    contratoEntrega: { tipo: 'diagrama', descripcion: 'Diagrama de flujo de procesos paso a paso.' },
    bloques: [
      { id: 'mapa', titulo: 'Mapa y jerarquía', capas: 'C13', campos: [
        { id: 'mapa', pregunta: '¿Cuáles son los macroprocesos y procesos principales?', tipo: 'lista', requeridoEn: E },
      ] },
      { id: 'contrato', titulo: 'Contrato del proceso', capas: 'C13',
        tabla: { tablaRef: 'procesos', requeridoEn: E, disparadorCSV: 3,
          columnasContexto: [ { id: 'estados', etiqueta: 'Estados', tipo: 'texto' } ] } },
      { id: 'pasos', titulo: 'Pasos y decisiones', capas: 'C13',
        tabla: { tablaRef: 'pasos', requeridoEn: S, disparadorCSV: 6,
          columnasContexto: [ { id: 'decision', etiqueta: 'Punto de decisión/rama', tipo: 'texto' }, { id: 'tiempo', etiqueta: 'Tiempo estimado', tipo: 'texto' } ] } },
      { id: 'calidad', titulo: 'Calidad y evidencias', capas: 'C13', campos: [
        { id: 'calidad', pregunta: '¿Criterio de calidad por salida y evidencia/registro?', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'versionado', titulo: 'Versionado y auditoría', capas: 'C13', campos: [
        { id: 'versionado', pregunta: '¿Cómo se versiona y audita el proceso (append-only)?', tipo: 'parrafo', requeridoEn: C },
      ] },
    ],
  },

  TEC: {
    planoId: 'TEC', nombre: 'Tecnológico',
    lenguajeTecnico: 'Produce DISEÑO (capacidades/componentes/contratos/estados), no implementación. Componentes repetibles; cada uno declara sustitución y estados de apagado. Stack/proveedor = referencia (LOCK aparte).',
    dependencias: ['PRO'],
    contratoEntrega: { tipo: 'documento', descripcion: 'Documento de diseño técnico (componentes y contratos).' },
    bloques: [
      { id: 'principio', titulo: 'Principio y capacidades', capas: 'C8·C14', campos: [
        { id: 'capacidades', pregunta: '¿Qué capacidades tecnológicas requieren los procesos (PRO manda, TEC soporta)?', tipo: 'lista', requeridoEn: E },
      ] },
      { id: 'componentes', titulo: 'Componentes y contratos', capas: 'C14',
        tabla: { tablaRef: 'componentes', requeridoEn: E, disparadorCSV: 4,
          columnasContexto: [ { id: 'entradaSalida', etiqueta: 'Entrada/Salida', tipo: 'texto' } ] } },
      { id: 'datos', titulo: 'Multi-tenant y datos', capas: 'C14', campos: [
        { id: 'datos', pregunta: '¿Jerarquía de aislamiento y dominios de datos (source of truth)?', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'seguridad', titulo: 'Seguridad, ACL y auditoría', capas: 'C10·C14', campos: [
        { id: 'seguridad', pregunta: '¿authn/authz, ACL N2–N6 y observabilidad conceptual?', tipo: 'parrafo', requeridoEn: C },
      ] },
    ],
  },

  IA: {
    planoId: 'IA', nombre: 'IA',
    lenguajeTecnico: 'Produce DISEÑO de agentes (no agentes en runtime). Cada agente es repetible (ficha). Agente⇏Runtime; validación nunca 100% IA; toda memoria gobernada; todo agente apagable.',
    dependencias: ['TEC', 'ORG'],
    contratoEntrega: { tipo: 'documento', descripcion: 'Documento de diseño de agentes (fichas + autonomía + memoria).' },
    bloques: [
      { id: 'principio', titulo: 'Principio y tipos', capas: 'C14·C10', campos: [
        { id: 'principio', pregunta: '¿Principio de IA y tipos de agente por función y autonomía?', tipo: 'parrafo', requeridoEn: E },
      ] },
      { id: 'agentes', titulo: 'Ficha de agente', capas: 'C10',
        tabla: { tablaRef: 'agentes', etiqueta: 'Fichas de agente', requeridoEn: E, disparadorCSV: 3,
          columnasContexto: [ { id: 'scope', etiqueta: 'Scope', tipo: 'texto' }, { id: 'permisos', etiqueta: 'Permisos (ACL)', tipo: 'texto' }, { id: 'apagado', etiqueta: 'Modo de apagado', tipo: 'texto' } ] } },
      { id: 'autonomia', titulo: 'Autonomía y supervisión', capas: 'C10', campos: [
        { id: 'autonomia', pregunta: '¿Modos (off/shadow/asistente/copiloto/autónomo) y umbral de escalamiento?', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'memoria', titulo: 'Memoria y contexto', capas: 'C14', campos: [
        { id: 'memoria', pregunta: '¿Qué recuerda, dónde vive, quién la ve y cómo se borra?', tipo: 'parrafo', requeridoEn: C },
      ] },
    ],
  },

  FIN: {
    planoId: 'FIN', nombre: 'Financiero',
    lenguajeTecnico: 'Produce ESTRUCTURA económica, NO cifras. Toda cifra → PENDIENTE (DATO_REAL / DECISION_PROPIETARIO / ASESOR_FISCAL). Ingresos y costos repetibles. ACL N4 (el más protegido).',
    dependencias: ['META', 'COM'],
    contratoEntrega: { tipo: 'tabla', descripcion: 'Tablas/modelo financiero (estructura, cifras = PENDIENTE).' },
    bloques: [
      { id: 'modelo', titulo: 'Modelo económico', capas: 'C15', campos: [
        { id: 'modelo', pregunta: '¿Centros de utilidad (externos) vs centros de costo (internos)?', tipo: 'parrafo', requeridoEn: E },
      ] },
      { id: 'ingresos', titulo: 'Ingresos y oferta', capas: 'C6·C15',
        tabla: { tablaRef: 'ingresos', requeridoEn: E, disparadorCSV: 3, columnasContexto: [ { id: 'precio', etiqueta: 'Precio (PENDIENTE)', tipo: 'texto' } ] } },
      { id: 'costos', titulo: 'Costos y gastos', capas: 'C15',
        tabla: { tablaRef: 'costos', requeridoEn: E, disparadorCSV: 4, columnasContexto: [ { id: 'monto', etiqueta: 'Monto (PENDIENTE_DATO_REAL)', tipo: 'texto' } ] } },
      { id: 'margenes', titulo: 'Márgenes y comisiones', capas: 'C4·C15', campos: [
        { id: 'margenes', pregunta: '¿Margen por actividad y reparto CPF↔operadora? (% → PENDIENTE)', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'fiscal', titulo: 'Transfer pricing y P&L', capas: 'C15', campos: [
        { id: 'fiscal', pregunta: '¿Política de transfer pricing y estructura P&L? (→ PENDIENTE_ASESOR_FISCAL)', tipo: 'parrafo', requeridoEn: C },
      ] },
    ],
  },

  CTR: {
    planoId: 'CTR', nombre: 'Control',
    lenguajeTecnico: 'Produce MODELO de medición, no dashboards reales (KPI-1: el OS publica, CTR no calcula). KPIs/métricas repetibles. Toda meta/umbral → PENDIENTE. ACL N4.',
    dependencias: ['META', 'OPE'],
    contratoEntrega: { tipo: 'dashboard', descripcion: 'Modelo de dashboard de KPIs (metas = PENDIENTE).' },
    bloques: [
      { id: 'modelo', titulo: 'Modelo de control', capas: 'C16', campos: [
        { id: 'modelo', pregunta: '¿Qué se mide y bajo qué regla (KPI-1: OS publica, Widget presenta)?', tipo: 'parrafo', requeridoEn: E },
      ] },
      { id: 'kpis', titulo: 'KPIs maestros', capas: 'C16',
        tabla: { tablaRef: 'kpis', etiqueta: 'KPIs maestros', requeridoEn: E, disparadorCSV: 4,
          columnasContexto: [ { id: 'meta', etiqueta: 'Meta (PENDIENTE)', tipo: 'texto' } ] } },
      { id: 'metricas', titulo: 'Métricas por capa', capas: 'C16',
        tabla: { tablaRef: 'kpis', etiqueta: 'Métricas por capa', requeridoEn: S, disparadorCSV: 6,
          columnasContexto: [ { id: 'capa', etiqueta: 'Capa (plano/proceso/rol/IA)', tipo: 'texto' } ] } },
      { id: 'umbrales', titulo: 'Umbrales y semáforos', capas: 'C16', campos: [
        { id: 'umbrales', pregunta: '¿Cortes verde/amarillo/rojo por métrica? (→ PENDIENTE)', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'cadencia', titulo: 'Cadencia y responsables', capas: 'C11·C16', campos: [
        { id: 'cadencia', pregunta: '¿Frecuencia de revisión, dueño por KPI y fuente de dato?', tipo: 'parrafo', requeridoEn: C },
      ] },
    ],
  },

  IMP: {
    planoId: 'IMP', nombre: 'Implementación',
    lenguajeTecnico: 'Produce ARQUITECTURA de implementación, no construcción/BUILD. Hitos/fases repetibles. Toda fecha/cifra/responsable → PENDIENTE. IMP planea, BUILD construye, ESC escala.',
    dependencias: ['META', 'EST'],
    contratoEntrega: { tipo: 'documento', descripcion: 'Roadmap de implementación (fechas = PENDIENTE).' },
    bloques: [
      { id: 'fases', titulo: 'Modelo y fases', capas: 'C17', campos: [
        { id: 'fases', pregunta: '¿Cuál es el principio de implementación y las fases en orden?', tipo: 'parrafo', requeridoEn: E },
      ] },
      { id: 'hitos', titulo: 'Hitos y criterios', capas: 'C17',
        tabla: { tablaRef: 'hitos', requeridoEn: E, disparadorCSV: 4,
          columnasContexto: [ { id: 'criterioEntrada', etiqueta: 'Criterio de entrada', tipo: 'texto' } ] } },
      { id: 'dependencias', titulo: 'Dependencias y secuencia', capas: 'C17', campos: [
        { id: 'dependencias', pregunta: '¿Qué requiere qué (secuencia entre fases/planos)?', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'recursos', titulo: 'Responsables y recursos', capas: 'C11·C17', campos: [
        { id: 'recursos', pregunta: '¿Dueño por fase y recursos (fechas/personas → PENDIENTE)?', tipo: 'parrafo', requeridoEn: C },
      ] },
    ],
  },

  ESC: {
    planoId: 'ESC', nombre: 'Escalamiento',
    lenguajeTecnico: 'Produce ARQUITECTURA de escalamiento, no escala real. Unidad de escala/fases repetibles. Escalar ≠ crecer directo; el crecimiento nunca rompe la base (Nivel B). Cifras → PENDIENTE.',
    dependencias: ['IMP'],
    contratoEntrega: { tipo: 'documento', descripcion: 'Documento de escalamiento (unidad, fases, límites).' },
    bloques: [
      { id: 'unidad', titulo: 'Principio y unidad', capas: 'C17', campos: [
        { id: 'unidad', pregunta: '¿Cuál es la unidad de escalamiento (qué replica) y el modelo de replicación?', tipo: 'parrafo', requeridoEn: E },
      ] },
      { id: 'fases', titulo: 'Fases y disparadores', capas: 'C17',
        tabla: { tablaRef: 'unidades', requeridoEn: E, disparadorCSV: 3, columnasContexto: [ { id: 'fase', etiqueta: 'Fase', tipo: 'texto' } ] } },
      { id: 'criterios', titulo: 'Criterios de escala segura', capas: 'C17', campos: [
        { id: 'criterios', pregunta: '¿Cuándo es seguro escalar (checklist de pre-escala)?', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'limites', titulo: 'Límites de expansión', capas: 'C17', campos: [
        { id: 'limites', pregunta: '¿Límite blando/duro, federación vs partición?', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'antifragil', titulo: 'Anti-fragilidad y recuperación', capas: 'C17', campos: [
        { id: 'antifragil', pregunta: '¿Cómo se fortalece bajo estrés (rollback/degradación/recuperación)?', tipo: 'parrafo', requeridoEn: C },
      ] },
    ],
  },

  MKT: {
    planoId: 'MKT', nombre: 'Marketing',
    lenguajeTecnico: 'Marketing ATRAE (Comercial vende, es otro plano). Produce investigación ANTROPOLÓGICA (no demografía), calendario de campañas y laboratorio de mercado (hipótesis→experimento→decisión, antes de gastar). Datos repetitivos por tabla. No inventa hallazgos. No contradice META/EST/COM.',
    dependencias: ['COM'],
    contratoEntrega: { tipo: 'documento', descripcion: 'Investigación antropológica + calendario de campañas + laboratorio de mercado.' },
    bloques: [
      { id: 'antropologia', titulo: 'Investigación antropológica', capas: 'C5', campos: [
        { id: 'cultura', pregunta: '¿Costumbres, lenguaje, creencias y símbolos del público (no demografía)?', tipo: 'parrafo', requeridoEn: E },
        { id: 'aspiraciones', pregunta: '¿Aspiraciones, miedos y estatus que mueven la compra?', tipo: 'parrafo', requeridoEn: E },
        { id: 'referencias', pregunta: '¿Influencers, música, referencias culturales y estacionalidad?', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'hallazgos', titulo: 'Hallazgos de investigación', capas: 'C5',
        tabla: { tablaRef: 'investigacion', requeridoEn: S, disparadorCSV: 5,
          columnasContexto: [ { id: 'implicacion', etiqueta: 'Implicación de marketing', tipo: 'texto' } ] } },
      { id: 'calendario', titulo: 'Campañas y calendario', capas: 'C7',
        tabla: { tablaRef: 'campanas', etiqueta: 'Calendario de campañas', requeridoEn: S, disparadorCSV: 4,
          columnasContexto: [ { id: 'canal', etiqueta: 'Canal', tipo: 'texto' }, { id: 'objetivo', etiqueta: 'Objetivo / KPI', tipo: 'texto' }, { id: 'fecha', etiqueta: 'Fecha / Temporada', tipo: 'texto' } ] } },
      { id: 'laboratorio', titulo: 'Laboratorio de mercado', capas: 'C5·C7',
        tabla: { tablaRef: 'experimentos', requeridoEn: C, disparadorCSV: 3,
          columnasContexto: [ { id: 'presupuesto', etiqueta: 'Presupuesto', tipo: 'texto' }, { id: 'resultado', etiqueta: 'Resultado / Decisión', tipo: 'texto' } ] } },
    ],
  },

  RH: {
    planoId: 'RH', nombre: 'Recursos Humanos',
    lenguajeTecnico: 'Profundiza la GENTE sobre la estructura de ORG. Produce el manual del empleado y el ciclo de vida completo: descripción de puesto, contratación (entrevistas/pruebas), onboarding, capacitación, evaluación, bonos, carrera, sucesión y offboarding/despido. La PLANTILLA (personas dadas de alta con su departamento, roles, procesos, nómina y KPIs) se captura en la superficie "Personas & RH" y proyecta la tabla de puestos. No inventa personas. No contradice ORG/CUL.',
    dependencias: ['ORG'],
    contratoEntrega: { tipo: 'documento', descripcion: 'Manual del empleado + descripciones de puesto + ciclo de vida (contratación→onboarding→capacitación→evaluación→salida).' },
    bloques: [
      { id: 'manual', titulo: 'Manual del empleado', capas: 'C11·C12', campos: [
        { id: 'manual', pregunta: '¿Reglas de convivencia, horarios, código de conducta y de imagen del empleado?', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'puestos', titulo: 'Descripciones de puesto (plantilla)', capas: 'C11',
        tabla: { tablaRef: 'puestos', etiqueta: 'Puestos y ocupantes', requeridoEn: E, disparadorCSV: 3,
          columnasContexto: [
            { id: 'competencias', etiqueta: 'Competencias clave', tipo: 'texto' },
            { id: 'kpis', etiqueta: 'KPIs del puesto', tipo: 'texto' },
            { id: 'ocupantes', etiqueta: 'Personas en el puesto', tipo: 'texto' },
          ] } },
      { id: 'contratacion', titulo: 'Contratación', capas: 'C11', campos: [
        { id: 'reclutamiento', pregunta: '¿Cómo se recluta y selecciona? (fuentes, entrevistas y pruebas)', tipo: 'parrafo', requeridoEn: E },
        { id: 'onboarding', pregunta: '¿Cómo es el onboarding de los primeros 30 días?', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'capacitacion', titulo: 'Capacitación', capas: 'C11', campos: [
        { id: 'capacitacion', pregunta: '¿Qué capacitación reciben (inicial y continua) y cómo se certifica?', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'desarrollo', titulo: 'Evaluación, bonos y carrera', capas: 'C11', campos: [
        { id: 'evaluacion', pregunta: '¿Cómo se evalúa el desempeño y qué bonos/incentivos hay?', tipo: 'parrafo', requeridoEn: S },
        { id: 'carrera', pregunta: '¿Plan de carrera y sucesión de los puestos clave?', tipo: 'parrafo', requeridoEn: C },
      ] },
      { id: 'salida', titulo: 'Salida y offboarding', capas: 'C11', campos: [
        { id: 'offboarding', pregunta: '¿Proceso de salida/despido, finiquito, traspaso y baja de accesos?', tipo: 'parrafo', requeridoEn: C },
      ] },
    ],
  },

  ARQ: {
    planoId: 'ARQ', nombre: 'Arquitectónico',
    lenguajeTecnico: 'Produce el BRIEF para un arquitecto (casa de muñecas): distribución, relaciones entre áreas y flujo de personas — NO diseño ni renders. "Necesito un edificio con estas cajas." Ambientes repetibles (tabla). Traduce operación (OPE/PRO) a requisitos de espacio. No contradice OPE.',
    dependencias: ['OPE', 'ORG'],
    contratoEntrega: { tipo: 'diagrama', descripcion: 'Casa de muñecas: distribución, relaciones entre áreas y flujo de personas (sin diseño/renders).' },
    bloques: [
      { id: 'flujo', titulo: 'Flujo y prioridades', capas: 'C9', campos: [
        { id: 'recorrido', pregunta: '¿Cuál es el recorrido de las personas (secuencia de espacios de entrada a salida)?', tipo: 'parrafo', requeridoEn: E },
        { id: 'prioridades', pregunta: '¿Qué áreas son críticas y cuáles pueden ser chicas o compartidas?', tipo: 'parrafo', requeridoEn: S },
      ] },
      { id: 'ambientes', titulo: 'Programa de ambientes', capas: 'C9',
        tabla: { tablaRef: 'ambientes', requeridoEn: E, disparadorCSV: 4,
          columnasContexto: [ { id: 'm2', etiqueta: 'Tamaño aprox (m²)', tipo: 'texto' }, { id: 'requisitos', etiqueta: 'Instalaciones / clima / acabados', tipo: 'texto' } ] } },
      { id: 'restricciones', titulo: 'Restricciones e instalaciones', capas: 'C9', campos: [
        { id: 'restricciones', pregunta: '¿Restricciones del inmueble/normativa e instalaciones especiales (agua, gas, extracción, energía)?', tipo: 'parrafo', requeridoEn: S },
      ] },
    ],
  },

  JUR: {
    planoId: 'JUR', nombre: 'Jurídico',
    lenguajeTecnico: 'Produce el CHECKLIST y borradores legales (constitución, contratos, PI, permisos, políticas), NO asesoría vinculante. Todo dictamen/riesgo → PENDIENTE_ASESOR_LEGAL. Documentos repetibles (tabla). No contradice META.',
    dependencias: ['META'],
    contratoEntrega: { tipo: 'documento', descripcion: 'Checklist legal: constitución, contratos, PI, permisos y políticas (borradores + PENDIENTE asesor).' },
    bloques: [
      { id: 'constitucion', titulo: 'Constitución y fiscal', capas: 'C10', campos: [
        { id: 'figura', pregunta: '¿Figura legal, socios y % de participación?', tipo: 'parrafo', requeridoEn: E },
        { id: 'obligaciones', pregunta: '¿Obligaciones fiscales y permisos del giro?', tipo: 'parrafo', requeridoEn: E },
      ] },
      { id: 'documentos', titulo: 'Documentos y permisos', capas: 'C10',
        tabla: { tablaRef: 'legales', requeridoEn: E, disparadorCSV: 4,
          columnasContexto: [ { id: 'estado', etiqueta: 'Estado', tipo: 'opcion', opciones: ['pendiente', 'borrador', 'firmado'] } ] } },
      { id: 'riesgos', titulo: 'Riesgos legales', capas: 'C10', campos: [
        { id: 'riesgos', pregunta: '¿Riesgos legales y cómo mitigarlos? (dictamen → PENDIENTE_ASESOR_LEGAL)', tipo: 'parrafo', requeridoEn: S },
      ] },
    ],
  },

  INV: {
    planoId: 'INV', nombre: 'Inversionista',
    lenguajeTecnico: 'Produce el documento para un fondo (deck): problema, solución, mercado, uso del dinero, proyección y salida. Es un plano DERIVADO (integra META+COM+FIN); no re-captura lo que ya vive en ellos. Toda cifra/valuación → PENDIENTE. ACL N4.',
    dependencias: ['META', 'FIN', 'COM'],
    contratoEntrega: { tipo: 'documento', descripcion: 'Documento de inversión (deck): problema, solución, mercado, uso del dinero, proyección y salida (cifras = PENDIENTE).' },
    bloques: [
      { id: 'tesis', titulo: 'Tesis de inversión', capas: 'C15', campos: [
        { id: 'problema', pregunta: '¿Problema, solución y por qué ahora?', tipo: 'parrafo', requeridoEn: E },
        { id: 'mercado', pregunta: '¿Tamaño de mercado y ventaja competitiva difícil de replicar?', tipo: 'parrafo', requeridoEn: E },
      ] },
      { id: 'rondas', titulo: 'Uso del dinero', capas: 'C15',
        tabla: { tablaRef: 'rondas', requeridoEn: E, disparadorCSV: 2,
          columnasContexto: [ { id: 'monto', etiqueta: 'Monto (PENDIENTE)', tipo: 'texto' } ] } },
      { id: 'retorno', titulo: 'Proyección y salida', capas: 'C15', campos: [
        { id: 'proyeccion', pregunta: '¿Proyección y camino a rentabilidad? (cifras → PENDIENTE_DATO_REAL)', tipo: 'parrafo', requeridoEn: S },
        { id: 'salida', pregunta: '¿Estrategia de salida del inversionista, valuación y dilución? (→ PENDIENTE)', tipo: 'parrafo', requeridoEn: C },
      ] },
    ],
  },
};

export function especialista(planoId: string): EspecialistaConfig | undefined {
  return ESPECIALISTAS[planoId];
}

// Aristas campo↔campo entre planos (para el grafo): dependencias declaradas.
export function aristasPlanos(): { de: string; a: string }[] {
  const aristas: { de: string; a: string }[] = [];
  for (const cfg of Object.values(ESPECIALISTAS)) {
    for (const dep of cfg.dependencias) aristas.push({ de: dep, a: cfg.planoId });
  }
  return aristas;
}
