// Prueba end-to-end (dominio puro, sin DB) de los planos nuevos + generador de
// documentos + grafo de dependencias unificado, con datos reales de Altercing Studio.
// Correr: npx tsx scripts/planner-altercing.ts
//
// No toca la base de datos: ejercita los motores deterministas (selección, readiness,
// documento, grafo) que son la parte nueva. La UI y la persistencia se validan aparte.

import { construirBlueprint } from '@/app/seleccion/selection-engine';
import type { Diagnostico } from '@/domain/diagnostico';
import { PLANOS_MAESTROS } from '@/domain/diagnostico';
import { ESPECIALISTAS } from '@/domain/especialistas';
import { generarDocumentoPlano } from '@/domain/plano-doc';
import type { CapturaPlano } from '@/domain/plano-doc';
import { construirGrafoDependencias, bloqueadosSi, tablasCompartidas } from '@/domain/dependencias';
import type { ProcesoNodo } from '@/domain/mapa';
import { procesosDeNivel, contarSubprocesos, subprocesosDe } from '@/domain/mapa';
import { ambientesDeEspacios, procesosDeMapa, personasDeSuperficies, superficiesDePlano, puestosDeEmpleados } from '@/domain/proyeccion';
import type { EspacioSrc, ProcesoSrc } from '@/domain/proyeccion';
import { empleadoVacio } from '@/domain/rh';
import type { Empleado } from '@/domain/rh';

let ok = 0, fail = 0;
const fails: string[] = [];
function check(nombre: string, cond: boolean) {
  if (cond) { ok++; console.log(`  ✅ ${nombre}`); }
  else { fail++; fails.push(nombre); console.log(`  ❌ ${nombre}`); }
}
function h(t: string) { console.log(`\n\x1b[1m${t}\x1b[0m`); }

// ============================================================
// 1) SELECCIÓN DE PLANOS — diagnóstico real de Altercing Studio
// ============================================================
h('1) Selección de planos para Altercing Studio (estudio de piercings/tatuajes)');
const altercing: Diagnostico = {
  nombreEntidad: 'Altercing Studio',
  resumen: 'Estudio de piercings, tatuajes, uñas y joyería corporal',
  tipoNegocio: 'servicio',
  industria: 'estudio de piercings y tatuajes',
  etapa: 'early',
  objetivo: 'lanzar',
  escala: 'local',
  presupuesto: 'medio',
  recursos: 'equipo-pequeno',
};
const bp = construirBlueprint(altercing);
const ids = bp.planos.map((p) => p.id);
console.log(`  Planos seleccionados (${ids.length}): ${ids.join(', ')}`);
console.log(`  Clasificación: ${bp.clasificacion.join(', ')}`);
check('Selecciona COM (comercial)', ids.includes('COM'));
check('Selecciona MKT (marketing — nuevo)', ids.includes('MKT'));
check('Selecciona ARQ (arquitectónico — nuevo, por presencia física)', ids.includes('ARQ'));
check('Selecciona RH (recursos humanos — nuevo, hay equipo)', ids.includes('RH'));
check('Selecciona JUR (jurídico — nuevo, objetivo lanzar)', ids.includes('JUR'));
check('NO selecciona INV (no levanta capital)', !ids.includes('INV'));
check('ARQ entrega un diagrama (casa de muñecas)', ESPECIALISTAS['ARQ']!.contratoEntrega.tipo === 'diagrama');

// ============================================================
// 2) GENERADOR DE DOCUMENTOS — cada plano produce su documento, marca PENDIENTE
// ============================================================
h('2) Documento del plano Marketing con datos parciales de Altercing');
const capturaMkt: CapturaPlano = {
  campos: {
    cultura: 'Cultura alternativa/urbana; el body art como identidad y pertenencia; lenguaje propio (calibres, materiales, cicatrización).',
    aspiraciones: 'Expresarse y pertenecer a una tribu; miedo al dolor, a la infección y a un mal resultado permanente.',
    // referencias (estandar) queda vacío -> PENDIENTE
  },
  tablas: {
    investigacion: [
      { hallazgo: 'El cliente investiga en Instagram y pide ver trabajos previos antes de agendar', categoria: 'costumbre', fuente: 'entrevistas a 8 clientes' },
      { hallazgo: 'La palabra "profesional/higiénico" pesa más que el precio', categoria: 'lenguaje', fuente: 'reseñas' },
    ],
    // campanas (estandar) vacío -> PENDIENTE ; experimentos (completo) no requerido en estandar
  },
};
const docMkt = generarDocumentoPlano(ESPECIALISTAS['MKT']!, 'estandar', capturaMkt);
console.log(`  Pendientes: ${docMkt.pendientes} / requeridos: ${docMkt.totalRequerido}`);
check('MKT: 2 pendientes al nivel estándar (referencias + campañas)', docMkt.pendientes === 2);
check('MKT: el documento marca ⚠ PENDIENTE', docMkt.markup.includes('⚠ PENDIENTE'));
check('MKT: el documento incluye el hallazgo capturado (no lo inventa ni lo pierde)', docMkt.markup.includes('El cliente investiga en Instagram'));
check('MKT: renderiza la tabla de investigación (2 filas)', docMkt.markup.includes('_Hallazgos de investigación'.slice(0, 5)) || docMkt.markup.includes('Hallazgo'));

h('2b) Documento del plano Jurídico vacío — todo lo esencial debe salir PENDIENTE');
const docJur = generarDocumentoPlano(ESPECIALISTAS['JUR']!, 'esencial', { campos: {}, tablas: {} });
console.log(`  Pendientes: ${docJur.pendientes} / requeridos: ${docJur.totalRequerido}`);
check('JUR vacío: pendientes === requeridos (nada inventado)', docJur.pendientes === docJur.totalRequerido && docJur.pendientes > 0);

// ============================================================
// 3) SIN REPETIR DATOS — un dato, muchos lentes (tablas compartidas)
// ============================================================
h('3) Grafo de dependencias unificado — "sin repetir datos"');
const grafo = construirGrafoDependencias();
const nPlanos = grafo.nodos.filter((n) => n.tipo === 'plano').length;
const nTablas = grafo.nodos.filter((n) => n.tipo === 'tabla').length;
console.log(`  Nodos: ${nPlanos} planos, ${nTablas} tablas maestras, ${grafo.aristas.length} aristas`);
const compartidas = tablasCompartidas(grafo);
for (const [ref, planos] of compartidas) console.log(`  · tabla "${ref}" alimenta a ${planos.length} planos: ${planos.join(', ')}`);
check('Hay 18 planos en el grafo', nPlanos === 18);
check('personas es tabla compartida (ORG + OPE la leen con distinta vista)', (compartidas.get('personas') ?? []).includes('ORG') && (compartidas.get('personas') ?? []).includes('OPE'));
check('campanas es tabla compartida (COM + MKT)', (compartidas.get('campanas') ?? []).includes('COM') && (compartidas.get('campanas') ?? []).includes('MKT'));

// ============================================================
// 4) MODELO EJECUTABLE — "si falla X, ¿qué se bloquea?"
// ============================================================
h('4) Propagación de dependencias (planos y procesos de Altercing)');
// Nivel plano: META es la raíz; si falla, se bloquea casi todo.
const bloqMeta = bloqueadosSi(grafo, 'plano:META');
check('Si falla META se bloquea EST', bloqMeta.includes('plano:EST'));
check('Si falla META se bloquea INV (INV depende de META→FIN→COM)', bloqMeta.includes('plano:INV'));

// Nivel proceso: flujo real de una sesión de piercing.
const P = (id: string, nombre: string, ramas: { evento: string; destino: string }[]): ProcesoNodo => ({
  id, departamentoId: 'uc-piercings', nombre, fase: 'durante', etapaDesde: 'arrancar', orden: 0,
  roles: [], herramientas: [], insumos: [], espacios: [],
  ramas: ramas.map((r, i) => ({ id: `${id}-r${i}`, evento: r.evento, destinoProcesoId: r.destino })),
});
const procesos: ProcesoNodo[] = [
  P('recepcion', 'Recepción y registro', [{ evento: 'Cliente registrado', destino: 'consentimiento' }]),
  P('consentimiento', 'Consentimiento y valoración', [{ evento: 'Firmado', destino: 'perforacion' }]),
  P('perforacion', 'Perforación', [{ evento: 'Servicio hecho', destino: 'cobro' }]),
  P('cobro', 'Cobro', [{ evento: 'Pago recibido', destino: 'seguimiento' }]),
  P('seguimiento', 'Seguimiento de cicatrización', []),
];
const grafoOp = construirGrafoDependencias({ procesos });
const bloqRec = bloqueadosSi(grafoOp, 'proceso:recepcion');
console.log(`  Si falla "Recepción" se bloquean ${bloqRec.length} procesos aguas abajo`);
check('Si falla Recepción se bloquea toda la cadena (4 procesos)', bloqRec.length === 4 && bloqRec.includes('proceso:seguimiento'));
check('Si falla Cobro solo se bloquea Seguimiento (1)', bloqueadosSi(grafoOp, 'proceso:cobro').length === 1);

// ============================================================
// 5) FLUJO DE DATOS REAL — superficies (Sedes/Mapa) proyectan a los planos
// ============================================================
h('5) Proyección: los espacios y procesos reales SE VUELVEN filas del plano (sin re-teclear)');
// Espacios reales de Altercing (como los dibuja el propietario en Sedes & Espacios).
const espacios: EspacioSrc[] = [
  { nombre: 'Recepción y espera', tipo: 'area', ancho: 3, alto: 4, data: { uso: 'Recibir y registrar al cliente', org_responsable: 'Recepcionista' } },
  { nombre: 'Cabina de perforación', tipo: 'area', ancho: 2.5, alto: 4, data: { uso: 'Perforación', proc_rol: 'Perforador, Asistente' } },
  { nombre: 'Esterilización', tipo: 'area', ancho: 2, alto: 2, data: { uso: 'Esterilizar instrumental', org_responsable: 'Asistente' } },
  { nombre: 'Planta baja', tipo: 'capa', ancho: 9, alto: 4, data: {} }, // capa: NO es ambiente
];
const ambientes = ambientesDeEspacios(espacios);
console.log(`  Espacios reales: ${espacios.length} → ambientes del plano ARQ: ${ambientes.length}`);
check('Solo áreas/cuartos se vuelven ambientes (la "capa" no)', ambientes.length === 3);
check('El ambiente conserva su objetivo y m² desde el espacio real', ambientes[0]!.objetivo === 'Recibir y registrar al cliente' && ambientes[0]!.m2 === '12');

const procesosSrc: ProcesoSrc[] = [
  { nombre: 'Recepción y registro', entrada: 'Cliente llega', salida: 'Cliente registrado', roles: ['Recepcionista'] },
  { nombre: 'Perforación', entrada: 'Consentimiento firmado', salida: 'Servicio hecho', roles: ['Perforador', 'Asistente'] },
];
const procTabla = procesosDeMapa(procesosSrc);
check('Cada nodo del Mapa se vuelve un proceso del plano PRO', procTabla.length === 2 && procTabla[1]!.responsable === 'Perforador, Asistente');

const personas = personasDeSuperficies(espacios, procesosSrc);
console.log(`  Roles únicos derivados (espacios + procesos): ${personas.map((p) => p['rol']).join(', ')}`);
check('Roles se derivan y deduplican para ORG/OPE (Asistente no se repite)', personas.filter((p) => p['rol'] === 'Asistente').length === 1);
check('superficiesDePlano(ARQ) incluye Sedes & Espacios', superficiesDePlano('ARQ').some((s) => s.superficie === 'sedes'));
check('superficiesDePlano(PRO) incluye Mapa Operativo', superficiesDePlano('PRO').some((s) => s.superficie === 'mapa'));

// ============================================================
// 6) FLUJOS ANIDADOS — subprocesos dentro de un paso del Mapa Operativo
// ============================================================
h('6) Subflujos: un paso puede contener su propio flujo de trabajo (anidado)');
const sub = (id: string, nombre: string, padre?: string): ProcesoNodo => ({
  id, departamentoId: 'd', nombre, fase: 'durante', etapaDesde: 'arrancar', orden: 0,
  roles: [], herramientas: [], insumos: [], espacios: [], ramas: [],
  ...(padre ? { padreProcesoId: padre } : {}),
});
const conSub: ProcesoNodo[] = [
  sub('perforacion', 'Perforación'),
  sub('cobro', 'Cobro'),
  sub('per-1', 'Marcar el punto', 'perforacion'),
  sub('per-2', 'Desinfectar', 'perforacion'),
  sub('per-3', 'Perforar y colocar', 'perforacion'),
];
check('Nivel raíz = solo los pasos sin padre (2)', procesosDeNivel(conSub, null).length === 2);
check('Dentro de "Perforación" hay 3 subprocesos', procesosDeNivel(conSub, 'perforacion').length === 3);
check('subprocesosDe coincide (3)', subprocesosDe(conSub, 'perforacion').length === 3);
check('contarSubprocesos marca perforacion=3', (contarSubprocesos(conSub).get('perforacion') ?? 0) === 3);
check('El plano PRO solo lista procesos de nivel raíz (no los subprocesos)', procesosDeMapa(conSub).length === 2);

// ============================================================
// 7) PERSONAS & RH — el roster alimenta el plano RH (puestos) y ORG/OPE (personas)
// ============================================================
h('7) Roster de Personas → plano RH y planos ORG/OPE (sin re-teclear)');
const emp = (nombre: string, puesto: string, depto: string, roles: string[], comp: string[]): Empleado =>
  ({ ...empleadoVacio(`EMP-${nombre}`), nombre, puesto, departamento: depto, estado: 'activo', roles, competencias: comp, kpis: 'Reseñas ≥4.7' });
const roster: Empleado[] = [
  emp('Ana', 'Perforador/a', 'Piercings', ['Perforador'], ['Asepsia', 'Anatomía']),
  emp('Beto', 'Perforador/a', 'Piercings', ['Perforador'], ['Asepsia']),        // mismo puesto → 1 descripción, 2 personas
  emp('Carla', 'Recepcionista', 'Recepción', ['Recepción', 'Caja'], ['Atención']),
];
const puestosRH = puestosDeEmpleados(roster);
console.log(`  ${roster.length} personas → ${puestosRH.length} descripciones de puesto`);
check('Puestos dedup por nombre (Perforador/a una vez)', puestosRH.length === 2);
check('El puesto lista a sus ocupantes (Ana, Beto)', (puestosRH.find((p) => p['puesto'] === 'Perforador/a')?.['ocupantes'] ?? '').includes('Ana') && (puestosRH.find((p) => p['puesto'] === 'Perforador/a')?.['ocupantes'] ?? '').includes('Beto'));
const personasRH = personasDeSuperficies([], [], roster);
check('El roster alimenta la tabla personas (ORG/OPE) con nombre real', personasRH.some((p) => p['persona'] === 'Carla'));
check('superficiesDePlano(RH) incluye Personas & RH', superficiesDePlano('RH').some((s) => s.superficie === 'personas'));

// ============================================================
// MUESTRA — extracto del documento de Marketing generado
// ============================================================
h('📄 Extracto del documento de Marketing generado (primeras líneas):');
console.log(docMkt.markup.split('\n').slice(0, 16).map((l) => '   ' + l).join('\n'));

// ============================================================
console.log(`\n${'='.repeat(56)}`);
console.log(`  RESULTADO: ${ok} pasaron, ${fail} fallaron`);
if (fail) { console.log(`  Fallas: ${fails.join(' · ')}`); process.exitCode = 1; }
else console.log('  ✅ TODO VERDE');
console.log('  Planos maestros ahora:', Object.keys(PLANOS_MAESTROS).length);
console.log('='.repeat(56));
