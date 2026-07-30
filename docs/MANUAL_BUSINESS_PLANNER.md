# 📘 Business Planner — Documento maestro (estado + funciones + interfaces + relaciones)

> Fecha del documento: **2026-07-29** · App EN VIVO: `https://planner-production-57f0.up.railway.app`
> Repo GitHub: `jairvaldez2004-cmd/planner` (auto-deploy a Railway en cada push a `main`).
> Suite de dominio: `scripts/planner-altercing.ts` — **169/169 verde**.
> Fuente de continuidad oficial: `90_Curador/ESTADO_ACTUAL.md` (leer primero en cada sesión).

---

## 0. Qué es

El **Business Planner** de CPF (Corporativo Palo Fierro) es un **diseñador de empresas**: convierte una idea/necesidad de negocio en **planos ejecutables**. No es un generador de documentos sueltos; es un sistema donde **un dato se captura una vez y se ve desde muchos "lentes" (planos), formando un grafo** ("un dato → muchos lentes → un grafo").

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
2. **📝 Editor de tablas dentro de la app** (hoy las tablas se llenan solo por CSV). Es el de mayor impacto: destraba MKT, FIN(ingresos), CTR, IMP, ESC, INV, JUR, COM.
3. **🔗 Proyecciones que faltan:** FIN←ingresos (del catálogo comercial) · CTR←kpis (del Mapa) · JUR←legales (de Contratos + datos fiscales) · ESC←unidades (de las UCs) · INV←rondas (derivado de META/FIN/COM).
4. **🤖 `ANTHROPIC_API_KEY`** para el chat especialista de cada plano.
5. **Nodo Marketing** que escriba filas directas (hoy manda a CSV); mini-CRM para COM(clientes/canales); pre-llenado por el Curador de los narrativos (META/EST/CUL) desde el diagnóstico.

**Orden recomendado:** (1 hecho) → editor de tablas inline → proyecciones faltantes → mejoras.

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
