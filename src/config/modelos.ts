// Config central de modelos por agente (un solo lugar para tunear costo/calidad).
// Estrategia de costo (AGENT_ARCHITECTURE_V1, Decisiones 2-3):
//   - Curador y Especialistas: Sonnet 4.6 (extracción estructurada confiable + tool use).
//   - Coordinador: Haiku 4.5 (solo redacta avance; la lógica es determinista).
// Para subir calidad en el futuro, cambia el valor del rol a 'claude-opus-4-8' (o
// 'claude-fable-5' cuando vuelva a estar disponible) — es una línea, sin tocar los agentes.

export type ModeloClaude =
  | 'claude-haiku-4-5'
  | 'claude-sonnet-4-6'
  | 'claude-opus-4-8'
  | 'claude-fable-5'; // NOTA: Fable está SUSPENDIDO en la consola (jun 2026); requiere manejo aparte (thinking siempre activo, refusal). No usar aún.

export type RolAgente = 'curador' | 'coordinador' | 'especialista';

// Modelo por rol. Cambia aquí para subir/bajar de tier por agente.
export const MODELOS: Record<RolAgente, ModeloClaude> = {
  curador: 'claude-sonnet-4-6',
  coordinador: 'claude-haiku-4-5',
  especialista: 'claude-sonnet-4-6',
};

// Override por variable de entorno (opcional): BP_MODELO_CURADOR, BP_MODELO_COORDINADOR, BP_MODELO_ESPECIALISTA.
function fromEnv(rol: RolAgente): ModeloClaude | undefined {
  const v = process.env[`BP_MODELO_${rol.toUpperCase()}`];
  return v ? (v as ModeloClaude) : undefined;
}

export function modeloDe(rol: RolAgente): ModeloClaude {
  return fromEnv(rol) ?? MODELOS[rol];
}

// Catálogo de modelos elegibles en el panel (etiqueta + si está habilitado).
// Vive aquí (módulo plano) para poder importarse tanto en server como en cliente.
export interface OpcionModelo { id: ModeloClaude; etiqueta: string; habilitado: boolean }
export const MODELOS_DISPONIBLES: OpcionModelo[] = [
  { id: 'claude-haiku-4-5', etiqueta: 'Haiku 4.5 · más barato ($1/$5)', habilitado: true },
  { id: 'claude-sonnet-4-6', etiqueta: 'Sonnet 4.6 · equilibrado ($3/$15)', habilitado: true },
  { id: 'claude-opus-4-8', etiqueta: 'Opus 4.8 · máxima calidad ($5/$25)', habilitado: true },
  { id: 'claude-fable-5', etiqueta: 'Fable 5 · (suspendido — no disponible)', habilitado: false },
];

export const ETIQUETA_ROL: Record<RolAgente, { nombre: string; nota: string }> = {
  curador: { nombre: 'Curador (workspace)', nota: 'entiende la idea y diagnostica proyectos' },
  coordinador: { nombre: 'Coordinador (proyecto)', nota: 'resume avance; la lógica es por reglas' },
  especialista: { nombre: 'Especialistas (planos)', nota: 'capturan y traducen a campos; alto volumen' },
};
