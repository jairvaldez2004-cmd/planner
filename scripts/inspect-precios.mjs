// Lista de solo lectura: UC -> Oferta -> Presentaciones con precio actual.
// Correr: DATABASE_URL=<public> node scripts/inspect-precios.mjs
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const PID = 'WS-GIRLY-ZONE--ALTERCING-STUDIO';
try {
  const ucs = await prisma.unidadComercial.findMany({ where: { proyectoId: PID } });
  const ofertas = await prisma.oferta.findMany({ where: { proyectoId: PID } });
  const pres = await prisma.presentacion.findMany({ where: { proyectoId: PID } });
  const ucById = Object.fromEntries(ucs.map(u => [u.id, u.nombre]));
  const presByOferta = {};
  for (const p of pres) (presByOferta[p.ofertaId] ||= []).push(p);

  for (const o of ofertas) {
    console.log(`\n### UC: ${ucById[o.ucId] || o.ucId}  |  OFERTA: ${o.nombre}  (${o.id})`);
    const list = presByOferta[o.id] || [];
    for (const p of list.sort((a, b) => a.nombre.localeCompare(b.nombre))) {
      const d = p.data || {};
      console.log(`   - ${p.nombre}  ::  precio=${JSON.stringify(d.precio)}  unidad=${d.unidad ?? ''}  min=${d.minimo ?? ''}  | id=${p.id}`);
    }
  }
  console.log(`\nTOTAL presentaciones: ${pres.length}`);
} catch (e) {
  console.error('FAIL', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
