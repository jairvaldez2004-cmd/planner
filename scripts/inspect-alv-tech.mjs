// Inspector de solo lectura: ¿qué datos reales cuelgan de ALV TECH y de Dioquis Software
// antes de fusionarlos? Corre contra la DB pública de Railway.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const IDS = ['WS-GRUPO-DIOQUIS--ALV-TECH', 'WS-GRUPO-DIOQUIS--DIOQUIS-SOFTWARE'];

try {
  for (const id of IDS) {
    console.log(`\n=== ${id} ===`);
    const p = await prisma.proyecto.findUnique({ where: { id } });
    console.log('data:', JSON.stringify(p?.data, null, 2));

    const [ucs, sedes, ofertas, presentaciones, deptos, procesos, planos, tablas, diag, conv] = await Promise.all([
      prisma.unidadComercial.count({ where: { proyectoId: id } }),
      prisma.sede.count({ where: { proyectoId: id } }),
      prisma.oferta.count({ where: { proyectoId: id } }),
      prisma.presentacion.count({ where: { proyectoId: id } }),
      prisma.departamento.count({ where: { proyectoId: id } }),
      prisma.proceso.count({ where: { proyectoId: id } }),
      prisma.proyectoPlanoEstado.count({ where: { proyectoId: id } }),
      prisma.tablaProyecto.count({ where: { proyectoId: id } }),
      prisma.proyectoDiagnostico.findUnique({ where: { proyectoId: id } }),
      prisma.conversacion.count({ where: { clave: { contains: id } } }),
    ]);
    console.log({ ucs, sedes, ofertas, presentaciones, deptos, procesos, planosConCampos: planos, tablas, tieneDiagnostico: !!diag, conversaciones: conv });
  }

  console.log('\n=== hijos de ALV TECH ===');
  const hijos = await prisma.proyecto.findMany();
  for (const h of hijos) {
    if ((h.data)?.padreId === 'WS-GRUPO-DIOQUIS--ALV-TECH') console.log('  hijo:', h.id, h.data?.nombre);
  }

  console.log('\n=== relaciones (RelacionProyecto) que tocan ALV TECH o Dioquis Software ===');
  const rels = await prisma.relacionProyecto.findMany();
  for (const r of rels) {
    if (r.aId?.includes('ALV-TECH') || r.bId?.includes('ALV-TECH') || r.aId?.includes('DIOQUIS-SOFTWARE') || r.bId?.includes('DIOQUIS-SOFTWARE')) {
      console.log(' ', r);
    }
  }
} catch (e) {
  console.error('FAIL', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
