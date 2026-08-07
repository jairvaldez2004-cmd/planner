// Diccionario ESPAÑOL — idioma base. Es también la lista canónica de claves: si una clave
// existe aquí y falta en `en.ts`, la app muestra el español (degradación limpia).
//
// Convención de claves: `<ambito>.<cosa>`. Los emojis NO van en el diccionario cuando
// acompañan a un texto traducible — se dejan en el JSX, para no duplicarlos por idioma.

// `satisfies` (en vez de anotar `Record<string, string>`) conserva las claves literales:
// de ahí sale `ClaveI18n`, y con eso `t('clave.inventada')` deja de compilar.
export const es = {
  // ---------- navegación / shell ----------
  'nav.workspaces': 'Workspaces',
  'nav.proyecto': 'Proyecto',
  'nav.configuracion': 'Configuración',
  'nav.configuracionTitle': 'Configuración (modelo por agente)',
  'nav.idioma': 'Idioma',

  // ---------- genéricos reutilizables ----------
  'comun.volver': 'Volver',
  'comun.cargando': 'Cargando…',
  'comun.cerrar': 'Cerrar',
  'comun.eliminar': 'Eliminar',
  'comun.cancelar': 'Cancelar',
  'comun.guardar': 'Guardar',
  'comun.nombre': 'Nombre',
  'comun.tipo': 'Tipo',
  'comun.descripcion': 'Descripción',
  'comun.datos': 'Datos',
  'comun.notas': 'Notas',
  'comun.sinNombre': '(sin nombre)',
  'comun.pendientes': 'pendientes',

  // ---------- workspaces ----------
  'workspaces.titulo': 'Workspaces',
  'workspaces.intro': 'Un workspace agrupa los proyectos (de Grupo Dioquis o de un cliente). Elige uno o crea el primero; dentro hablarás con el agente para identificar tus proyectos.',
  'workspaces.crearTitulo': 'Crear workspace',
  'workspaces.nombrePlaceholder': 'Nombre (p. ej. Grupo Dioquis, Cliente Acme…)',
  'workspaces.crearEntrar': '+ Crear y entrar',
  'workspaces.vacio': 'Aún no hay workspaces. Crea el primero arriba.',
  'workspaces.abrirGrafo': 'Abrir grafo →',
  'workspaces.eliminar': '🗑 Eliminar',
  'workspaces.eliminarTitle': 'Eliminar workspace y todo su contenido',
  'workspaces.confirmEliminar': '¿Eliminar el workspace "{ws}" y TODO su contenido (proyectos, negocios, sedes, espacios y conversaciones)?\n\nEsta acción NO se puede deshacer.',

  // ---------- grafo del workspace ----------
  'grafo.subtitulo': 'grafo del workspace',
  'grafo.volverWorkspaces': '← Workspaces',
  'grafo.nuevoProyecto': 'Nuevo proyecto',
  'grafo.vacio': 'Aún no hay proyectos en este workspace.',
  'grafo.curador': 'Curador del workspace',
  'grafo.headerSub': 'Curador + grafo',
  'grafo.curadorAyuda': 'Acomoda proyectos y cura el grafo: “renombra X a Y”, “relaciona X con Y”, “archiva X”, “mueve X al workspace Z”.',
  'grafo.cargando': 'Cargando grafo…',

  // ---------- administración de planos ----------
  'planosAdmin.titulo': 'Administración · Planos',
  'planosAdmin.subtitulo': 'Coordinador + grafo',
  'planosAdmin.cargando': 'Cargando planos…',
  'planosAdmin.coordinador': 'Coordinador del proyecto',
  'planosAdmin.profundidad': 'Profundidad: {p} · {sel} planos · {pub} publicados · {min} mín. operable.',
  'planosAdmin.etapa': '🎚️ Etapa',
  'planosAdmin.foco': 'Foco: {foco}',
  'planosAdmin.siguiente': 'Siguiente recomendado:',
  'planosAdmin.trabajarPlano': 'Trabajar este plano →',
  'planosAdmin.leyendaGrafo': 'Nodos = los planos (atenuados = no seleccionados). Color = estado. Clic para entrar.',

  // ---------- proyecto ----------
  'proyecto.subtitulo': 'negocios y unidades comerciales',
  'proyecto.volverGrafo': '← Grafo del workspace',
  'proyecto.estructura': 'Estructura',
  'proyecto.explicacion': 'El nodo {planos} es donde {ves} los documentos; los nodos {sedes}, {mapa} y {unidades} son donde {capturas} y desde ahí alimentan varios planos. Un proyecto también puede contener {negocios} (sub-empresas). Clic en un nodo para entrar.',
  'proyecto.explicacion.ves': 'ves y descargas',
  'proyecto.explicacion.capturas': 'capturas',
  'proyecto.resumen': '{planos} Planos: {n} seleccionados · {negocios} negocios · {ucs} unidades comerciales.',
  'proyecto.etapaLabel': '🎚️ Etapa del negocio (define el foco de los planos)',
  'proyecto.etapaSinDefinir': '— Sin definir (fíjala tú o el Curador) —',
  'proyecto.etapaFoco': 'Foco: {foco}.',
  'proyecto.tipoEntidadLabel': '🏛️ Tipo de entidad (qué ES en el ecosistema)',
  'proyecto.sinDeclarar': '— Sin declarar —',
  'proyecto.estadoLabel': 'Estado',
  'proyecto.noConstituida': '⚠ No constituida: es arquitectura, no operación real.',
  'proyecto.conflictos': '⚠ {n} conflicto(s) de jerarquía:',
  'proyecto.negocioDentro': 'Negocio dentro de este proyecto',
  'proyecto.negocioPlaceholder': 'Nuevo negocio (ej. Altercing Studio)',
  'proyecto.ucDeEsteProyecto': 'Unidad comercial de este proyecto',
  'proyecto.ucPlaceholder': 'Nueva UC (ej. Tatuajes)',
  'proyecto.curador': 'Curador de este proyecto',
  'proyecto.curadorAyuda': 'Dile qué negocios contiene o qué vende, y crea negocios o unidades comerciales conversando.',
  'proyecto.leyenda.planos': '📄 Planos = ver y descargar los documentos',
  'proyecto.leyenda.uc': 'UC = Unidad Comercial',
  'proyecto.leyenda.alimentan': 'Los nodos {alimentan} los planos; en 📄 los ves. Clic para entrar.',
  'proyecto.leyenda.formas': 'Formas:',
  'proyecto.leyenda.formasDetalle': '▢ Planos · ○ Unidad Comercial · ⬡ Negocio/Empresa · ◇ Holding · ▲ superficies de captura. Un nodo con {punteado} es una entidad {noConstituida}, no una operación real.',
  'proyecto.leyenda.punteado': 'borde punteado',
  'proyecto.leyenda.noConstituida': 'no constituida',

  // nodos del grafo del proyecto
  'nodo.planos': 'Planos',
  'nodo.sedes': 'Sedes & Espacios',
  'nodo.mapa': 'Mapa Operativo',
  'nodo.personas': 'Personas & RH',
  'nodo.recursos': 'Recursos & Proveedores',
  'nodo.logistica': 'Logística',
  'nodo.marketing': 'Marketing',
  'nodo.negocio': 'Negocio',

  // banner de proyección
  'enriquece.prefijo': '🔗 Lo que captures aquí {enriquece} los planos:',
  'enriquece.verbo': 'enriquece',

  // ---------- unidad comercial ----------
  'uc.subtitulo': 'Unidad Comercial',
  'uc.superficies': 'Superficies de esta unidad',
  'uc.superficiesAyuda': 'Captura solo para "{uc}". Lo compartido (sin UC asignada) y lo que captures aquí conviven; al volver al proyecto se ve todo junto.',
  'uc.espacios': 'Espacios de esta unidad',
  'uc.espaciosAyuda': 'Habitaciones/áreas asignadas a "{uc}" en las sedes.',
  'uc.espaciosVacio': 'Aún sin espacios. Ve a Sedes & Espacios y asígnale áreas a esta UC.',
  'uc.irSedes': 'Ir a Sedes & Espacios →',
  'uc.tipoPlaceholder': 'servicio · producto · e-commerce…',

  // ---------- planos ----------
  'planos.titulo': 'Planos',
  'planos.subtitulo': 'documentos del negocio',
  'planos.seleccionados': '{n} seleccionados',
  'planos.abrir': 'Abrir',
  'planos.generarEntregables': '📦 Generar entregables',
  'planos.simularEmpresa': '🏢 Simular empresa',
  'planos.vacio': 'Aún no hay planos seleccionados para este proyecto.',
  'planos.readiness': 'Completitud',

  // ---------- vista de un plano ----------
  'plano.generarDocumento': '📄 Generar documento',
  'plano.abrirDocumento': '📖 Documento',
  'plano.campos': 'Campos',
  'plano.tablas': 'Tablas',
  'plano.filas': '{n} filas',
  'plano.vacioPendiente': '(vacío → PENDIENTE)',
  'plano.documentoTitulo': '📄 Documento — {titulo}',
  'plano.documentoPendientes': '({p} pendientes / {t})',
  'plano.manuales': 'manuales',
  'plano.derivadas': 'derivadas',

  // ---------- nombres de los 18 planos ----------
  'plano.META': 'Meta',
  'plano.EST': 'Estratégico',
  'plano.COM': 'Comercial',
  'plano.MKT': 'Marketing',
  'plano.CUL': 'Cultural',
  'plano.ORG': 'Organizacional',
  'plano.RH': 'Recursos Humanos',
  'plano.OPE': 'Operativo',
  'plano.PRO': 'Procesos',
  'plano.ARQ': 'Arquitectónico',
  'plano.TEC': 'Tecnológico',
  'plano.IA': 'IA',
  'plano.FIN': 'Financiero',
  'plano.INV': 'Inversionista',
  'plano.CTR': 'Control',
  'plano.IMP': 'Implementación',
  'plano.ESC': 'Escalamiento',
  'plano.JUR': 'Jurídico',

  // ---------- etapas objetivo ----------
  'etapa.arrancar': 'Arrancar y operar',
  'etapa.arrancar.desc': 'Que el negocio abra y empiece a vender con lo mínimo bien hecho.',
  'etapa.expandir': 'Expandir y semi-automatizar',
  'etapa.expandir.desc': 'Crecer, medir y meter los primeros sistemas y automatizaciones.',
  'etapa.replicar': 'Replicar',
  'etapa.replicar.desc': 'Estandarizar y documentar para abrir otra sede o franquiciar.',
  'etapa.automatizar': 'Automatizar al máximo',
  'etapa.automatizar.desc': 'Agentes de IA operan lo repetible; tableros en vivo.',
  'etapa.vender': 'Vender el negocio',
  'etapa.vender.desc': 'Todo completo y documentado: paquete de due diligence.',

  // ---------- paquetes de entregables ----------
  'paquete.maestro': 'Documento Maestro (Plano ALV)',
  'paquete.maestro.desc': 'Todos los planos en un solo documento — la configuración inicial completa de la empresa.',
  'paquete.inversionistas': 'Paquete Inversionistas',
  'paquete.inversionistas.desc': 'Memorandum de inversión: negocio, mercado, finanzas, uso del capital.',
  'paquete.arquitectos': 'Paquete Arquitectos e Ingenieros',
  'paquete.arquitectos.desc': 'Para que una constructora diseñe, cotice y construya (programa + casa de muñecas + doc por espacio).',
  'paquete.operaciones': 'Paquete Operaciones',
  'paquete.operaciones.desc': 'Manual operativo: procesos, SOPs, KPIs y control.',
  'paquete.rh': 'Paquete Recursos Humanos',
  'paquete.rh.desc': 'Estructura, puestos, ciclo del empleado y cultura.',
  'paquete.marketing': 'Paquete Marketing y Comercial',
  'paquete.marketing.desc': 'Plan de marketing, laboratorio de validación y sistema comercial.',
  'paquete.software': 'Paquete Tecnológico / Software',
  'paquete.software.desc': 'Configuración inicial para el software operativo: componentes, agentes, escalamiento.',
  'paquete.legal': 'Paquete Legal / Jurídico',
  'paquete.legal.desc': 'Constitución, contratos, permisos, PI y checklist legal.',

  // ---------- tipos de entidad (taxonomía) ----------
  'tipoEntidad.holding_matriz': 'Holding matriz',
  'tipoEntidad.holding_sectorial': 'Holding sectorial',
  'tipoEntidad.empresa_operativa': 'Empresa operativa',
  'tipoEntidad.unidad_negocio': 'Unidad de negocio',
  'tipoEntidad.marca_comercial': 'Marca comercial',
  'tipoEntidad.producto_tecnologico': 'Producto tecnológico',
  'tipoEntidad.plataforma_saas': 'Plataforma SaaS',
  'tipoEntidad.sistema_interno': 'Sistema interno',
  'tipoEntidad.proyecto': 'Proyecto',
  'tipoEntidad.metodologia': 'Metodología',
  'tipoEntidad.activo_intelectual': 'Activo intelectual',
  'tipoEntidad.concepto_comercial': 'Concepto comercial',
  'tipoEntidad.entidad_historica': 'Entidad histórica',

  // ---------- estados de entidad ----------
  'estadoEntidad.existente': 'Existente',
  'estadoEntidad.en_construccion': 'En construcción',
  'estadoEntidad.propuesta': 'Propuesta',
  'estadoEntidad.objetivo': 'Objetivo (no constituida)',
  'estadoEntidad.inactiva': 'Inactiva',
  'estadoEntidad.historica': 'Histórica',

  // ---------- traducción de datos del usuario (aviso de costo) ----------
  'traducir.titulo': 'Traducir tus datos',
  'traducir.explicacion': 'Las pantallas ya cambiaron de idioma (eso es gratis e instantáneo). Lo que tú escribiste —nombres, respuestas de los planos, catálogo, procesos— sigue en español: traducirlo usa la API de Claude y tiene un costo.',
  'traducir.pendientes': '{n} textos por traducir · {chars} caracteres',
  'traducir.yaPagado': '{n} ya traducidos antes · sin costo',
  'traducir.costo': 'Costo estimado: hasta {usd} USD',
  'traducir.unaVez': 'Se paga UNA sola vez. Cada texto queda guardado para siempre, así que volver a cambiar de idioma es gratis.',
  'traducir.original': 'Tu original nunca se sobrescribe: la traducción es una vista. Al volver a español ves exactamente lo que escribiste.',
  'traducir.modelo': 'Modelo: {modelo} · se cambia en ⚙ Configuración',
  'traducir.confirmar': 'Traducir ahora',
  'traducir.ahoraNo': 'Ahora no',
  'traducir.trabajando': 'Traduciendo {n} textos… no cierres esta pestaña.',
  'traducir.listo': '✅ {n} textos traducidos · costo real {usd} USD',
  'traducir.fallidos': '⚠ {n} texto(s) se quedaron en español.',
  'traducir.error': 'No se pudo traducir: {msg}',
  'traducir.reintentar': 'Traducir mis datos',
} satisfies Record<string, string>;

/** Lista canónica de claves de UI. Cualquier clave fuera de esta lista es un error de compilación. */
export type ClaveI18n = keyof typeof es;
