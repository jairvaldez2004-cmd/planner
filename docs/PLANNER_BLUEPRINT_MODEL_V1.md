# Modelo de Planos del Business Planner — V1

> **Principio rector:** *un dato → muchos lentes → un grafo.*
> Un proyecto NO es un conjunto de documentos: es **un solo grafo** del que los planos son
> vistas y los documentos son *renders*. Por eso un cambio se propaga solo: hay una sola fuente.

Este documento formaliza cómo el Planner captura toda la información de una empresa **sin
repetir datos**, con qué interfaces, y cómo se adapta a lo ya construido.

---

## 1. La regla de oro: cada hecho tiene un solo hogar

El enemigo de "sin repetir datos" es el mismo hecho tecleado dos veces. La defensa:

| Tipo de dato | Dónde vive (único hogar) | Cómo se captura | Modelo Prisma |
|---|---|---|---|
| **Repetible** (roles, productos, procesos, costos, KPIs, campañas, ambientes, puestos…) | **Tabla Maestra** (`TABLAS_BASE` en `domain/tablas.ts`) | Tabla / CSV con dedupe por `llave` | `TablaProyecto.filas` |
| **Narrativo** (misión, tesis, cultura, principios…) | **Campo del plano** (`bloques[].campos`) | Chat con el especialista | `ProyectoPlanoEstado.campos` |
| **Espacial / geométrico** (áreas, objetos, muros) | **Módulo Espacios** | Editor 2D/3D + Diseñador (chat) | `Sede/Espacio/ObjetoFisico` |
| **Relacional / flujo** (dependencias, disparadores) | **El grafo** | Derivado (no se recaptura) | `Proceso.ramas` + config |

Un plano **no posee** datos repetibles: declara una **Vista** (`TablaVista`) sobre una Tabla
Maestra. Ejemplo real: la tabla `personas` la lee **ORG** como *"Roles humanos"*, **OPE** como
*"Ejecutores por etapa"* y **RH** vía `puestos`. Se teclea una vez, aparece en varios planos con
las columnas de cada uno (`columnasContexto`). Un plano tampoco vuelve a preguntar lo que otro ya
definió: lo declara en `dependencias[]`.

---

## 2. Las 3 interfaces de captura

No hay 18 formularios. Cada tipo de dato entra por su interfaz natural (todas ya existen):

1. **Chat con el especialista** (`chat-especialista.tsx` → `conversarEspecialista`) — lo narrativo.
   El agente llena `campos` con la herramienta `registrar_campos` (derivada de la config).
2. **Tabla / CSV** (`vista-plano.tsx` → `plantillaCSV` / `importarCSV`) — lo repetible.
   `llave` hace dedupe en el re-import; un CSV alimenta a varios planos.
3. **Lienzo visual** — el editor 2D/3D (arquitectónico) y el canvas n8n del Mapa Operativo
   (procesos/dependencias).

---

## 3. Los 18 planos (mapa de la visión → código)

Config canónica en `domain/diagnostico.ts` (`PLANOS_MAESTROS` + `ORDEN_PLANOS`) y
`domain/especialistas.ts` (`ESPECIALISTAS`). Agregar un plano = **config, no código**.

| # Visión | Plano (id) | Estado |
|---|---|---|
| 1. Ejecutivo (CEO) | `META` + `EST` | Existía |
| 2. Arquitectónico (casa de muñecas) | **`ARQ`** | **Nuevo** (+ módulo Espacios) |
| 3. Operativo (manual ISO) | `OPE` + `PRO` + Mapa Operativo | Existía |
| 4. Tecnológico | `TEC` | Existía |
| 5. Financiero | `FIN` | Existía |
| 6. Inversionista | **`INV`** | **Nuevo** (derivado META+FIN+COM) |
| 7. Jurídico | **`JUR`** | **Nuevo** |
| 8. RH | `ORG` (estructura) + **`RH`** (gente) | **Nuevo** (RH) |
| 9. Cultural | `CUL` | Existía |
| 10. Comercial | `COM` | Existía |
| 11. Marketing (antropología + laboratorio) | **`MKT`** | **Nuevo** |
| 12. Escalabilidad | `ESC` | Existía |
| 13. Automatización | `IA` | Existía |
| 14. Inteligencia Empresarial | `CTR` | Existía |
| ⭐ Dependencias | `domain/dependencias.ts` | **Nuevo** (grafo unificado) |

Tablas maestras nuevas (`domain/tablas.ts`): `ambientes` (ARQ), `puestos` (RH), `legales` (JUR),
`investigacion` + `experimentos` (MKT), `rondas` (INV).

---

## 4. El Grafo de Dependencias — el modelo ejecutable

`domain/dependencias.ts` une las tres capas que vivían separadas en **un solo grafo**:

- **plano → plano** (`depende`) — de `ESPECIALISTAS[].dependencias`.
- **tabla → plano** (`usa`) — una Tabla Maestra usada por ≥2 planos = espina compartida
  (prueba de "sin repetir datos": `tablasCompartidas()`).
- **proceso → proceso** (`dispara`) — de `Proceso.ramas` del Mapa Operativo.

Cada nodo sabe `queNecesita` y `queProduce`. Con eso `bloqueadosSi(nodo)` responde la pregunta
del propietario: *"si falla X, ¿qué se bloquea aguas abajo?"* — a nivel plano y a nivel proceso.

---

## 5. Cada plano produce su documento

`domain/plano-doc.ts` (`generarDocumentoPlano`) rinde cualquier plano a Markdown desde
`campos` + `tablas`. **Invariante (heredado del compositor FROZEN): no inventa.** Lo requerido
al nivel del proyecto y vacío se marca `⚠ PENDIENTE` y se cuenta. Acción de servidor:
`generarDocumentoDePlano(proyectoId, planoId)`; botón *"📄 Generar documento"* en `vista-plano.tsx`.

---

## 6. Qué tocar para agregar un plano (checklist)

1. `domain/diagnostico.ts` → `PLANOS_MAESTROS` **y** `ORDEN_PLANOS`.
2. `domain/especialistas.ts` → entrada en `ESPECIALISTAS` (dependencias, contratoEntrega, bloques).
3. `domain/tablas.ts` → nuevas `TABLAS_BASE` que referencien los bloques.
4. `domain/etapas.ts` → columna del plano en las 5 filas de `MATRIZ_ETAPA` (fácil de olvidar).
5. `app/seleccion/selection-engine.ts` → regla que lo seleccione al blueprint.

El resto (grafo, readiness, chat, tablas, documento, UI) se deriva de la config automáticamente.

---

## 7. Verificación

`scripts/planner-altercing.ts` (correr: `npx tsx scripts/planner-altercing.ts`) ejercita todo
con datos reales de **Altercing Studio** (sin DB): selección de planos, generación de documentos
con PENDIENTE, tablas compartidas y propagación de fallos. **19/19 verde.**
