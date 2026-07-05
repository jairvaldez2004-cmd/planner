# Business Planner — BUILD_ALPHA (MVP local)

> Alpha local del Business Planner. **Alcance:** 1 vertical — producir un **Plano Comercial-EXP** (FROZEN) end-to-end, local, con **agente MOCK**.
> Reglas duras: NO proveedor/cloud · NO deploy productivo · NO agentes reales · NO Fable · NO LOCK de producción · solo COM-EXP · persistencia local.
> Origen del alcance: `C:\ALV-Knowledge-System\BusinessPlanner\BUILD_ALPHA_SCOPE_DECISION.md` + `BUILD_ALPHA_START.md`. Curador: Opus · 2026-06-12.

## Stack (alpha, no LOCK)
Next.js 16 + Node + TypeScript + PostgreSQL local (Prisma). Local/dev únicamente.

## Estructura
```
src/
  domain/        estados del ciclo + contrato COM-EXP (tipos)
  adapters/
    persistence/ contrato de repositorio (R5D) + impl local
    agent/       contrato de agente + agente MOCK (Agente⇏Runtime)
  app/           pipeline (casos de uso)
  ui/            Next.js (fase posterior)
seeds/           datos de dominio reales (Incoterms/puertos); valores de negocio → PENDIENTE
```

## Invariantes respetados
- **OS = escritor único** (publica tras validación humana).
- **Agente ⇏ Runtime** (el mock propone; nunca escribe).
- **KPI-1** (la UI no calcula; consume).
- **No inventar:** valores de negocio faltantes = `PENDIENTE`.

## Estado de construcción
Bloques 0–3 (fundación · estados · persistencia · agente mock) = **scaffolding inicial**. Siguiente: workspace/proyecto/instancia → captura → plano → validación → versión → UI.

## Próximo paso (requiere acción/aprobación)
`npm install` + `npx prisma init` y levantar localhost **no se han ejecutado** (alpha empieza por las capas puras). Cuando el propietario lo autorice, se instala y se corre en local.
