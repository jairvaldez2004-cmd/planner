// Contenido profesional de EJEMPLO para el Catálogo de Marketing anidado de Altercing.
// Producto → Campañas (tipo/CTA) → Formatos (specs/caract/CTA + guion con tomas + minuta).
// Idempotente: upsert de TablaProyecto 'mkt_catalogo'. Correr:
//   DATABASE_URL=<public> node scripts/seed-mkt-catalogo.mjs
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const PID = 'WS-GIRLY-ZONE--ALTERCING-STUDIO';

const CATALOGO = [
  // ============================================================ PRODUCTO 1
  {
    id: 'pm-primer-piercing', producto: 'Primer piercing seguro (Lóbulo / Hélix)', categoria: 'Piercing',
    descripcion: 'Servicio ancla de adquisición: el primer piercing con material estéril de un solo uso y titanio grado implante. Baja la barrera del miedo con higiene visible.',
    precio: 'Lóbulo $350 · Hélix $500',
    campanas: [
      {
        id: 'cm-sin-miedo', nombre: 'Primer piercing sin miedo', tipo: 'Adquisición',
        cta: 'Agenda tu cita por DM', objetivo: 'Convertir primeras visitas: DM → cita agendada.',
        temporada: 'Todo el año (refuerzo Ago y Abr–Jul)', canal: 'Instagram + TikTok', presupuesto: '$1,500/mes (mayormente orgánico + pauta ligera)',
        kpi: 'Citas atribuidas por DM · costo por cita ≤ $60', mensaje: 'El miedo a "que se infecte" se vence mostrando la asepsia, no ocultándola.',
        formatos: [
          {
            id: 'fm-reel-esteril', formato: 'Reel Instagram — "Así esterilizamos"',
            objetivo: 'Prueba de higiene visible que rompe la objeción principal (infección).',
            especificaciones: '9:16 · 1080×1920 · 22–28 s · sin marca de agua de otras apps · subtítulos quemados',
            caracteristicas: 'Tono cercano y honesto. Hook en los primeros 2 s. Música trend suave. B-roll real del autoclave y el sobre sellado abriéndose frente a cámara.',
            cta: 'Guarda este reel y escríbenos "PIERCING" por DM para agendar.',
            hashtags: '#piercingseguro #titaniogradoimplante #primerpiercing #girlyzone #bodyartseguro',
            guion: [
              { n: 1, plano: 'Primer plano (manos)', descripcion: 'Suzet abre el sobre estéril sellado frente a la cámara.', vozTexto: 'Texto en pantalla: "Aguja sellada, un solo uso."', duracion: '3 s', audio: 'Trend suave, volumen bajo' },
              { n: 2, plano: 'Detalle 4K', descripcion: 'Autoclave cerrándose; luz indicadora del ciclo 134°C.', vozTexto: 'Voz en off: "Todo se esteriliza a 134 grados."', duracion: '4 s', audio: 'SFX del cierre' },
              { n: 3, plano: 'Medio', descripcion: 'Cliente sonriendo mientras Suzet marca el punto con espejo.', vozTexto: 'Texto: "Marcamos contigo, tú decides."', duracion: '5 s', audio: 'Trend sube' },
              { n: 4, plano: 'Primer plano', descripcion: 'Colocación de la joyería de titanio; brillo del titanio.', vozTexto: 'Texto: "Titanio grado implante ASTM F-136."', duracion: '5 s', audio: 'Trend' },
              { n: 5, plano: 'Cierre a cámara', descripcion: 'Cliente muestra el lóbulo recién hecho; Suzet saluda.', vozTexto: 'Voz: "Tu primer piercing, sin miedo." CTA en pantalla.', duracion: '5 s', audio: 'Cierre musical' },
            ],
            minuta: [
              { momento: 'Pre-producción (mar)', tema: 'Guion, permisos de imagen del cliente y checklist de asepsia para grabar sin romper el campo estéril', responsable: 'Flor (redes) + Suzet', acuerdo: 'Consentimiento de imagen firmado; grabar solo con guantes nuevos.' },
              { momento: 'Rodaje (jue 16:00)', tema: 'Grabar tomas 1–5 en una cita real de lóbulo', responsable: 'Flor (cámara) + Suzet (servicio)', acuerdo: 'Máx 15 min; no interrumpir el protocolo clínico.' },
              { momento: 'Post (vie)', tema: 'Edición, subtítulos y aprobación', responsable: 'Flor', acuerdo: 'Publicar sáb 12:00; Suzet aprueba antes de subir.' },
            ],
          },
          {
            id: 'fm-historia-encuesta', formato: 'Historia Instagram — Encuesta interactiva',
            objetivo: 'Detectar objeciones y abrir conversación (DM).',
            especificaciones: '9:16 · secuencia de 3 historias · stickers de encuesta y pregunta',
            caracteristicas: 'Interactivo, ligero. Usa el sticker de encuesta y el de preguntas para conversar.',
            cta: 'Desliza y mándanos tu duda; te respondemos con voz.',
            hashtags: '',
            guion: [
              { n: 1, plano: 'Selfie', descripcion: 'Suzet a cámara con el estudio de fondo.', vozTexto: 'Sticker encuesta: "¿Te da miedo perforarte? Sí / Un poco".', duracion: '—' },
              { n: 2, plano: 'B-roll', descripcion: 'Vitrina de joyería de titanio.', vozTexto: 'Texto: "El 80% del miedo es a la infección. Por eso todo es de un solo uso."', duracion: '—' },
              { n: 3, plano: 'Selfie', descripcion: 'Cierre.', vozTexto: 'Sticker preguntas: "¿Qué te gustaría perforarte?" + CTA agenda.', duracion: '—' },
            ],
          },
        ],
      },
      {
        id: 'cm-verano', nombre: 'Verano al descubierto', tipo: 'Estacional',
        cta: 'Reserva tu lugar de verano', objetivo: 'Aprovechar el repunte primavera-verano (ropa que muestra).',
        temporada: 'Abr–Jul', canal: 'TikTok + Instagram', presupuesto: '$2,000 (pauta de alcance)',
        kpi: 'Citas de lóbulo/hélix en temporada · alcance', mensaje: 'El verano se ve mejor con una pieza bien colocada y cicatrizada a tiempo.',
        formatos: [
          {
            id: 'fm-tiktok-trend', formato: 'TikTok — Trend "get ready"',
            objetivo: 'Alcance orgánico montado sobre un audio en tendencia.',
            especificaciones: '9:16 · 1080×1920 · 15–20 s · audio en tendencia (verificar licencia comercial)',
            caracteristicas: 'Dinámico, corte rápido, texto grande. Montado sobre audio trend del momento.',
            cta: 'Aparta tu cita antes de que se llene el verano — link en bio.',
            hashtags: '#getreadywithme #piercingtiktok #verano #titanio',
            guion: [
              { n: 1, plano: 'Medio', descripcion: 'Cliente entra al estudio, saluda.', vozTexto: 'Texto: "POV: tu primer hélix del verano."', duracion: '3 s', audio: 'Audio trend' },
              { n: 2, plano: 'Detalle', descripcion: 'Montaje rápido: asepsia → marca → titanio.', vozTexto: 'Texto por corte: "Estéril / Marcado / Titanio".', duracion: '8 s', audio: 'Beat drop' },
              { n: 3, plano: 'Cierre', descripcion: 'Antes/después del oído.', vozTexto: 'Texto: "Cicatriza a tiempo para agosto." CTA.', duracion: '5 s', audio: 'Cierre' },
            ],
          },
        ],
      },
    ],
  },
  // ============================================================ PRODUCTO 2
  {
    id: 'pm-joyeria', producto: 'Joyería de titanio (downsizing y recompra)', categoria: 'Joyería',
    descripcion: 'Motor de recompra y mayor margen. El downsizing post-cicatrización y el cambio de joya traen de vuelta al cliente.',
    precio: '$250–$900 según pieza',
    campanas: [
      {
        id: 'cm-cambia-joya', nombre: 'Cambia tu joya, cuida tu perforación', tipo: 'Recompra',
        cta: 'Escríbenos por WhatsApp para tu downsizing', objetivo: 'Reactivar clientes a las 6–8 semanas (downsizing).',
        temporada: 'Todo el año (recordatorio post-servicio)', canal: 'WhatsApp + Instagram', presupuesto: 'Orgánico',
        kpi: 'Recompra de joyería ≥ 25% · tickets de downsizing', mensaje: 'La cicatrización termina con un downsizing; es cuidado, no lujo.',
        formatos: [
          {
            id: 'fm-carrusel-downsizing', formato: 'Carrusel Instagram — Antes/Después',
            objetivo: 'Educar sobre downsizing y disparar la recompra.',
            especificaciones: '4:5 · 1080×1350 · 5 láminas · plantilla de marca',
            caracteristicas: 'Educativo y aspiracional. Fotos reales (con permiso). Última lámina = CTA.',
            cta: 'A las 6 semanas escríbenos "DOWNSIZING" por WhatsApp.',
            hashtags: '#downsizing #joyeriadetitanio #cuidadopostpiercing',
            guion: [
              { n: 1, plano: 'Lámina 1', descripcion: 'Portada: "¿Qué es el downsizing?"', vozTexto: 'Título grande + subtítulo.', duracion: '—' },
              { n: 2, plano: 'Lámina 2', descripcion: 'Foto: barra larga inicial (para inflamación).', vozTexto: 'Texto: "Al inicio la barra es larga a propósito."', duracion: '—' },
              { n: 3, plano: 'Lámina 3', descripcion: 'Foto: barra corta post-cicatrización.', vozTexto: 'Texto: "A las 6–8 semanas la cambiamos por una más corta."', duracion: '—' },
              { n: 4, plano: 'Lámina 4', descripcion: 'Vitrina de opciones de titanio.', vozTexto: 'Texto: "Elige color anodizado o clásico."', duracion: '—' },
              { n: 5, plano: 'Lámina 5', descripcion: 'CTA final.', vozTexto: 'Texto: "Agenda tu downsizing por WhatsApp."', duracion: '—' },
            ],
          },
        ],
      },
      {
        id: 'cm-titanio-autoridad', nombre: 'Por qué titanio ASTM F-136', tipo: 'Educación / Autoridad',
        cta: 'Conoce el catálogo de titanio', objetivo: 'Construir autoridad y justificar el precio premium.',
        temporada: 'Todo el año', canal: 'Instagram (Reel + guardado)', presupuesto: 'Orgánico',
        kpi: 'Guardados y compartidos · tickets de joyería premium', mensaje: 'No todo el "acero quirúrgico" es hipoalergénico; el titanio grado implante sí.',
        formatos: [
          {
            id: 'fm-reel-educativo', formato: 'Reel Instagram — Educativo',
            objetivo: 'Diferenciar titanio grado implante de material barato.',
            especificaciones: '9:16 · 1080×1920 · 30–40 s · subtítulos',
            caracteristicas: 'Autoridad con lenguaje del gremio pero claro. Muestra el certificado ASTM F-136.',
            cta: 'Guarda esto y pregunta por nuestra joyería de titanio.',
            hashtags: '#astmf136 #titaniogradoimplante #hipoalergenico #bodyart',
            guion: [
              { n: 1, plano: 'A cámara', descripcion: 'Suzet sostiene dos joyas.', vozTexto: 'Voz: "¿Por qué a veces una perforación no cierra bien?"', duracion: '4 s', audio: 'Ambiente' },
              { n: 2, plano: 'Detalle', descripcion: 'Comparativa de materiales.', vozTexto: 'Texto: "Material barato = irritación."', duracion: '6 s' },
              { n: 3, plano: 'Detalle', descripcion: 'Muestra el sello ASTM F-136.', vozTexto: 'Voz: "Titanio grado implante: lo mismo que usan en cirugía."', duracion: '8 s' },
              { n: 4, plano: 'Cierre', descripcion: 'Vitrina + CTA.', vozTexto: 'Texto: "Por eso cicatriza mejor." CTA.', duracion: '6 s', audio: 'Cierre' },
            ],
          },
        ],
      },
    ],
  },
  // ============================================================ PRODUCTO 3
  {
    id: 'pm-tatuaje', producto: 'Tu primer tatuaje con higiene de hospital', categoria: 'Tatuaje',
    descripcion: 'Adquisición de la línea de tatuaje apoyada en el mismo diferenciador: higiene certificable y acompañamiento.',
    precio: 'Desde $800 (pequeño); por sesión según tamaño',
    campanas: [
      {
        id: 'cm-tinta-segura', nombre: 'Tinta segura, primer tatuaje', tipo: 'Adquisición',
        cta: 'Cotiza tu diseño por DM', objetivo: 'Captar primeras cotizaciones de tatuaje.',
        temporada: 'Todo el año', canal: 'Instagram + TikTok', presupuesto: '$1,000',
        kpi: 'Cotizaciones por DM · citas de tatuaje', mensaje: 'Un tatuaje es permanente; la higiene no es opcional.',
        formatos: [
          {
            id: 'fm-reel-proceso', formato: 'Reel Instagram — Proceso',
            objetivo: 'Mostrar el proceso limpio de principio a fin.',
            especificaciones: '9:16 · 1080×1920 · 25–35 s · timelapse + subtítulos',
            caracteristicas: 'Satisfactorio (timelapse), foco en material sellado y estación limpia.',
            cta: 'Manda tu idea por DM y te cotizamos.',
            hashtags: '#primertatuaje #tattoohigienico #tatuajeseguro',
            guion: [
              { n: 1, plano: 'Detalle', descripcion: 'Apertura de agujas y tinta selladas.', vozTexto: 'Texto: "Todo nuevo, frente a ti."', duracion: '4 s', audio: 'Lo-fi' },
              { n: 2, plano: 'Medio', descripcion: 'Colocación del stencil sobre piel limpia.', vozTexto: 'Texto: "Diseño a tu medida."', duracion: '5 s' },
              { n: 3, plano: 'Timelapse', descripcion: 'Trazo del tatuaje pequeño.', vozTexto: 'Texto: "Tinta segura, línea firme."', duracion: '10 s', audio: 'Lo-fi sube' },
              { n: 4, plano: 'Cierre', descripcion: 'Resultado final + cuidados.', vozTexto: 'Voz: "Te vas con tus cuidados por WhatsApp." CTA.', duracion: '6 s' },
            ],
            minuta: [
              { momento: 'Pre-producción', tema: 'Elegir cita con diseño "instagrameable" y permiso del cliente', responsable: 'Flor', acuerdo: 'Cliente confirma permiso de imagen.' },
              { momento: 'Rodaje', tema: 'Timelapse con tripié fijo; no contaminar la estación', responsable: 'Flor + tatuador', acuerdo: 'Cámara fuera del campo estéril.' },
              { momento: 'Post', tema: 'Edición y CTA', responsable: 'Flor', acuerdo: 'Publicar mar/jue 20:00.' },
            ],
          },
        ],
      },
    ],
  },
];

async function main() {
  const now = new Date().toISOString();
  await prisma.tablaProyecto.upsert({
    where: { proyectoId_tablaRef: { proyectoId: PID, tablaRef: 'mkt_catalogo' } },
    create: { proyectoId: PID, tablaRef: 'mkt_catalogo', filas: CATALOGO, actualizadoEn: now },
    update: { filas: CATALOGO, actualizadoEn: now },
  });
  const camp = CATALOGO.reduce((s, p) => s + p.campanas.length, 0);
  const fmt = CATALOGO.reduce((s, p) => s + p.campanas.reduce((a, c) => a + c.formatos.length, 0), 0);
  const tom = CATALOGO.reduce((s, p) => s + p.campanas.reduce((a, c) => a + c.formatos.reduce((b, f) => b + f.guion.length, 0), 0), 0);
  console.log(`✅ Catálogo MKT anidado: ${CATALOGO.length} productos · ${camp} campañas · ${fmt} formatos · ${tom} tomas de guion.`);
}
main().catch((e) => { console.error('SEED_MKT_FAIL', e instanceof Error ? e.message : String(e)); process.exitCode = 1; }).finally(() => prisma.$disconnect());
