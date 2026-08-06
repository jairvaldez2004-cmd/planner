// Inspector de SOLO LECTURA del workspace de Grupo Dioquis.
// Correr: DATABASE_URL=<public> node scripts/inspect-dioquis.mjs
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  const ws = await prisma.workspace.findMany();
  console.log('=== WORKSPACES ===');
  for (const w of ws) {
    const d = w.data || {};
    console.log(`  ${w.id}  | nombre="${d.nombre ?? '?'}" tipo=${d.tipo ?? '?'}`);
  }

  const proys = await prisma.proyecto.findMany();
  console.log(`\n=== PROYECTOS (${proys.length}) ===`);
  const byId = new Map(proys.map((p) => [p.id, p.data || {}]));
  // agrupa por workspace
  const porWs = {};
  for (const p of proys) {
    const d = p.data || {};
    (porWs[d.workspaceId ?? '(sin ws)'] ||= []).push({ id: p.id, ...d });
  }
  for (const [wsId, lista] of Object.entries(porWs)) {
    console.log(`\n--- workspace: ${wsId} (${lista.length}) ---`);
    const raiz = lista.filter((p) => !p.padreId);
    const hijosDe = (id) => lista.filter((p) => p.padreId === id);
    const pinta = (p, ind) => {
      const tipo = p.tipoEntidad ? ` [${p.tipoEntidad}${p.estadoEntidad ? '/' + p.estadoEntidad : ''}]` : ' [SIN TIPO]';
      console.log(`${ind}· ${p.nombre}${tipo}  (${p.id})`);
      for (const h of hijosDe(p.id)) pinta(h, ind + '   ');
    };
    for (const r of raiz) pinta(r, '  ');
    const huerfanos = lista.filter((p) => p.padreId && !byId.has(p.padreId));
    for (const h of huerfanos) console.log(`  ⚠ HUÉRFANO (padre inexistente ${h.padreId}): ${h.nombre} (${h.id})`);
  }

  const ucs = await prisma.unidadComercial.findMany();
  console.log(`\n=== UNIDADES COMERCIALES (${ucs.length}) ===`);
  for (const u of ucs) console.log(`  ${u.nombre}  → proyecto ${u.proyectoId}`);

  const ofertas = await prisma.oferta.count();
  const pres = await prisma.presentacion.count();
  console.log(`\nOfertas: ${ofertas} · Presentaciones: ${pres}`);
} catch (e) {
  console.error('FAIL', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
