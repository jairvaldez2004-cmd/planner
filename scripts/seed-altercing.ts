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
    referencias: 'Influencers locales de piercing/tattoo, música de la escena, ferias de tatuaje. Comida y eventos: convenciones de tatuaje, festivales. Modismos del gremio (calibre, downsizing, healing).',
    estacionalidad: 'Repunte en primavera-verano (ropa que muestra), regreso a clases (agosto) y diciembre (aguinaldo). Baja en cuaresma e inicio de año.',
    entorno: 'Clase media/media-baja urbana, alta movilidad, muy digital (IG/TikTok). Consumo por impulso guiado por confianza e higiene; el "boca a boca" y las reseñas pesan mucho.',
    segmento: 'Mercado: body art urbano. Nicho: primer piercing seguro (16–25). Micronicho: universitarias que quieren lóbulo/hélix con material hipoalergénico y buena cicatrización.',
    avatar: 'Avatar: "Regina", 20, estudiante, activa en IG, quiere verse auténtica sin arriesgar salud. Sub-avatar: mamá que trae a su hija de 16 y valora la seguridad y el trato.',
    buyerJourney: 'No te conoce → ve un reel de higiene → revisa portafolio y reseñas → escribe por DM → agenda → asesoría → servicio → cuidados por WhatsApp → recompra (downsizing/joyería) → recomienda.',
    mapaEmocional: 'Antes: nervios y miedo al dolor/infección. Durante: tensión que baja con el trato profesional. Después: orgullo y ganas de mostrarlo; ansiedad si la cicatrización se complica.',
    mapaDolores: 'Dolores: miedo a infección/cicatriz, a que "salga chueco", a lugares sucios. Deseos: verse auténtica, pertenecer, una pieza bien colocada. Aspiración: colección de piezas cuidadas.',
    mapaObjeciones: '"¿Duele mucho?" → se explica y se acompaña. "¿Es seguro?" → aguja sellada a la vista + protocolo. "Está caro" → material de titanio y cicatrización incluida.',
    mapaLenguaje: 'Habla de: "me quiero perforar", "calibre", "que no se me infecte", "titanio", "que cicatrice bien", "downsizing". Evitar tecnicismos fríos; usar sus palabras.',
    plan: 'Calendario anual por temporada; objetivo por campaña (citas o recompra), KPI (citas atribuidas, reseñas), presupuesto mayormente orgánico + pauta ligera, canales IG/TikTok/WhatsApp, responsable Flor (redes).',
    metodo: 'Antes de gastar: hipótesis → reel/encuesta/anuncio de prueba con presupuesto chico → medir DM/citas → conclusión → decisión de escalar o descartar. Nunca lanzar solo por intuición.',
  },
  JUR: {
    figura: 'Persona física con actividad empresarial (o SAS si entran socios). Dueña actual al 100%; contemplar 70/30 si se suma un tatuador socio.',
    obligaciones: 'Aviso de funcionamiento y licencia sanitaria municipal, manejo de RPBI (residuos peligrosos biológico-infecciosos) con empresa autorizada, consentimiento informado firmado por servicio, verificación de mayoría de edad. Régimen fiscal RESICO, facturación CFDI 4.0.',
    dueno: 'Dueña y directora: Suzet (100% del negocio). El inmueble es RENTADO dentro de Girly Zone (segunda planta).',
    ubicacion: 'Girly Zone, 2ª planta. Superficie ~32 m² (huella real LiDAR 9.2×3.5 m).',
    contratos: 'Arrendamiento con Girly Zone (renta mensual — monto PENDIENTE, vigencia PENDIENTE). Servicios (luz/agua/internet) incluidos o a nombre del grupo. Contrato de RPBI con gestor autorizado.',
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
  // fecha relativa a hoy (YYYY-MM-DD) para vencimientos y seguimientos realistas
  const d = (n: number) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const PROVEEDORES = [
    { id: 'prv-insumos', nombre: 'Insumos Médicos MX', razonSocial: 'Insumos Médicos de México S.A. de C.V.', rfc: 'IMM120304AB1', pais: 'México', estado: 'Querétaro', ciudad: 'Querétaro', direccion: 'Av. 5 de Febrero 210', gps: '20.5888,-100.3899', zonas: ['Bajío', 'Centro'], contacto: 'Laura Méndez', puesto: 'Ejecutiva de ventas', telefono: '442-111-2233', whatsapp: '442-111-2233', email: 'ventas@insumosmx.com', sitioWeb: 'https://insumosmx.com', idiomas: ['español'], horario: 'L-V 9-18', moneda: 'MXN', incoterms: ['DAP'], aniosMercado: '12', tamano: 'pyme', certificaciones: ['ISO 9001', 'ISO 13485'], categorias: ['insumos', 'materia prima'], tipo: 'insumos', cumplimiento: '96%', tiempoPromedio: '3 días', evaluacion: { calidad: 90, precio: 75, tiempo: 80, comunicacion: 80, servicio: 85, confiabilidad: 85 }, proveedorUnico: false, dependencia: 'media', riesgos: [], planB: 'Tattoo Supply MX para guantes', proveedorAlternativo: 'Tattoo Supply MX', estadoRelacion: 'preferente', proximoSeguimiento: d(-2), responsable: 'Suzet', notas: 'Agujas, gasas, guantes, solución.' },
    { id: 'prv-titanio', nombre: 'Titanio Body MX', razonSocial: 'Titanio Body MX S. de R.L.', rfc: 'TBM150607CD2', pais: 'México', estado: 'CDMX', ciudad: 'Ciudad de México', direccion: 'Roma Norte', gps: '', zonas: ['Nacional'], contacto: 'Iván Ruiz', puesto: 'Dueño', telefono: '55-222-3344', whatsapp: '55-222-3344', email: 'hola@titaniobody.mx', sitioWeb: '', idiomas: ['español', 'inglés'], horario: 'L-V 10-19', moneda: 'MXN', incoterms: ['EXW'], aniosMercado: '8', tamano: 'micro', certificaciones: ['ASTM F-136'], categorias: ['insumos', 'materia prima'], tipo: 'insumos', cumplimiento: '90%', tiempoPromedio: '7 días', evaluacion: { calidad: 95, precio: 60, tiempo: 70, servicio: 80, confiabilidad: 75 }, proveedorUnico: true, dependencia: 'alta', riesgos: ['logístico', 'cambiario'], planB: '', proveedorAlternativo: '', estadoRelacion: 'activo', proximoSeguimiento: d(6), responsable: 'Suzet', notas: 'Joyería de titanio grado implante. ÚNICO proveedor: riesgo.' },
    { id: 'prv-equipmed', nombre: 'EquipMed', tipo: 'equipo', categorias: ['equipo', 'maquinaria', 'mantenimiento'], contacto: 'Servicio', email: 'servicio@equipmed.mx', telefono: '442-333-4455', rfc: '', ciudad: 'Querétaro', pais: 'México', estadoRelacion: 'activo', responsable: 'Suzet', notas: 'Autoclave y equipo de esterilización.' },
    { id: 'prv-constructora', nombre: 'Constructora externa', tipo: 'materiales / construcción', categorias: ['construcción', 'materia prima'], contacto: '', email: '', rfc: '', notas: 'Acondicionamiento del local.' },
    { id: 'prv-diseno', nombre: 'Estudio de interiores', tipo: 'diseño de interiores', categorias: ['diseño de interiores', 'muebles'], contacto: '', email: 'contacto@estudiodi.mx', rfc: '', notas: 'Diseño y mobiliario de las cabinas.' },
    { id: 'prv-girly', nombre: 'Girly Zone', tipo: 'servicios', categorias: ['servicios', 'consultoría'], contacto: 'Administración', email: 'admin@girlyzone.mx', rfc: '', estadoRelacion: 'preferente', responsable: 'Suzet', notas: 'Contabilidad del grupo y arrendamiento (tercerizado hacia arriba).' },
    { id: 'prv-tattoo', nombre: 'Tattoo Supply MX', tipo: 'insumos', categorias: ['insumos', 'equipo'], contacto: 'Pedro', email: 'ventas@tattoosupply.mx', telefono: '33-444-5566', rfc: '', ciudad: 'Guadalajara', pais: 'México', evaluacion: { calidad: 80, precio: 85, tiempo: 70, servicio: 70 }, estadoRelacion: 'activo', proximoSeguimiento: d(4), responsable: 'Francisco', notas: 'Tintas, agujas y máquinas de tatuaje.' },
    { id: 'prv-nails', nombre: 'Beauty Nails MX', tipo: 'insumos', categorias: ['insumos'], contacto: '', email: 'hola@beautynails.mx', rfc: '', estadoRelacion: 'prospecto', notas: 'Geles, limas y lámparas UV.' },
    { id: 'prv-clima', nombre: 'ClimaMX', tipo: 'equipo', categorias: ['equipo', 'mantenimiento'], contacto: 'Soporte', email: 'soporte@climamx.mx', telefono: '442-555-6677', rfc: '', estadoRelacion: 'inactivo', proximoSeguimiento: d(-1), responsable: 'Suzet', notas: 'Minisplits y mantenimiento.' },
  ];
  // RECURSOS = ACTIVOS / EQUIPO / MUEBLES / OBRA (compra única/setup). Los INSUMOS recurrentes
  // (guantes, agujas, gasas, joyería, tinta…) viven en PRODUCTOS (inventario + proveedores +
  // precio), para NO duplicar el ítem ni el precio. El costeo del Mapa toma el precio de Productos.
  const RECURSOS = [
    { id: 'rec-autoclave', nombre: 'Autoclave', categoria: 'equipo', grupo: 'Esterilización', proveedor: 'EquipMed', unidad: 'pza', costo: '25000', cantidad: '1', impuesto: '16% IVA', logistica: 'Compra única', notas: 'Ciclo 134°C/18min.' },
    { id: 'rec-lampara', nombre: 'Lámpara de examen', categoria: 'equipo', grupo: 'Cabina de perforación', proveedor: 'EquipMed', unidad: 'pza', costo: '3500', cantidad: '2', impuesto: '16% IVA', logistica: '', notas: '' },
    { id: 'rec-camilla', nombre: 'Camilla / sillón', categoria: 'mueble', grupo: 'Cabina de perforación', proveedor: 'Estudio de interiores', unidad: 'pza', costo: '8000', cantidad: '2', impuesto: '16% IVA', logistica: '', notas: '' },
    { id: 'rec-mostrador', nombre: 'Mostrador de recepción', categoria: 'mueble', grupo: 'Recepción', proveedor: 'Estudio de interiores', unidad: 'pza', costo: '6000', cantidad: '1', impuesto: '16% IVA', logistica: '', notas: '' },
    { id: 'rec-porcelanato', nombre: 'Porcelanato (piso)', categoria: 'material', grupo: 'Obra planta baja', proveedor: 'Constructora externa', unidad: 'm²', costo: '350', cantidad: '32', impuesto: '16% IVA', logistica: 'Obra inicial', notas: 'Lavable, no poroso.' },
    { id: 'rec-maqtat', nombre: 'Máquina de tatuaje', categoria: 'equipo', grupo: 'Tatuajes', proveedor: 'Tattoo Supply MX', unidad: 'pza', costo: '4500', cantidad: '2', impuesto: '16% IVA', logistica: '', notas: '' },
    { id: 'rec-lampuv', nombre: 'Lámpara UV de uñas', categoria: 'equipo', grupo: 'Uñas', proveedor: 'Beauty Nails MX', unidad: 'pza', costo: '800', cantidad: '2', impuesto: '16% IVA', logistica: '', notas: '' },
    { id: 'rec-limas', nombre: 'Limas y pulidores', categoria: 'herramienta', grupo: 'Uñas', proveedor: 'Beauty Nails MX', unidad: 'set', costo: '25', cantidad: '30', impuesto: '16% IVA', logistica: '', notas: '' },
    { id: 'rec-minisplit', nombre: 'Minisplit', categoria: 'equipo', grupo: 'Clima', proveedor: 'ClimaMX', unidad: 'pza', costo: '9000', cantidad: '2', impuesto: '16% IVA', logistica: 'Instalación incluida', notas: '' },
    { id: 'rec-dispensador', nombre: 'Dispensador de agua', categoria: 'mueble', grupo: 'Recepción', proveedor: 'Estudio de interiores', unidad: 'pza', costo: '1200', cantidad: '1', impuesto: '16% IVA', logistica: '', notas: '' },
  ];
  // Lo que YA se tiene (muebles/equipo instalados) vs lo que hay que adquirir.
  const YA_EXISTE = new Set(['rec-autoclave', 'rec-lampara', 'rec-camilla', 'rec-mostrador', 'rec-porcelanato', 'rec-dispensador', 'rec-minisplit', 'rec-maqtat', 'rec-lampuv']);
  const RECURSOS_EX = RECURSOS.map((r) => ({ ...r, existe: YA_EXISTE.has(r.id) }));
  await prisma.tablaProyecto.upsert({ where: { proyectoId_tablaRef: { proyectoId: PID, tablaRef: 'proveedores_dir' } }, create: { proyectoId: PID, tablaRef: 'proveedores_dir', filas: J(PROVEEDORES), actualizadoEn: now() }, update: { filas: J(PROVEEDORES), actualizadoEn: now() } });
  await prisma.tablaProyecto.upsert({ where: { proyectoId_tablaRef: { proyectoId: PID, tablaRef: 'recursos' } }, create: { proyectoId: PID, tablaRef: 'recursos', filas: J(RECURSOS_EX), actualizadoEn: now() }, update: { filas: J(RECURSOS_EX), actualizadoEn: now() } });
  console.log(`✅ Catálogo: ${RECURSOS.length} recursos (${YA_EXISTE.size} ya existentes), ${PROVEEDORES.length} proveedores.`);

  // 7b) ABASTECIMIENTO avanzado: productos con inventario, vínculos m:n con historial de precios,
  //     órdenes de compra por etapa, contratos con vencimiento, incidencias y bitácora de relación.
  const PRODUCTOS = [
    { id: 'prod-guantes', nombre: 'Guantes de nitrilo', skuInterno: 'GNT-100', codigoFabricante: 'AMB-NIT-M', marca: 'Ambiderm', modelo: 'Nitrilo M', categoria: 'insumos', unidad: 'caja', presentacion: 'Caja 100 pzas', empaque: 'Caja', cantidadPorCaja: '100', vidaUtil: '3 años', almacenamiento: 'Seco, fresco', stockActual: '2', stockMinimo: '3', stockMaximo: '20', puntoReorden: '5', stockSeguridad: '3', ubicacion: 'Rincón Servicios', consumoMensual: '12', frecuenciaCompra: 'mensual', leadTimeDias: '5', notas: 'Talla M. Caja de 100 pzas.' },
    { id: 'prod-aguja', nombre: 'Aguja estéril 16G', skuInterno: 'AGJ-16G', marca: '', modelo: '16G', categoria: 'insumos', unidad: 'pza', presentacion: 'Sobre individual estéril', vidaUtil: '5 años', almacenamiento: 'Seco', stockActual: '40', stockMinimo: '50', stockMaximo: '400', puntoReorden: '80', stockSeguridad: '50', ubicacion: 'Cabina de perforación', consumoMensual: '200', frecuenciaCompra: 'semanal', leadTimeDias: '7', notas: 'Un solo uso.' },
    { id: 'prod-joya', nombre: 'Joyería de titanio', skuInterno: 'JOY-TI', codigoFabricante: 'ASTM F-136', marca: 'Titanio Body', categoria: 'insumos', unidad: 'pza', presentacion: 'Bolsa individual', stockActual: '45', stockMinimo: '20', stockMaximo: '60', puntoReorden: '30', stockSeguridad: '15', ubicacion: 'Recepción (vitrina)', consumoMensual: '20', frecuenciaCompra: 'mensual', leadTimeDias: '10', notas: 'Titanio grado implante ASTM F-136, varios calibres.' },
    { id: 'prod-gasas', nombre: 'Gasas estériles', skuInterno: 'GAS-EST', categoria: 'insumos', unidad: 'pza', stockActual: '120', stockMinimo: '100', stockMaximo: '800', puntoReorden: '200', stockSeguridad: '80', ubicacion: 'Cabina de perforación', consumoMensual: '500', frecuenciaCompra: 'semanal', leadTimeDias: '4', notas: '' },
    { id: 'prod-tinta', nombre: 'Tinta de tatuaje', skuInterno: 'TNT-NEG', marca: 'Eternal', categoria: 'insumos', unidad: 'bote', presentacion: 'Bote negro', stockActual: '8', stockMinimo: '4', stockMaximo: '30', puntoReorden: '10', stockSeguridad: '3', ubicacion: 'Cabina 2', consumoMensual: '6', frecuenciaCompra: 'mensual', leadTimeDias: '6', notas: '' },
  ];
  const VINCULOS = [
    // Guantes: dos proveedores → el sistema detecta el más barato; con historial de precios.
    { id: 'pp-guantes-insumos', productoId: 'prod-guantes', proveedorId: 'prv-insumos', skuProveedor: 'IMM-GNT-M', precio: '180', moneda: 'MXN', tiempoEntrega: '3 días', cantidadMinima: '5', formaPago: 'Transferencia', credito: true, diasCredito: '15', incoterms: 'DAP', lugarEntrega: 'Girly Zone', historial: [{ fecha: d(-120), precio: '160', moneda: 'MXN', quien: 'compras', motivo: 'precio inicial', documento: '' }, { fecha: d(-20), precio: '180', moneda: 'MXN', quien: 'compras', motivo: 'ajuste por inflación', documento: '' }], notas: '' },
    { id: 'pp-guantes-tattoo', productoId: 'prod-guantes', proveedorId: 'prv-tattoo', skuProveedor: 'TS-GNT', precio: '165', moneda: 'MXN', tiempoEntrega: '5 días', cantidadMinima: '10', formaPago: 'Contado', credito: false, historial: [], notas: 'Más barato pero pedido mínimo mayor.' },
    { id: 'pp-aguja-insumos', productoId: 'prod-aguja', proveedorId: 'prv-insumos', skuProveedor: 'IMM-16G', precio: '8', moneda: 'MXN', tiempoEntrega: '3 días', cantidadMinima: '100', credito: true, diasCredito: '15', historial: [{ fecha: d(-60), precio: '8', moneda: 'MXN', quien: 'compras', motivo: 'precio vigente', documento: '' }], notas: '' },
    { id: 'pp-joya-titanio', productoId: 'prod-joya', proveedorId: 'prv-titanio', skuProveedor: 'TB-TI', precio: '120', moneda: 'MXN', tiempoEntrega: '10 días', cantidadMinima: '20', credito: false, incoterms: 'EXW', lugarRecoleccion: 'CDMX', historial: [{ fecha: d(-90), precio: '110', moneda: 'MXN', quien: 'compras', motivo: 'inicial', documento: '' }, { fecha: d(-15), precio: '120', moneda: 'MXN', quien: 'proveedor', motivo: 'alza de titanio', documento: '' }], notas: 'Proveedor único.' },
    { id: 'pp-gasas-insumos', productoId: 'prod-gasas', proveedorId: 'prv-insumos', skuProveedor: 'IMM-GAS', precio: '2', moneda: 'MXN', tiempoEntrega: '3 días', cantidadMinima: '200', credito: true, diasCredito: '15', historial: [], notas: '' },
    { id: 'pp-tinta-tattoo', productoId: 'prod-tinta', proveedorId: 'prv-tattoo', skuProveedor: 'TS-TNT', precio: '250', moneda: 'MXN', tiempoEntrega: '6 días', cantidadMinima: '5', credito: false, historial: [], notas: '' },
  ];
  const ORDENES = [
    { id: 'oc-guantes-rfq', folio: 'OC-0001', etapa: 'cotizacion', productoId: 'prod-guantes', proveedorId: 'prv-insumos', descripcion: 'Guantes de nitrilo (caja 100)', cantidad: '10', unidad: 'caja', precioUnitario: '180', moneda: 'MXN', fechaSolicitud: d(-3), fechaRequerida: d(4), aprobadaPor: '', recibidoOk: false, evaluacion: '', notas: 'RFQ enviada; esperando confirmación de precio por volumen.' },
    { id: 'oc-aguja', folio: 'OC-0002', etapa: 'orden', productoId: 'prod-aguja', proveedorId: 'prv-insumos', descripcion: 'Aguja estéril 16G', cantidad: '300', unidad: 'pza', precioUnitario: '8', moneda: 'MXN', fechaSolicitud: d(-6), fechaRequerida: d(1), aprobadaPor: 'Suzet', recibidoOk: false, evaluacion: '', notas: 'Urgente: stock bajo el mínimo.' },
    { id: 'oc-joya', folio: 'OC-0003', etapa: 'recepcion', productoId: 'prod-joya', proveedorId: 'prv-titanio', descripcion: 'Joyería de titanio (surtido)', cantidad: '30', unidad: 'pza', precioUnitario: '120', moneda: 'MXN', fechaSolicitud: d(-14), fechaRequerida: d(-2), aprobadaPor: 'Suzet', recibidoOk: false, evaluacion: '', notas: 'En tránsito desde CDMX.' },
    { id: 'oc-tinta-cerrada', folio: 'OC-0004', etapa: 'cerrada', productoId: 'prod-tinta', proveedorId: 'prv-tattoo', descripcion: 'Tinta de tatuaje negra', cantidad: '10', unidad: 'bote', precioUnitario: '250', moneda: 'MXN', fechaSolicitud: d(-40), fechaRequerida: d(-33), aprobadaPor: 'Francisco', recibidoOk: true, evaluacion: 'Entrega a tiempo, buena calidad.', notas: 'Ciclo completo.' },
  ];
  const CONTRATOS = [
    { id: 'ctr-arrendamiento', titulo: 'Arrendamiento local (Girly Zone)', proveedorId: 'prv-girly', tipo: 'arrendamiento', fechaInicio: d(-345), fechaVencimiento: d(20), renovacionAutomatica: false, monto: 'PENDIENTE', moneda: 'MXN', responsables: 'Suzet', clausulas: 'Renta mensual, servicios incluidos, uso exclusivo del local de 2ª planta.', multas: '1 mes de renta por terminación anticipada', exclusividad: false, confidencialidad: false, garantias: 'Depósito 1 mes', alertaDias: '30', documento: '', notas: 'Renovar o renegociar pronto.' },
    { id: 'ctr-rpbi', titulo: 'Gestión de RPBI', proveedorId: '', tipo: 'servicio', fechaInicio: d(-200), fechaVencimiento: d(160), renovacionAutomatica: true, monto: '1200', moneda: 'MXN', responsables: 'Suzet', clausulas: 'Recolección quincenal de residuos peligrosos biológico-infecciosos con manifiesto.', multas: '', exclusividad: false, confidencialidad: false, garantias: 'Manifiestos de disposición', alertaDias: '45', documento: '', notas: 'Obligatorio por normativa sanitaria.' },
    { id: 'ctr-titanio', titulo: 'Suministro joyería titanio', proveedorId: 'prv-titanio', tipo: 'suministro', fechaInicio: d(-400), fechaVencimiento: d(-10), renovacionAutomatica: false, monto: '', moneda: 'MXN', responsables: 'Suzet', clausulas: 'Precios preferentes por volumen anual.', multas: '', exclusividad: true, confidencialidad: false, garantias: '', alertaDias: '30', documento: '', notas: 'VENCIDO: renegociar (proveedor único).' },
  ];
  const EMBARQUES = [
    // Paquetería (Estafeta): agujas + guantes en una guía. En tránsito con ETA vencida = retrasado.
    { id: 'emb-insumos', folio: 'EMB-0001', modalidad: 'paqueteria', ordenIds: ['oc-aguja', 'oc-guantes-rfq'], transportista: 'Estafeta', origen: 'Querétaro', destino: 'Girly Zone', incoterm: 'DAP', estado: 'transito', fechaRecoleccion: d(-4), fechaEstimada: d(-1), fechaEntrega: '', tracking: 'EST-778812', peso: '6', bultos: '2', flete: '220', seguro: '50', aduana: '', maniobras: '', otros: '', notas: 'Paquetería: cobro por guía/peso.' },
    // Paquetería (Paquetexpress): joyería de titanio desde CDMX, recolección en origen (EXW).
    { id: 'emb-titanio', folio: 'EMB-0002', modalidad: 'paqueteria', ordenIds: ['oc-joya'], transportista: 'Paquetexpress', origen: 'CDMX', destino: 'Girly Zone', incoterm: 'EXW', estado: 'transito', fechaRecoleccion: d(-2), fechaEstimada: d(3), fechaEntrega: '', tracking: 'PX-4471', peso: '1.5', bultos: '1', flete: '180', seguro: '120', aduana: '', maniobras: '', otros: '', notas: 'Sobre asegurado por valor.' },
    // Carga/flete: porcelanato y material de obra en tráiler (consolidado, entregado).
    { id: 'emb-obra', folio: 'EMB-0003', modalidad: 'carga', ordenIds: [], transportista: 'Fletes del Centro', origen: 'León', destino: 'Girly Zone', incoterm: 'DAP', estado: 'entregado', fechaRecoleccion: d(-30), fechaEstimada: d(-27), fechaEntrega: d(-27), tracking: 'CP-1102', peso: '850', bultos: '12', flete: '1800', seguro: '200', aduana: '', maniobras: '300', otros: '', notas: 'Tráiler con material de obra en tarima.' },
    // IMPORTACIÓN: joyería premium desde EUA por DHL, en aduana. Aduana = arancel+IVA+DTA+agente.
    { id: 'emb-import', folio: 'EMB-0004', modalidad: 'paqueteria', importacion: { esImportacion: true, paisOrigen: 'Estados Unidos', fraccionArancelaria: '7117.19.99', pedimento: '26 43 3807 5001234', agenteAduanal: 'Aduanales del Bajío', valorAduana: '8000', arancelPct: '15', ivaPct: '16', dta: '290', honorariosAgente: '1200', otros: '150' }, ordenIds: [], transportista: 'DHL', origen: 'Miami, EUA', destino: 'Girly Zone', incoterm: 'DAP', estado: 'aduana', fechaRecoleccion: d(-5), fechaEstimada: d(2), fechaEntrega: '', tracking: 'DHL-99120', peso: '2', bultos: '1', flete: '650', seguro: '160', aduana: '4358.40', maniobras: '', otros: '', notas: 'Joyería premium de titanio anodizado; en despacho aduanal.' },
  ];
  const TRANSPORTISTAS = [
    { id: 'trp-estafeta', nombre: 'Estafeta', modalidades: ['paqueteria'], contacto: 'Sucursal Qro', telefono: '442-100-2000', email: '', sitioWeb: 'https://estafeta.com', zonas: ['Local', 'Bajío', 'Nacional'], tarifas: [{ modalidad: 'paqueteria', zona: 'Bajío', base: '80', porKg: '22', porViaje: '', tiempoDias: '2', notas: '' }, { modalidad: 'paqueteria', zona: 'Nacional', base: '95', porKg: '28', porViaje: '', tiempoDias: '3', notas: '' }], notas: 'Paquetería principal.' },
    { id: 'trp-dhl', nombre: 'DHL', modalidades: ['paqueteria'], contacto: '', telefono: '', email: '', sitioWeb: 'https://dhl.com', zonas: ['Nacional', 'Internacional'], tarifas: [{ modalidad: 'paqueteria', zona: 'Nacional', base: '130', porKg: '20', porViaje: '', tiempoDias: '2', notas: 'Más caro base, mejor por kg.' }], notas: 'Para envíos urgentes o pesados.' },
    { id: 'trp-paquetex', nombre: 'Paquetexpress', modalidades: ['paqueteria'], contacto: '', telefono: '', email: '', sitioWeb: '', zonas: ['Nacional'], tarifas: [{ modalidad: 'paqueteria', zona: 'Nacional', base: '85', porKg: '24', porViaje: '', tiempoDias: '4', notas: '' }], notas: '' },
    { id: 'trp-fletes', nombre: 'Fletes del Centro', modalidades: ['carga'], contacto: 'Logística', telefono: '477-200-3000', email: '', sitioWeb: '', zonas: ['Bajío'], tarifas: [{ modalidad: 'carga', zona: 'Bajío', base: '600', porKg: '', porViaje: '1800', tiempoDias: '3', notas: 'Tarima/tráiler.' }], notas: 'Para obra y volumen.' },
    { id: 'trp-moto', nombre: 'Mensajería Rápida QRO', modalidades: ['mensajeria'], contacto: '', telefono: '442-300-4000', email: '', sitioWeb: '', zonas: ['Local'], tarifas: [{ modalidad: 'mensajeria', zona: 'Local', base: '60', porKg: '5', porViaje: '', tiempoDias: '1', notas: 'Mismo día en la ciudad.' }], notas: '' },
  ];
  const INCIDENCIAS = [
    { id: 'inc-1', proveedorId: 'prv-insumos', tipo: 'retraso', gravedad: 'media', fecha: d(-25), descripcion: 'Entrega de guantes llegó 4 días tarde.', ordenId: '', evidencia: '' },
    { id: 'inc-2', proveedorId: 'prv-tattoo', tipo: 'defecto', gravedad: 'leve', fecha: d(-50), descripcion: 'Un bote de tinta llegó mal sellado.', ordenId: 'oc-tinta-cerrada', evidencia: '' },
  ];
  const INTERACCIONES = [
    { id: 'int-1', proveedorId: 'prv-insumos', tipo: 'cotización', canal: 'correo', direccion: 'saliente', fecha: d(-6), resumen: 'RFQ de guantes y agujas.', ordenId: 'oc-guantes-rfq' },
    { id: 'int-2', proveedorId: 'prv-insumos', tipo: 'respuesta', canal: 'correo', direccion: 'entrante', fecha: d(-4), resumen: 'Confirmó precio 180/caja, ofrece 170 por 15+ cajas.', ordenId: '' },
    { id: 'int-3', proveedorId: 'prv-titanio', tipo: 'llamada', canal: 'teléfono', direccion: 'saliente', fecha: d(-12), resumen: 'Avisó alza de precio del titanio.', ordenId: '' },
    { id: 'int-4', proveedorId: 'prv-clima', tipo: 'nota', canal: '', direccion: 'saliente', fecha: d(-40), resumen: 'Mantenimiento de minisplits pendiente de reagendar.', ordenId: '' },
  ];
  const up = async (ref: string, filas: unknown[]) => {
    await prisma.tablaProyecto.upsert({ where: { proyectoId_tablaRef: { proyectoId: PID, tablaRef: ref } }, create: { proyectoId: PID, tablaRef: ref, filas: J(filas), actualizadoEn: now() }, update: { filas: J(filas), actualizadoEn: now() } });
  };
  await up('productos', PRODUCTOS);
  await up('producto_proveedor', VINCULOS);
  await up('ordenes_compra', ORDENES);
  await up('contratos', CONTRATOS);
  await up('incidencias', INCIDENCIAS);
  await up('interacciones_prov', INTERACCIONES);
  await up('embarques', EMBARQUES);
  await up('transportistas', TRANSPORTISTAS);
  console.log(`✅ Abastecimiento: ${PRODUCTOS.length} productos, ${VINCULOS.length} vínculos, ${ORDENES.length} órdenes, ${CONTRATOS.length} contratos, ${INCIDENCIAS.length} incidencias, ${INTERACCIONES.length} interacciones, ${EMBARQUES.length} embarques, ${TRANSPORTISTAS.length} transportistas.`);

  // 7c) RH: marca algunos procesos como AUTOMATIZADOS → alimentan los planos IA y Tecnológico.
  const procesosTodos = await prisma.proceso.findMany({ where: { proyectoId: PID } });
  let autos = 0;
  for (const pr of procesosTodos) {
    const n = pr.nombre.toLowerCase();
    let auto: { con: string; herramienta: string; nota: string } | null = null;
    // Solo procesos claramente automatizables (evita marcar de más).
    if (n.includes('catálogo') || n.includes('catalogo')) auto = { con: 'ia', herramienta: 'Agente de catálogo', nota: 'Publica y actualiza el catálogo desde una lista.' };
    else if (n.includes('recordatorio') || n.includes('confirmar cita') || n.includes('confirmación de cita')) auto = { con: 'n8n', herramienta: 'n8n: recordatorio de cita', nota: 'Envía recordatorio por WhatsApp antes de la cita.' };
    else if (n.includes('facturación') || n.includes('facturacion') || n.includes('emitir factura')) auto = { con: 'software', herramienta: 'Facturación CFDI', nota: 'Emite el CFDI desde el POS.' };
    if (auto) { const dd = (pr.data as Record<string, unknown>) ?? {}; await prisma.proceso.update({ where: { id: pr.id }, data: { data: J({ ...dd, automatizacion: auto }) } }); autos++; }
    else if ((pr.data as Record<string, unknown>)?.automatizacion) { const dd = { ...(pr.data as Record<string, unknown>) }; delete dd.automatizacion; await prisma.proceso.update({ where: { id: pr.id }, data: { data: J(dd) } }); }
  }
  console.log(`✅ RH: ${autos} procesos marcados como automatizados (alimentan IA/Tecnológico).`);

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

  // 9) Datos de lente en los ESPACIOS (uso, roles, mantenimiento) → enriquecen ARQ/ORG/OPE/FIN.
  const ESPACIO_DATA: Record<string, Record<string, string>> = {
    'Recepción y espera': { uso: 'Recibir, registrar y cobrar al cliente', proc_rol: 'Recepcionista', org_acceso: 'Recepcionista', ope_ejecutor: 'humano' },
    'Cabina de perforación': { uso: 'Perforación en condiciones estériles', proc_proceso: 'Perforación con aguja estéril', proc_rol: 'Perforador', org_acceso: 'Perforador', fin_mantenimiento: 'Desinfección entre clientes' },
    'Cabina 2': { uso: 'Cabina secundaria / tatuaje', proc_rol: 'Perforador', org_acceso: 'Perforador' },
    'Esterilización': { uso: 'Esterilizar y empacar instrumental', proc_rol: 'Asistente', org_acceso: 'Asistente', tec_herramienta: 'Autoclave', fin_mantenimiento: 'Limpieza semanal de la cámara' },
    'Sanitario': { uso: 'Sanitario de clientes y asepsia de manos' },
    'Entrada': { uso: 'Acceso y espera breve' },
    'Sala Principal': { uso: 'Asesoría y sala de espera', proc_rol: 'Perforador' },
    'Zona Pizarrón': { uso: 'Explicar cuidados y diseños', proc_rol: 'Perforador' },
    'Rincón Servicios': { uso: 'Apoyo: carrito, insumos y RPBI' },
    'Baño': { uso: 'Baño de clientes' },
  };
  const esps = await prisma.espacio.findMany({ where: { proyectoId: PID } });
  let espActualizados = 0;
  for (const e of esps) {
    const d = ESPACIO_DATA[e.nombre]; if (!d) continue;
    const cur = (e.data as Record<string, unknown>) ?? {};
    await prisma.espacio.update({ where: { id: e.id }, data: { data: J({ ...cur, ...d }) } });
    espActualizados++;
  }
  console.log(`✅ Datos de lente en ${espActualizados} espacios.`);
  // La sede de Altercing YA existe (opera hoy) → alimenta el flujo de "¿ya hay instalaciones?".
  const sedes = await prisma.sede.findMany({ where: { proyectoId: PID } });
  for (const s of sedes) { const sd = (s.data as Record<string, unknown>) ?? {}; await prisma.sede.update({ where: { id: s.id }, data: { data: J({ ...sd, existe: true }) } }); }
  console.log(`✅ ${sedes.length} sede(s) marcadas como existentes (LiDAR + Jurídico).`);

  // 10) Más recursos por proceso (herramientas, equipo, muebles, manuales) en el mapa.
  const AUTOCLAVE_MANUAL = 'Cargar bolsas selladas; ciclo 134 °C / 18 min; registrar. Limpieza de cámara semanal.';
  const RECURSOS_PROC: Record<string, { herramientas?: string[]; equipo?: string[]; muebles?: string[]; manuales?: Record<string, string> }> = {
    'PROC-mrufyz9n-0qn42': { herramientas: ['Marcador quirúrgico'], muebles: ['Camilla / sillón', 'Lámpara de examen'] }, // Asepsia
    'PROC-mrufyvjy-8wry6': { equipo: ['Autoclave'], muebles: ['Camilla / sillón', 'Carrito de instrumental'], manuales: { 'Autoclave': AUTOCLAVE_MANUAL } }, // Preparar cabina
    'PROC-mrufyuri-cygax': { equipo: ['Autoclave'], manuales: { 'Autoclave': AUTOCLAVE_MANUAL } }, // Encender y verificar esterilización
    'PROC-mrufz1pt-djykd': { equipo: ['Autoclave'], herramientas: ['Pinza Pennington'], manuales: { 'Autoclave': AUTOCLAVE_MANUAL } }, // Limpieza y esterilización
    'PROC-mrufyw6p-r47xh': { herramientas: ['Terminal POS'], muebles: ['Mostrador de recepción', 'Dispensador de agua'] }, // Recibir al cliente
    'PROC-mrufyy13-xh3ks': { herramientas: ['Terminal de pago'], muebles: ['Mostrador de recepción'] }, // Cobrar el servicio
    'PROC-mrufywtg-la51y': { muebles: ['Sillas', 'Vitrina de joyería', 'Espejo'] }, // Asesoría
    'PROC-mrufyymw-asgfq': { herramientas: ['Marcador quirúrgico'], muebles: ['Espejo'] }, // Marcaje anatómico
  };
  let recProc = 0;
  for (const [pid, v] of Object.entries(RECURSOS_PROC)) {
    const pr = await prisma.proceso.findUnique({ where: { id: pid } });
    if (!pr) continue;
    const dd = (pr.data as Record<string, unknown>) ?? {};
    const merged: Record<string, unknown> = { ...dd };
    if (v.herramientas) merged.herramientas = v.herramientas;
    if (v.equipo) merged.equipo = v.equipo;
    if (v.muebles) merged.muebles = v.muebles;
    if (v.manuales) merged.manuales = { ...(dd.manuales as Record<string, string> ?? {}), ...v.manuales };
    await prisma.proceso.update({ where: { id: pid }, data: { data: J(merged) } });
    recProc++;
  }
  console.log(`✅ Herramientas/equipo/muebles en ${recProc} procesos más.`);

  // 11) Videos/documentos de apoyo en procesos con temas complejos.
  const APOYOS_PROC: Record<string, { tipo: string; titulo: string; url: string; nota?: string }[]> = {
    'PROC-mrufyriv-d67we': [{ tipo: 'video', titulo: 'Cómo aplicar acabados de albañilería (impermeabilizante y pintura lavable)', url: 'https://www.youtube.com/results?search_query=acabados+alba%C3%B1iler%C3%ADa', nota: 'El jefe de obra lo muestra en la mañana antes de aplicar.' }], // Acondicionar el local
    'PROC-mrufyzuh-p0829': [{ tipo: 'video', titulo: 'Técnica de perforación segura y colocación de joyería', url: 'https://www.youtube.com/results?search_query=piercing+technique', nota: 'Repaso de técnica y asepsia.' }], // Perforación
    'PROC-mrufz1pt-djykd': [{ tipo: 'documento', titulo: 'Protocolo de esterilización (autoclave) y manejo de RPBI', url: 'https://drive.google.com/', nota: 'Documento interno; leer antes del primer ciclo.' }], // Limpieza y esterilización
  };
  let conApoyo = 0;
  for (const [pid, aps] of Object.entries(APOYOS_PROC)) {
    const pr = await prisma.proceso.findUnique({ where: { id: pid } });
    if (!pr) continue;
    const dd = (pr.data as Record<string, unknown>) ?? {};
    const apoyos = aps.map((a, i) => ({ id: `${pid}-apo-${i + 1}`, ...a }));
    await prisma.proceso.update({ where: { id: pid }, data: { data: J({ ...dd, apoyos }) } });
    conApoyo++;
  }
  console.log(`✅ Videos/documentos de apoyo en ${conApoyo} procesos.`);

  // 12) Tiempos y espacio por proceso (servicio) → alimenta la SIMULACIÓN.
  const SIM_PROC: Record<string, { min: number; espacio: string }> = {
    'PROC-mrufyw6p-r47xh': { min: 5, espacio: 'Recepción y espera' },   // Recibir al cliente
    'PROC-mrufywtg-la51y': { min: 10, espacio: 'Sala Principal' },      // Asesoría
    'PROC-mrufyxg8-7kgab': { min: 5, espacio: 'Recepción y espera' },   // Verificar edad / consentimiento
    'PROC-mrufyymw-asgfq': { min: 5, espacio: 'Cabina de perforación' },// Marcaje anatómico
    'PROC-mrufyz9n-0qn42': { min: 5, espacio: 'Cabina de perforación' },// Asepsia
    'PROC-mrufyzuh-p0829': { min: 10, espacio: 'Cabina de perforación' },// Perforación
    'PROC-mrufz0gb-4ppz7': { min: 5, espacio: 'Cabina de perforación' },// Colocar joyería
    'PROC-mrufz134-u4ckv': { min: 5, espacio: 'Cabina de perforación' },// Indicaciones de cuidado
    'PROC-mrufyy13-xh3ks': { min: 5, espacio: 'Recepción y espera' },   // Cobrar
    'PROC-mrufz1pt-djykd': { min: 15, espacio: 'Esterilización' },      // Limpieza y esterilización
  };
  let simSeed = 0;
  for (const [pid, v] of Object.entries(SIM_PROC)) {
    const pr = await prisma.proceso.findUnique({ where: { id: pid } });
    if (!pr) continue;
    const dd = (pr.data as Record<string, unknown>) ?? {};
    await prisma.proceso.update({ where: { id: pid }, data: { data: J({ ...dd, tiempoMin: v.min, tiempoEstimado: false, espacios: [{ nombre: v.espacio }] }) } });
    simSeed++;
  }
  console.log(`✅ Tiempos y espacio en ${simSeed} procesos (simulación).`);

  // 13) Objeto DEMO modelado paramétricamente (como lo haría el chat) para ver el render real.
  const cabina = esps.find((e) => e.nombre === 'Cabina de perforación');
  if (cabina) {
    const prims = [
      { forma: 'caja', w: 0.9, h: 0.3, d: 0.22, x: 0, y: 2.05, z: 0, color: '#f2f2ee', material: 'blanco' },
      { forma: 'caja', w: 0.82, h: 0.04, d: 0.01, x: 0, y: 1.94, z: 0.11, color: '#c9ced3', material: 'metal' },
      { forma: 'caja', w: 0.18, h: 0.05, d: 0.02, x: 0.28, y: 2.2, z: 0.11, color: '#2b6cb0', material: 'plastico' },
    ];
    const ficha = { Marca: 'Mirage', Modelo: 'X3', Tipo: 'Minisplit inverter', Capacidad: '12,000 BTU', Voltaje: '127 V', Dimensiones: '90×30×22 cm' };
    await prisma.objetoFisico.upsert({
      where: { id: 'OBJ-ac-mirage-demo' },
      create: { id: 'OBJ-ac-mirage-demo', proyectoId: PID, sedeId: cabina.sedeId, espacioId: cabina.id, nombre: 'Aire acondicionado Mirage X3', categoria: 'equipo', capa: cabina.capa, x: cabina.x + 0.6, y: cabina.y + 0.2, ancho: 0.9, alto: 0.25, data: J({ modelo3d: JSON.stringify(prims), fichaTecnica: JSON.stringify(ficha) }) },
      update: { data: J({ modelo3d: JSON.stringify(prims), fichaTecnica: JSON.stringify(ficha) }) },
    });
    console.log('✅ Objeto demo paramétrico: "Aire acondicionado Mirage X3" en la Cabina.');
  }

  console.log('\n🎉 Altercing Studio llenado. Recarga la app.');
}

main().catch((e) => { console.error('SEED_FAIL', e instanceof Error ? e.message : String(e)); process.exitCode = 1; }).finally(() => prisma.$disconnect());
