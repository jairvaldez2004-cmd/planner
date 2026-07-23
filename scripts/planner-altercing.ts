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
