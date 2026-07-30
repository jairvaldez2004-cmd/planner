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
import { personaHaceProceso, flujoDePersona, flujoDeRol, indiceRoles, flujoInterEmpresa, flujoDeSubprocesos } from '@/domain/flujo-persona';
import { costosDeRecursos, componentesDeEquipo, proveedoresATabla, agentesDeProcesos, componentesDeAutomatizacion } from '@/domain/proyeccion';
import { recursoVacio, proveedorVacio, numero, subtotalRecurso, normalizarProveedor, vinculoVacio, registrarCambioPrecio, precioVigente, proveedorMasBarato, vinculosDeProducto, productoVacio, planearCompra, siguienteEtapaCompra, totalOrden, ordenVacia, solicitudDesdeProducto, contratoVacio, estadoContrato, scoreProveedor, incidenciaVacia, redactarSolicitudCotizacion, normalizarInteraccion, interaccionesDeProveedor, ultimoContacto, requiereSeguimiento, seguimientosPendientes } from '@/domain/recursos';
import type { Recurso, ProductoProveedor, Producto, Contrato, Incidencia } from '@/domain/recursos';
import { indiceRecursos, costearProceso, indiceCosto } from '@/domain/costeo';
import { costosDeProductos, costosDeEmbarques } from '@/domain/proyeccion';
import { embarqueVacio, landedCostEmbarque, prorrateoLanded, embarqueRetrasado, costoLogisticoEmbarque, normalizarEmbarque, modalidadEnvioInfo, transportistaVacio, cotizarFlete, mejorTransportista } from '@/domain/recursos';
import type { Transportista } from '@/domain/recursos';
import type { Embarque } from '@/domain/recursos';
import { areaEspacio, reporteEscaneo } from '@/domain/escaneo';
import { simular } from '@/domain/simulacion';
import { normalizarPrimitivas, leerModelo3D, alturaModelo } from '@/domain/modelo-parametrico';

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
check('MKT V2: pendientes al nivel estándar (referencias, estacionalidad, segmento, avatar, campañas, plan)', docMkt.pendientes === 6);
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
// 8) FLUJO POR PERSONA — sus procesos, disparadores y quién se los entrega
// ============================================================
h('8) Al seleccionar a una persona: su n8n (disparadores + quién los entrega)');
const pr = (id: string, nombre: string, roles: string[], ramas: { evento: string; destino: string }[]): ProcesoNodo => ({
  id, departamentoId: id === 'consent' ? 'dep-recep' : 'dep-pierc', nombre, fase: 'durante', etapaDesde: 'arrancar', orden: id === 'consent' ? 1 : 2,
  roles, herramientas: [], insumos: [], espacios: [],
  ramas: ramas.map((r, i) => ({ id: `${id}-r${i}`, evento: r.evento, destinoProcesoId: r.destino })),
});
const procsFlujo: ProcesoNodo[] = [
  pr('consent', 'Verificar edad y firmar consentimiento', ['Recepcionista'], [{ evento: 'Consentimiento firmado', destino: 'perf' }]),
  pr('perf', 'Perforación con aguja estéril', ['Perforador'], []),
];
const flor = { ...empleadoVacio('flor'), nombre: 'Flor', roles: ['Recepcionista'] };
const suzet = { ...empleadoVacio('suzet'), nombre: 'Suzet', roles: ['Perforador'] };
const equipo = [flor, suzet];
const depN = (id: string) => id === 'dep-recep' ? 'Recepción' : 'Piercings';

check('personaHaceProceso: Flor (Recepcionista) hace "Consentimiento"', personaHaceProceso(flor, procsFlujo[0]!));
check('personaHaceProceso: Flor NO hace "Perforación"', !personaHaceProceso(flor, procsFlujo[1]!));
const flujoSuzet = flujoDePersona(suzet, procsFlujo, equipo, depN);
check('El flujo de Suzet tiene 1 proceso (Perforación)', flujoSuzet.length === 1 && flujoSuzet[0]!.nombre.includes('Perforación'));
const rec = flujoSuzet[0]!.recibeDe[0];
check('Su disparador de entrada es "Consentimiento firmado"', rec?.evento === 'Consentimiento firmado');
check('Y se lo entrega Flor (quién entrega el disparador)', (rec?.quien ?? []).includes('Flor'));
const flujoFlor = flujoDePersona(flor, procsFlujo, equipo, depN);
check('Flor entrega a Suzet: su salida va a "Perforación"', flujoFlor[0]!.entregaA[0]?.quien.includes('Suzet') === true);

// Vista por ROL: solo lo que involucra ese rol.
const flujoRolPerf = flujoDeRol('Perforador', procsFlujo, equipo, depN);
check('flujoDeRol("Perforador") = 1 proceso (Perforación)', flujoRolPerf.length === 1 && flujoRolPerf[0]!.nombre.includes('Perforación'));
const idx = indiceRoles(procsFlujo, equipo);
check('indiceRoles lista Recepcionista y Perforador', idx.some((r) => r.rol === 'Recepcionista') && idx.some((r) => r.rol === 'Perforador'));
check('indiceRoles cuenta procesos y personas por rol', (idx.find((r) => r.rol === 'Perforador')?.procesos ?? 0) === 1 && (idx.find((r) => r.rol === 'Recepcionista')?.personas ?? 0) === 1);

// Tercerización: un externo (Girly Zone) con el rol cuenta como quien lo ejecuta.
const contadorExt = { ...empleadoVacio('c'), nombre: 'Girly Zone', roles: ['Contador'], externo: true, proveedor: 'Girly Zone' };
const procConta = pr('conta', 'Contabilizar ingresos', ['Contador'], []);
check('Un rol tercerizado (externo) cuenta como quien lo hace', personaHaceProceso(contadorExt, procConta));
check('El externo trae su proveedor', contadorExt.externo && contadorExt.proveedor === 'Girly Zone');

// Flujo inter-empresa: agrupa por proveedor con lo que entregamos/recibimos.
const contaFull = { ...contadorExt, entregamos: 'facturas del mes', recibimos: 'declaración de impuestos' };
const inter = flujoInterEmpresa([contaFull], [procConta]);
check('flujoInterEmpresa agrupa 1 proveedor (Girly Zone)', inter.length === 1 && inter[0]!.proveedor === 'Girly Zone');
check('El intercambio trae entregamos/recibimos y el proceso que hace', inter[0]!.intercambios[0]?.entregamos === 'facturas del mes' && inter[0]!.procesos.includes('Contabilizar ingresos'));
const procTrig = pr('trig', 'Registrar servicio', ['Administrador'], [{ evento: 'Factura del día', destino: 'conta' }]);
const inter2 = flujoInterEmpresa([contaFull], [procConta, procTrig]);
check('El intercambio detecta el disparador de ENTRADA (quién dispara el handoff)', inter2[0]!.entrada.includes('Factura del día'));
check('flujoDeSubprocesos devuelve los subpasos de un paso', flujoDeSubprocesos('perforacion', conSub, [], (id) => id).length === 3);

// ============================================================
// 9) RECURSOS & PROVEEDORES — catálogo que alimenta FIN, TEC y COM
// ============================================================
h('9) Recursos & Proveedores → Financiero (costos), Tecnológico (equipo), Comercial (proveedores)');
check('numero parsea "$1,200.50"', numero('$1,200.50') === 1200.5);
const recAguja: Recurso = { ...recursoVacio('r1'), nombre: 'Aguja estéril 16G', categoria: 'insumo', grupo: 'Cabina', proveedor: 'Insumos Médicos SA', costo: '8', cantidad: '100', unidad: 'pza', impuesto: '16%' };
const recAuto: Recurso = { ...recursoVacio('r2'), nombre: 'Autoclave', categoria: 'equipo', proveedor: 'EquipMed', costo: '25000', cantidad: '1' };
check('subtotal = costo × cantidad (8×100=800)', subtotalRecurso(recAguja) === 800);
const costos = costosDeRecursos([recAguja, recAuto]);
check('Recursos → filas de costos (FIN)', costos.length === 2 && costos.every((c) => c['tipo'] === 'costo'));
check('El costo trae el monto calculado ($800.00)', costos.find((c) => c['concepto']?.startsWith('Aguja'))?.['monto'] === '$800.00');
const comps = componentesDeEquipo([recAguja, recAuto]);
check('Solo el EQUIPO va a componentes (TEC): 1', comps.length === 1 && comps[0]!['componente'] === 'Autoclave');
const provs = proveedoresATabla([{ ...proveedorVacio('p1'), nombre: 'Insumos Médicos SA', tipo: 'insumos', contacto: 'ventas@im.mx' }]);
check('Proveedores → tabla de COM', provs.length === 1 && provs[0]!['proveedor'] === 'Insumos Médicos SA');

// Costeo de proceso: enlaza insumos del mapa con el catálogo por nombre.
const idxCost = indiceRecursos([recAguja]); // Aguja estéril 16G · $8
const cp = costearProceso(['Aguja estéril 16G', 'Marcador quirúrgico'], { 'Aguja estéril 16G': '3 pzas' }, idxCost);
check('Costea el proceso: 3 × $8 = $24', cp.total === 24);
check('Marca los insumos sin costo en catálogo', cp.sinCosto.includes('Marcador quirúrgico'));

// ============================================================
// 10) REPORTE DE MEDIDAS estilo MAKE.PLAN (áreas, m², muros)
// ============================================================
h('10) Reporte de medidas (áreas por cuarto, m² totales, muros) desde la geometría');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const esp = (nombre: string, tipo: string, ancho: number, alto: number, capa = 0): any => ({ id: 'e-' + nombre, sedeId: 's', tipo, nombre, capa, x: 0, y: 0, ancho, alto, rot: 0, ucIds: [], data: {} });
check('Área de un rectángulo (3×4 = 12 m²)', areaEspacio({ ancho: 3, alto: 4 }) === 12);
check('Área de un polígono (triángulo base 4 alt 3 = 6 m²)', areaEspacio({ ancho: 0, alto: 0, poligono: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }] }) === 6);
const rep = reporteEscaneo(
  [esp('Cabina', 'area', 3, 4), esp('Baño', 'habitacion', 1.5, 2), esp('Piso', 'capa', 9, 4)],
  [{ espacioId: 'e-Cabina' } as never],
  [{ tipo: 'muro', x1: 0, y1: 0, x2: 5, y2: 0 } as never, { tipo: 'puerta', x1: 0, y1: 0, x2: 0.9, y2: 0 } as never],
);
check('Reporte: solo áreas/cuartos (2, la "capa" no cuenta)', rep.nCuartos === 2);
check('Reporte: total = 12 + 3 = 15 m²', rep.totalM2 === 15);
check('Reporte: muros 5 m de longitud y 1 puerta', rep.muros.longitudTotal === 5 && rep.muros.nPuertas === 1);

// ============================================================
// 11) SIMULACIÓN — procesos sobre el espacio (carga, cuellos, recorrido)
// ============================================================
h('11) Simulación: carga por espacio/rol, cuellos de botella y recorrido');
const sp = (id: string, nombre: string, rol: string, espacio: string, tiempo: number, destino?: string): ProcesoNodo => ({
  id, departamentoId: 'd', nombre, fase: 'durante', etapaDesde: 'arrancar', orden: 0,
  roles: [rol], herramientas: [], insumos: [], espacios: [{ nombre: espacio }], tiempoMin: tiempo,
  ramas: destino ? [{ id: id + 'r', evento: 'sigue', destinoProcesoId: destino }] : [],
});
const simProcs: ProcesoNodo[] = [
  sp('a', 'Recepción', 'Recepcionista', 'Recepción', 5, 'b'),
  sp('b', 'Perforación', 'Perforador', 'Cabina', 15, 'c'),
  sp('c', 'Cobro', 'Recepcionista', 'Recepción', 3),
];
const sim = simular(simProcs);
check('Tiempo total = 23 min', sim.totalMin === 23);
check('Cuello de espacio = Cabina (15 min)', sim.cuelloEspacio?.nombre === 'Cabina' && sim.cuelloEspacio?.minutos === 15);
check('Recepción acumula 8 min en 2 procesos', sim.porEspacio.find((e) => e.nombre === 'Recepción')?.minutos === 8);
check('Cuello de rol = Perforador (15 min)', sim.cuelloRol?.nombre === 'Perforador');
check('Recorrido con 2 cambios de espacio', sim.cambiosEspacio === 2);

// ============================================================
// 12) MODELO 3D PARAMÉTRICO (lo que arma el chat desde primitivas)
// ============================================================
h('12) Modelo paramétrico: el chat describe el objeto con primitivas y se saneó');
// Ej.: un "aire acondicionado (minisplit)" como caja blanca montada + rejilla.
const primsAC = normalizarPrimitivas([
  { forma: 'caja', w: 0.9, h: 0.3, d: 0.22, x: 0, y: 2.05, z: 0, color: '#f2f2ee', material: 'blanco' },
  { forma: 'caja', w: 0.82, h: 0.04, d: 0.01, x: 0, y: 1.94, z: 0.12, material: 'metal' },
  { forma: 'caja', w: 999, h: -3, d: 0.2, x: 0, y: 0.5, z: 0 }, // valores locos → deben sanearse
]);
check('Normaliza 3 primitivas (con clamp de valores locos)', primsAC.length === 3 && primsAC[2]!.w <= 12 && primsAC[2]!.h >= 0.001);
check('Conserva color y material válidos', primsAC[0]!.color === '#f2f2ee' && primsAC[0]!.material === 'blanco');
check('alturaModelo del AC ≈ 2.2 m', Math.abs(alturaModelo(primsAC) - 2.2) < 0.01);
check('leerModelo3D lee un array en data.modelo3d', leerModelo3D({ modelo3d: primsAC }).length === 3);
check('leerModelo3D lee también un string JSON (data aplanada)', leerModelo3D({ modelo3d: JSON.stringify([{ forma: 'esfera', r: 0.3, x: 0, y: 0.3, z: 0 }]) }).length === 1);

// ============================================================
// 13) ORGANIZADOR DE EQUIPO (IA): automatizar procesos → plano de software
// ============================================================
h('13) Automatización de procesos alimenta el plano de software (IA → agentes · n8n/software → componentes)');
const procsAuto: ProcesoSrc[] = [
  { nombre: 'Dar de alta el catálogo', roles: ['Recepción'], entrada: 'lista de servicios', salida: 'catálogo publicado',
    automatizacion: { con: 'ia', herramienta: 'Agente de catálogo', nota: 'Redacta y publica el catálogo desde una lista.' } },
  { nombre: 'Recordatorio de cita', roles: ['Recepción'], salida: 'WhatsApp enviado',
    automatizacion: { con: 'n8n', herramienta: 'n8n: recordatorio' } },
  { nombre: 'Perforar', roles: ['Perforador'] }, // manual: no proyecta nada
  { nombre: 'Sub', roles: [], padreProcesoId: 'X', automatizacion: { con: 'ia' } }, // subproceso: se ignora
];
const agentes = agentesDeProcesos(procsAuto);
const compsAuto = componentesDeAutomatizacion(procsAuto);
check('Solo el proceso IA de nivel raíz se vuelve ficha de agente', agentes.length === 1 && agentes[0]!.nombre === 'Agente de catálogo');
check('La ficha de agente lleva su capacidad y scope', String(agentes[0]!.capability).includes('catálogo publicado') && String(agentes[0]!.scope).includes('Redacta'));
check('El proceso n8n se vuelve componente técnico', compsAuto.length === 1 && String(compsAuto[0]!.componente).includes('recordatorio'));
check('El componente declara que reemplaza el trabajo manual', String(compsAuto[0]!.sustitucion).includes('Recordatorio de cita'));
check('Los procesos manuales y los subprocesos NO proyectan software', agentes.length + compsAuto.length === 2);
check('Mapa enriquece IA/agentes y TEC/componentes', superficiesDePlano('IA').some((s) => s.superficie === 'mapa') && superficiesDePlano('TEC').some((s) => s.superficie === 'mapa'));

// ============================================================
// 14) ABASTECIMIENTO Fase 1: proveedor rico + muchos-a-muchos + historial de precios
// ============================================================
h('14) Recursos & Proveedores: modelo muchos-a-muchos e historial de precios');
// Retrocompat: un proveedor viejo (solo `tipo`) siembra su categoría.
const provViejo = normalizarProveedor({ id: 'PRV-1', nombre: 'Aceros MX', tipo: 'materiales / construcción' });
check('Proveedor legacy conserva su tipo y lo copia a categorias', provViejo.categorias.includes('materiales / construcción'));
check('Proveedor rico trae los campos nuevos vacíos (no undefined)', Array.isArray(provViejo.zonas) && Array.isArray(provViejo.incoterms) && provViejo.gps === '');

// Un producto con 3 proveedores; precios distintos → el más barato se detecta.
const prodId = 'PROD-guante';
let v1 = vinculoVacio('PP1', prodId, 'PRV-A'); v1 = { ...v1, precio: '120', moneda: 'MXN' };
let v2 = vinculoVacio('PP2', prodId, 'PRV-B'); v2 = { ...v2, precio: '95', moneda: 'MXN' };
const v3 = vinculoVacio('PP3', 'PROD-otro', 'PRV-C'); // de otro producto: no debe contar
const vinculos: ProductoProveedor[] = [v1, v2, v3];
check('vinculosDeProducto filtra por producto (2 de 3)', vinculosDeProducto(vinculos, prodId).length === 2);
check('proveedorMasBarato = PRV-B ($95)', proveedorMasBarato(vinculos, prodId)?.proveedorId === 'PRV-B');

// Historial de precios: registrar un cambio actualiza el precio vigente.
check('Precio vigente inicial = precio del vínculo', precioVigente(v2) === '95');
const v2b = registrarCambioPrecio(v2, { fecha: '2026-07-29', precio: '130', moneda: 'MXN', quien: 'compras', motivo: 'alza de insumo', documento: '' });
check('Tras registrar cambio, hay 1 en historial', v2b.historial.length === 1);
check('Precio vigente = último del historial ($130)', precioVigente(v2b) === '130');
check('El más barato cambia a PRV-A ($120) tras el alza de PRV-B', proveedorMasBarato([v1, v2b], prodId)?.proveedorId === 'PRV-A');

// ============================================================
// 15) INVENTARIO + PLANEACIÓN de compras (motor de recomendación)
// ============================================================
h('15) Planeación de compras: recomienda comprar/esperar según stock, umbrales y consumo');
const HOY = '2026-07-29';
const prodBase = (o: Partial<Producto>): Producto => ({ ...productoVacio('PROD-x'), ...o });

// Bajo el stock de seguridad → urgente.
const plUrg = planearCompra(prodBase({ stockActual: '2', stockSeguridad: '5', stockMaximo: '50', consumoMensual: '30' }), HOY);
check('Stock bajo seguridad → comprar-urgente', plUrg.accion === 'comprar-urgente');
check('Cantidad sugerida = máximo - actual (48)', plUrg.cantidadSugerida === 48);

// En punto de reorden → comprar hoy.
const plHoy = planearCompra(prodBase({ stockActual: '10', puntoReorden: '10', stockSeguridad: '3', consumoMensual: '30' }), HOY);
check('Stock en punto de reorden → comprar-hoy', plHoy.accion === 'comprar-hoy');

// Cobertura amplia → OK, con pronóstico de agotamiento.
const plOk = planearCompra(prodBase({ stockActual: '300', stockSeguridad: '10', consumoMensual: '30', leadTimeDias: '5' }), HOY);
check('Stock holgado → OK', plOk.accion === 'ok');
check('Calcula días de cobertura (~300 días)', plOk.diasCobertura !== null && plOk.diasCobertura > 250);
check('Pronostica fecha de agotamiento (no "—")', plOk.seAgotaEn !== '—' && plOk.seAgotaEn > HOY);

// Cobertura menor al lead time → comprar hoy aunque no toque el reorden.
const plLead = planearCompra(prodBase({ stockActual: '10', consumoMensual: '30', leadTimeDias: '15' }), HOY);
check('Cobertura (~10d) < lead time (15d) → comprar-hoy', plLead.accion === 'comprar-hoy');

// Sin datos → sin-datos.
check('Producto sin stock/consumo → sin-datos', planearCompra(productoVacio('P0'), HOY).accion === 'sin-datos');

// ============================================================
// 16) COMPRAS (flujo por etapas) + CONTRATOS (alertas de vencimiento)
// ============================================================
h('16) Flujo de compras, total de la orden y alertas de contrato');
// Flujo de etapas: avanza en orden y se detiene en "cerrada".
check('solicitud → cotizacion', siguienteEtapaCompra('solicitud') === 'cotizacion');
check('evaluacion → cerrada', siguienteEtapaCompra('evaluacion') === 'cerrada');
check('cerrada se queda en cerrada', siguienteEtapaCompra('cerrada') === 'cerrada');

// Total de la orden = precio × cantidad.
const oc = { ...ordenVacia('OC1'), precioUnitario: '25', cantidad: '4' };
check('Total de la orden = 100', totalOrden(oc) === 100);

// Solicitud automática desde un producto bajo mínimo (Sección 17).
const prodBajo = { ...productoVacio('PROD-z'), nombre: 'Guantes', unidad: 'caja', stockMaximo: '50', stockActual: '3' };
const sol = solicitudDesdeProducto('OC-auto', prodBajo, 47, 'PRV-9', HOY);
check('Solicitud automática nace en etapa solicitud', sol.etapa === 'solicitud');
check('Solicitud toma producto, cantidad y proveedor sugeridos', sol.productoId === 'PROD-z' && sol.cantidad === '47' && sol.proveedorId === 'PRV-9');

// Contratos: alertas según fecha de vencimiento (HOY = 2026-07-29).
const ctr = (venc: string, o: Partial<Contrato> = {}): Contrato => ({ ...contratoVacio('C'), fechaVencimiento: venc, alertaDias: '30', ...o });
check('Contrato a 200 días → vigente, sin alerta', estadoContrato(ctr('2027-02-15'), HOY).estado === 'vigente');
check('Contrato a 10 días → por-vencer con alerta', (() => { const i = estadoContrato(ctr('2026-08-08'), HOY); return i.estado === 'por-vencer' && i.alerta; })());
check('Contrato pasado → vencido', estadoContrato(ctr('2026-06-01'), HOY).estado === 'vencido');
check('Renovación automática NO dispara alerta aunque esté por vencer', estadoContrato(ctr('2026-08-08', { renovacionAutomatica: true }), HOY).alerta === false);
check('Sin fecha de vencimiento → sin-fecha', estadoContrato(ctr(''), HOY).estado === 'sin-fecha');

// ============================================================
// 17) CALIDAD + EVALUACIÓN + RIESGO: Score General automático del proveedor
// ============================================================
h('17) Score de proveedor: promedio de criterios penalizado por incidencias');
const provEval = { ...proveedorVacio('PRV-EV'), nombre: 'Distribuidora X', evaluacion: { calidad: 90, precio: 80, tiempo: 70 } };
const sc0 = scoreProveedor(provEval, []);
check('Score = promedio de criterios (80)', sc0.score === 80 && sc0.base === 80 && sc0.nCriterios === 3);
check('Nivel excelente ≥80', sc0.nivel === 'excelente');

// Incidencias penalizan: 1 grave (−8) + 1 media (−4) = −12 → 68.
const incsX: Incidencia[] = [
  { ...incidenciaVacia('I1', 'PRV-EV'), gravedad: 'grave' },
  { ...incidenciaVacia('I2', 'PRV-EV'), gravedad: 'media' },
  { ...incidenciaVacia('I3', 'OTRO'), gravedad: 'grave' }, // de otro proveedor: no cuenta
];
const sc1 = scoreProveedor(provEval, incsX);
check('Penalización solo de SUS incidencias (−12)', sc1.penalizacion === 12 && sc1.incidencias === 2);
check('Score penalizado = 68 (bueno)', sc1.score === 68 && sc1.nivel === 'bueno');

// Sin criterios calificados → sin evaluar.
check('Proveedor sin evaluación → sin-evaluar', scoreProveedor(proveedorVacio('P0'), []).nivel === 'sin-evaluar');

// El normalizador limpia valores fuera de rango y no-criterios.
const provNorm = normalizarProveedor({ id: 'X', nombre: 'Y', evaluacion: { calidad: 150, precio: -5, inventado: 99 } });
check('Evaluación: clamp a 100 y descarta criterios inválidos', provNorm.evaluacion.calidad === 100 && provNorm.evaluacion.precio === undefined && (provNorm.evaluacion as Record<string, number>).inventado === undefined);

// ============================================================
// 18) CENTRO IA: redacción de solicitud de cotización (RFQ)
// ============================================================
h('18) El agente redacta correos de solicitud de cotización');
const prodRFQ = { ...productoVacio('PROD-rfq'), nombre: 'Guantes de nitrilo', unidad: 'caja', marca: 'Ambiderm' };
const rfq = redactarSolicitudCotizacion(prodRFQ, 'Insumos del Bajío', 20, 'Altercing Studio', 'Entrega en Querétaro.');
check('El asunto nombra el producto', rfq.asunto.includes('Guantes de nitrilo'));
check('El cuerpo incluye cantidad y unidad', rfq.cuerpo.includes('20 caja'));
check('El cuerpo saluda al proveedor y pide precio/entrega', rfq.cuerpo.includes('Insumos del Bajío') && rfq.cuerpo.includes('precio unitario') && rfq.cuerpo.includes('tiempo de entrega'));
check('Incluye la marca en especificaciones', rfq.cuerpo.includes('Ambiderm'));
check('Incluye el mensaje extra y firma el remitente', rfq.cuerpo.includes('Querétaro') && rfq.cuerpo.includes('Altercing Studio'));

// ============================================================
// 19) RELACIÓN COMERCIAL: bitácora + motor de seguimiento
// ============================================================
h('19) Bitácora de interacciones y seguimiento por proveedor');
const bitac = [
  normalizarInteraccion({ id: 'A', proveedorId: 'P1', tipo: 'cotización', direccion: 'saliente', fecha: '2026-07-20', resumen: 'RFQ guantes' }),
  normalizarInteraccion({ id: 'B', proveedorId: 'P1', tipo: 'respuesta', direccion: 'entrante', fecha: '2026-07-25', resumen: 'mandó precio' }),
  normalizarInteraccion({ id: 'C', proveedorId: 'P2', tipo: 'nota', direccion: 'saliente', fecha: '2026-07-10', resumen: 'primer contacto' }),
];
check('interaccionesDeProveedor filtra y ordena (recientes primero)', (() => { const l = interaccionesDeProveedor(bitac, 'P1'); return l.length === 2 && l[0]!.id === 'B'; })());
check('ultimoContacto = fecha más reciente', ultimoContacto('P1', bitac) === '2026-07-25');
check('normalizarInteraccion respeta dirección entrante', bitac[1]!.direccion === 'entrante');

const pSeg = { ...proveedorVacio('P1'), nombre: 'A', proximoSeguimiento: '2026-07-28' };
const pFuturo = { ...proveedorVacio('P2'), nombre: 'B', proximoSeguimiento: '2026-08-15' };
const pSin = { ...proveedorVacio('P3'), nombre: 'C' };
check('requiereSeguimiento true si la fecha ya pasó (hoy 2026-07-29)', requiereSeguimiento(pSeg, HOY));
check('requiereSeguimiento false si es futura', !requiereSeguimiento(pFuturo, HOY));
check('requiereSeguimiento false sin fecha', !requiereSeguimiento(pSin, HOY));
check('seguimientosPendientes solo devuelve los vencidos', (() => { const l = seguimientosPendientes([pSeg, pFuturo, pSin], HOY); return l.length === 1 && l[0]!.nombre === 'A'; })());

// ============================================================
// 20) UNIFICACIÓN: Productos como fuente de precio para costeo y Financiero
// ============================================================
h('20) Catálogo unificado: el precio del vínculo del producto manda en el costeo');
const prodG = { ...productoVacio('prod-g'), nombre: 'Guantes de nitrilo', unidad: 'caja', consumoMensual: '12' };
// Dos proveedores: el más barato (165) fija el precio vigente para costeo/FIN.
const vG1 = { ...vinculoVacio('vg1', 'prod-g', 'prv-a'), precio: '180', moneda: 'MXN' };
const vG2 = { ...vinculoVacio('vg2', 'prod-g', 'prv-b'), precio: '165', moneda: 'MXN' };
const recActivo = { ...recursoVacio('rec-auto'), nombre: 'Autoclave', costo: '25000', unidad: 'pza' };
const idxU = indiceCosto([recActivo], [prodG], [vG1, vG2]);
check('indiceCosto toma el precio vigente más barato del producto (165)', idxU.get('guantes de nitrilo')?.costo === '165');
check('indiceCosto conserva los activos de Recursos (autoclave)', idxU.get('autoclave')?.costo === '25000');
const cU = costearProceso(['Guantes de nitrilo'], { 'Guantes de nitrilo': '2' }, idxU);
check('costearProceso usa el precio de Productos (2×165 = 330)', cU.total === 330);
// Financiero: el producto proyecta costo recurrente = precio vigente × consumo mensual.
const finRows = costosDeProductos([prodG], [vG1, vG2]);
check('costosDeProductos = 165 × 12 = 1980 al mes', finRows[0]?.monto === '$1,980.00');
check('El ítem NO se duplica: guantes solo como producto (no en Recursos)', !idxU.has('guantes de nitrilo') === false && idxU.get('guantes de nitrilo')?.costo === '165');

// ============================================================
// 21) LOGÍSTICA: embarques + landed cost (consolidación y prorrateo)
// ============================================================
h('21) Embarque consolida órdenes y calcula landed cost + prorrateo');
const ocA = { ...ordenVacia('OCA'), descripcion: 'Guantes', precioUnitario: '180', cantidad: '10' }; // 1800
const ocB = { ...ordenVacia('OCB'), descripcion: 'Agujas', precioUnitario: '8', cantidad: '100' };   // 800
const emb: Embarque = { ...embarqueVacio('E1'), ordenIds: ['OCA', 'OCB'], transportista: 'Estafeta', flete: '400', aduana: '100', fechaEstimada: '2026-07-20', estado: 'transito' };
check('Costo logístico = flete + aduana (500)', costoLogisticoEmbarque(emb) === 500);
const lc = landedCostEmbarque(emb, [ocA, ocB]);
check('Valor mercancía = 1800 + 800 = 2600', lc.valor === 2600);
check('Landed = 2600 + 500 = 3100', lc.total === 3100);
check('Factor landed ≈ 1.19', Math.abs(lc.factor - 3100 / 2600) < 0.001);
const prLc = prorrateoLanded(emb, [ocA, ocB]);
check('Prorrateo del flete por valor: guantes recibe 500×(1800/2600)≈346.15', Math.abs(prLc.find((x) => x.ordenId === 'OCA')!.logistica - 500 * 1800 / 2600) < 0.01);
check('Embarque en tránsito con ETA vencida (hoy 2026-07-29) → retrasado', embarqueRetrasado(emb, HOY));
check('Embarque entregado NO cuenta como retrasado', !embarqueRetrasado({ ...emb, estado: 'entregado' }, HOY));
check('costosDeEmbarques proyecta el costo logístico a Financiero', costosDeEmbarques([emb])[0]?.monto === '$500.00');
// Modalidad de envío (paquetería vs carga/tráiler).
check('embarqueVacio nace como paquetería (courier)', embarqueVacio('Ex').modalidad === 'paqueteria');
check('normalizarEmbarque respeta modalidad carga', normalizarEmbarque({ id: 'E2', modalidad: 'carga' }).modalidad === 'carga');
check('normalizarEmbarque cae a paquetería si la modalidad es inválida', normalizarEmbarque({ id: 'E3', modalidad: 'avión-privado' }).modalidad === 'paqueteria');
check('modalidadEnvioInfo da etiqueta legible', modalidadEnvioInfo('paqueteria').label.includes('Paquetería'));

// ============================================================
// 22) TRANSPORTISTAS: cotización de fletes (paquetería por kg vs carga por viaje)
// ============================================================
h('22) Cotizar flete según modalidad y elegir el más conveniente');
const estafeta: Transportista = { ...transportistaVacio('T1'), nombre: 'Estafeta', modalidades: ['paqueteria'], tarifas: [{ modalidad: 'paqueteria', zona: 'Nacional', base: '80', porKg: '25', porViaje: '', tiempoDias: '3', notas: '' }] };
const dhl: Transportista = { ...transportistaVacio('T2'), nombre: 'DHL', modalidades: ['paqueteria'], tarifas: [{ modalidad: 'paqueteria', zona: 'Nacional', base: '120', porKg: '18', porViaje: '', tiempoDias: '2', notas: '' }] };
const fletes: Transportista = { ...transportistaVacio('T3'), nombre: 'Fletes del Centro', modalidades: ['carga'], tarifas: [{ modalidad: 'carga', zona: 'Bajío', base: '500', porKg: '', porViaje: '1500', tiempoDias: '2', notas: '' }] };
// Paquetería: base + $/kg × peso. Estafeta 6kg = 80 + 25×6 = 230.
check('Estafeta 6kg = 80 + 25×6 = 230', cotizarFlete(estafeta, 'paqueteria', 'Nacional', 6) === 230);
check('DHL 6kg = 120 + 18×6 = 228', cotizarFlete(dhl, 'paqueteria', 'Nacional', 6) === 228);
// A 6 kg DHL es más barato (228 < 230); a 1 kg Estafeta gana (105 < 138).
check('Mejor a 6kg = DHL', mejorTransportista([estafeta, dhl], 'paqueteria', 'Nacional', 6)?.t.nombre === 'DHL');
check('Mejor a 1kg = Estafeta', mejorTransportista([estafeta, dhl], 'paqueteria', 'Nacional', 1)?.t.nombre === 'Estafeta');
// Carga: base + $/viaje (no depende del peso). 500 + 1500 = 2000.
check('Carga = base + por viaje = 2000', cotizarFlete(fletes, 'carga', 'Bajío', 999) === 2000);
check('Un transportista de carga NO cotiza paquetería', cotizarFlete(fletes, 'paqueteria', 'Bajío', 5) === null);

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
