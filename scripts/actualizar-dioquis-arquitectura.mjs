// Actualiza el workspace de Grupo Dioquis con las decisiones arquitectónicas registradas en
// el cerebro el 2026-08-08. SOLO DATOS: no toca código, esquema ni módulos.
//
// Cada dato va en su campo canónico de la taxonomía (src/domain/taxonomia-entidad.ts):
//   · desarrolladoPor / utilizadoPor  → obligatorios en `producto_tecnologico`, hoy vacíos.
//   · notaEntidad                     → la decisión o la advertencia que aplica a ESE nodo.
//   · RelacionProyecto                → los vínculos que cruzan la jerarquía (BP↔SICA, CPF↔SICA).
//
// Fuentes: 04_Sistemas/ARQUITECTURA_BP_SICA.md · 02_Grafo_ALV/CPF_INTELLIGENCE_Y_OPPORTUNITY_ENGINE.md
//          02_Grafo_ALV/ARQUITECTURA_CORPORATIVA_DIOQUIS.md
//
// Correr: DATABASE_URL=<public> node scripts/actualizar-dioquis-arquitectura.mjs [--dry]

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const WS = 'WS-GRUPO-DIOQUIS';
const P = (s) => `${WS}--${s}`;
const DRY = process.argv.includes('--dry');
const L = (...xs) => xs.join(' ');

// ─────────────────────────────── notas y campos canónicos por nodo

const ECOSISTEMA = [
  'Corporativo Palo Fierro', 'PROCNOR', 'XLine', 'Macao Marketing',
  'Comercializadora General Commerce', 'MagnoCommodities', 'Inmobiliaria ALV',
  'Agrícola ALV', 'Altercing Studio',
];

const NODOS = {
  // ---------- matriz ----------
  [P('GRUPO-DIOQUIS')]: {
    notaEntidad: L(
      'Board de Holdings: posee, decide y asigna capital; NO opera.',
      'De la capa de inteligencia recibe SOLO lo estratégico (oportunidades de portafolio, riesgos,',
      'sectores nuevos, adquisiciones, capital requerido, empresas recomendadas) para decidir',
      'invertir · no invertir · crear · adquirir · vender · fusionar · expandir.',
      'El dato operacional granular NO llega hasta aquí: lo opera CPF. Ref: CPF_INTELLIGENCE_Y_OPPORTUNITY_ENGINE.md (2026-08-08).',
    ),
  },

  // ---------- holdings ----------
  [P('HOLDING-BUSINESS')]: {
    notaEntidad: L(
      '⚠ Este holding NO opera la inteligencia de datos del ecosistema.',
      'Se evaluó si los datos transversales los explotaría este holding o CPF: la decisión (2026-08-08) es que el operador es CPF.',
      'Dioquis Business conserva su función de holding — gobierno de sus empresas, supervisión, estrategia sectorial, capital,',
      'propiedad y resultados agregados — y puede recibir información CONSOLIDADA para gobernar.',
      'Razón: un holding_sectorial no opera; convertirlo en operador de datos crearía un segundo CPF dentro del holding que lo gobierna.',
    ),
  },
  [P('HOLDING-TECHNOLOGIES')]: {
    notaEntidad: L(
      'Gobierna a sus 6 empresas (posee, decide estrategia sectorial, asigna capital del holding).',
      'Distinto de la coordinación de proyectos que ejerce CPF sobre esas mismas empresas: CPF coordina entregables, no gobierna.',
      'Sus empresas suministran capacidades a SICA de forma TRANSVERSAL, no jerárquica.',
    ),
  },

  // ---------- CPF ----------
  [P('CORPORATIVO-PALO-FIERRO')]: {
    notaEntidad: L(
      'CPF coordina proyectos (planea/crea/expande/sistematiza/automatiza), NO gobierna las empresas que coordina —',
      'el gobierno corporativo de cada holding sectorial es suyo. CPF puede ser simultáneamente cliente interno +',
      'coordinador de proyecto + especificador de requerimientos, sin ser holding padre.',
      '‖ DECISIÓN 2026-08-08: CPF es además la ENTIDAD OPERATIVA que explota los datos autorizados del ecosistema',
      '(CPF Intelligence: analytics · benchmarking · Opportunity Engine · Opportunity Router). Dioquis Business NO opera esa información.',
      'CPF Intelligence es capacidad TRANSVERSAL que alimenta a las 8 unidades comerciales; NO es una novena unidad',
      'y su clasificación organizacional queda pospuesta a propósito. Ref: CPF_INTELLIGENCE_Y_OPPORTUNITY_ENGINE.md.',
    ),
  },

  // ---------- empresa tecnológica que opera ----------
  [P('DIOQUIS-SOFTWARE')]: {
    notaEntidad: L(
      'Transición ejecutada 2026-08-08 (aprobada por el propietario): hereda operación real, diagnóstico y blueprint de ALV Technologies.',
      'Dioquis Technologies queda compuesto directamente por sus 6 empresas.',
      '‖ ALCANCE: SOLO software. La IA es de Dioquis AI, la infraestructura de Dioquis Hardware, las redes de Dioquis Telecom,',
      'la seguridad de Dioquis Cybersecurity y la automatización física de Dioquis Robotics —',
      'esa frontera es la razón de haber dividido el holding en 6 y debe defenderse activamente.',
      '‖ Será responsable de Business Planner, SICA, la Capability Library, el workflow engine, el event engine y el rule engine.',
    ),
  },

  // ---------- las 5 empresas objetivo: su papel en la arquitectura de SICA ----------
  [P('DIOQUIS-AI')]: { notaEntidad: 'Suministrará a SICA: agentes, análisis, automatización inteligente y modelos. Dioquis AI desarrolla la capacidad; Dioquis Software la integra dentro del producto. Relación transversal, no jerárquica. ⚠ Empresa objetivo: no constituida.' },
  [P('DIOQUIS-HARDWARE')]: { notaEntidad: 'Suministrará a SICA: terminales, sensores, POS y dispositivos. ⚠ Empresa objetivo: no constituida.' },
  [P('DIOQUIS-TELECOM')]: { notaEntidad: 'Suministrará a SICA: conectividad, redes y comunicaciones. ⚠ Empresa objetivo: no constituida.' },
  [P('DIOQUIS-ROBOTICS')]: { notaEntidad: 'Suministrará a SICA: ejecución y automatización física. ⚠ Empresa objetivo: no constituida.' },
  [P('DIOQUIS-CYBERSECURITY')]: { notaEntidad: 'Suministrará a SICA: identidad, permisos, auditoría y seguridad — DEFINE y valida los controles; CPF Intelligence opera dentro de ellos, no los define para sí mismo. ⚠ Empresa objetivo: no constituida.' },

  // ---------- productos: campos canónicos + su papel ----------
  [P('PROD-BUSINESS-PLANNER')]: {
    desarrolladoPor: 'Dioquis Software',
    utilizadoPor: ['Corporativo Palo Fierro (operador principal)', ...ECOSISTEMA.slice(1)],
    notaEntidad: L(
      'Fábrica de planos de CPF. ARQUITECTURA OBJETIVO (2026-08-08, NO implementada): su salida —el Plano Operativo versionado—',
      'se convertirá en la CONFIGURACIÓN EJECUTABLE de SICA, y la operación real de SICA retroalimentará al Planner',
      'para generar versiones nuevas del plano. Regla dura: SICA nunca modifica el plano canónico — aporta evidencia,',
      'el Planner propone, un humano aprueba, se publica una versión. Ref: ARQUITECTURA_BP_SICA.md.',
      '‖ Prioridad actual: terminar el Planner y obtener mapas operativos reales. Toda la arquitectura posterior depende de eso.',
    ),
  },
  [P('PROD-SICA')]: {
    desarrolladoPor: 'Dioquis Software',
    utilizadoPor: ECOSISTEMA,
    notaEntidad: L(
      'ARQUITECTURA OBJETIVO (2026-08-08, NO implementada — NO se desarrolla SICA todavía):',
      'SICA ejecutará el modelo operativo diseñado en Business Planner, usando el Plano Operativo como configuración.',
      'NO es un ERP tradicional: 4 capas previstas — SICA Core (infraestructura común) · Capability Library (capacidades reutilizables) ·',
      'Configuración de Empresa · Custom Extensions. Modelo event-driven: trigger → condición → acción → destino/actor.',
      'El centro de la experiencia es el TRABAJO que toca hacer según el mapa, no una colección de módulos.',
      '‖ ⚠ DOS CONTRADICCIONES ABIERTAS con la ficha del cerebro, pendientes de decisión del propietario:',
      '(1) el nombre — la ficha dice "Sistema Integral de Comercio Automatizado", la visión nueva dice "Control Administrativo";',
      '(2) los 9 bloques fijos de la ficha se diseñaron para una comercializadora (Especias ALV): como núcleo genérico harían que',
      'toda empresa nueva herede forma de commodities. Propuesta: reinterpretarlos como una Configuración de Empresa sobre el Core.',
      'Ref: ARQUITECTURA_BP_SICA.md · SICA.md.',
    ),
  },
  [P('PROD-EXPORTS-HUB')]: {
    desarrolladoPor: 'Dioquis Software',
    utilizadoPor: ['Comercializadora General Commerce', 'MagnoCommodities'],
    notaEntidad: '⚠ Decisión abierta: el nombre queda corto si la plataforma administra importaciones, logística, aduanas, cotizaciones, documentos y embarques. Propuesta: nombre más amplio con "Exports Hub" como módulo.',
  },
  [P('PROD-ERP')]: { desarrolladoPor: 'Dioquis Software', utilizadoPor: ECOSISTEMA, notaEntidad: '⚠ Producto objetivo. Bajo la arquitectura BP→SICA podría no ser un producto aparte sino un conjunto de capabilities dentro de SICA. Decisión pendiente.' },
  [P('PROD-CRM')]: { desarrolladoPor: 'Dioquis Software', utilizadoPor: ECOSISTEMA, notaEntidad: '⚠ Producto objetivo. Misma pregunta que el ERP: ¿producto aparte o capability de SICA? Decisión pendiente.' },
};

// ─────────────────────────────── relaciones que cruzan la jerarquía

const RELACIONES = [
  { id: 'REL-BP-SICA', a: P('PROD-BUSINESS-PLANNER'), b: P('PROD-SICA'),
    etiqueta: 'plano → configuración ejecutable · operación → evidencia (ciclo)' },
  { id: 'REL-CPF-SICA', a: P('CORPORATIVO-PALO-FIERRO'), b: P('PROD-SICA'),
    etiqueta: 'CPF Intelligence explota los datos autorizados' },
  { id: 'REL-CPF-BP', a: P('CORPORATIVO-PALO-FIERRO'), b: P('PROD-BUSINESS-PLANNER'),
    etiqueta: 'operador principal (fábrica de planos)' },
];

// ─────────────────────────────── ejecución

try {
  const obj = (v) => (v && typeof v === 'object') ? v : {};
  let nodosOk = 0, faltantes = [];

  for (const [id, patch] of Object.entries(NODOS)) {
    const r = await prisma.proyecto.findUnique({ where: { id } });
    if (!r) { faltantes.push(id); continue; }
    nodosOk++;
    if (!DRY) {
      await prisma.proyecto.update({
        where: { id },
        data: { data: { ...obj(r.data), ...patch }, version: { increment: 1 } },
      });
    }
  }

  // El diagnóstico que Dioquis Software heredó de ALV TECH describe el alcance ANTERIOR a la
  // división en 6 empresas ("software, IA, automatizaciones, infraestructura y ciberseguridad").
  // Corregirlo es parte de dejar cada dato como va.
  const diag = await prisma.proyectoDiagnostico.findUnique({ where: { proyectoId: P('DIOQUIS-SOFTWARE') } });
  let diagCorregido = false;
  if (diag) {
    const RESUMEN_NUEVO = 'Empresa de PRODUCTOS DE SOFTWARE del grupo: diseña, desarrolla, mantiene, opera y comercializa plataformas (Business Planner, SICA, ALV Exports Hub). NO hace IA (Dioquis AI), ni infraestructura (Dioquis Hardware), ni redes (Dioquis Telecom), ni seguridad (Dioquis Cybersecurity), ni automatización física (Dioquis Robotics).';
    const d = obj(diag.diagnostico), b = obj(diag.blueprint);
    if (String(d.resumen ?? '').includes('IA, automatizaciones, infraestructura')) {
      diagCorregido = true;
      if (!DRY) {
        await prisma.proyectoDiagnostico.update({
          where: { proyectoId: P('DIOQUIS-SOFTWARE') },
          data: {
            diagnostico: { ...d, resumen: RESUMEN_NUEVO, restricciones: 'Da servicio prioritario a empresas del grupo; puede atender clientes externos. Su frontera con las 5 empresas tecnológicas hermanas debe defenderse activamente (ver ARQUITECTURA_CORPORATIVA_DIOQUIS.md).' },
            blueprint: { ...b, resumen: RESUMEN_NUEVO },
            actualizadoEn: new Date().toISOString(),
          },
        });
      }
    }
  }

  let relsOk = 0;
  for (const rel of RELACIONES) {
    const [a, b] = await Promise.all([
      prisma.proyecto.findUnique({ where: { id: rel.a } }),
      prisma.proyecto.findUnique({ where: { id: rel.b } }),
    ]);
    if (!a || !b) { faltantes.push(`relación ${rel.id}`); continue; }
    relsOk++;
    if (!DRY) {
      await prisma.relacionProyecto.upsert({
        where: { id: rel.id },
        create: { id: rel.id, workspaceId: WS, aId: rel.a, bId: rel.b, etiqueta: rel.etiqueta },
        update: { aId: rel.a, bId: rel.b, etiqueta: rel.etiqueta },
      });
    }
  }

  console.log(`Nodos actualizados: ${nodosOk}/${Object.keys(NODOS).length}`);
  console.log(`Relaciones: ${relsOk}/${RELACIONES.length}`);
  console.log(`Diagnóstico de Dioquis Software corregido (alcance pre-división): ${diagCorregido ? 'SÍ' : 'no hacía falta'}`);
  if (faltantes.length) console.log('⚠ No encontrados:', faltantes.join(', '));
  console.log(DRY ? '\n--dry: no se escribió nada.' : '\n✅ Aplicado.');
} catch (e) {
  console.error('\n❌ FAIL —', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
