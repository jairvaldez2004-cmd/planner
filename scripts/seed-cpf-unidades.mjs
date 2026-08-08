// Siembra las 8 UNIDADES COMERCIALES de Corporativo Palo Fierro con su ficha estructural,
// y el MAPA OPERATIVO COMPLETO de UC-01 (Planeación y Arquitectura Empresarial).
//
// Fuente: instrucción del propietario 2026-08-08. Las 5 UCs anteriores de CPF eran
// marcadores de posición vacíos (0 ofertas, 0 procesos, data={"tipo":""}) y se reemplazan.
//
// Principio respetado: los campos de la ficha que ya tienen dueño en el mapa operativo
// (proceso, subprocesos, roles, departamentos, herramientas, software, automatizaciones, IA)
// NO se capturan aquí — se derivan. Ver src/domain/uc-ficha.ts.
//
// Correr: DATABASE_URL=<public> node scripts/seed-cpf-unidades.mjs [--dry]

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PROY = 'WS-GRUPO-DIOQUIS--CORPORATIVO-PALO-FIERRO';
const DRY = process.argv.includes('--dry');
const L = (...xs) => xs.join('\n');
const P = 'PENDIENTE — definir con el propietario';

// ─────────────────────────────────────────── las 8 unidades comerciales

const UCS = [
  {
    id: 'UC-CPF-01-PLANEACION', nombre: 'UC-01 Planeación y Arquitectura Empresarial',
    tipo: 'servicio profesional', orden: 1,
    descripcion: 'Convierte una idea, oportunidad o empresa existente en un plano empresarial ejecutable.',
    ficha: {
      proposito: 'Convertir una idea, oportunidad o empresa existente en un plano empresarial ejecutable, con todo lo necesario para que otra unidad o empresa lo construya sin volver a investigar.',
      clienteObjetivo: L(
        'Interno: cualquier empresa de Grupo Dioquis que va a nacer, transformarse o escalar.',
        'Externo: emprendedor, dueño de negocio, inversionista o empresa que contrata el plano.',
      ),
      problemaQueResuelve: 'La empresa se va a construir (o ya se construyó) improvisando: idea → ventas → contrataciones → problemas → reestructura → dependencia del dueño. No existe un documento que diga cómo debe funcionar antes de gastar el dinero.',
      triggerEntrada: L(
        'Alguien del grupo propone crear una empresa o unidad nueva.',
        'Un cliente externo solicita un plano empresarial.',
        'Una empresa existente necesita rediseño y entra por UC-07 Turnaround.',
        'Grupo Dioquis aprueba una adquisición que hay que rediseñar.',
      ),
      requisitosEntrada: L(
        'Una entidad objetivo identificada (aunque todavía no exista legalmente).',
        'Un interlocutor con autoridad para responder y decidir.',
        'Alcance acordado: qué se planea y hasta qué profundidad.',
        'Acceso a los datos reales si la empresa ya opera.',
      ),
      diagnostico: 'El Curador conduce el intake y el Motor de Selección (reglas deterministas) clasifica la entidad y decide qué planos, módulos y profundidad aplican. Resultado: un blueprint. Si el caso no requiere plano completo, se rechaza o se manda a la unidad que corresponda.',
      servicios: L(
        'Plano empresarial completo (18 planos del estándar PLANO ALV).',
        'Plano parcial por capa (solo comercial, solo operativo, solo tecnológico…).',
        'Rediseño de empresa existente.',
        'Segunda opinión / validación de un plan ya hecho.',
        'Investigación de mercado y validación de modelo.',
        'Modelado financiero y capital necesario.',
      ),
      entregables: L(
        'Documento Maestro (Plano ALV) con los 18 planos.',
        'Paquete para Inversionistas (memorándum de inversión).',
        'Paquete para Arquitectos e Ingenieros (programa + plano 2D/3D por espacio).',
        'Paquete de Operaciones (procesos, SOPs, KPIs).',
        'Paquete de RH (estructura, roles, ciclo de vida del empleado).',
        'Paquete de Marketing y Ventas.',
        'Paquete de Tecnología / Software (configuración inicial de sistemas).',
        'Paquete Legal.',
        'Roadmap por etapas y capital necesario por etapa.',
      ),
      empresasDioquis: L(
        'Dioquis Software — construye los sistemas que el plano especifica.',
        'Dioquis AI — capacidades inteligentes del plano de IA.',
        'Macao Marketing — marca, posicionamiento y demanda.',
        'Comercializadora General Commerce — proveedores y abastecimiento.',
        'PROCNOR — obra e infraestructura física.',
        'XLine — diseño integral de espacios.',
        'Inmobiliaria ALV — inmuebles.',
        'Financiera ALV — capital y financiamiento.',
      ),
      proveedoresExternos: L(
        'Especialistas por industria (cuando el giro lo exige).',
        'Fuentes de datos de mercado.',
        'Notaría y despachos legales (vía Paquete Legal).',
      ),
      formularios: L(
        'Intake del Curador (diagnóstico inicial).',
        'Las 18 capturas por plano (una por especialista).',
        'Plantillas CSV de las tablas maestras (datos repetitivos).',
      ),
      documentos: L(
        'Blueprint del proyecto (qué planos, qué profundidad, qué mínimo operable).',
        'Propuesta comercial y alcance firmado.',
        'Acta de validación del plano con el cliente.',
      ),
      datosGenerados: L(
        'Diagnóstico y clasificación de la entidad.',
        'Campos capturados de los 18 planos.',
        'Tablas maestras (catálogo, roles, procesos, proveedores…).',
        'Readiness por plano (qué está mínimo operable, publicado, completo).',
        'Estimación de capital por etapa.',
      ),
      kpis: L(
        'Días desde intake hasta plano validado.',
        '% de planos que llegan a mínimo operable.',
        '% de campos PENDIENTE al momento de entregar.',
        'Nº de planos entregados que efectivamente pasan a UC-02 (no se quedan en papel).',
        'Retrabajos solicitados por el cliente tras la validación.',
      ),
      riesgos: L(
        'El cliente no tiene los datos reales y el plano se llena de supuestos.',
        'Alcance que crece durante la captura (scope creep) sin ajustar precio ni plazo.',
        'Plano entregado que nunca se ejecuta: se vuelve papel.',
        'Dependencia de una sola persona que conoce el método.',
        'Sobre-planear: profundidad completa donde bastaba lo esencial.',
      ),
      controles: L(
        'Todo dato no confirmado se marca PENDIENTE, nunca se inventa.',
        'Umbrales de readiness: un plano no se publica sin su mínimo operable.',
        'Alcance y profundidad se fijan en el blueprint ANTES de capturar.',
        'Validación formal con el cliente antes de entregar.',
        'Handoff obligatorio a UC-02 con criterio de aceptación explícito.',
      ),
      costos: L(
        'Horas de Arquitecto Empresarial y de Operador de Business Planner.',
        'Consumo de API de los agentes (Curador, Coordinador, 18 Especialistas).',
        'Investigación de mercado y fuentes de datos.',
        'Especialistas externos por industria, cuando aplica.',
      ),
      pricing: P + '. Opciones a evaluar: precio fijo por plano · por paquete de entregables · por fase · retainer · éxito/equity en casos internos.',
      sla: P + '. Debe fijarse contra el mapa operativo de esta unidad (la suma de los tiempos de sus procesos), no a ojo.',
      criterioTerminacion: L(
        'Los planos del blueprint alcanzaron su umbral acordado (mínimo operable o completo).',
        'El cliente validó formalmente el plano.',
        'Los paquetes de entregables están generados y entregados.',
        'El handoff a la siguiente unidad está aceptado por quien lo recibe.',
      ),
      handoff: 'Normalmente a UC-02 Creación y Lanzamiento, con el Documento Maestro, el roadmap por etapas y el capital necesario. Si la empresa ya opera, puede ir a UC-03 Organización o a UC-04 Sistematización. Si el plano se hizo para vender, va directo a UC-08.',
    },
  },
  {
    id: 'UC-CPF-02-CREACION', nombre: 'UC-02 Creación y Lanzamiento de Empresas',
    tipo: 'dirección de proyecto', orden: 2,
    descripcion: 'Toma el plano y lo convierte en una empresa operando.',
    ficha: {
      proposito: 'Convertir un plano empresarial en una empresa real, operando, coordinando a las empresas del grupo que ejecutan cada parte.',
      clienteObjetivo: 'Quien ya tiene un plano validado (interno o externo) y necesita que exista.',
      problemaQueResuelve: 'Existe el plano pero nadie lo ejecuta, o se ejecuta por partes sin integrar: la obra va por un lado, la marca por otro y el sistema nunca llega.',
      triggerEntrada: L('Plano validado y aceptado en el handoff de UC-01.', 'Cliente que llega con un plan propio ya hecho y pide ejecución.'),
      requisitosEntrada: L('Plano validado.', 'Capital aprobado o financiamiento gestionado.', 'Decisión de arranque tomada.'),
      diagnostico: 'Se revisa que el plano tenga lo mínimo ejecutable y que las empresas ejecutoras tengan capacidad en el periodo.',
      servicios: L('Dirección de proyecto de creación de empresa.', 'Constitución y estructura empresarial.', 'Puesta en marcha de operación.', 'Apertura y lanzamiento.'),
      entregables: L('Empresa constituida y operando.', 'Marca lanzada.', 'Instalaciones listas.', 'Sistemas implementados.', 'Equipo contratado y capacitado.', 'Procesos iniciales corriendo.'),
      empresasDioquis: L('Macao Marketing — marca y lanzamiento.', 'Dioquis Software — sistemas.', 'PROCNOR — obra.', 'XLine — interiorismo.', 'General Commerce — proveedores.', 'Inmobiliaria ALV — inmueble.', 'Financiera ALV — financiamiento.'),
      proveedoresExternos: P, formularios: P, documentos: P, datosGenerados: P,
      kpis: L('Días de plano a apertura.', 'Desviación de presupuesto vs. el plano.', 'Entregables comprometidos vs. entregados.'),
      riesgos: L('Una empresa ejecutora se retrasa y arrastra a las demás.', 'El plano resulta incompleto al ejecutarlo.', 'Presupuesto rebasado.'),
      controles: P, costos: P, pricing: P, sla: P,
      criterioTerminacion: L('La empresa opera y vende.', 'Los procesos iniciales están corriendo.', 'Handoff aceptado por UC-03.'),
      handoff: 'A UC-03 Organización y Profesionalización, con la empresa operando y la lista de lo que quedó pendiente de ordenar.',
    },
  },
  {
    id: 'UC-CPF-03-ORGANIZACION', nombre: 'UC-03 Organización y Profesionalización',
    tipo: 'servicio profesional', orden: 3,
    descripcion: 'Quita la dependencia del dueño: estructura, roles, SOPs, KPIs y gobierno.',
    ficha: {
      proposito: 'Pasar una empresa que funciona pero depende del dueño a un sistema de gestión con responsables, procesos y KPIs.',
      clienteObjetivo: 'Empresa que ya opera y factura, pero está desorganizada o depende del fundador. Es la puerta de entrada más común para empresas existentes — no pasan por Creación.',
      problemaQueResuelve: 'El dueño controla todo: nada se decide ni se ejecuta sin él. La empresa no puede crecer, ni venderse, ni operar si él falta.',
      triggerEntrada: L('Handoff de UC-02 tras el lanzamiento.', 'Empresa existente que entra directo por desorganización.', 'Salida de un turnaround (UC-07).'),
      requisitosEntrada: L('La empresa opera y tiene ingresos.', 'El dueño acepta delegar (sin esto, la unidad fracasa).'),
      diagnostico: 'Se mide el grado de dependencia del fundador, qué procesos existen sin documentar y qué decisiones están centralizadas.',
      servicios: L('Organigrama y definición de roles.', 'SOPs y manuales.', 'Sistema de gestión por KPIs.', 'Gobierno y cadencias de reunión.', 'Presupuestos y centros de responsabilidad.', 'Políticas y delegación.'),
      entregables: L('Organigrama con responsabilidades.', 'Manual de procesos y SOPs.', 'Tablero de KPIs.', 'Calendario de cadencias de gestión.', 'Políticas y esquema de delegación.'),
      empresasDioquis: L('Dioquis Software — tableros y sistemas de gestión, cuando se digitaliza.', 'Macao Marketing — comunicación interna del cambio, si aplica.'),
      proveedoresExternos: P, formularios: P, documentos: P, datosGenerados: P,
      kpis: L('% de decisiones que ya no pasan por el dueño.', 'Procesos documentados vs. procesos reales.', 'Cobertura de KPIs por área.'),
      riesgos: L('El dueño no suelta y la estructura queda en papel.', 'Se documentan procesos que nadie sigue.'),
      controles: P, costos: P, pricing: P, sla: P,
      criterioTerminacion: L('Existe estructura con responsables reales.', 'Los KPIs se revisan en una cadencia establecida.', 'El dueño salió de la operación diaria.'),
      handoff: 'A UC-04 Sistematización y Digitalización, con los procesos ya definidos y listos para volverse software.',
    },
  },
  {
    id: 'UC-CPF-04-SISTEMATIZACION', nombre: 'UC-04 Sistematización y Digitalización',
    tipo: 'servicio profesional', orden: 4,
    descripcion: 'Convierte los procesos definidos en sistemas operativos digitales.',
    ficha: {
      proposito: 'Convertir procesos ya definidos en flujos digitales dentro de sistemas: ERP, CRM, inventarios, finanzas, RRHH, compras, operaciones, tableros.',
      clienteObjetivo: 'Empresa con procesos ya ordenados (típicamente salida de UC-03) que los ejecuta a mano.',
      problemaQueResuelve: 'El proceso existe en papel pero se ejecuta con WhatsApp, Excel y memoria. No hay trazabilidad ni datos.',
      triggerEntrada: L('Handoff de UC-03 con procesos documentados.', 'Empresa que ya está ordenada y pide digitalizar.'),
      requisitosEntrada: L('Procesos definidos y vigentes (no aspiracionales).', 'Responsables asignados por proceso.'),
      diagnostico: 'Se evalúa qué procesos justifican sistema, cuáles se resuelven con configuración y cuáles requieren desarrollo.',
      servicios: L('Especificación funcional de sistemas.', 'Implementación de ERP/CRM.', 'Tableros e integraciones.', 'Gestión documental.', 'Portales y aplicaciones.'),
      entregables: L('Sistema implementado y en uso.', 'Workflows digitales por proceso.', 'Tableros de indicadores en vivo.', 'Usuarios capacitados.'),
      empresasDioquis: L('Dioquis Software — construye e implementa (socio principal de esta unidad).', 'Dioquis Cybersecurity — valida controles.', 'Dioquis Hardware / Telecom — si se requiere infraestructura.'),
      proveedoresExternos: P, formularios: P, documentos: P, datosGenerados: P,
      kpis: L('% de procesos con flujo digital.', 'Adopción real por usuario.', 'Tiempo de ciclo antes vs. después.'),
      riesgos: L('Se digitaliza un proceso malo y se vuelve un problema más rápido.', 'El sistema se implementa pero nadie lo usa.'),
      controles: P, costos: P, pricing: P, sla: P,
      criterioTerminacion: L('Los procesos críticos corren en el sistema.', 'Los datos que generan alimentan los KPIs.', 'Los usuarios operan sin acompañamiento.'),
      handoff: 'A UC-05 Expansión (si el modelo ya es replicable) o a UC-06 Automatización (si ya hay datos suficientes).',
    },
  },
  {
    id: 'UC-CPF-05-EXPANSION', nombre: 'UC-05 Expansión y Replicación',
    tipo: 'dirección de proyecto', orden: 5,
    descripcion: 'Replica un modelo probado: nuevas sedes, canales, líneas, franquicias.',
    ficha: {
      proposito: 'Tomar un modelo que ya funciona y hacerlo más grande: otra ciudad, otro país, nuevas sucursales, canales, líneas, franquicias, distribuidores o licencias.',
      clienteObjetivo: 'Empresa con operación probada, ordenada y preferentemente ya sistematizada.',
      problemaQueResuelve: 'El negocio funciona en un lugar pero no está documentado ni estandarizado como para repetirlo sin perder calidad.',
      triggerEntrada: L('El modelo alcanzó estabilidad operativa y financiera.', 'Decisión de crecer del propietario o del Board.'),
      requisitosEntrada: L('Unidad base rentable y estable.', 'Procesos documentados.', 'Capital para la expansión aprobado.'),
      diagnostico: 'Se determina qué es replicable tal cual, qué debe adaptarse por plaza y qué todavía no está listo para repetirse.',
      servicios: L('Manual replicable de la unidad.', 'Selección y evaluación de plazas.', 'Apertura de nuevas sedes.', 'Diseño de franquicia o licencia.', 'Nuevos canales y líneas.'),
      entregables: L('Manual de replicación.', 'Modelo económico por unidad.', 'Plan de apertura por plaza.', 'Nuevas sedes operando.'),
      empresasDioquis: L('Macao Marketing — lanzamiento por plaza.', 'PROCNOR — obra de cada sede.', 'XLine — interiorismo replicable.', 'Inmobiliaria ALV — búsqueda y negociación de inmuebles.', 'General Commerce — abastecimiento multi-sede.', 'Dioquis Software — sistemas multi-sede.'),
      proveedoresExternos: P, formularios: P, documentos: P, datosGenerados: P,
      kpis: L('Tiempo de apertura por sede nueva.', 'Costo de apertura vs. presupuestado.', 'Desempeño de sede nueva vs. la base.'),
      riesgos: L('Se replica antes de que el modelo base sea realmente estable.', 'La calidad se degrada en las sedes nuevas.'),
      controles: P, costos: P, pricing: P, sla: P,
      criterioTerminacion: L('Las unidades nuevas operan con el estándar de la base.', 'El manual de replicación se usó sin necesidad de rehacerlo.'),
      handoff: 'A UC-06 Automatización, o de vuelta a UC-03/UC-04 para las unidades nuevas.',
    },
  },
  {
    id: 'UC-CPF-06-AUTOMATIZACION', nombre: 'UC-06 Automatización e Inteligencia Operativa',
    tipo: 'servicio profesional', orden: 6,
    descripcion: 'Determina qué partes pueden funcionar solas y las automatiza.',
    ficha: {
      proposito: 'Reducir errores, tiempos, costos y dependencia humana automatizando lo repetible, con agentes de IA y sistemas que operan solos.',
      clienteObjetivo: 'Empresa que ya tiene proceso, personal, software y — sobre todo — datos.',
      problemaQueResuelve: 'Hay trabajo repetitivo que consume personas y genera errores, cuando ya existe la información para que lo haga un sistema.',
      triggerEntrada: L('El sistema ya genera datos suficientes.', 'Se identifican procesos de alto volumen y baja variabilidad.', 'Etapa "automatizar" del roadmap.'),
      requisitosEntrada: L('Procesos digitalizados (UC-04 hecho).', 'Datos históricos disponibles y confiables.'),
      diagnostico: 'Por cada proceso se decide: se automatiza con IA, con n8n/workflow, con software a medida, o no se automatiza.',
      servicios: L('Diagnóstico de automatización por proceso.', 'Agentes de IA operativos.', 'Automatización de compras, marketing y operación.', 'Inteligencia operativa y pronóstico.'),
      entregables: L('Procesos automatizados en producción.', 'Agentes de IA configurados.', 'Tableros de inteligencia operativa.', 'Medición del ahorro real.'),
      empresasDioquis: L('Dioquis AI — capacidades inteligentes.', 'Dioquis Software — integra la IA en los productos.', 'Dioquis Robotics — automatización física.', 'Dioquis Hardware — sensores e infraestructura.', 'Dioquis Telecom — conectividad.', 'Dioquis Cybersecurity — valida controles.'),
      proveedoresExternos: P, formularios: P, documentos: P, datosGenerados: P,
      kpis: L('Horas humanas ahorradas por mes.', '% de procesos automatizados sobre los automatizables.', 'Tasa de error antes vs. después.'),
      riesgos: L('Automatizar un proceso mal definido.', 'Dependencia de un agente sin supervisión ni plan B.', 'Costo de IA mayor que el ahorro.'),
      controles: P, costos: P, pricing: P, sla: P,
      criterioTerminacion: L('Los procesos objetivo operan sin intervención humana rutinaria.', 'El ahorro está medido, no estimado.'),
      handoff: 'A UC-08 M&A (empresa lista para valuarse mejor) o de vuelta a UC-05 para seguir creciendo.',
    },
  },
  {
    id: 'UC-CPF-07-TURNAROUND', nombre: 'UC-07 Transformación / Turnaround',
    tipo: 'servicio profesional', orden: 7,
    descripcion: 'Entrada lateral: empresas existentes con problemas. Puede insertar el caso en cualquier punto del ciclo.',
    ficha: {
      proposito: 'Rescatar y transformar empresas que ya existen pero tienen problemas: estancadas, con pérdidas, desorganizadas, familiares, adquiridas o con costos excesivos.',
      clienteObjetivo: 'Empresa en problemas — interna o externa. Ejemplo típico: factura bien pero pierde dinero.',
      problemaQueResuelve: 'La empresa opera pero destruye valor, y el dueño no sabe dónde está la fuga.',
      triggerEntrada: L('Empresa con pérdidas o estancada solicita intervención.', 'Grupo Dioquis adquiere una empresa que requiere rediseño.', 'Un caso de otra unidad revela que el problema es más profundo.'),
      requisitosEntrada: L('Acceso real a los números.', 'Mandato claro de intervención.', 'Autoridad para decidir cambios.'),
      diagnostico: 'Diagnóstico profundo que determina si el problema es de modelo, de organización, de operación, de costos o de mercado — y en qué punto del ciclo debe insertarse el caso.',
      servicios: L('Diagnóstico de situación.', 'Rediseño del modelo.', 'Reestructura organizacional.', 'Optimización de costos.', 'Plan de recuperación.'),
      entregables: L('Diagnóstico con causa raíz.', 'Plan de transformación por fases.', 'Empresa estabilizada.'),
      empresasDioquis: L('Depende del diagnóstico: cualquier empresa del grupo puede participar.', 'Financiera ALV — si hay reestructura financiera.'),
      proveedoresExternos: P, formularios: P, documentos: P, datosGenerados: P,
      kpis: L('Tiempo hasta punto de equilibrio.', 'Reducción de costos lograda.', 'Empresas estabilizadas vs. intervenidas.'),
      riesgos: L('Se interviene demasiado tarde.', 'El diagnóstico se queda en síntomas y no llega a la causa.', 'Resistencia interna al cambio.'),
      controles: P, costos: P, pricing: P, sla: P,
      criterioTerminacion: L('La empresa dejó de destruir valor.', 'El plan de transformación está en ejecución con responsables.'),
      handoff: 'ENTRADA LATERAL: inserta el caso en la unidad que el diagnóstico indique — UC-01 si necesita replantearse de raíz, UC-03 si es desorganización, UC-04 si es falta de sistemas, UC-08 si conviene venderla.',
    },
  },
  {
    id: 'UC-CPF-08-MA-SALIDA', nombre: 'UC-08 M&A, Preparación para Venta y Salida',
    tipo: 'servicio profesional', orden: 8,
    descripcion: 'Cierre del ciclo: maximiza el valor del activo y monetiza.',
    ficha: {
      proposito: 'Cambiar la pregunta de "cómo crece la empresa" a "cómo maximizamos su valor y monetizamos el activo": preparar, valuar, negociar y cerrar.',
      clienteObjetivo: 'Empresa ordenada, sistematizada y preferentemente automatizada, que se va a conservar con mayor valor, vender, fusionar o recapitalizar.',
      problemaQueResuelve: 'La empresa vale menos de lo que podría porque depende del fundador, no tiene procesos documentados ni números normalizados, y no soportaría un due diligence.',
      triggerEntrada: L('Decisión de vender, fusionar o levantar capital.', 'Empresa que completó el ciclo y llega a su punto de máximo valor.', 'Oferta de compra recibida.'),
      requisitosEntrada: L('Contabilidad ordenada.', 'Procesos documentados.', 'Mandato del propietario.'),
      diagnostico: 'Se evalúa qué tan lista está la empresa para un due diligence y qué hay que corregir antes de salir al mercado.',
      servicios: L('Preparación para due diligence.', 'Limpieza corporativa y normalización financiera.', 'Data room.', 'Valuación.', 'Búsqueda de compradores.', 'Estructuración y negociación de la transacción.', 'Integración post-venta o salida.'),
      entregables: L('Data room completo.', 'Valuación sustentada.', 'Memorándum de información.', 'Transacción cerrada o decisión de conservar.'),
      empresasDioquis: L('Financiera ALV — valuación y estructuración financiera.', 'Dioquis Software — data room y consolidación de información.'),
      proveedoresExternos: L('Despachos legales y fiscales.', 'Auditores.', 'Bancos de inversión / intermediarios, según el tamaño.'),
      formularios: P, documentos: P, datosGenerados: P,
      kpis: L('Múltiplo obtenido vs. múltiplo objetivo.', 'Tiempo de preparación a cierre.', 'Hallazgos en due diligence (menos = mejor preparación).'),
      riesgos: L('Salir al mercado antes de estar listo y quemar el activo.', 'Dependencia del fundador no resuelta que castiga la valuación.', 'Información inconsistente en due diligence.'),
      controles: P, costos: P, pricing: P, sla: P,
      criterioTerminacion: L('Transacción cerrada, o decisión formal de conservar con el valor ya maximizado.'),
      handoff: 'Fin del ciclo: conservar · vender · fusionar · recapitalizar. Si se conserva, puede volver a UC-05 o UC-06.',
    },
  },
];

// ────────────────────────────── mapa operativo de UC-01 (el primero real)

const DEP_UC01 = 'DEP-CPF-UC01';
const ROL = {
  arq: 'Arquitecto Empresarial',
  op: 'Operador de Business Planner',
  dir: 'Dirección CPF',
  mkt: 'Analista de Mercado',
  fin: 'Analista Financiero',
  coord: 'Coordinador de Proyecto',
};
const HERR = {
  bp: 'Business Planner',
  cur: 'Agente Curador',
  coordAg: 'Agente Coordinador',
  esp: 'Agentes Especialistas (18)',
  csv: 'Plantillas CSV de tablas maestras',
  doc: 'Generador de entregables',
};

// fase · etapaDesde · nombre · descripción · roles · herramientas · entrada · salida · ramas
const PROCESOS_UC01 = [
  // ---------- ANTES: entrada y encuadre ----------
  { id: 'P01', fase: 'antes', orden: 1, nombre: '1. Recepción de la oportunidad',
    descripcion: 'Llega una idea, una empresa o una adquisición. Se registra el caso y se identifica la entidad objetivo, aunque todavía no exista legalmente.',
    roles: [ROL.dir, ROL.coord], herramientas: [HERR.bp],
    entrada: 'Solicitud interna, externa o decisión del Board.',
    salida: 'Caso registrado con entidad objetivo identificada e interlocutor asignado.',
    ramas: [{ evento: 'Caso registrado', destino: 'P02' }] },

  { id: 'P02', fase: 'antes', orden: 2, nombre: '2. Diagnóstico e intake (Curador)',
    descripcion: 'El Curador conduce la conversación de intake: entiende la idea, el mercado, la etapa, la escala, el objetivo y las restricciones. NO decide todavía qué planos se harán.',
    roles: [ROL.arq, ROL.op], herramientas: [HERR.bp, HERR.cur],
    entrada: 'Caso registrado.',
    salida: 'Diagnóstico estructurado (tipo de negocio, industria, etapa, objetivo, escala, presupuesto, complejidad, restricciones).',
    ramas: [{ evento: 'Diagnóstico completo', destino: 'P03' }, { evento: 'Información insuficiente', destino: 'P02' }] },

  { id: 'P03', fase: 'antes', orden: 3, nombre: '3. Clasificación y blueprint',
    descripcion: 'El Motor de Selección (reglas deterministas, sin IA) clasifica la entidad y decide qué planos, módulos y profundidad aplican, y cuál es el mínimo operable de cada uno.',
    roles: [ROL.arq], herramientas: [HERR.bp],
    entrada: 'Diagnóstico estructurado.',
    salida: 'Blueprint: lista de planos seleccionados, profundidad por plano, módulos activados y umbrales de mínimo operable.',
    ramas: [{ evento: 'Blueprint generado', destino: 'P04' }] },

  { id: 'P04', fase: 'antes', orden: 4, nombre: '4. Propuesta, alcance y acuerdo',
    descripcion: 'Se convierte el blueprint en una propuesta con alcance, plazo y precio. Fija el límite contra el que después se mide el scope creep.',
    roles: [ROL.dir, ROL.coord], herramientas: [HERR.bp],
    entrada: 'Blueprint.',
    salida: 'Propuesta aceptada con alcance y profundidad firmados.',
    ramas: [{ evento: 'Propuesta aceptada', destino: 'P05' }, { evento: 'Propuesta rechazada', destino: null }] },

  // ---------- DURANTE: la planeación ----------
  { id: 'P05', fase: 'durante', orden: 1, nombre: '5. Captura asistida por especialistas',
    descripcion: 'El grueso del trabajo. Cada Especialista conduce la captura de SU plano, en el orden que el grafo de dependencias permite. Los datos repetitivos entran por CSV, no por chat.',
    roles: [ROL.op, ROL.arq], herramientas: [HERR.bp, HERR.esp, HERR.csv, HERR.coordAg],
    entrada: 'Blueprint aprobado.',
    salida: 'Campos y tablas capturados por plano, con readiness medido.',
    ramas: [{ evento: 'Capas base completas', destino: 'P06' }, { evento: 'Falta información del cliente', destino: 'P05' }] },

  { id: 'P06', fase: 'durante', orden: 2, nombre: '6. Investigación de mercado y validación',
    descripcion: 'Se valida que el modelo tenga mercado: tamaño, competencia, cliente, precio de referencia. Corrige supuestos de la captura.',
    roles: [ROL.mkt, ROL.arq], herramientas: [HERR.bp],
    entrada: 'Planos comercial y de marketing en borrador.',
    salida: 'Validación de mercado con fuentes; supuestos corregidos o marcados PENDIENTE.',
    ramas: [{ evento: 'Modelo validado', destino: 'P07' }, { evento: 'Modelo no viable', destino: 'P03' }] },

  { id: 'P07', fase: 'durante', orden: 3, nombre: '7. Modelado financiero y capital',
    descripcion: 'Convierte la operación diseñada en números: inversión, costos, precios, punto de equilibrio, capital necesario por etapa.',
    roles: [ROL.fin, ROL.arq], herramientas: [HERR.bp],
    entrada: 'Operación, oferta y precios capturados.',
    salida: 'Modelo financiero y capital necesario por etapa.',
    ramas: [{ evento: 'Modelo financiero cerrado', destino: 'P10' }, { evento: 'No cierra financieramente', destino: 'P03' }] },

  { id: 'P08', fase: 'durante', orden: 4, nombre: '8. Diseño de la operación',
    descripcion: 'Procesos, roles, espacios, proveedores y logística de la entidad que se está planeando. Es donde el plano deja de ser idea y se vuelve ejecutable.',
    roles: [ROL.arq, ROL.op], herramientas: [HERR.bp],
    entrada: 'Modelo de negocio y oferta definidos.',
    salida: 'Mapa operativo, estructura organizacional y requerimientos de espacio de la entidad planeada.',
    ramas: [{ evento: 'Operación diseñada', destino: 'P10' }] },

  { id: 'P09', fase: 'durante', orden: 5, nombre: '9. Diseño tecnológico y de automatización',
    descripcion: 'Qué sistemas necesita la entidad y qué se automatiza desde el día uno. Alimenta el plano Tecnológico y el de IA.',
    roles: [ROL.arq], herramientas: [HERR.bp],
    entrada: 'Procesos diseñados.',
    salida: 'Especificación de sistemas y de automatizaciones — el insumo con el que Dioquis Software cotiza.',
    ramas: [{ evento: 'Tecnología especificada', destino: 'P10' }] },

  { id: 'P10', fase: 'durante', orden: 6, nombre: '10. Consolidación del plano',
    descripcion: 'Se integran los 18 planos en un documento coherente, se resuelven contradicciones entre capas y se marca todo lo que quedó PENDIENTE.',
    roles: [ROL.arq], herramientas: [HERR.bp, HERR.doc],
    entrada: 'Todos los planos del blueprint capturados.',
    salida: 'Documento Maestro consolidado con readiness por plano.',
    ramas: [{ evento: 'Plano consolidado', destino: 'P11' }] },

  { id: 'P11', fase: 'durante', orden: 7, nombre: '11. Validación con el cliente',
    descripcion: 'Se presenta el plano y se recogen correcciones. Es el control que evita entregar un plano que el cliente no reconoce como suyo.',
    roles: [ROL.dir, ROL.arq], herramientas: [HERR.bp],
    entrada: 'Documento Maestro consolidado.',
    salida: 'Plano validado formalmente, o lista de correcciones.',
    ramas: [{ evento: 'Plano validado', destino: 'P12' }, { evento: 'Correcciones solicitadas', destino: 'P05' }] },

  // ---------- DESPUÉS: entrega y handoff ----------
  { id: 'P12', fase: 'despues', orden: 1, nombre: '12. Generación y entrega de paquetes',
    descripcion: 'Se generan los paquetes de entregables que correspondan al caso (maestro, inversionistas, arquitectos, operaciones, RH, marketing, software, legal) y se entregan.',
    roles: [ROL.op, ROL.coord], herramientas: [HERR.bp, HERR.doc],
    entrada: 'Plano validado.',
    salida: 'Paquetes de entregables generados y entregados al cliente.',
    ramas: [{ evento: 'Entrega aceptada', destino: 'P13' }] },

  { id: 'P13', fase: 'despues', orden: 2, nombre: '13. Handoff a la unidad siguiente',
    descripcion: 'Se traspasa el caso con criterio de aceptación explícito. Normalmente a UC-02; si la empresa ya opera puede ir a UC-03 o UC-04; si el plano se hizo para vender, a UC-08.',
    roles: [ROL.coord, ROL.dir], herramientas: [HERR.bp],
    entrada: 'Paquetes entregados.',
    salida: 'Caso aceptado por la unidad receptora, con roadmap y capital por etapa.',
    ramas: [
      { evento: 'Va a construirse → UC-02', destino: null },
      { evento: 'Ya opera, hay que ordenarla → UC-03', destino: null },
      { evento: 'Se hizo para vender → UC-08', destino: null },
    ] },

  { id: 'P14', fase: 'despues', orden: 3, nombre: '14. Seguimiento y medición del plano',
    descripcion: 'Se mide si el plano efectivamente se ejecutó y qué tan bien predijo la realidad. Es lo que hace que el método mejore en vez de repetir errores.',
    roles: [ROL.arq, ROL.dir], herramientas: [HERR.bp],
    entrada: 'Caso en ejecución en la unidad receptora.',
    salida: 'Hallazgos registrados: qué del plano se cumplió, qué no y por qué.',
    ramas: [{ evento: 'Hallazgo relevante para el método', destino: null }] },
];

// Subprocesos del paso 5 (captura) — las capas en que se ordena la captura.
const SUBPROCESOS_P05 = [
  { id: 'S01', nombre: '5.1 Capa Meta y Estratégica', descripcion: 'Identidad, misión, objetivos, norte y prioridades. Se captura primero porque condiciona todo lo demás.', roles: [ROL.arq] },
  { id: 'S02', nombre: '5.2 Capa Comercial y Marketing', descripcion: 'Mercado, cliente, oferta, precios, canales, marca y demanda.', roles: [ROL.arq, ROL.mkt] },
  { id: 'S03', nombre: '5.3 Capa Operativa y de Procesos', descripcion: 'Cómo se produce y se entrega: procesos, tiempos, insumos, espacios.', roles: [ROL.op] },
  { id: 'S04', nombre: '5.4 Capa Organizacional, RH y Cultural', descripcion: 'Estructura, roles, plantilla, cultura y ciclo de vida del empleado.', roles: [ROL.arq] },
  { id: 'S05', nombre: '5.5 Capa Tecnológica e IA', descripcion: 'Sistemas, integraciones y agentes. Alimenta la especificación con que Dioquis Software cotiza.', roles: [ROL.arq] },
  { id: 'S06', nombre: '5.6 Capa Financiera y de Control', descripcion: 'Costos, precios, proyecciones, KPIs y tableros.', roles: [ROL.fin] },
  { id: 'S07', nombre: '5.7 Capa Jurídica, Implementación y Escalamiento', descripcion: 'Constitución, contratos, permisos, roadmap de implementación y límites de escala.', roles: [ROL.arq] },
];

// ────────────────────────────────────────────────────────────── ejecución

function nuevoProceso(p, depId, padreId) {
  return {
    id: `PRC-CPF-${p.id}`,
    proyectoId: PROY,
    departamentoId: depId,
    nombre: p.nombre,
    fase: p.fase ?? 'durante',
    orden: p.orden ?? 0,
    data: {
      etapaDesde: 'arrancar',
      descripcion: p.descripcion ?? '',
      roles: p.roles ?? [],
      herramientas: p.herramientas ?? [],
      insumos: [],
      espacios: [],
      entrada: p.entrada ?? '',
      salida: p.salida ?? '',
      ramas: (p.ramas ?? []).map((r, i) => ({
        id: `RM-${p.id}-${i}`,
        evento: r.evento,
        ...(r.destino ? { destinoProcesoId: `PRC-CPF-${r.destino}` } : {}),
      })),
      ...(padreId ? { padreProcesoId: padreId } : {}),
    },
  };
}

try {
  const proy = await prisma.proyecto.findUnique({ where: { id: PROY } });
  if (!proy) throw new Error('No existe el proyecto de CPF — abortando.');

  const ucsViejas = await prisma.unidadComercial.findMany({ where: { proyectoId: PROY } });
  // Ninguna UC vieja debe tener datos colgando antes de reemplazarla.
  const conflictos = [];
  for (const u of ucsViejas) {
    const [of, esp] = await Promise.all([
      prisma.oferta.count({ where: { ucId: u.id } }),
      prisma.espacio.count({ where: { proyectoId: PROY } }),
    ]);
    if (of > 0) conflictos.push(`${u.nombre}: ${of} ofertas`);
  }
  if (conflictos.length) throw new Error('UCs viejas con datos: ' + conflictos.join(' · '));

  console.log(`UCs actuales: ${ucsViejas.length} (todas vacías, se reemplazan)`);
  console.log(`Nuevas: ${UCS.length} unidades comerciales`);
  console.log(`Mapa UC-01: ${PROCESOS_UC01.length} procesos raíz + ${SUBPROCESOS_P05.length} subprocesos`);

  if (DRY) { console.log('\n--dry: no se escribió nada.'); process.exit(0); }

  await prisma.$transaction(async (tx) => {
    // 1. Reemplazar las UCs
    await tx.unidadComercial.deleteMany({ where: { proyectoId: PROY } });
    for (const u of UCS) {
      await tx.unidadComercial.create({
        data: {
          id: u.id, proyectoId: PROY, nombre: u.nombre,
          data: { tipo: u.tipo, descripcion: u.descripcion, orden: u.orden, ficha: u.ficha },
        },
      });
    }

    // 2. Departamento (carril) de UC-01
    await tx.departamento.deleteMany({ where: { id: DEP_UC01 } });
    await tx.departamento.create({
      data: {
        id: DEP_UC01, proyectoId: PROY, nombre: 'UC-01 Planeación y Arquitectura Empresarial',
        tipo: 'uc', ucId: 'UC-CPF-01-PLANEACION', orden: 1,
        data: {
          color: '#5b8def',
          descripcion: 'Carril de la unidad de planeación: de la oportunidad al plano validado y entregado.',
          espacios: [], herramientas: [],
        },
      },
    });

    // 3. Procesos raíz + subprocesos del paso 5
    await tx.proceso.deleteMany({ where: { departamentoId: DEP_UC01 } });
    for (const p of PROCESOS_UC01) {
      await tx.proceso.create({ data: nuevoProceso(p, DEP_UC01, null) });
    }
    for (const [i, s] of SUBPROCESOS_P05.entries()) {
      await tx.proceso.create({
        data: nuevoProceso({ ...s, fase: 'durante', orden: i + 1 }, DEP_UC01, 'PRC-CPF-P05'),
      });
    }
  });

  const [nUcs, nProc] = await Promise.all([
    prisma.unidadComercial.count({ where: { proyectoId: PROY } }),
    prisma.proceso.count({ where: { departamentoId: DEP_UC01 } }),
  ]);
  console.log(`\n✅ Sembrado. UCs de CPF: ${nUcs} · procesos en el mapa de UC-01: ${nProc}`);
} catch (e) {
  console.error('\n❌ FAIL —', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
