// Llena el proyecto Altercing Studio (Railway) con datos reales para ver los planos.
// Aditivo e idempotente: regenera el blueprint, mergea campos, upsertea tablas y crea un
// subflujo de ejemplo. NO pisa META/EST (ya tenían datos) ni la tabla `personas`.
// Correr: DATABASE_URL=<public> npx tsx scripts/seed-altercing.ts
import { PrismaClient } from '@prisma/client';
import { construirBlueprint } from '@/app/seleccion/selection-engine';

const prisma = new PrismaClient();
const PID = 'WS-GIRLY-ZONE--ALTERCING-STUDIO';
const now = () => new Date().toISOString();
const J = (v: unknown) => v as never;

// ---------- Campos narrativos por plano (los IDs coinciden con especialistas.ts) ----------
const CAMPOS: Record<string, Record<string, string>> = {
  COM: {
    oferta: 'Perforaciones profesionales con joyería de titanio grado implante, tatuajes, uñas y venta de joyería corporal. Se compra por higiene certificada, asesoría honesta y resultados que cicatrizan bien; el diferenciador es la seguridad (material estéril de un solo uso) y el acompañamiento post-servicio.',
  },
  MKT: {
    cultura: 'Público de cultura alternativa/urbana (16–35). El body art es identidad y pertenencia a una tribu; lenguaje propio (calibres, titanio ASTM F-136, "downsizing", cicatrización). Instagram y TikTok son el escaparate: el portafolio de trabajos previos manda más que el anuncio.',
    aspiraciones: 'Aspiran a expresarse y verse "auténticos" sin arriesgar la salud. Miedos: dolor, infección, cicatriz o rechazo de la perforación, y que "salga mal" algo permanente. Estatus: mostrar una pieza bien hecha y bien colocada.',
    referencias: 'Influencers locales de piercing/tattoo, música de la escena, ferias de tatuaje. Estacionalidad: repunte en primavera-verano (ropa que muestra), regreso a clases y diciembre (aguinaldo). Baja en cuaresma/inicio de año.',
  },
  JUR: {
    figura: 'Persona física con actividad empresarial (o SAS si entran socios). Dueña actual al 100%; contemplar 70/30 si se suma un tatuador socio.',
    obligaciones: 'Aviso de funcionamiento y licencia sanitaria municipal, manejo de RPBI (residuos peligrosos biológico-infecciosos) con empresa autorizada, consentimiento informado firmado por servicio, verificación de mayoría de edad. Régimen fiscal RESICO, facturación CFDI 4.0.',
    riesgos: 'Servicio a menores sin tutor, mala praxis/infección, manejo indebido de RPBI. Mitigación: consentimiento + copia de ID, protocolo de asepsia documentado, contrato con gestor de residuos. (dictamen → PENDIENTE_ASESOR_LEGAL)',
  },
  ARQ: {
    recorrido: 'Entrada → Recepción y espera → Sala Principal (asesoría) → Cabina de perforación / Cabina 2 → (post) Recepción para cobro → salida. Esterilización es de apoyo, contigua a las cabinas. Baño para clientes y para asepsia de manos.',
    prioridades: 'Críticas: las cabinas (privacidad, luz y superficie lavable) y Esterilización (flujo sucio→limpio sin cruces). Recepción debe verse desde la entrada. La Zona Pizarrón y la sala pueden compartirse para asesoría/espera.',
    restricciones: 'Local en segunda planta ~32 m². Necesita: buena luz sobre la camilla, lavabo con agua corriente en/junto a cada cabina, tomas para autoclave y minisplit, pisos y muros lavables (no porosos), y un punto de acopio de RPBI separado.',
  },
  RH: {
    reclutamiento: 'Se recluta por portafolio + prueba práctica supervisada. Filtros: manejo de asepsia, trato al cliente, conocimiento de anatomía de la perforación. Referencias de otros estudios.',
    onboarding: 'Primeros 30 días: acompañamiento en cabina, memorizar el protocolo de asepsia y RPBI, dominar la agenda/POS, y hacer 10 servicios supervisados antes de trabajar solo.',
    evaluacion: 'Se evalúa por reseñas (≥4.7★), tasa de cicatrización sin incidentes, puntualidad y ticket promedio. Bono trimestral atado a reseñas y reincidencia de clientes.',
    offboarding: 'Salida: baja de accesos (agenda/POS/redes), devolución de material, y traspaso de clientes en curso. Sucesión: la dueña o el perforador senior cubre la cabina.',
  },
  INV: {
    problema: 'El mercado de perforación tiene mucha informalidad e higiene dudosa; el cliente joven quiere un lugar seguro, estético y de confianza. Altercing ya opera con demanda validada y 4 líneas (piercing, tatuaje, uñas, joyería).',
    mercado: 'Estudios de body art en zona urbana con recompra alta (joyería, downsizing, nuevos piercings). Ventaja difícil de replicar: marca + comunidad en redes + protocolo de higiene certificable + surtido de joyería de titanio.',
    proyeccion: 'Camino a rentabilidad por aumento de ticket (joyería premium) y ocupación de la 2ª cabina. (cifras → PENDIENTE_DATO_REAL)',
    salida: 'Posible expansión a 2ª sede o franquicia ligera del protocolo; venta a un grupo de estética/retail de joyería. Valuación y dilución → PENDIENTE.',
  },
  FIN: {
    modelo: 'Centros de utilidad: servicios (piercing/tatuaje/uñas) y venta de joyería. Centros de costo: renta, insumos estériles, RPBI, sueldos, marketing. La joyería es el mayor margen y motor de recompra.',
    margenes: 'Servicio de perforación: margen alto (mano de obra + aguja/insumo bajo). Joyería de titanio: margen de retail. Reparto dueña/perforador por comisión sobre servicio. (% → PENDIENTE)',
    fiscal: 'RESICO persona física; separar gasto de RPBI y depreciación del autoclave. (→ PENDIENTE_ASESOR_FISCAL)',
  },
  CUL: {
    narrativa: 'Nació para que perforarse sea seguro, honesto y bonito — sin el miedo de "a ver si no se infecta". Higiene de hospital con trato de amigo.',
    valores: 'Higiene sin excepciones · Honestidad (si no conviene, se dice) · Estética cuidada · Comunidad · Aprendizaje continuo.',
    comportamientos: 'Higiene: material estéril de un solo uso siempre, a la vista del cliente. Honestidad: recomendar el calibre correcto aunque venda menos. Comunidad: seguimiento post-servicio por WhatsApp.',
    principios: 'Ante la duda de seguridad, no se hace el servicio. El cliente decide informado; nosotros asesoramos, no presionamos.',
    limites: 'No se perfora a menores sin tutor ni identificación; no se reutiliza material; no se trabaja bajo condiciones no estériles.',
  },
  ORG: {
    entidades: 'Girly Zone (desarrollo) → Altercing Studio (negocio) → 4 unidades comerciales: Piercings, Tatuajes, Uñas, Joyería corporal. Una sede.',
    jerarquia: 'Dirección (dueña) decide y aprueba; Perforador ejecuta el servicio; Recepción agenda, cobra y da seguimiento; Marketing (externo/parcial) maneja redes.',
    fronteras: 'La dueña separa Dirección de Operación: define protocolo y precios; el perforador no cambia precios ni protocolo. Marketing no toca la agenda clínica.',
  },
  CTR: {
    modelo: 'Se mide el negocio con pocos KPIs por línea: servicios/día, ticket promedio, reseñas, recompra e incidencias de cicatrización. El OS publica; el tablero solo presenta.',
    umbrales: 'Reseña < 4.7★ = rojo; incidencia de cicatrización > 2% = rojo; ocupación de cabina < 40% = amarillo. (metas → PENDIENTE)',
    cadencia: 'Revisión diaria (corte de caja + informe del día) y cierre mensual (contabilidad + reseñas). Dueño por KPI: Dirección.',
  },
  PRO: {
    mapa: 'Macroprocesos: Preparación (abrir, esterilizar, cargar agenda) · Servicio (recepción→asesoría→consentimiento→asepsia→perforación→joyería→cuidados→cobro) · Cierre (registro, esterilización, corte de caja, seguimiento).',
    calidad: 'Cada servicio deja evidencia: consentimiento firmado, registro en POS, foto opcional del resultado. Criterio de calidad = asepsia correcta + colocación anatómica + cliente informado.',
    versionado: 'El protocolo de asepsia y el instructivo por servicio se versionan; los cambios los aprueba Dirección (append-only).',
  },
};

// ---------- Tablas (IDs de columna = base de tablas.ts + contexto de especialistas.ts) ----------
const TABLAS: Record<string, Record<string, string>[]> = {
  productos: [
    { sku: 'PIER-LOBULO', nombre: 'Perforación de lóbulo', categoria: 'Piercing', presentacion: 'Con titanio incluido', precio: '', moneda: 'MXN' },
    { sku: 'PIER-HELIX', nombre: 'Perforación de hélix', categoria: 'Piercing', presentacion: 'Con titanio incluido', precio: '', moneda: 'MXN' },
    { sku: 'PIER-SEPTUM', nombre: 'Perforación de septum', categoria: 'Piercing', presentacion: 'Con titanio incluido', precio: '', moneda: 'MXN' },
    { sku: 'TAT-SMALL', nombre: 'Tatuaje pequeño', categoria: 'Tatuaje', presentacion: 'Hasta 10 cm', precio: '', moneda: 'MXN' },
    { sku: 'UNA-GEL', nombre: 'Uñas de gel', categoria: 'Uñas', presentacion: 'Set completo', precio: '', moneda: 'MXN' },
    { sku: 'JOY-TITANIO', nombre: 'Joyería de titanio', categoria: 'Joyería', presentacion: 'Varios calibres', precio: '', moneda: 'MXN' },
  ],
  investigacion: [
    { hallazgo: 'El cliente revisa Instagram y pide ver trabajos previos antes de agendar', categoria: 'costumbre', fuente: 'entrevistas', implicacion: 'Portafolio al día = principal herramienta de venta' },
    { hallazgo: '"Profesional/higiénico" pesa más que el precio en las reseñas', categoria: 'lenguaje', fuente: 'reseñas Google', implicacion: 'Comunicar la asepsia visible (aguja sellada frente al cliente)' },
    { hallazgo: 'Miedo al dolor y a "que se infecte" frena la primera compra', categoria: 'miedo', fuente: 'DM y comentarios', implicacion: 'Contenido educativo de cuidados y de qué esperar' },
    { hallazgo: 'La joyería bonita motiva recompra y downsizing', categoria: 'aspiración', fuente: 'ventas', implicacion: 'Empujar joyería premium post-cicatrización' },
  ],
  campanas: [
    { campana: 'Temporada de verano', publico: '16–30, escena urbana', mensaje: 'Luce tu piercing este verano, con higiene de verdad', canal: 'Instagram/TikTok', objetivo: 'Citas de piercing', fecha: 'Abr–Jul' },
    { campana: 'Regreso a clases', publico: 'Estudiantes', mensaje: 'Estrena look seguro', canal: 'Instagram', objetivo: 'Lóbulo/hélix', fecha: 'Ago' },
    { campana: 'Joyería de titanio', publico: 'Clientes existentes', mensaje: 'Cambia tu joyería, cuida tu perforación', canal: 'WhatsApp/IG', objetivo: 'Recompra joyería', fecha: 'Todo el año' },
  ],
  experimentos: [
    { experimento: 'Reels de "cómo esterilizamos"', hipotesis: 'Mostrar la asepsia sube la confianza y las citas', metrica: 'Citas atribuidas / DM', presupuesto: 'Bajo (orgánico)', resultado: 'PENDIENTE' },
    { experimento: 'Promo primer piercing + cuidado', hipotesis: 'Bajar la barrera del primer servicio sube volumen', metrica: 'Conversión de primeras visitas', presupuesto: '$1,500', resultado: 'PENDIENTE' },
  ],
  legales: [
    { documento: 'Aviso de funcionamiento / licencia sanitaria', tipo: 'permiso', responsable: 'Dirección', estado: 'pendiente' },
    { documento: 'Contrato de manejo de RPBI', tipo: 'contrato', responsable: 'Dirección', estado: 'pendiente' },
    { documento: 'Consentimiento informado por servicio', tipo: 'política', responsable: 'Recepción', estado: 'borrador' },
    { documento: 'Aviso de privacidad', tipo: 'política', responsable: 'Dirección', estado: 'borrador' },
    { documento: 'Registro de marca "Altercing"', tipo: 'PI', responsable: 'Dirección', estado: 'pendiente' },
  ],
  puestos: [
    { puesto: 'Perforador/a profesional', mision: 'Ejecutar servicios seguros y estéticos', reportaA: 'Dirección', competencias: 'Asepsia, anatomía, trato', kpis: 'Reseñas, cicatrización sin incidentes' },
    { puesto: 'Recepcionista', mision: 'Agendar, cobrar y dar seguimiento', reportaA: 'Dirección', competencias: 'Atención, POS, WhatsApp', kpis: 'Ocupación de agenda, seguimiento' },
    { puesto: 'Tatuador/a', mision: 'Realizar tatuajes con calidad e higiene', reportaA: 'Dirección', competencias: 'Técnica, diseño, asepsia', kpis: 'Reseñas, reincidencia' },
  ],
  rondas: [
    { ronda: 'Capital semilla propio', uso: 'Equipo, licencia y acondicionamiento', hito: 'Estudio abierto y operando', monto: 'PENDIENTE' },
    { ronda: 'Reinversión / 2ª cabina', uso: 'Habilitar Cabina 2 e inventario de joyería', hito: 'Ocupación >60% de la 1ª cabina', monto: 'PENDIENTE' },
  ],
  ingresos: [
    { fuente: 'Servicios de piercing', centro: 'Piercings', precio: 'PENDIENTE' },
    { fuente: 'Tatuajes', centro: 'Tatuajes', precio: 'PENDIENTE' },
    { fuente: 'Uñas', centro: 'Uñas', precio: 'PENDIENTE' },
    { fuente: 'Venta de joyería', centro: 'Joyería', precio: 'PENDIENTE' },
  ],
  costos: [
    { concepto: 'Renta del local', tipo: 'gasto', centro: 'Administración', monto: 'PENDIENTE' },
    { concepto: 'Insumos estériles (agujas, guantes)', tipo: 'costo', centro: 'Operación', monto: 'PENDIENTE' },
    { concepto: 'Manejo de RPBI', tipo: 'gasto', centro: 'Operación', monto: 'PENDIENTE' },
    { concepto: 'Inventario de joyería', tipo: 'costo', centro: 'Joyería', monto: 'PENDIENTE' },
    { concepto: 'Marketing / redes', tipo: 'gasto', centro: 'Marketing', monto: 'PENDIENTE' },
  ],
  kpis: [
    { kpi: 'Servicios por día', dueno: 'Dirección', frecuencia: 'Diaria', fuente: 'POS', meta: 'PENDIENTE' },
    { kpi: 'Ticket promedio', dueno: 'Dirección', frecuencia: 'Semanal', fuente: 'POS', meta: 'PENDIENTE' },
    { kpi: 'Reseñas (★)', dueno: 'Dirección', frecuencia: 'Semanal', fuente: 'Google/IG', meta: '≥ 4.7' },
    { kpi: 'Recompra de joyería', dueno: 'Marketing', frecuencia: 'Mensual', fuente: 'POS', meta: 'PENDIENTE' },
    { kpi: 'Incidencias de cicatrización', dueno: 'Dirección', frecuencia: 'Mensual', fuente: 'Seguimiento', meta: '< 2%' },
  ],
};

// ---------- Subflujos dentro de varios pasos (padreId → subpasos encadenados) ----------
const SUBFLUJOS: Record<string, { nombre: string; rol: string; ins: string[] }[]> = {
  'PROC-mrufyzuh-p0829': [ // Perforación con aguja estéril
    { nombre: 'Marcar el punto con el cliente (espejo)', rol: 'Perforador', ins: [] },
    { nombre: 'Colocar pinza y alinear', rol: 'Perforador', ins: ['pinza estéril'] },
    { nombre: 'Insertar aguja estéril de un solo uso', rol: 'Perforador', ins: ['aguja estéril'] },
    { nombre: 'Pasar y colocar la joyería de titanio', rol: 'Perforador', ins: ['joyería de titanio'] },
    { nombre: 'Retirar aguja, limpiar y revisar', rol: 'Perforador', ins: ['gasa', 'solución salina'] },
  ],
  'PROC-mrufyz9n-0qn42': [ // Asepsia de la zona
    { nombre: 'Lavado de manos y colocar guantes estériles', rol: 'Perforador', ins: ['guantes estériles'] },
    { nombre: 'Limpiar la zona con antiséptico', rol: 'Perforador', ins: ['antiséptico', 'gasa'] },
    { nombre: 'Delimitar campo estéril', rol: 'Perforador', ins: ['campo estéril'] },
  ],
  'PROC-mrufywtg-la51y': [ // Asesoría: elegir perforación y joyería
    { nombre: 'Escuchar qué quiere el cliente', rol: 'Perforador', ins: [] },
    { nombre: 'Revisar anatomía y viabilidad', rol: 'Perforador', ins: [] },
    { nombre: 'Recomendar calibre y material', rol: 'Perforador', ins: [] },
    { nombre: 'Mostrar opciones de joyería y precio', rol: 'Recepción', ins: [] },
  ],
  'PROC-mrufyti0-sgjls': [ // Cargar catálogo, precios y agenda de citas
    { nombre: 'Actualizar servicios y precios en el POS', rol: 'Recepción', ins: [] },
    { nombre: 'Cargar inventario de joyería', rol: 'Recepción', ins: [] },
    { nombre: 'Abrir agenda y confirmar citas del día', rol: 'Recepción', ins: [] },
  ],
  'PROC-mrufyvjy-8wry6': [ // Preparar cabina y material estéril
    { nombre: 'Desinfectar superficies de la cabina', rol: 'Perforador', ins: ['desinfectante'] },
    { nombre: 'Abrir material estéril de un solo uso', rol: 'Perforador', ins: ['aguja estéril', 'guantes'] },
    { nombre: 'Preparar bandeja y verificar autoclave', rol: 'Perforador', ins: [] },
  ],
  'PROC-mrufyxg8-7kgab': [ // Verificar edad y firmar consentimiento
    { nombre: 'Solicitar identificación oficial', rol: 'Recepción', ins: [] },
    { nombre: 'Explicar riesgos y cuidados', rol: 'Perforador', ins: [] },
    { nombre: 'Firmar consentimiento informado', rol: 'Recepción', ins: ['consentimiento'] },
  ],
  'PROC-mrufz1pt-djykd': [ // Limpieza y esterilización de instrumental
    { nombre: 'Separar y desechar RPBI', rol: 'Perforador', ins: ['contenedor RPBI'] },
    { nombre: 'Prelavado y ultrasonido', rol: 'Asistente', ins: [] },
    { nombre: 'Empacar y ciclo de autoclave', rol: 'Asistente', ins: ['bolsas de esterilización'] },
    { nombre: 'Registrar el ciclo de esterilización', rol: 'Asistente', ins: [] },
  ],
  'PROC-mrufyy13-xh3ks': [ // Cobrar el servicio
    { nombre: 'Sumar servicio + joyería', rol: 'Recepción', ins: [] },
    { nombre: 'Cobrar (efectivo o tarjeta)', rol: 'Recepción', ins: [] },
    { nombre: 'Emitir ticket / factura', rol: 'Recepción', ins: [] },
  ],
  'PROC-mrufz4y7-61d2f': [ // Corte de caja y cierre del día
    { nombre: 'Contar efectivo y conciliar POS', rol: 'Recepción', ins: [] },
    { nombre: 'Registrar ingresos y gastos del día', rol: 'Dirección', ins: [] },
    { nombre: 'Guardar y respaldar', rol: 'Dirección', ins: [] },
  ],
  'PROC-mrufyssd-umpb5': [ // Contratar y capacitar al perforador
    { nombre: 'Publicar vacante y recibir portafolios', rol: 'Dirección', ins: [] },
    { nombre: 'Entrevista y prueba práctica', rol: 'Dirección', ins: [] },
    { nombre: 'Onboarding y protocolo de asepsia', rol: 'Dirección', ins: [] },
    { nombre: 'Servicios supervisados antes de operar solo', rol: 'Perforador', ins: [] },
  ],
};

// ---------- Roster real de Altercing (superficie Personas & RH). Los roles coinciden con
// los roles de los procesos del Mapa para que cada quien vea SU flujo de trabajo. ----------
const EMPLEADOS = [
  { id: 'EMP-suzet', nombre: 'Suzet', puesto: 'Directora y perforadora', departamento: 'Dirección', estado: 'activo', roles: ['Director', 'Perforador'], procesos: [], responsabilidades: 'Dirige el estudio (precios, protocolo, contratación) y perfora.', competencias: ['Liderazgo', 'Perforación', 'Asepsia', 'Anatomía'], nomina: 'Retiro de utilidades (PENDIENTE)', kpis: 'Rentabilidad, reseñas ≥4.7, cicatrización sin incidentes', notas: 'Fundadora. Cubre cabina y decide el protocolo.', email: 'suzet@altercing.mx', telefono: '+52 55 1000 0001 (ejemplo)', rfc: 'PENDIENTE (dato real)', curp: 'PENDIENTE (dato real)', nss: 'PENDIENTE', direccion: 'Girly Zone, 2ª planta (ejemplo)', nacimiento: '', emergencia: 'Contacto de emergencia (PENDIENTE)', externo: false, proveedor: '', entregamos: '', recibimos: '' },
  { id: 'EMP-francisco', nombre: 'Francisco', puesto: 'Perforador y administración', departamento: 'Piercings', estado: 'activo', roles: ['Perforador', 'Administrador'], procesos: [], responsabilidades: 'Perfora y lleva compras, inventario, catálogo y corte de caja.', competencias: ['Perforación', 'Asepsia', 'Inventario', 'POS'], nomina: 'Sueldo + comisión por servicio (PENDIENTE)', kpis: 'Reseñas, exactitud de inventario y corte', notas: 'Certificación de RPBI vigente.', email: 'francisco@altercing.mx', telefono: '+52 55 1000 0002 (ejemplo)', rfc: 'PENDIENTE (dato real)', curp: 'PENDIENTE (dato real)', nss: 'PENDIENTE', direccion: 'PENDIENTE', nacimiento: '', emergencia: 'Contacto de emergencia (PENDIENTE)', externo: false, proveedor: '', entregamos: '', recibimos: '' },
  { id: 'EMP-flor', nombre: 'Flor', puesto: 'Recepción y redes', departamento: 'Recepción', estado: 'activo', roles: ['Recepcionista', 'Community manager'], procesos: [], responsabilidades: 'Agenda, cobro, consentimientos y redes/WhatsApp.', competencias: ['Atención al cliente', 'POS', 'Instagram/TikTok', 'WhatsApp'], nomina: 'Sueldo base (PENDIENTE)', kpis: 'Ocupación de agenda, seguimiento post-servicio, engagement', notas: '', email: 'flor@altercing.mx', telefono: '+52 55 1000 0003 (ejemplo)', rfc: 'PENDIENTE (dato real)', curp: 'PENDIENTE (dato real)', nss: 'PENDIENTE', direccion: 'PENDIENTE', nacimiento: '', emergencia: 'Contacto de emergencia (PENDIENTE)', externo: false, proveedor: '', entregamos: '', recibimos: '' },
  // TERCERIZADOS: roles que NO ejecuta Altercing sino un tercero.
  { id: 'EMP-contador', nombre: 'Contabilidad (Girly Zone)', puesto: 'Contador', departamento: 'Administración', estado: 'activo', roles: ['Contador'], procesos: [], responsabilidades: 'Contabilidad y cumplimiento fiscal del negocio.', competencias: ['Contabilidad', 'Fiscal'], nomina: 'Servicio del grupo (interno Girly Zone)', kpis: 'Declaraciones a tiempo, sin multas', notas: 'Rol tercerizado HACIA ARRIBA: lo lleva Girly Zone para todos sus negocios.', email: '', telefono: '', rfc: '', curp: '', nss: '', direccion: '', nacimiento: '', emergencia: '', externo: true, proveedor: 'Girly Zone', entregamos: 'Facturas del mes, corte de caja, gastos y comprobantes', recibimos: 'Declaración de impuestos, estados financieros y asesoría fiscal' },
  { id: 'EMP-obra', nombre: 'Constructora externa', puesto: 'Encargado de obra', departamento: 'Administración', estado: 'baja', roles: ['Encargado de obra'], procesos: [], responsabilidades: 'Acondicionamiento del local (una sola vez).', competencias: ['Construcción', 'Instalaciones'], nomina: 'Contrato por obra (PENDIENTE)', kpis: 'Entrega a tiempo y en presupuesto', notas: 'Tercerizado a otra empresa; trabajo puntual de acondicionamiento.', email: '', telefono: '', rfc: '', curp: '', nss: '', direccion: '', nacimiento: '', emergencia: '', externo: true, proveedor: 'Constructora externa', entregamos: 'Medidas del local, requisitos y presupuesto aprobado', recibimos: 'Local acondicionado (pisos, muros, instalaciones de agua/luz)' },
];

async function main() {
  // 1) Regenerar blueprint para que los planos nuevos queden seleccionados
  const diag = await prisma.proyectoDiagnostico.findUnique({ where: { proyectoId: PID } });
  if (diag && diag.diagnostico) {
    const bp = construirBlueprint(diag.diagnostico as never);
    await prisma.proyectoDiagnostico.update({ where: { proyectoId: PID }, data: { blueprint: J(bp), actualizadoEn: now() } });
    console.log('✅ Blueprint regenerado. Planos seleccionados:', (bp.planos as { id: string }[]).map((p) => p.id).join(', '));
  } else {
    console.log('⚠ No hay diagnóstico; no se regenera blueprint.');
  }

  // 2) Campos por plano (MERGE — no pisa lo ya capturado)
  for (const [planoId, nuevos] of Object.entries(CAMPOS)) {
    const prev = await prisma.proyectoPlanoEstado.findUnique({ where: { proyectoId_planoId: { proyectoId: PID, planoId } } });
    const merged = { ...((prev?.campos as Record<string, string>) ?? {}), ...nuevos };
    await prisma.proyectoPlanoEstado.upsert({
      where: { proyectoId_planoId: { proyectoId: PID, planoId } },
      create: { proyectoId: PID, planoId, campos: J(merged), actualizadoEn: now() },
      update: { campos: J(merged), actualizadoEn: now() },
    });
  }
  console.log(`✅ Campos escritos en ${Object.keys(CAMPOS).length} planos.`);

  // 3) Tablas maestras
  for (const [ref, filas] of Object.entries(TABLAS)) {
    await prisma.tablaProyecto.upsert({
      where: { proyectoId_tablaRef: { proyectoId: PID, tablaRef: ref } },
      create: { proyectoId: PID, tablaRef: ref, filas: J(filas), actualizadoEn: now() },
      update: { filas: J(filas), actualizadoEn: now() },
    });
  }
  console.log(`✅ ${Object.keys(TABLAS).length} tablas maestras llenadas.`);

  // 4) Subflujos dentro de varios pasos
  let sfCreados = 0, sfPasos = 0, sfOmitidos = 0;
  for (const [padreId, subpasos] of Object.entries(SUBFLUJOS)) {
    const padre = await prisma.proceso.findUnique({ where: { id: padreId } });
    if (!padre) { sfOmitidos++; continue; }
    const deptoId = padre.departamentoId;
    const fase = padre.fase;
    for (let i = 0; i < subpasos.length; i++) {
      const s = subpasos[i]!;
      const id = `${padreId}-sub-${i + 1}`; // determinista → idempotente
      const ramas = i < subpasos.length - 1 ? [{ id: `${id}-r`, evento: 'continúa', destinoProcesoId: `${padreId}-sub-${i + 2}` }] : [];
      await prisma.proceso.upsert({
        where: { id },
        create: {
          id, proyectoId: PID, departamentoId: deptoId, nombre: s.nombre, fase, orden: i + 1,
          data: J({ posX: 40 + i * 230, posY: 60, etapaDesde: 'arrancar', roles: [s.rol], herramientas: [], insumos: s.ins, espacios: [], ramas, padreProcesoId: padreId, instructivo: s.nombre }),
        },
        update: {},
      });
      sfPasos++;
    }
    sfCreados++;
  }
  console.log(`✅ Subflujos: ${sfCreados} pasos con subflujo (${sfPasos} subpasos)${sfOmitidos ? `, ${sfOmitidos} padres no encontrados` : ''}.`);

  // 5) Roster de Personas & RH
  await prisma.tablaProyecto.upsert({
    where: { proyectoId_tablaRef: { proyectoId: PID, tablaRef: 'empleados' } },
    create: { proyectoId: PID, tablaRef: 'empleados', filas: J(EMPLEADOS), actualizadoEn: now() },
    update: { filas: J(EMPLEADOS), actualizadoEn: now() },
  });
  console.log(`✅ Roster de RH: ${EMPLEADOS.length} personas dadas de alta.`);

  // 6) Ejemplo de recursos ricos en un proceso: insumos con cantidad, equipo con manual, muebles.
  const perf = await prisma.proceso.findUnique({ where: { id: 'PROC-mrufyzuh-p0829' } });
  if (perf) {
    const d = (perf.data as Record<string, unknown>) ?? {};
    await prisma.proceso.update({ where: { id: perf.id }, data: { data: J({
      ...d,
      herramientas: ['Pinza Pennington', 'Marcador quirúrgico'],
      insumos: ['Aguja estéril 16G', 'Joyería de titanio', 'Gasas', 'Solución salina'],
      cantidades: { 'Aguja estéril 16G': '1 pza', 'Joyería de titanio': '1 pza', 'Gasas': '3 pzas', 'Solución salina': '20 ml' },
      equipo: ['Autoclave'],
      muebles: ['Camilla', 'Lámpara de examen', 'Carrito de instrumental'],
      manuales: {
        'Autoclave': 'Cargar bolsas selladas; ciclo 134 °C / 18 min; registrar el ciclo. Limpieza de cámara semanal.',
        'Pinza Pennington': 'De un solo uso, o esterilizar en autoclave tras cada uso.',
      },
    }) } });
    console.log('✅ Recursos ricos de ejemplo en "Perforación con aguja estéril".');
  }

  // 7) Catálogo de Recursos & Proveedores (alimenta FIN/TEC/COM)
  const PROVEEDORES = [
    { id: 'prv-insumos', nombre: 'Insumos Médicos MX', tipo: 'insumos', contacto: 'ventas', telefono: '', email: 'ventas@insumosmx.com', rfc: '', notas: 'Agujas, gasas, guantes, solución.' },
    { id: 'prv-titanio', nombre: 'Titanio Body MX', tipo: 'insumos', contacto: '', telefono: '', email: '', rfc: '', notas: 'Joyería de titanio grado implante.' },
    { id: 'prv-equipmed', nombre: 'EquipMed', tipo: 'equipo', contacto: '', telefono: '', email: '', rfc: '', notas: 'Autoclave y equipo de esterilización.' },
    { id: 'prv-constructora', nombre: 'Constructora externa', tipo: 'materiales / construcción', contacto: '', telefono: '', email: '', rfc: '', notas: 'Acondicionamiento del local.' },
    { id: 'prv-diseno', nombre: 'Estudio de interiores', tipo: 'diseño de interiores', contacto: '', telefono: '', email: '', rfc: '', notas: 'Diseño y mobiliario de las cabinas.' },
    { id: 'prv-girly', nombre: 'Girly Zone', tipo: 'servicios', contacto: '', telefono: '', email: '', rfc: '', notas: 'Contabilidad del grupo (tercerizado hacia arriba).' },
  ];
  const RECURSOS = [
    { id: 'rec-aguja', nombre: 'Aguja estéril 16G', categoria: 'insumo', grupo: 'Cabina de perforación', proveedor: 'Insumos Médicos MX', unidad: 'pza', costo: '8', cantidad: '200', impuesto: '16% IVA', logistica: 'Pedido semanal', notas: 'Un solo uso.' },
    { id: 'rec-joya', nombre: 'Joyería de titanio', categoria: 'insumo', grupo: 'Joyería', proveedor: 'Titanio Body MX', unidad: 'pza', costo: '120', cantidad: '50', impuesto: '16% IVA', logistica: 'Pedido mensual', notas: 'Varios calibres.' },
    { id: 'rec-gasas', nombre: 'Gasas estériles', categoria: 'insumo', grupo: 'Cabina de perforación', proveedor: 'Insumos Médicos MX', unidad: 'pza', costo: '2', cantidad: '500', impuesto: '16% IVA', logistica: '', notas: '' },
    { id: 'rec-guantes', nombre: 'Guantes de nitrilo', categoria: 'insumo', grupo: 'Cabina de perforación', proveedor: 'Insumos Médicos MX', unidad: 'caja', costo: '180', cantidad: '10', impuesto: '16% IVA', logistica: '', notas: '' },
    { id: 'rec-autoclave', nombre: 'Autoclave', categoria: 'equipo', grupo: 'Esterilización', proveedor: 'EquipMed', unidad: 'pza', costo: '25000', cantidad: '1', impuesto: '16% IVA', logistica: 'Compra única', notas: 'Ciclo 134°C/18min.' },
    { id: 'rec-lampara', nombre: 'Lámpara de examen', categoria: 'equipo', grupo: 'Cabina de perforación', proveedor: 'EquipMed', unidad: 'pza', costo: '3500', cantidad: '2', impuesto: '16% IVA', logistica: '', notas: '' },
    { id: 'rec-camilla', nombre: 'Camilla / sillón', categoria: 'mueble', grupo: 'Cabina de perforación', proveedor: 'Estudio de interiores', unidad: 'pza', costo: '8000', cantidad: '2', impuesto: '16% IVA', logistica: '', notas: '' },
    { id: 'rec-mostrador', nombre: 'Mostrador de recepción', categoria: 'mueble', grupo: 'Recepción', proveedor: 'Estudio de interiores', unidad: 'pza', costo: '6000', cantidad: '1', impuesto: '16% IVA', logistica: '', notas: '' },
    { id: 'rec-porcelanato', nombre: 'Porcelanato (piso)', categoria: 'material', grupo: 'Obra planta baja', proveedor: 'Constructora externa', unidad: 'm²', costo: '350', cantidad: '32', impuesto: '16% IVA', logistica: 'Obra inicial', notas: 'Lavable, no poroso.' },
  ];
  await prisma.tablaProyecto.upsert({ where: { proyectoId_tablaRef: { proyectoId: PID, tablaRef: 'proveedores_dir' } }, create: { proyectoId: PID, tablaRef: 'proveedores_dir', filas: J(PROVEEDORES), actualizadoEn: now() }, update: { filas: J(PROVEEDORES), actualizadoEn: now() } });
  await prisma.tablaProyecto.upsert({ where: { proyectoId_tablaRef: { proyectoId: PID, tablaRef: 'recursos' } }, create: { proyectoId: PID, tablaRef: 'recursos', filas: J(RECURSOS), actualizadoEn: now() }, update: { filas: J(RECURSOS), actualizadoEn: now() } });
  console.log(`✅ Catálogo: ${RECURSOS.length} recursos, ${PROVEEDORES.length} proveedores.`);

  // 8) Insumos por proceso (con cantidad) enlazados al catálogo → costeo automático.
  const INSUMOS_PROC: Record<string, { insumos: string[]; cantidades: Record<string, string> }> = {
    'PROC-mrufyzuh-p0829': { insumos: ['Aguja estéril 16G', 'Joyería de titanio', 'Gasas estériles'], cantidades: { 'Aguja estéril 16G': '1 pza', 'Joyería de titanio': '1 pza', 'Gasas estériles': '2 pzas' } }, // Perforación
    'PROC-mrufyz9n-0qn42': { insumos: ['Gasas estériles'], cantidades: { 'Gasas estériles': '2 pzas' } }, // Asepsia
    'PROC-mrufz0gb-4ppz7': { insumos: ['Joyería de titanio'], cantidades: { 'Joyería de titanio': '1 pza' } }, // Colocar joyería inicial
    'PROC-mrufyvjy-8wry6': { insumos: ['Guantes de nitrilo', 'Gasas estériles'], cantidades: { 'Guantes de nitrilo': '1 caja', 'Gasas estériles': '3 pzas' } }, // Preparar cabina
    'PROC-mrufz1pt-djykd': { insumos: ['Gasas estériles'], cantidades: { 'Gasas estériles': '2 pzas' } }, // Limpieza y esterilización
    'PROC-mrufz134-u4ckv': { insumos: ['Gasas estériles'], cantidades: { 'Gasas estériles': '1 pza' } }, // Indicaciones de cuidado
  };
  let costeados = 0;
  for (const [pid, v] of Object.entries(INSUMOS_PROC)) {
    const pr = await prisma.proceso.findUnique({ where: { id: pid } });
    if (!pr) continue;
    const dd = (pr.data as Record<string, unknown>) ?? {};
    await prisma.proceso.update({ where: { id: pid }, data: { data: J({ ...dd, insumos: v.insumos, cantidades: v.cantidades }) } });
    costeados++;
  }
  console.log(`✅ Insumos con cantidad enlazados al catálogo en ${costeados} procesos (costeo automático).`);

  console.log('\n🎉 Altercing Studio llenado. Recarga la app.');
}

main().catch((e) => { console.error('SEED_FAIL', e instanceof Error ? e.message : String(e)); process.exitCode = 1; }).finally(() => prisma.$disconnect());
