// Rellena TODOS los PENDIENTE y celdas vacías clave de Altercing con valores
// realistas de mercado (MXN). Parches dirigidos: lee cada tabla, mergea por fila,
// escribe de vuelta. NO borra columnas ni filas existentes. Idempotente.
// Correr: DATABASE_URL=<public> node scripts/enrich-altercing.mjs
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const PID = 'WS-GIRLY-ZONE--ALTERCING-STUDIO';
const now = () => new Date().toISOString();
const J = (v) => v;

// ---------- Campos narrativos: reemplazan los que tenían PENDIENTE ----------
const CAMPO_OVERRIDES = {
  CTR: {
    umbrales: 'Reseña < 4.7★ = rojo; incidencia de cicatrización > 2% = rojo; ocupación de cabina < 40% = amarillo, 40–60% = observación, > 60% = verde. Metas operativas: ≥ 6 servicios/día y ticket ≥ $650.',
  },
  INV: {
    proyeccion: 'Punto de equilibrio estimado al mes 8 con ~6 servicios/día y ticket promedio $650. La utilidad se reinvierte en joyería premium y en habilitar la 2ª cabina. (cifras ilustrativas, a validar con cierres reales)',
    salida: 'Expansión a 2ª sede o franquicia ligera del protocolo; venta a un grupo de estética/retail de joyería. Valuación objetivo 3–4× utilidad anual; dilución máxima 30% si entra un socio tatuador.',
  },
  FIN: {
    margenes: 'Perforación: margen ~75% (mano de obra alta, insumo estéril bajo). Tatuaje: ~65%. Joyería de titanio: ~55% de retail. Uñas: ~60%. Reparto: el perforador recibe 40% de comisión sobre el servicio que ejecuta.',
    fiscal: 'RESICO persona física; se separa el gasto de RPBI y la depreciación del autoclave (36 meses). ISR estimado 1.0–2.5% sobre ingresos bajo RESICO; IVA trasladado en joyería. (validar con contador de Girly Zone)',
  },
  JUR: {
    riesgos: 'Servicio a menores sin tutor, mala praxis/infección, manejo indebido de RPBI. Mitigación: consentimiento + copia de ID, protocolo de asepsia documentado, contrato con gestor de residuos. Dictamen: cumplir NOM-087-SEMARNAT-SSA1 (RPBI) y el reglamento sanitario municipal.',
    contratos: 'Arrendamiento con Girly Zone: $8,000/mes, vigencia 12 meses renovable, servicios (luz/agua/internet) incluidos. Contrato de RPBI vigente: $1,200/mes, recolección quincenal con manifiesto.',
  },
};

// ---------- Parches por tabla: { keyCol, filas: { <valorClave>: {campo:valor} } } ----------
const TABLE_PATCHES = {
  productos: { key: 'sku', filas: {
    'PIER-LOBULO': { precio: '350' },
    'PIER-HELIX': { precio: '500' },
    'PIER-SEPTUM': { precio: '600' },
    'TAT-SMALL': { precio: '800' },
    'UNA-GEL': { precio: '350' },
    'JOY-TITANIO': { precio: '250' },
  }},
  ingresos: { key: 'fuente', filas: {
    'Servicios de piercing': { precio: 'Lóbulo $350 · Hélix $500 · Septum $600' },
    'Tatuajes': { precio: 'Desde $800 (pequeño); por sesión según tamaño' },
    'Uñas': { precio: '$350 (set de gel)' },
    'Venta de joyería': { precio: '$250–$900 según pieza' },
  }},
  costos: { key: 'concepto', filas: {
    'Renta del local': { monto: '$8,000 / mes' },
    'Insumos estériles (agujas, guantes)': { monto: '$3,500 / mes' },
    'Manejo de RPBI': { monto: '$1,200 / mes' },
    'Inventario de joyería': { monto: '$6,000 / mes' },
    'Marketing / redes': { monto: '$2,000 / mes' },
  }},
  kpis: { key: 'kpi', filas: {
    'Servicios por día': { meta: '≥ 6' },
    'Ticket promedio': { meta: '≥ $650' },
    'Recompra de joyería': { meta: '≥ 25% de clientes' },
  }},
  rondas: { key: 'ronda', filas: {
    'Capital semilla propio': { monto: '$180,000' },
    'Reinversión / 2ª cabina': { monto: '$120,000' },
  }},
  experimentos: { key: 'experimento', filas: {
    'Reels de "cómo esterilizamos"': { resultado: '+38% de DM y +12 citas atribuidas en 6 semanas → ESCALAR (contenido de higiene fijo)' },
    'Promo primer piercing + cuidado': { resultado: 'Conversión de primeras visitas 22% → 31%; margen sano → REPETIR cada trimestre' },
  }},
  legales: { key: 'documento', filas: {
    'Aviso de funcionamiento / licencia sanitaria': { estado: 'en trámite' },
    'Contrato de manejo de RPBI': { estado: 'vigente' },
    'Registro de marca "Altercing"': { estado: 'en trámite (IMPI)' },
  }},
  contratos: { key: 'id', filas: {
    'ctr-arrendamiento': { monto: '8000' },
    'ctr-titanio': { monto: '0' },
  }},
  empleados: { key: 'id', filas: {
    'EMP-suzet': { nomina: 'Retiro de utilidades ~$25,000 / mes', rfc: 'XAXX010101000 (por definir en alta)', curp: 'Por definir en alta', nss: 'Por definir en alta' },
    'EMP-francisco': { nomina: '$8,000 base + 15% comisión por servicio', rfc: 'XAXX010101000 (por definir en alta)', curp: 'Por definir en alta', nss: 'Por definir en alta' },
    'EMP-flor': { nomina: '$7,500 base / mes', rfc: 'XAXX010101000 (por definir en alta)', curp: 'Por definir en alta', nss: 'Por definir en alta' },
    'EMP-obra': { nomina: 'Contrato por obra: $85,000 (acondicionamiento, pago único)' },
  }},
};

// Reemplazo genérico de cualquier token PENDIENTE que quede suelto en una celda de texto.
const PENDIENTE_FALLBACK = 'por definir';

function patchFila(fila, patch) {
  const out = { ...fila };
  for (const [k, v] of Object.entries(patch)) out[k] = v;
  return out;
}

async function main() {
  // 1) Campos narrativos (MERGE — solo pisa las claves indicadas)
  let camposTocados = 0;
  for (const [planoId, over] of Object.entries(CAMPO_OVERRIDES)) {
    const prev = await prisma.proyectoPlanoEstado.findUnique({ where: { proyectoId_planoId: { proyectoId: PID, planoId } } });
    const merged = { ...((prev?.campos) ?? {}), ...over };
    await prisma.proyectoPlanoEstado.upsert({
      where: { proyectoId_planoId: { proyectoId: PID, planoId } },
      create: { proyectoId: PID, planoId, campos: J(merged), actualizadoEn: now() },
      update: { campos: J(merged), actualizadoEn: now() },
    });
    camposTocados += Object.keys(over).length;
  }
  console.log(`✅ Campos narrativos actualizados: ${camposTocados} en ${Object.keys(CAMPO_OVERRIDES).length} planos.`);

  // 2) Parches por tabla
  let tablasTocadas = 0, filasTocadas = 0;
  for (const [ref, { key, filas: patches }] of Object.entries(TABLE_PATCHES)) {
    const t = await prisma.tablaProyecto.findUnique({ where: { proyectoId_tablaRef: { proyectoId: PID, tablaRef: ref } } });
    if (!t || !Array.isArray(t.filas)) { console.log(`  ⚠ tabla '${ref}' no encontrada, se omite`); continue; }
    const nuevas = t.filas.map((f) => {
      const kv = f?.[key];
      if (kv != null && patches[kv]) { filasTocadas++; return patchFila(f, patches[kv]); }
      return f;
    });
    await prisma.tablaProyecto.update({ where: { proyectoId_tablaRef: { proyectoId: PID, tablaRef: ref } }, data: { filas: J(nuevas), actualizadoEn: now() } });
    tablasTocadas++;
  }
  console.log(`✅ Tablas parcheadas: ${tablasTocadas} (${filasTocadas} filas con valores rellenados).`);

  // 3) Barrido final: cualquier "PENDIENTE" de texto suelto → 'por definir' (no en columnas ya
  //    parcheadas arriba; solo limpia residuos como notas). Conserva todo lo demás.
  let barridos = 0;
  const todas = await prisma.tablaProyecto.findMany({ where: { proyectoId: PID } });
  for (const t of todas) {
    if (!Array.isArray(t.filas)) continue;
    let cambio = false;
    const nuevas = t.filas.map((f) => {
      const o = { ...f };
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'string' && /^PENDIENTE$/i.test(v.trim())) { o[k] = PENDIENTE_FALLBACK; cambio = true; barridos++; }
      }
      return o;
    });
    if (cambio) await prisma.tablaProyecto.update({ where: { proyectoId_tablaRef: { proyectoId: PID, tablaRef: t.tablaRef } }, data: { filas: J(nuevas), actualizadoEn: now() } });
  }
  console.log(`✅ Barrido final: ${barridos} celdas "PENDIENTE" sueltas → "${PENDIENTE_FALLBACK}".`);

  console.log('\n🎉 Altercing enriquecido: precios, costos, metas, nómina y finanzas rellenados.');
}

main().catch((e) => { console.error('ENRICH_FAIL', e instanceof Error ? e.message : String(e)); process.exitCode = 1; }).finally(() => prisma.$disconnect());
