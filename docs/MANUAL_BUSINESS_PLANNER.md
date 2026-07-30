# 📘 Business Planner — Documento maestro (estado + funciones + interfaces + relaciones)

> Fecha del documento: **2026-07-29** · App EN VIVO: `https://planner-production-57f0.up.railway.app`
> Repo GitHub: `jairvaldez2004-cmd/planner` (auto-deploy a Railway en cada push a `main`).
> Suite de dominio: `scripts/planner-altercing.ts` — **169/169 verde**.
> Fuente de continuidad oficial: `90_Curador/ESTADO_ACTUAL.md` (leer primero en cada sesión).

---

## 0. Qué es

El **Business Planner** de CPF (Corporativo Palo Fierro) es un **diseñador de empresas**: convierte una idea/necesidad de negocio en **planos ejecutables**. No es un generador de documentos sueltos; es un sistema donde **un dato se captura una vez y se ve desde muchos "lentes" (planos), formando un grafo** ("un dato → muchos lentes → un grafo").

> ### ⚖️ Principio rector (frontera del sistema)
> **El Business Planner DISEÑA la empresa; NO administra su operación diaria.** Su único producto es la **configuración inicial completa** del negocio (planos, manuales, paquetes, datos semilla). La **operación cotidiana** (registrar ventas/compras/nómina/impuestos día a día) es responsabilidad del **software operativo** (ERP / CRM / WMS / HCM) que se generará **a partir del Plano ALV**. Por eso, todo lo que el Planner captura (proveedores, procesos, inventario, personas…) se entiende como **definición y semilla de configuración**, no como el sistema de gestión en vivo. Cuando un módulo del Planner parece "operativo" (ej. el flujo de compras o la bitácora de proveedores), su rol real es **dejar lista la configuración y el modelo** que el software operativo heredará. → Ver **PARTE II** para responsabilidades, entregables y la capa de generación.

- **Stack:** Next.js 16 + React 19 + Prisma 6 (PostgreSQL) + Three.js 0.185.
- **Deploy:** Railway (`start:prod` = `prisma db push --skip-generate && next start`); auto-deploy desde GitHub.
- **IA:** API de Claude (server-side). Requiere `ANTHROPIC_API_KEY` en el entorno.
- **Patrón de datos:** casi todo vive como **filas JSON en `TablaProyecto`** (una tabla por "ref"), sin cambios de schema; los agentes IA son "tool-runners" (`correrBucleTools`).

---

## 1. Navegación general

```
Workspaces
  └─ Grafo del workspace (estilo Obsidian, SVG radial)  + Curador (IA) del workspace
       └─ Proyecto (empresa / desarrollo contenedor)     + Curador (IA) del proyecto
            └─ 6 NODOS del proyecto (grafo):
               · 📄 Planos (admin)     · 🏢 Sedes & Espacios   · 🗺️ Mapa Operativo
               · 👥 Personas & RH      · 📦 Recursos & Prov.   · 📣 Marketing
```

- **Jerarquía:** un proyecto puede ser un **desarrollo contenedor** (ej. Girly Zone) que agrupa **negocios** (Altercing Studio, Macao Pilates), y cada negocio vende por **Unidades Comerciales** (Piercings, Tatuajes, Uñas, Joyería). Desarrollo → negocios → unidades comerciales.
- **Etapa objetivo del negocio** (ruta de 5, acumulativa): **arrancar → expandir → replicar → automatizar → vender**. Define qué planos y a qué % se enfoca.

---

## 2. Agentes IA (todos "tool-runner": conversan y ejecutan acciones reales)

| Agente | Dónde vive | Qué hace |
|---|---|---|
| **Curador del workspace** | Grafo del workspace | Identifica/acomoda proyectos (registrar diagnóstico) y **cura el grafo**: renombrar, relacionar, archivar, mover, **anidar/desanidar** proyectos. |
| **Curador del proyecto** | Dentro del proyecto | Crea **negocios** y **Unidades Comerciales**, **fija la etapa objetivo**, y **construye el Mapa Operativo conversando** (crear/actualizar/conectar procesos y departamentos). |
| **Diseñador 3D** | Vista 3D de una sede | Amuebla el plano describiéndolo: crea/mueve/gira/redimensiona/elimina objetos, aplica acabados, **crea objetos desde cero con primitivas + ficha técnica**, ve **fotos de referencia**, recrea el local desde fotos. |
| **Organizador de Equipo (RH)** | Personas & RH → 🤖 | Arma el equipo más eficiente (asigna procesos por carga en min), crea vacantes, da roles y **decide qué automatizar** (ia/n8n/software). |
| **Centro de Abastecimiento Inteligente** | Recursos → 🧠 Centro IA | Razona toda la cadena de compra/logística y **gestiona la relación con proveedores** (ver §8). |
| **Especialista por plano** | Cada plano | Captura los **campos** del plano conversando (llenado asistido). |

Modelos configurables por rol en `src/config/modelos.ts` + panel **⚙ Configuración** (Opus/Sonnet/Haiku/Fable).

---

## 3. Diagnóstico → Selección → Blueprint

1. **Chat con el Curador** → cuando entiende la idea, **registra un diagnóstico** (tipo de negocio, industria, etapa, objetivo, escala, presupuesto…).
2. **Motor de Selección** (reglas **deterministas**, sin IA, `selection-engine.ts`) → **Blueprint**: qué planos aplican, **profundidad** (esencial/estándar/completo) y **mínimo operable**.
3. **Regla AP-1:** ningún módulo especializado (ej. COM-EXP de exportación) se enciende antes del diagnóstico. Nada se asume por defecto.

---

## 4. Los 18 planos (nodo "📄 Planos")

Grafo de 18 planos. Cada plano tiene: **campos** (texto) + **tablas** (datos repetitivos) + **generar documento** (marca `⚠ PENDIENTE` lo requerido y vacío; **no inventa**) + **readiness** (estados por profundidad).

**Cómo se llena cada tabla:**
- **Proyección automática** desde superficies (Sedes/Mapa/Personas/Recursos/Embarques) — sin recapturar.
- **CSV** (bajar plantilla → llenar → subir).
- **Chat especialista** (IA) para los campos narrativos.

**Los 18** (orden): META · EST · COM · MKT · CUL · ORG · RH · OPE · PRO · ARQ · TEC · IA · FIN · INV · CTR · IMP · ESC · JUR.

| Plano | Qué es | Cómo se llena hoy |
|---|---|---|
| **META** | Meta/empresarial (visión, misión) | campos (chat/manual) |
| **EST** | Estratégico | campos (chat/manual) |
| **COM** | Comercial (oferta, precios, clientes, canales, campañas, proveedores) | `proveedores` auto ✅ · catálogo/clientes/canales por CSV/chat |
| **MKT** | Marketing (antropología → laboratorio) | **nodo Marketing** (campos) + tablas por CSV |
| **CUL** | Cultural (narrativa, valores, comportamientos) | campos (chat/manual) |
| **ORG** | Organizacional (roles humanos + roles IA) | `personas` + `agentes` **auto ✅** |
| **RH** | Recursos Humanos (puestos) | `puestos` **auto ✅** (roster de Personas) |
| **OPE** | Operativo (ciclo, ejecutores, handoffs) | `personas` auto ✅ + campos |
| **PRO** | Procesos (entrada/salida/responsable) | `procesos` **auto ✅** (Mapa) |
| **ARQ** | Arquitectónico (ambientes, distribución) | `ambientes` **auto ✅** (Sedes) |
| **TEC** | Tecnológico (componentes/contratos) | `componentes` **auto ✅** (equipo + automatizaciones) |
| **IA** | Fichas de agente IA | `agentes` **auto ✅** (automatizaciones de RH) |
| **FIN** | Financiero (ingresos, costos, modelo) | `costos` **auto ✅** (Recursos+Productos+Embarques) · ingresos por CSV |
| **INV** | Inversionista (rondas, valuación) | campos + tabla por CSV |
| **CTR** | Control (KPIs, métricas) | kpis por CSV |
| **IMP** | Implementación (hitos) | hitos por CSV |
| **ESC** | Escalamiento (unidades por fase) | por CSV |
| **JUR** | Jurídico (figura, obligaciones, contratos, riesgos) | campos + `legales` por CSV |

**Grafo de dependencias unificado** (`domain/dependencias.ts`): une plano→plano (depende), tabla→plano (usa; revela tablas compartidas = prueba de no-duplicación) y proceso→proceso (dispara). Responde "si falla X, ¿qué se bloquea aguas abajo?".

---

## 5. Sedes & Espacios (nodo "🏢")

Superficie de captura del espacio físico. Alimenta **ARQ, ORG, PRO, OPE, FIN**.

- **Editor 2D arquitectónico** — en **metros a escala**; niveles (sótano/PB/pisos), **muros perimetrales = huella**, herramienta de dibujo **muros/puertas/ventanas** (snap 0.25 m), habitaciones, objetos con lentes y **costeo en vivo**.
- **Mapa real (Leaflet + OSM)** — sedes con **huella poligonal editable/rotable** (Geoman), persistida; overlay del layout interior.
- **Vista 3D (Three.js)** — cámara orbital + **vista en primera persona (avatar)** (WASD/flechas + arrastrar para mirar + D‑pad táctil); PBR, sombras, dollhouse, objetos clicables/arrastrables; **acabados** (piso: duela/porcelanato/azulejo/cemento/alfombra/pintura/mármol/mosaico/microcemento; muro: pintura/azulejo/ladrillo/cemento/yeso/microcemento/madera) con texturas procedurales; **27 formas 3D** por nombre; modelos paramétricos.
- **Diseñador 3D (chat IA)** — describe y coloca objetos, aplica acabados, **crea cualquier objeto desde primitivas + ficha técnica** ("pon un aire acondicionado Mirage X3"), ve **fotos** de referencia, recrea el local desde fotos, dibuja muros/puertas/ventanas. Deshacer persistente por sede.
- **Renders externos** — subir imagen calibrada por 2 clics, anclar a Espacio/Objeto reales.
- **Escaneo LiDAR** — subir `.glb` (MAKE.PLAN/Polycam/Scaniverse) + reporte de medidas imprimible.

---

## 6. Mapa Operativo (nodo "🗺️")

Lienzo n8n de la operación. Alimenta **PRO, ORG, OPE, CTR, IA, TEC**.

- **Estructura:** Procesos (nodos) · **Departamentos** = etiquetas (Administración + UCs) · **Fases** = Antes/Durante/Después (páginas) · **Etapas** = ruta de 5 **acumulativa** (un proceso nace en una etapa y se hereda; `etapaHasta` lo jubila) · **Ramas** = disparador/evento que conecta procesos · **Subflujos** (procesos anidados dentro de un paso).
- **7 lentes (misma data, otra vista):** 🗺️ General · 📋 Instructivo · 👤 Roles · 📐 Espacios · 🔧 Herramientas · ⏱️ Tiempos · 💵 Costos.
- **Recursos por proceso:** roles · herramientas · **insumos** (lo que se consume) · equipo · muebles · **cantidades** · **manuales anidados** (por herramienta) · **apoyos** (video/documento/enlace) · **automatización** (ia/n8n/software) · **⚠️ contingencias**.
- **Paneles (botones):** 🖨️ **Instructivo** imprimible · 🗓️ **Agenda** de recursos (detecta choques de horario) · 🎬 **Simular** (carga por espacio/rol, cuellos, recorrido) · ⚠️ **Contingencias** (ver §11).
- **Costeo:** los insumos de cada proceso se enlazan al catálogo y toman el **precio vigente de Productos** (índice unificado); suma el costo de insumos por proceso/etapa.
- **Otros:** importar rutas del catálogo · rescatar tiempos del catálogo · el Curador construye el mapa conversando.
- **Automatización → planos:** un proceso automatizado con `ia` se vuelve **ficha de agente (plano IA)**; con `n8n`/`software` se vuelve **componente (plano TEC)**.

---

## 7. Personas & RH (nodo "👥")

Roster del negocio. Alimenta **RH (puestos), ORG/OPE (roles), JUR/FIN (datos fiscales, nómina)**.

- **Alta de personas** con: nombre, puesto, departamento, estado (candidato→…→activo→baja), **roles múltiples**, procesos, responsabilidades, competencias, nómina, KPIs, notas, y **datos personales/fiscales** (correo, teléfono, RFC, CURP, NSS, dirección, nacimiento, emergencia).
- **Tercerización:** marca "🏢 Tercerizado" (Girly Zone u otra empresa) con qué **entregamos ↔ recibimos**.
- **Vistas (tabs):** 👥 Personas · 🏷️ Roles · 🏢 Terceros · 🤖 **Organizar IA**.
- **Flujos n8n:** por **persona** (sus procesos + disparadores + quién los entrega) · por **rol** · **inter-empresa** (handoffs con terceros). Lienzo interactivo (arrastrar, clic = detalle, entrar a subflujos).
- **🤖 Organizador de Equipo (IA):** asigna procesos equilibrando **carga en minutos**, crea **vacantes** donde falta gente, da roles, y **decide qué automatizar**. Dashboard: activas · procesos manuales · automatizados · sin cubrir · carga por persona.

---

## 8. Recursos & Proveedores / Abastecimiento (nodo "📦") — **7 pestañas**

Módulo completo de abastecimiento tipo ERP. Alimenta **FIN (costos), TEC (componentes), COM (proveedores)**.

### 8.1 📦 Recursos
Catálogo de **activos / equipo / muebles / materiales / obra** (compra única / setup). Costo, cantidad, unidad, impuesto, proveedor, **grupo libre** para agrupar, y "✅ ya lo tenemos". Agrupación por categoría/grupo/proveedor con subtotales. *(Los insumos recurrentes viven en Productos — ver 8.3 — para no duplicar el ítem ni el precio.)*

### 8.2 🏭 Proveedores (ficha rica)
- **General/fiscal:** nombre comercial, razón social, RFC, sitio web.
- **🏷️ Categorías múltiples** (materia prima, insumos, herramientas, maquinaria, transporte, construcción, marketing…). Buscador.
- **📍 Ubicación:** país, estado, ciudad, dirección, **GPS**, zonas.
- **📞 Contacto:** persona, puesto, teléfono, WhatsApp, correo, idiomas, horario.
- **💼 Comercial:** moneda, **incoterms**, años en el mercado, tamaño, certificaciones.
- **⭐ Evaluación:** 10 criterios (calidad, precio, tiempo, comunicación, garantía, servicio, flexibilidad, disponibilidad, innovación, confiabilidad) → **Score General automático** (promedio − penalización por incidencias) con nivel excelente/bueno/regular/crítico.
- **🧪 Calidad e incidencias:** % cumplimiento, tiempo promedio, y registro de **incidencias** (rechazo/retraso/defecto/incidencia/auditoría) con gravedad/fecha/evidencia (bajan el score).
- **⚠️ Riesgo:** proveedor único, dependencia, tipos de riesgo, **plan B**, proveedor alternativo. Banner de "únicos sin plan B".
- **🤝 Relación (CRM):** estado (prospecto/activo/preferente/inactivo), **próximo seguimiento**, responsable, y **bitácora** de interacciones (➡ salientes / ⬅ entrantes). Badge ⏰ de seguimiento pendiente.

### 8.3 🏷️ Productos (maestro de compra + inventario)
- **Ficha:** SKU interno/fabricante, marca, modelo, físico (peso, volumen, dimensiones, empaque, cant. por caja/pallet), vida útil/almacenamiento (caducidad, temperatura, humedad, rotación, garantía), docs (ficha/MSDS/manual).
- **📦 Inventario y planeación:** stock actual/mínimo/máximo, **punto de reorden**, **stock de seguridad**, ubicación, consumo mensual, frecuencia, **lead time**. Motor **`planearCompra`**: 🔴 comprar YA / 🟠 hoy / 🟡 pronto / 🟢 ok / 🟣 exceso, con **días de cobertura**, fecha estimada de agotamiento y **cantidad sugerida**. Banner de planeación arriba.
- **Relación muchos-a-muchos con Proveedores:** cada vínculo lleva su **precio, SKU, moneda, lead time, mín/máx, capacidad, forma de pago, crédito, incoterms, envío, lugares** + **historial de precios** (fecha/motivo). Detecta el **proveedor más barato**.
- **🛒 Generar solicitud de compra** desde un producto bajo mínimo (proveedor y cantidad sugeridos).

### 8.4 🛒 Compras — **Flujo** + **Arranque**
- **🛒 Flujo de compras (kanban):** órdenes con **12 etapas** (solicitud→cotización→comparación→aprobación→OC→confirmación→envío→recepción→inspección→pago→evaluación→cerrada), editor con **stepper** y "avanzar etapa", total automático, **recepción parcial** (cantidad recibida vs pedida → ⚠ parcial/completa/faltante).
- **🚀 Arranque del negocio:** checklist de apertura = **activos por adquirir** + **inventario inicial** (llenar cada producto a su objetivo) con **inversión de apertura** total, y botón **"Generar N órdenes de arranque"** (idempotente).

### 8.5 🚚 Logística — **Embarques** + **Transportistas**
- **📦 Embarques:** **modalidad** (📮 paquetería / 🚚 carga-tráiler / 🛵 mensajería / 🚗 recolección / 💾 digital) + peso/bultos; **consolida órdenes**; transportista, origen/destino, incoterm, **estado** (preparando→recolección→tránsito→aduana→entregado), fechas/**ETA**/guía-tracking; **costos** (flete/seguro/aduana/maniobras/otros); **🛃 aduana/importación** (país, fracción arancelaria, pedimento, agente aduanal, valor en aduana, arancel IGI %, IVA %, DTA, honorarios → **desglose calculado**); **landed cost** (mercancía + logística) con **prorrateo** por orden y **factor** de sobrecosto; **alerta de retraso** (ETA vencida). Botón **💡 Estimar flete**. Alimenta Financiero (costo logístico).
- **🚛 Transportistas:** directorio de fletes con **modalidades, zonas y tarifas** (paquetería = base + $/kg; carga = $/viaje). Helpers para **cotizar** y elegir el más barato.

### 8.6 📄 Contratos
Fechas de inicio/vencimiento, monto, responsables, cláusulas, multas, exclusividad/confidencialidad, garantías, PDF. **Semáforo de vencimiento** (🟢 vigente / 🟠 por vencer / 🔴 vencido) + **banner de alertas** (la renovación automática silencia la alerta).

### 8.7 🧠 Centro de Abastecimiento Inteligente (IA)
Dashboard (por comprar / contratos por vencer / únicos sin plan B / seguimientos hoy / score promedio) + **agente** que:
- Dice **qué comprar** esta semana y qué esperar, y **qué proveedor conviene hoy** (precio+score+riesgo).
- **Solicita cotizaciones por correo** a varios proveedores y **escribe correos como humano** (cotización, seguimiento, reactivación, cita, atención) — nunca revela que es IA.
- **Da seguimiento a cada proveedor** (compremos o no) y **llena datos solo** con las respuestas (precio→historial).
- **Consolida órdenes en embarques**, **cotiza fletes** y avisa retrasos/aduanas; registra **incidencias**.
- **Envío real** de correos vía **Resend** (fallback a borrador si falta `RESEND_API_KEY`).

---

## 9. Marketing (nodo "📣")

Embudo del plano MKT como flujo: **investigación antropológica → hallazgos → segmentación y avatar → mapas del cliente → calendario de campañas → laboratorio de mercado** (validar antes de gastar). Lo que se escribe aquí ES el plano Marketing.

---

## 10. Relaciones / flujo de datos ("sin repetir datos")

Cada **superficie** proyecta filas a las tablas maestras que leen los planos:

| Superficie | Alimenta (plano ← tabla) |
|---|---|
| **Sedes & Espacios** | ARQ ← ambientes · ORG ← personas · PRO · OPE · FIN |
| **Mapa Operativo** | PRO ← procesos · ORG ← personas · OPE · CTR · **IA ← agentes** · **TEC ← componentes** (automatizaciones) |
| **Personas & RH** | RH ← puestos · ORG ← personas · OPE · FIN · JUR |
| **Recursos & Productos** | FIN ← costos (activos + insumos recurrentes) · TEC ← componentes · COM ← proveedores |
| **Embarques (logística)** | FIN ← costo logístico |
| **Unidad Comercial** | COM · MKT · FIN |

Tablas **compartidas** (misma tabla, varios planos): `personas` (ORG/OPE), `agentes` (ORG/IA), `campanas` (COM/MKT).

---

## 11. Contingencias (manuales de emergencia por riesgo)

En el **Mapa Operativo** (panel ⚠️ Contingencias + sección dentro de cada proceso): protocolos "¿qué hacer si…?" (disparador → pasos → prevención, gravedad, categoría), **anclables a un proceso** del workflow. **7 plantillas** listas: el pedido no llega, roban la mercancía, sin seguro, mercancía dañada, detenida en aduana, el proveedor falla, llega incompleto (faltante).

---

## 12. Qué falta para llenar los 18 planos (análisis 2026-07-29)

Los 18 **ya son llenables** por 3 vías (campos a mano · chat especialista IA · CSV), y varios se autollenan por proyección. Para llenarlos **completos y sin recapturar** falta:

1. **✅ (HECHO) Colisión `productos`** — el maestro de compra chocaba con el "Catálogo de oferta" del plano Comercial. Renombrado a `productos_compra` y limpiada la tabla vieja.
2. **✅ (HECHO) Editor de tablas inline** — en la Vista de Plano se agregan/editan/borran **filas manuales** sin CSV; las **derivadas** de superficies se ven read-only y siguen autollenándose. Destraba llenar MKT, FIN(ingresos), CTR, IMP, ESC, INV, JUR, COM. (CSV sigue disponible.)
3. **✅ (HECHO parcial) Proyecciones nuevas:** FIN←ingresos (ofertas/UCs) · CTR←kpis (tiempo por proceso del Mapa) · JUR←legales (contratos del abastecimiento) · ESC←unidades (UCs). **Falta:** INV←rondas (derivado de META/FIN/COM) y enlazar datos fiscales de Personas a JUR.
4. **🤖 `ANTHROPIC_API_KEY`** para el chat especialista de cada plano (llenado asistido).
5. **Nodo Marketing** que escriba filas directas (hoy manda a CSV); mini-CRM para COM(clientes/canales); pre-llenado por el Curador de los narrativos (META/EST/CUL) desde el diagnóstico.

**Estado:** 1–2 completos y 3 casi completo → los 18 planos ya son llenables (auto + inline + CSV + chat). Restan mejoras (4–5) e INV←rondas.

---

## 13. Pendientes / próximos pasos

- 🔒 **ROTAR `ANTHROPIC_API_KEY`** (expuesta desde 2026-07-13).
- 🌐 **DNS de businessplanner.com.mx** (CNAME + TXT en Railway).
- ✉️ **`RESEND_API_KEY` + `RESEND_FROM`** (dominio verificado) para envío real de correos del Centro IA.
- 🧠 Sumar **contingencias** al contexto del Centro IA (para que recite/accione el protocolo ante un retraso o robo).
- Piezas grandes futuras de logística/relaciones: **buzón de entrada automático** (recibir respuestas sin pegarlas) y **agendar en calendario real** (Google Calendar).
- Del análisis §12: **editor de tablas inline** + **proyecciones faltantes**.

---

## 14. Convenciones técnicas

- **Config-driven:** agregar un plano = tocar `especialistas.ts`, `diagnostico.ts` (PLANOS_MAESTROS + ORDEN_PLANOS), `tablas.ts` (TABLAS_BASE), `etapas.ts` (MATRIZ_ETAPA), `selection-engine.ts`.
- **Datos:** filas JSON en `TablaProyecto` por "ref"; normalizadores defensivos por entidad; sin migraciones de schema.
- **Agentes:** `correrBucleTools(system, tools, historial, ejecutar, modelo)`; snapshot del estado se reinyecta cada turno; el ejecutor aplica acciones reales.
- **Gates:** `npx tsc --noEmit` (strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess) + `npm run build` + `npx tsx scripts/planner-altercing.ts` (169/169).
- **Deploy:** push a `main` → auto-deploy en Railway. Seed de Altercing: `DATABASE_URL=<public proxy> npx tsx scripts/seed-altercing.ts`.

---

## 15. Lo construido en esta tanda de sesiones (2026-07-13 → 07-29)

- Navegación completa (workspaces → grafo → proyecto → 6 nodos), Curadores, diagnóstico + selección + 18 planos + generador de documentos + grafo de dependencias.
- Módulo de Espacios + editor 2D + mapa Leaflet + **3D Three.js** (órbita + **primera persona**) + **Diseñador 3D** (crea objetos desde primitivas) + acabados/texturas + renders + LiDAR/glb.
- **Mapa Operativo V3** (fases/etapas/ramas/subflujos, 7 lentes, recursos ricos, agenda, simulación, instructivo, **automatización**, **contingencias**).
- **Personas & RH** + flujos n8n + **Organizador de Equipo IA**.
- **Módulo de Abastecimiento completo:** proveedores ricos + productos + inventario/planeación + compras (flujo + arranque) + contratos + calidad/score/riesgo + **Centro de Abastecimiento Inteligente** + **agente de relaciones comerciales** (correos, seguimiento, llenado auto).
- **Unificación de catálogo** (Productos = fuente única de precio; costeo y Financiero sin duplicar).
- **Logística F1–F5:** embarques + landed cost + **modalidad de envío** + transportistas/tarifas + arranque + **aduana/importación** + recepción parcial + **contingencias**.
- **Fix:** colisión de tabla `productos`.

_Nota: Marketing como "fábrica de personalidades" NO se construyó en el Planner (esa idea es para **Macao Marketing**, un proyecto hermano fuera del Planner)._

---
---

# PARTE II — MÉTODO: Responsabilidades y Entregables de los Planos

> Esta parte **profundiza** los planos existentes: define con precisión **qué produce cada uno** (entregables), **qué contiene** y **cómo se relaciona** con el resto. **No** crea planos nuevos, **no** cambia la arquitectura, **no** describe funciones de ERP. Cada ampliación se integra al plano existente que arquitectónicamente le corresponde. Regla base: si algo cabe en un plano existente, va ahí.

## II.0 Cómo leer esta parte y mapeo de nombres

Algunos nombres del negocio no son 1:1 con los `planoId` del sistema. Mapeo oficial (sin crear planos):

| Nombre de negocio | Plano(s) del sistema |
|---|---|
| **Ejecutivo** | **META** (documento maestro/ejecutivo) + apoyo de **EST** (estratégico) |
| **Arquitectónico** | **ARQ** |
| **Operativo (Manual Operativo)** | **OPE** + **PRO** (procesos) — se nutren del **Mapa Operativo** |
| **Financiero** | **FIN** |
| **Inversionista** | **INV** |
| **Comercial** | **COM** (separado de MKT) |
| **Marketing** | **MKT** |
| **Jurídico** | **JUR** |
| **Recursos Humanos** | **RH** (+ **ORG** para estructura) |
| **Cultural** | **CUL** |
| **Proveedores y Compras** | **NO es un plano**: es la **superficie** "Recursos & Proveedores" que **configura** y **alimenta** COM/FIN/TEC/JUR |
| **Tecnológico / IA / Control / Implementación / Escalamiento** | **TEC / IA / CTR / IMP / ESC** (conservan su rol; ver II.1 y II.6) |

Cada plano ya declara en código un **`contratoEntrega`** (documento/diagrama/tabla/dashboard). Lo que sigue **amplía el contenido** de ese contrato; no lo reemplaza.

---

## II.1 Responsabilidades y entregables ampliados (por plano)

### 1. Ejecutivo → **META** (contrato actual: *Documento maestro de la entidad*)
**Entregable:** Documento Ejecutivo completo (resumen que integra a todos los planos).
**Contenido mínimo:** resumen ejecutivo · problema · solución · propuesta de valor · modelo de negocio · objetivos · KPIs generales · roadmap · riesgos · ventajas competitivas · restricciones · cronograma general · **dependencias entre departamentos** · **etapas de crecimiento** (arrancar→…→vender) · **criterios para pasar a la siguiente etapa**.
**Relaciones:** *consume* de EST, COM, FIN, OPE, MKT (resúmenes) · *alimenta* a INV. Las "etapas de crecimiento" reusan la **ruta de 5 etapas** del sistema.

### 2. Arquitectónico → **ARQ** (contrato actual: *Casa de muñecas, sin diseño/renders*)
**Entregable:** **Paquete para arquitectos e ingenieros** — insumo para que una constructora pueda **diseñar, cotizar y construir** (el Planner **no** diseña arquitectura ni hace renders).
**Contenido mínimo:** programa arquitectónico · casa de muñecas (bloques funcionales) · relaciones entre espacios · **flujo de personas** · **flujo de materiales** · **documento por espacio** con: área requerida, restricciones, instalaciones necesarias, equipamiento, mobiliario, iluminación, ventilación, electricidad, agua, gas, sanitarios, seguridad y **acabados requeridos**.
**Relaciones:** *consume* de OPE/PRO (qué se hace en cada espacio), Proveedores (equipo/mobiliario), FIN (presupuesto de obra); la geometría y ambientes vienen de la superficie **Sedes & Espacios**. *Alimenta* a FIN (CAPEX de obra) y JUR (permisos/uso de suelo).

### 3. Operativo → **OPE** + **PRO** (contratos: *documento operativo* + *diagrama de flujo*)
**Entregable:** **Manual Operativo** por departamento. Por cada departamento la cadena completa:
`Departamento → Roles → Procesos → Subprocesos → Pasos → Herramientas → Permisos → Entradas → Salidas → Triggers → KPIs → Checklists → Plantillas → SOPs → Errores comunes → Protocolos de contingencia → Tiempo esperado → Automatizaciones previstas → Documentación generada`.
**Ya lo produce el Mapa Operativo** (procesos, subflujos, roles, herramientas, insumos, entradas/salidas, **ramas=triggers**, tiempos, **contingencias**, **automatización**, apoyos/manuales). **Falta estandarizar como contenido**: permisos por rol, checklists, plantillas, SOPs formales, errores comunes y "documentación generada" por proceso.
**Relaciones:** *consume* de COM (rutas del catálogo), ARQ (espacios), Proveedores (insumos), RH (ejecutores). *Alimenta* a FIN (costeo/tiempos), TEC/IA (automatizaciones), CTR (KPIs/tiempos), y es la **base de configuración del software operativo**.

### 4. Financiero → **FIN** (contrato: *tablas/modelo, cifras = PENDIENTE*)
**Entregable:** Modelo financiero de arranque (estructura; cifras reales = PENDIENTE hasta dato real).
**Contenido mínimo:** **CAPEX** · **OPEX** · capital de trabajo · presupuesto inicial · flujo mensual · flujo anual · **proyección a 5 años** · **escenarios** (optimista/realista/conservador) · ROI · VPN · TIR · punto de equilibrio · calendario de inversión · **calendario de compras** · calendario de pagos · fondos de emergencia · supuestos financieros.
**Relaciones:** *consume* de OPE (costos/tiempos), RH (nómina), ARQ (CAPEX de obra), TEC/Proveedores (equipo/insumos/logística → landed cost), COM (ingresos/precios). *Alimenta* a INV y META.

### 5. Inversionista → **INV** (contrato: *deck de inversión*)
**Entregable:** **Investment Memorandum**.
**Contenido mínimo:** resumen ejecutivo · descripción del negocio · mercado · competencia · **uso del capital** · **etapas de inversión** y **qué desbloquea cada etapa** · proyección · KPIs · riesgos · **salida del inversionista** · valuación · dilución · cronograma.
**Relaciones:** *consume* (derivado) de META, EST, FIN, COM, MKT. No recaptura: se arma de esos planos.

### 6. Comercial → **COM** — **separado de Marketing** (contrato: *documento comercial + catálogo de oferta*)
**Entregable:** Sistema comercial de arranque (la venta, no la comunicación).
**Contenido mínimo:** **pipeline** · embudo comercial · proceso comercial · **CRM inicial** (config de etapas/campos, no operación) · cotizaciones (plantilla/lógica) · seguimiento · scripts · objeciones · comisiones · metas · forecast.
**Relaciones:** *consume* de META (propuesta de valor), MKT (demanda validada), FIN (precios/márgenes), Proveedores (catálogo de venta). *Alimenta* a FIN (ingresos) e INV. Su **CRM inicial** es **configuración semilla** para el CRM operativo.

### 7. Marketing → **MKT** (contrato: *antropología + calendario + laboratorio*)
**Entregable:** Sistema completo de planificación de marketing.
**Contenido mínimo:** investigación antropológica · segmentación · mercado/nicho/micronicho · avatar/subavatar · **mapas** (psicológico, emocional, cultural, de dolores, de objeciones, de aspiraciones) · buyer journey · plan anual · campañas · KPIs · calendario de producción · calendario editorial · mensajes clave · canales · presupuestos · responsables · guiones profesionales · briefs · prompts · entregables · versiones · aprendizajes · retroalimentación.
**+ Laboratorio de validación de mercado:** formular hipótesis → diseñar pruebas → validar demanda → lanzar **campañas piloto** → obtener conclusiones **antes de invertir fuerte**.
**Relaciones:** *consume* de META, COM, FIN (presupuesto), CUL (identidad). *Alimenta* a COM (demanda) e INV.

### 8. Jurídico → **JUR** (contrato: *checklist legal, borradores + PENDIENTE asesor*)
**Entregable:** Paquete legal de arranque (borradores + checklist; dictamen final = asesor).
**Contenido mínimo:** constitución · contratos · NDA · licencias · permisos · marcas · patentes · políticas · términos · propiedad intelectual · **checklist legal** · **calendario de obligaciones**.
**Relaciones:** *consume* de RH (contratos laborales, datos fiscales), Proveedores (contratos/pólizas), COM (términos de venta), ARQ (permisos/uso de suelo). Los **contratos** capturados en la superficie de Abastecimiento y los **datos fiscales** de Personas son su insumo.

### 9. Recursos Humanos → **RH** (contrato: *manual del empleado + puestos + ciclo de vida*)
**Entregable:** Paquete de RH de arranque.
**Contenido mínimo:** manual del empleado · descripción de puestos · proceso de contratación · onboarding · capacitación · evaluaciones · bonos · plan de carrera · sucesión · offboarding · KPIs.
**Relaciones:** *consume* de ORG (estructura), OPE (roles/procesos por puesto), FIN (nómina). Se nutre del **roster de Personas & RH**. *Alimenta* a JUR (contratos laborales) y FIN (costo de personal).

### 10. Cultural → **CUL** (contrato: *propósito, valores, comportamientos*)
**Entregable:** Documento de cultura e identidad.
**Contenido mínimo:** valores · normas · lenguaje · protocolos · historia · rituales · reconocimientos · identidad · liderazgo.
**Relaciones:** *consume* de META (propósito). *Alimenta* a MKT (identidad de marca) y RH (comportamientos/onboarding).

### 11. Proveedores y Compras → superficie **Recursos & Proveedores** (alimenta COM/FIN/TEC/JUR)
**No es un plano ni un ERP.** Su único objetivo es dejar lista la **configuración inicial** de abastecimiento; la administración diaria será del software operativo.
**Contenido mínimo (config):** registro de proveedores · **clasificación** · productos · servicios · ubicaciones · contratos · capacidad · tiempo de entrega · rotación · vida útil · tiempo de anaquel · condiciones de almacenamiento · **historial de precios** · riesgos · calificación · **proveedor alternativo** · subcontratistas.
**Responsabilidad de IA (definida como entregable, no como feature operativa):** la IA debe **recomendar automáticamente la clasificación** de productos y proveedores para no confundir al usuario.
**Relaciones:** *alimenta* a **COM** (proveedores/catálogo), **FIN** (costos/compras/landed cost), **TEC** (equipo/licencias), **JUR** (contratos/pólizas). Todo lo capturado es **semilla de configuración** para el WMS/compras del software operativo.

### Planos de soporte que conservan su rol
- **ORG** (organigrama/estructura y autoridad) — insumo de RH y OPE.
- **TEC** (componentes, contratos, seguridad, datos) — define la **configuración inicial del software** (stack, componentes, licencias); *consume* de PRO/OPE.
- **IA** (fichas de agente, autonomía, memoria) — define los **agentes** que operarán; *consume* de TEC/ORG/OPE.
- **CTR** (dashboard de KPIs) — consolida KPIs de todos los planos.
- **IMP** (roadmap de implementación) — hitos por plano + calendario.
- **ESC** (escalamiento: unidad replicable, fases, límites) — cómo se replica/franquicia.

---

## II.2 Entregables por Plano (catálogo — índice, no re-detalle)

Índice compacto de artefactos por plano (el detalle vive en II.1; esto es referencia rápida — **SSOT en II.1**).

| Plano | Produce |
|---|---|
| **META (Ejecutivo)** | Documento ejecutivo · roadmap · dependencias entre departamentos · etapas y criterios de avance |
| **EST** | Documento estratégico (norte, prioridades, sistema de decisión) |
| **ARQ** | Programa arquitectónico · casa de muñecas · documento por espacio · paquete para arquitectos/ingenieros |
| **OPE + PRO** | Manual Operativo · SOPs · checklists · plantillas · diagramas de flujo · KPIs · formularios · permisos · protocolos de contingencia |
| **FIN** | CAPEX/OPEX · flujos · proyección 5 años · escenarios · ROI/VPN/TIR/punto de equilibrio · calendarios · supuestos |
| **INV** | Investment Memorandum (deck) |
| **COM** | Pipeline · embudo · proceso comercial · CRM inicial · cotizaciones · scripts · objeciones · comisiones · forecast |
| **MKT** | Investigación/segmentación/avatares · mapas · buyer journey · plan anual · campañas · calendarios · guiones/briefs/prompts · laboratorio de validación |
| **JUR** | Constitución · contratos/NDA · permisos/licencias · marcas/patentes/PI · checklist legal · calendario de obligaciones |
| **RH** | Manual del empleado · descripciones de puesto · ciclo (contratación→…→offboarding) · KPIs |
| **CUL** | Valores · normas · lenguaje · protocolos · rituales · identidad · liderazgo |
| **ORG** | Organigrama / estructura y autoridad |
| **TEC** | Componentes/contratos · seguridad/datos · configuración inicial de software |
| **IA** | Fichas de agente · autonomía · memoria |
| **CTR** | Modelo de dashboard de KPIs |
| **IMP** | Roadmap de implementación (hitos) |
| **ESC** | Documento de escalamiento (unidad, fases, límites) |
| **Proveedores & Compras** (superficie) | Configuración inicial de abastecimiento (registro/clasificación/contratos/riesgos…) |

---

## II.3 Dependencias entre Planos

**Distinto de §10.** §10 documenta **superficie → plano** (proyección de datos). Aquí se documenta **plano → plano** (qué información consume un plano de otros) para evitar inconsistencias.

| Plano | Depende de (consume) |
|---|---|
| **META (Ejecutivo)** | EST, COM, FIN, OPE, MKT (integra sus resúmenes) |
| **EST** | META |
| **FIN** | OPE, RH, ARQ (construcción/CAPEX), TEC, Proveedores, COM (ingresos) |
| **INV** | META, EST, FIN, COM, MKT |
| **COM** | META, MKT (demanda), FIN (precios), Proveedores (catálogo) |
| **MKT** | META (propuesta de valor), COM (oferta), FIN (presupuesto), CUL (identidad) |
| **OPE / PRO** | COM (rutas), ARQ (espacios), Proveedores (insumos), RH (ejecutores), TEC (automatización) |
| **ARQ** | OPE/PRO (uso de espacios), Proveedores (equipo/mobiliario), FIN (presupuesto) |
| **RH** | ORG (estructura), OPE (roles/procesos), FIN (nómina) |
| **ORG** | OPE (roles), RH |
| **TEC** | PRO/OPE (procesos y automatizaciones) |
| **IA** | TEC, ORG, OPE |
| **JUR** | RH (laboral/fiscal), Proveedores (contratos), COM (términos), ARQ (permisos) |
| **CTR** | Todos (KPIs), en especial OPE, FIN, MKT |
| **IMP** | Todos (hitos por plano), FIN (calendario) |
| **ESC** | OPE (replicabilidad), FIN, COM |
| **CUL** | META |

Regla de consistencia: si un plano cambia un dato compartido (precio, rol, espacio, proceso), los planos que dependen de él deben recomputar (hoy la **proyección** lo resuelve en las tablas; el **grafo de dependencias** —`domain/dependencias.ts`— hace explícita la cadena plano↔tabla↔proceso).

---

## II.4 Nivel de Completitud

Cada plano debe poder reportar su **estado de llenado** para saber cuándo está listo para la siguiente fase. Métrica estándar por plano:

- **% completado** = campos+tablas requeridos llenos / requeridos totales (por profundidad esencial/estándar/completo).
- **Información pendiente** = lista de campos/tablas `⚠ PENDIENTE` (los marca el generador de documentos, `domain/plano-doc.ts`).
- **Bloqueos** = requisitos aguas arriba sin cumplir (del **grafo de dependencias**: p. ej. FIN bloqueado si OPE no tiene costos).
- **Dependencias** = planos de los que aún espera datos (ver II.3).

**Base ya existente:** el motor de *readiness* (`readiness-engine.ts`) calcula estados `LOCKED / DISPONIBLE / MIN_OPERABLE / PUBLICADO / COMPLETO`; el grafo de planos muestra `progreso`, `estado`, `pendientes` por nodo. Esta sección **estandariza qué reporta cada plano**; no requiere arquitectura nueva. Un proyecto está listo para publicar cuando todos los planos seleccionados alcanzan al menos **MIN_OPERABLE** y sus bloqueos están resueltos.

---

## II.5 Simulación Empresarial

Antes de publicar, el Planner debe poder **describir cómo funcionaría la empresa**, simulando su lógica de extremo a extremo. Objetivo: **validar el diseño antes de generar el software operativo** (encontrar incoherencias, cuellos y huecos).

**Qué simular:** clientes · ventas · compras · producción · inventario · nómina · pagos · impuestos · mantenimiento · incidentes · **cuellos de botella**.

**Base ya existente:** el Mapa Operativo tiene el panel **🎬 Simular** (carga por espacio/rol, cuellos, recorrido, cambios de espacio) y el motor de **planeación de compras** (qué se agotará), la **agenda** (choques de recursos) y las **contingencias** (incidentes). Esta sección define la **simulación integral** como la **unión** de esas piezas + el modelo financiero (flujos) + el roster (nómina) — una "corrida" de la empresa en papel. **Propósito documental** (no se especifica implementación aquí): que el resultado de la simulación sea un **reporte de viabilidad** que condicione la generación de entregables (II.6).

---

## II.6 Generación de Entregables

Cuando **todos los planos** alcanzan su nivel objetivo (II.4) y la simulación (II.5) es viable, el Planner puede producir sus **artefactos finales**. Aquí se documenta la **arquitectura y el propósito** (la generación automática **no** se desarrolla todavía).

**Artefactos finales:**
- **Plano ALV** (documento maestro bajo ARQOS V2.1 + PLANO ALV V1.0).
- **Manuales** (operativo, del empleado, etc.).
- **Documentación técnica** (TEC/IA: componentes, agentes, seguridad).
- **Documentación para inversionistas** (INV: memorandum/deck).
- **Paquete para arquitectos** (ARQ: programa + casa de muñecas + doc por espacio).
- **Paquete para operaciones** (OPE/PRO: manual, SOPs, checklists, flujos).
- **Paquete para Recursos Humanos** (RH).
- **Paquete para Marketing** (MKT).
- **Configuración inicial para el ERP** (FIN + Proveedores + OPE).
- **Configuración inicial para el CRM** (COM).
- **Configuración inicial para el software operativo** (semilla que hereda: procesos, roles, permisos, catálogos, proveedores, inventario, KPIs, contingencias).

**Mecanismo base ya existente:** cada plano genera hoy su **documento** (`generarDocumentoDePlano`) marcando pendientes. Un "paquete" = **bundle** de los documentos de un grupo de planos. La **configuración para ERP/CRM/software operativo** = exportación estructurada de las superficies (procesos, roles, permisos, proveedores, productos, inventario, KPIs) como **datos semilla**, no como sistema en vivo. Esta capa cierra la frontera del Principio Rector: **el Planner entrega la configuración; el software operativo la ejecuta.**

---

### Nota de mantenimiento (SSOT)
Este capítulo (PARTE II) es la **fuente única** de las responsabilidades y entregables de los planos. Los `contratoEntrega` en `especialistas.ts` son su reflejo mínimo en código. Si se amplía un entregable, se edita **aquí**; no se duplica en otros documentos. El estado operativo del proyecto sigue viviendo en `90_Curador/ESTADO_ACTUAL.md`.
