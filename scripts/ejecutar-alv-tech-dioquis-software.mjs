// Ejecuta en el Planner la transición ALV TECH → Dioquis Software ya aprobada y registrada
// en el cerebro (ARQUITECTURA_CORPORATIVA_DIOQUIS.md § Decisión 1, 2026-08-08).
//
// Verificado antes de escribir (inspect-alv-tech.mjs): ALV TECH no tiene UCs, sedes, ofertas,
// presentaciones, departamentos, procesos, tablas ni conversaciones — solo un diagnóstico real
// (blueprint de 14 planos, generado 2026-08-05). Ese diagnóstico se MUEVE a Dioquis Software
// (que no tenía ninguno); no se pierde nada. Dioquis Software ya tiene 5 productos colgando
// (Business Planner, SICA, ALV Exports Hub, ERP, CRM) — por eso su id sobrevive, no el de ALV TECH.
//
// PROCNOR y XLine: NO se tocan. Por instrucción explícita quedan donde están.
//
// Correr: DATABASE_URL=<public> node scripts/ejecutar-alv-tech-dioquis-software.mjs [--dry]
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const ALV_TECH_ID = 'WS-GRUPO-DIOQUIS--ALV-TECH';
const DIOQUIS_SOFTWARE_ID = 'WS-GRUPO-DIOQUIS--DIOQUIS-SOFTWARE';
const DRY = process.argv.includes('--dry');

function ahora() { return new Date().toISOString(); }

try {
  const alvTech = await prisma.proyecto.findUnique({ where: { id: ALV_TECH_ID } });
  const dioSoft = await prisma.proyecto.findUnique({ where: { id: DIOQUIS_SOFTWARE_ID } });
  if (!alvTech || !dioSoft) throw new Error('Falta uno de los dos proyectos — abortando sin tocar nada.');

  const diagAlvTech = await prisma.proyectoDiagnostico.findUnique({ where: { proyectoId: ALV_TECH_ID } });
  const diagDioSoft = await prisma.proyectoDiagnostico.findUnique({ where: { proyectoId: DIOQUIS_SOFTWARE_ID } });
  if (diagDioSoft) throw new Error('Dioquis Software YA tiene un diagnóstico propio — no se sobrescribe automáticamente. Revisar a mano.');

  // Reconfirma en vivo que ALV TECH sigue sin datos operativos antes de tocar nada (defensa
  // contra que algo se haya cargado entre la inspección y esta corrida).
  const [ucs, ofertas, tablas, deptos] = await Promise.all([
    prisma.unidadComercial.count({ where: { proyectoId: ALV_TECH_ID } }),
    prisma.oferta.count({ where: { proyectoId: ALV_TECH_ID } }),
    prisma.tablaProyecto.count({ where: { proyectoId: ALV_TECH_ID } }),
    prisma.departamento.count({ where: { proyectoId: ALV_TECH_ID } }),
  ]);
  if (ucs || ofertas || tablas || deptos) {
    throw new Error(`ALV TECH tiene datos operativos (ucs=${ucs} ofertas=${ofertas} tablas=${tablas} deptos=${deptos}) — abortando, requiere revisión manual.`);
  }

  console.log('--- Plan ---');
  console.log('1. Mover diagnóstico de ALV TECH → Dioquis Software (renombrando nombreEntidad dentro del JSON).');
  console.log('2. Actualizar Dioquis Software: estadoEntidad objetivo→existente, nombreAnterior=ALV Technologies, alias=ALV TECH.');
  console.log('3. Eliminar el proyecto ALV TECH (diagnóstico ya movido, sin más datos colgando).');
  console.log('4. PROCNOR y XLine: sin cambios (no incluidos en este script).');

  if (DRY) { console.log('\n--dry: no se escribió nada.'); process.exit(0); }

  await prisma.$transaction(async (tx) => {
    // 1. Mover diagnóstico
    const diagnostico = JSON.parse(JSON.stringify(diagAlvTech.diagnostico).replaceAll('ALV TECH', 'Dioquis Software'));
    const blueprint = JSON.parse(JSON.stringify(diagAlvTech.blueprint).replaceAll('ALV TECH', 'Dioquis Software'));
    await tx.proyectoDiagnostico.create({
      data: { proyectoId: DIOQUIS_SOFTWARE_ID, diagnostico, blueprint, actualizadoEn: ahora() },
    });
    await tx.proyectoDiagnostico.delete({ where: { proyectoId: ALV_TECH_ID } });

    // 2. Actualizar Dioquis Software
    await tx.proyecto.update({
      where: { id: DIOQUIS_SOFTWARE_ID },
      data: {
        data: {
          ...dioSoft.data,
          estadoEntidad: 'existente',
          nombreAnterior: 'ALV Technologies',
          alias: 'ALV TECH',
          notaEntidad: 'Transición ejecutada 2026-08-08 (aprobada por el propietario): hereda operación real, diagnóstico y blueprint de ALV Technologies. Dioquis Technologies queda compuesto directamente por sus 6 empresas.',
        },
        version: { increment: 1 },
      },
    });

    // 3. Retirar el proyecto ALV TECH
    await tx.proyecto.delete({ where: { id: ALV_TECH_ID } });
  });

  console.log('\n✅ Ejecutado. Dioquis Software ahora es "existente", con el diagnóstico heredado. ALV TECH retirado.');
} catch (e) {
  console.error('\n❌ FAIL —', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
