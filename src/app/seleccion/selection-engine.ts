// MOTOR DE SELECCIÓN — reglas deterministas (SIN IA). Diagnóstico → Blueprint.
// Implementa SELECTION_ENGINE_DRY_RUN.md. Puro y testeable. No toca FROZEN/COM-EXP.

import type {
  Blueprint, Diagnostico, ModuloDecision, PlanoSeleccionado, Profundidad,
} from '@/domain/diagnostico';
import { ORDEN_PLANOS, PLANOS_MAESTROS } from '@/domain/diagnostico';

// --- 1. Clasificación (clase de empresa) ---
export function clasificar(d: Diagnostico): string[] {
  const clases: string[] = [];
  const esBienFisico = d.tipoNegocio === 'comercio-bienes' || d.tipoNegocio === 'producto-fisico';
  const exportador = esBienFisico && (d.objetivo === 'exportar' || d.escala === 'internacional');

  if (d.tipoNegocio === 'software') clases.push('Software/SaaS');
  if (d.tipoNegocio === 'producto-fisico') clases.push('Manufactura');
  if (exportador) clases.push('Exportación/Comercio internacional');
  if (d.tipoNegocio === 'comercio-bienes' && !exportador) clases.push('Retail/Local');
  if (d.tipoNegocio === 'servicio') clases.push('Servicios/Consultoría');
  const ind = d.industria.toLowerCase();
  if (d.tipoNegocio === 'producto-fisico' && (ind.includes('alim') || ind.includes('agr'))) clases.push('Agrícola');
  if (d.objetivo === 'franquiciar') clases.push('Franquicia');
  if (clases.length === 0) clases.push('General');
  return Array.from(new Set(clases));
}

// --- 2. Módulos especializados (hoy solo existe COM-EXP) ---
export function decidirModulos(d: Diagnostico, clases: string[]): ModuloDecision[] {
  const comExp = clases.includes('Exportación/Comercio internacional');
  return [{
    modulo: 'COM-EXP',
    activo: comExp,
    razon: comExp
      ? 'Bienes físicos + exportación/comercio internacional → módulo COM-EXP activado.'
      : 'No es comercio internacional de bienes físicos → COM-EXP NO se activa.',
  }];
}

// --- 3. Profundidad ---
function profundidadBase(d: Diagnostico): Profundidad {
  if (d.presupuesto === 'alto' || d.objetivo === 'levantar-capital' || d.complejidad === 'alta') return 'completo';
  if (d.presupuesto === 'bajo' || d.etapa === 'idea' || d.urgencia === 'urgente' || d.recursos === 'solo-fundador') return 'esencial';
  return 'estandar';
}
const subir = (p: Profundidad): Profundidad => (p === 'esencial' ? 'estandar' : 'completo');

// Planos "punta" según objetivo/clase (suben un nivel de profundidad).
function planosPunta(d: Diagnostico, clases: string[]): Set<string> {
  const punta = new Set<string>();
  if (clases.includes('Exportación/Comercio internacional')) punta.add('COM');
  if (clases.includes('Software/SaaS')) punta.add('TEC');
  if (d.objetivo === 'levantar-capital') punta.add('FIN');
  if (d.objetivo === 'escalar') punta.add('ESC');
  return punta;
}

// --- 4. Selección de planos (capas A–D del dry run) ---
function seleccionarPlanos(d: Diagnostico, clases: string[]): PlanoSeleccionado[] {
  const razones = new Map<string, string[]>();
  const add = (id: string, razon: string) => {
    const r = razones.get(id) ?? [];
    r.push(razon);
    razones.set(id, r);
  };

  // Capa A — núcleo de definición
  add('META', 'Núcleo: toda entidad se define primero (R-A1).');
  add('EST', 'Núcleo: norte y prioridades (R-A2).');

  // Capa B — por objetivo/etapa
  if (d.objetivo === 'lanzar' || d.etapa === 'idea' || d.etapa === 'validacion') {
    add('IMP', 'Arranque/lanzamiento (R-B1).'); add('FIN', 'Viabilidad (R-B1).'); add('COM', 'Salida al mercado (R-B1).');
  }
  if (d.objetivo === 'ordenar' || d.etapa === 'consolidado') {
    add('ORG', 'Ordenar la organización (R-B2).'); add('PRO', 'Procesos (R-B2).'); add('CTR', 'Control (R-B2).');
  }
  if (d.objetivo === 'escalar' || d.etapa === 'crecimiento') {
    add('ESC', 'Escalamiento (R-B3).'); add('CTR', 'Control del crecimiento (R-B3).');
  }
  if (d.objetivo === 'levantar-capital') { add('FIN', 'Modelo financiero para inversión (R-B4).'); }

  // Capa C — por clase de negocio
  if (clases.includes('Software/SaaS')) { ['TEC', 'COM', 'OPE', 'IMP'].forEach((p) => add(p, 'Software/SaaS (R-C1).')); }
  if (clases.includes('Retail/Local')) { ['COM', 'OPE', 'FIN', 'ORG'].forEach((p) => add(p, 'Retail/Local (R-C2).')); }
  if (clases.includes('Exportación/Comercio internacional')) { ['COM', 'FIN', 'OPE', 'CTR'].forEach((p) => add(p, 'Exportación (R-C3).')); }
  if (clases.includes('Manufactura')) { ['OPE', 'PRO', 'TEC', 'FIN'].forEach((p) => add(p, 'Manufactura (R-C4).')); }
  if (clases.includes('Servicios/Consultoría')) { ['COM', 'ORG', 'OPE'].forEach((p) => add(p, 'Servicios (R-C5).')); }
  if (clases.includes('Agrícola')) { ['OPE', 'PRO', 'FIN'].forEach((p) => add(p, 'Agrícola (R-C6).')); }

  // Capa D — transversales por condición
  if (d.recursos === 'equipo-pequeno' || d.recursos === 'equipo-completo' || d.etapa === 'crecimiento' || d.etapa === 'consolidado') add('CUL', 'Hay equipo / madurez (R-D1).');
  if (d.complejidad === 'alta') add('IA', 'Complejidad alta (R-D2).');
  if (d.etapa === 'crecimiento' || d.etapa === 'consolidado' || d.escala === 'nacional' || d.escala === 'internacional' || (d.restricciones ?? '').trim() !== '') add('CTR', 'Escala/regulación (R-D3).');
  if (d.complejidad === 'media' || d.complejidad === 'alta' || d.etapa === 'crecimiento' || d.etapa === 'consolidado') add('PRO', 'Complejidad/operación (R-D4).');

  const base = profundidadBase(d);
  const punta = planosPunta(d, clases);

  return ORDEN_PLANOS
    .filter((id) => razones.has(id))
    .map((id): PlanoSeleccionado => {
      const prof: Profundidad = punta.has(id) ? subir(base) : base;
      return {
        id,
        nombre: PLANOS_MAESTROS[id] ?? id,
        profundidad: prof,
        razones: razones.get(id) ?? [],
        minOperable: false, // se marca abajo
        formulario: `CAPTURA_${id}`,
      };
    });
}

// --- 5. Información mínima operable (qué planos deben arrancar) ---
function marcarMinimosOperables(planos: PlanoSeleccionado[], d: Diagnostico, clases: string[]): void {
  const minimos = new Set<string>(['META']);
  if (clases.includes('Exportación/Comercio internacional')) minimos.add('COM');
  if (clases.includes('Software/SaaS')) minimos.add('TEC');
  if (planos.some((p) => p.id === 'COM')) minimos.add('COM');
  if (planos.some((p) => p.id === 'FIN')) minimos.add('FIN');
  for (const p of planos) if (minimos.has(p.id)) p.minOperable = true;
}

// --- Blueprint final ---
export function construirBlueprint(d: Diagnostico): Blueprint {
  const clasificacion = clasificar(d);
  const modulos = decidirModulos(d, clasificacion);
  const planos = seleccionarPlanos(d, clasificacion);
  marcarMinimosOperables(planos, d, clasificacion);

  const formularios = planos.map((p) => p.formulario);
  if (modulos.find((m) => m.modulo === 'COM-EXP')?.activo) formularios.push('FORM_COM_EXP');

  return {
    nombreEntidad: d.nombreEntidad,
    resumen: d.resumen,
    clasificacion,
    profundidadProyecto: profundidadBase(d),
    planos,
    modulos,
    formularios,
    flujosMinimos: planos.filter((p) => p.minOperable).map((p) => p.id),
    generadoEn: new Date().toISOString(),
  };
}
