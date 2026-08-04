// Inspector de solo lectura del proyecto Altercing en la DB conectada.
// Correr: DATABASE_URL=<public> node scripts/inspect-altercing.mjs
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const PID = 'WS-GIRLY-ZONE--ALTERCING-STUDIO';
try {
  const proy = await prisma.proyecto.findUnique({ where: { id: PID } });
  const diag = await prisma.proyectoDiagnostico.findUnique({ where: { proyectoId: PID } });
  const planos = await prisma.proyectoPlanoEstado.findMany({ where: { proyectoId: PID } });
  const tablas = await prisma.tablaProyecto.findMany({ where: { proyectoId: PID } });
  const procesos = await prisma.proceso.count({ where: { proyectoId: PID } });
  const ucs = await prisma.unidadComercial.count({ where: { proyectoId: PID } });
  const ofertas = await prisma.oferta.count({ where: { proyectoId: PID } });
  const presentaciones = await prisma.presentacion.count({ where: { proyectoId: PID } });

  console.log('PROYECTO:', proy ? 'existe' : 'NO EXISTE');
  const bp = diag?.blueprint;
  const planosSel = bp && Array.isArray(bp.planos) ? bp.planos.map(p => p.id) : [];
  console.log('BLUEPRINT planos seleccionados:', planosSel.length ? planosSel.join(', ') : '(ninguno)');
  console.log('PLANOS con campos:', planos.map(p => `${p.planoId}(${Object.keys(p.campos||{}).length})`).join(', '));
  console.log('UCs:', ucs, '| Ofertas:', ofertas, '| Presentaciones:', presentaciones, '| Procesos:', procesos);
  console.log('TABLAS (' + tablas.length + '):');
  for (const t of tablas) {
    const filas = Array.isArray(t.filas) ? t.filas : [];
    // detecta celdas vacías o PENDIENTE
    let vacias = 0, pend = 0, celdas = 0;
    for (const f of filas) for (const v of Object.values(f || {})) {
      celdas++;
      if (v === '' || v === null || v === undefined) vacias++;
      else if (typeof v === 'string' && /PENDIENTE/i.test(v)) pend++;
    }
    console.log(`  - ${t.tablaRef}: ${filas.length} filas | ${vacias} celdas vacías | ${pend} PENDIENTE`);
  }

  // Campos con PENDIENTE
  console.log('\nCAMPOS con PENDIENTE:');
  for (const p of planos) {
    const pend = Object.entries(p.campos || {}).filter(([, v]) => typeof v === 'string' && /PENDIENTE/i.test(v));
    if (pend.length) console.log(`  - ${p.planoId}: ${pend.map(([k]) => k).join(', ')}`);
  }
} catch (e) {
  console.error('INSPECT_FAIL', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
