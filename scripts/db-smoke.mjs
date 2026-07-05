// Smoke test de persistencia local (no parte del build). Verifica DB real: insert→read→historial→cleanup.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const id = 'SMOKE-PLANO-1';

try {
  await prisma.plano.upsert({
    where: { id },
    create: { id, data: { id, entidad: 'smoke', productos: [], cotizaciones: [], documentos: [], version: 0, publicado: false }, version: 0 },
    update: {},
  });
  const got = await prisma.plano.findUnique({ where: { id } });

  await prisma.versionSnapshot.upsert({
    where: { planoId_version: { planoId: id, version: 1 } },
    create: { planoId: id, version: 1, publicado: true, timestamp: new Date().toISOString(), data: {} },
    update: {},
  });
  const hist = await prisma.versionSnapshot.findMany({ where: { planoId: id }, orderBy: { version: 'asc' } });

  console.log('PLANO_LEIDO=', got ? got.id : 'null', '| HISTORIAL=', hist.length);

  // cleanup
  await prisma.versionSnapshot.deleteMany({ where: { planoId: id } });
  await prisma.plano.delete({ where: { id } });
  console.log('SMOKE_OK');
} catch (e) {
  console.error('SMOKE_FAIL', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
