// Tablas Maestras compartidas (Decisión 5 de AGENT_ARCHITECTURE_V1).
// Una tabla NO pertenece a un especialista: vive en el proyecto y se REUSA entre varios.
// Cada especialista la consume con su VISTA (columnas de contexto, en especialistas.ts).
// Genérico: agregar una tabla = config, no código (FORM_REPEATABLE_ARCHITECTURE.md).

export type TipoColumna = 'texto' | 'numero' | 'opcion' | 'booleano';

export interface Columna {
  id: string;
  etiqueta: string;
  tipo: TipoColumna;
  requerido?: boolean;
  opciones?: string[]; // para tipo 'opcion'
}

export interface TablaBase {
  ref: string;        // identificador reutilizable (productos, personas, …)
  nombre: string;     // etiqueta visible
  llave: string;      // columna llave para upsert en round-trip (dedupe)
  columnas: Columna[]; // columnas base compartidas
}

// Registro de tablas maestras base. Los especialistas referencian por `ref` y añaden contexto.
export const TABLAS_BASE: Record<string, TablaBase> = {
  productos: {
    ref: 'productos', nombre: 'Productos / Oferta', llave: 'sku',
    columnas: [
      { id: 'sku', etiqueta: 'SKU', tipo: 'texto', requerido: true },
      { id: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
      { id: 'categoria', etiqueta: 'Categoría', tipo: 'texto', requerido: true },
    ],
  },
  clientes: {
    ref: 'clientes', nombre: 'Clientes / Segmentos', llave: 'nombre',
    columnas: [
      { id: 'nombre', etiqueta: 'Cliente', tipo: 'texto', requerido: true },
      { id: 'segmento', etiqueta: 'Segmento', tipo: 'texto' },
      { id: 'contacto', etiqueta: 'Contacto', tipo: 'texto' },
    ],
  },
  canales: {
    ref: 'canales', nombre: 'Canales', llave: 'canal',
    columnas: [
      { id: 'canal', etiqueta: 'Canal', tipo: 'texto', requerido: true },
      { id: 'tipo', etiqueta: 'Tipo', tipo: 'texto' },
      { id: 'prioridad', etiqueta: 'Prioridad', tipo: 'opcion', opciones: ['alta', 'media', 'baja'] },
    ],
  },
  campanas: {
    ref: 'campanas', nombre: 'Campañas', llave: 'campana',
    columnas: [
      { id: 'campana', etiqueta: 'Campaña', tipo: 'texto', requerido: true },
      { id: 'publico', etiqueta: 'Público', tipo: 'texto' },
      { id: 'mensaje', etiqueta: 'Mensaje', tipo: 'texto' },
    ],
  },
  personas: {
    ref: 'personas', nombre: 'Personas / Roles', llave: 'rol',
    columnas: [
      { id: 'rol', etiqueta: 'Rol', tipo: 'texto', requerido: true },
      { id: 'persona', etiqueta: 'Persona', tipo: 'texto' },
      { id: 'area', etiqueta: 'Área', tipo: 'texto' },
      { id: 'reportaA', etiqueta: 'Reporta a', tipo: 'texto' },
    ],
  },
  agentes: {
    ref: 'agentes', nombre: 'Agentes IA', llave: 'nombre',
    columnas: [
      { id: 'nombre', etiqueta: 'Agente', tipo: 'texto', requerido: true },
      { id: 'capability', etiqueta: 'Capacidad', tipo: 'texto', requerido: true },
      { id: 'categoria', etiqueta: 'Categoría', tipo: 'texto' },
    ],
  },
  componentes: {
    ref: 'componentes', nombre: 'Componentes técnicos', llave: 'componente',
    columnas: [
      { id: 'componente', etiqueta: 'Componente', tipo: 'texto', requerido: true },
      { id: 'contrato', etiqueta: 'Contrato/Interfaz', tipo: 'texto' },
      { id: 'sustitucion', etiqueta: 'Sustitución', tipo: 'texto' },
    ],
  },
  procesos: {
    ref: 'procesos', nombre: 'Procesos', llave: 'proceso',
    columnas: [
      { id: 'proceso', etiqueta: 'Proceso', tipo: 'texto', requerido: true },
      { id: 'entrada', etiqueta: 'Entrada', tipo: 'texto' },
      { id: 'salida', etiqueta: 'Salida', tipo: 'texto' },
      { id: 'responsable', etiqueta: 'Responsable', tipo: 'texto' },
    ],
  },
  pasos: {
    ref: 'pasos', nombre: 'Pasos de proceso', llave: 'paso',
    columnas: [
      { id: 'proceso', etiqueta: 'Proceso', tipo: 'texto', requerido: true },
      { id: 'paso', etiqueta: 'Paso', tipo: 'texto', requerido: true },
      { id: 'ejecutor', etiqueta: 'Ejecutor', tipo: 'texto' },
    ],
  },
  ingresos: {
    ref: 'ingresos', nombre: 'Fuentes de ingreso', llave: 'fuente',
    columnas: [
      { id: 'fuente', etiqueta: 'Fuente / Paquete', tipo: 'texto', requerido: true },
      { id: 'centro', etiqueta: 'Centro de ingreso', tipo: 'texto' },
    ],
  },
  costos: {
    ref: 'costos', nombre: 'Costos y gastos', llave: 'concepto',
    columnas: [
      { id: 'concepto', etiqueta: 'Concepto', tipo: 'texto', requerido: true },
      { id: 'tipo', etiqueta: 'Tipo', tipo: 'opcion', opciones: ['costo', 'gasto'] },
      { id: 'centro', etiqueta: 'Centro de costo', tipo: 'texto' },
    ],
  },
  kpis: {
    ref: 'kpis', nombre: 'KPIs / Métricas', llave: 'kpi',
    columnas: [
      { id: 'kpi', etiqueta: 'KPI / Métrica', tipo: 'texto', requerido: true },
      { id: 'dueno', etiqueta: 'Dueño', tipo: 'texto' },
      { id: 'frecuencia', etiqueta: 'Frecuencia', tipo: 'texto' },
      { id: 'fuente', etiqueta: 'Fuente de dato', tipo: 'texto' },
    ],
  },
  hitos: {
    ref: 'hitos', nombre: 'Hitos / Fases', llave: 'hito',
    columnas: [
      { id: 'fase', etiqueta: 'Fase', tipo: 'texto', requerido: true },
      { id: 'hito', etiqueta: 'Hito', tipo: 'texto', requerido: true },
      { id: 'criterioSalida', etiqueta: 'Criterio de salida', tipo: 'texto' },
    ],
  },
  unidades: {
    ref: 'unidades', nombre: 'Unidades de escala', llave: 'unidad',
    columnas: [
      { id: 'unidad', etiqueta: 'Unidad de escala', tipo: 'texto', requerido: true },
      { id: 'disparador', etiqueta: 'Disparador', tipo: 'texto' },
      { id: 'limite', etiqueta: 'Límite', tipo: 'texto' },
    ],
  },
  // --- Tablas maestras de los planos nuevos (ARQ/RH/MKT/JUR/INV). Mismo patrón:
  //     el dato se teclea UNA vez y cada plano lo lee con su vista (columnasContexto). ---
  ambientes: {
    ref: 'ambientes', nombre: 'Programa de ambientes', llave: 'ambiente',
    columnas: [
      { id: 'ambiente', etiqueta: 'Ambiente / Espacio', tipo: 'texto', requerido: true },
      { id: 'objetivo', etiqueta: 'Objetivo del espacio', tipo: 'texto' },
      { id: 'adyacencias', etiqueta: 'Conecta con', tipo: 'texto' },
    ],
  },
  puestos: {
    ref: 'puestos', nombre: 'Puestos / Descripciones', llave: 'puesto',
    columnas: [
      { id: 'puesto', etiqueta: 'Puesto', tipo: 'texto', requerido: true },
      { id: 'mision', etiqueta: 'Misión del puesto', tipo: 'texto' },
      { id: 'reportaA', etiqueta: 'Reporta a', tipo: 'texto' },
    ],
  },
  legales: {
    ref: 'legales', nombre: 'Documentos legales', llave: 'documento',
    columnas: [
      { id: 'documento', etiqueta: 'Documento / Acto', tipo: 'texto', requerido: true },
      { id: 'tipo', etiqueta: 'Tipo', tipo: 'opcion', opciones: ['constitución', 'contrato', 'permiso', 'PI', 'política', 'otro'] },
      { id: 'responsable', etiqueta: 'Responsable', tipo: 'texto' },
    ],
  },
  investigacion: {
    ref: 'investigacion', nombre: 'Investigación de mercado', llave: 'hallazgo',
    columnas: [
      { id: 'hallazgo', etiqueta: 'Hallazgo', tipo: 'texto', requerido: true },
      { id: 'categoria', etiqueta: 'Categoría', tipo: 'opcion', opciones: ['costumbre', 'lenguaje', 'aspiración', 'miedo', 'símbolo', 'referencia', 'otro'] },
      { id: 'fuente', etiqueta: 'Fuente / Evidencia', tipo: 'texto' },
    ],
  },
  experimentos: {
    ref: 'experimentos', nombre: 'Laboratorio de mercado', llave: 'experimento',
    columnas: [
      { id: 'experimento', etiqueta: 'Experimento', tipo: 'texto', requerido: true },
      { id: 'hipotesis', etiqueta: 'Hipótesis', tipo: 'texto' },
      { id: 'metrica', etiqueta: 'Métrica de éxito', tipo: 'texto' },
    ],
  },
  rondas: {
    ref: 'rondas', nombre: 'Rondas y uso del capital', llave: 'ronda',
    columnas: [
      { id: 'ronda', etiqueta: 'Ronda / Tramo', tipo: 'texto', requerido: true },
      { id: 'uso', etiqueta: 'Uso del dinero', tipo: 'texto' },
      { id: 'hito', etiqueta: 'Hito que desbloquea', tipo: 'texto' },
    ],
  },
};

export function tablaBase(ref: string): TablaBase | undefined {
  return TABLAS_BASE[ref];
}
