// CATÁLOGO DE MARKETING ANIDADO (ADITIVO). Jerarquía en cascada para el entregable de
// Marketing: cada PRODUCTO/servicio del catálogo tiene CAMPAÑAS (por tipo y CTA); cada
// campaña tiene FORMATOS de contenido (reel, historia, TikTok, carrusel…); cada formato
// lleva especificaciones, características, CTA, GUION profesional (tomas) y MINUTA de
// producción (si aplica). Se guarda como árbol JSON en TablaProyecto (tablaRef 'mkt_catalogo').
// Solo datos + tipos; el render en cascada y el PDF viven en la capa UI.

// Una toma del guion (storyboard/shotlist profesional).
export interface Toma {
  n: number;            // número de toma
  plano: string;        // tipo de plano/encuadre (ej. "Primer plano", "Detalle 4K")
  descripcion: string;  // qué se ve / acción
  vozTexto?: string | undefined;    // locución, texto en pantalla o diálogo
  duracion?: string | undefined;    // ej. "3 s"
  audio?: string | undefined;       // música / SFX
}

// Una línea de la minuta de producción (reunión/rodaje).
export interface MinutaItem {
  momento: string;      // ej. "Pre-producción", "Rodaje 10:00", "Post"
  tema: string;         // qué se trata
  responsable: string;  // quién
  acuerdo: string;      // acuerdo / entregable / deadline
}

// Un formato de contenido dentro de una campaña.
export interface FormatoMkt {
  id: string;
  formato: string;              // ej. "Reel Instagram", "Historia", "TikTok", "Carrusel"
  objetivo?: string | undefined;            // objetivo específico del pieza
  especificaciones: string;     // relación de aspecto, duración, resolución, plataforma
  caracteristicas: string;      // tono, hook, música, estilo visual
  cta: string;                  // llamado a la acción de esta pieza
  hashtags?: string | undefined;
  guion: Toma[];                // storyboard / shotlist
  minuta?: MinutaItem[] | undefined;        // minuta de producción (opcional)
}

// Una campaña de un producto (por tipo y CTA).
export interface CampanaMkt {
  id: string;
  nombre: string;
  tipo: string;                 // Adquisición | Recompra | Estacional | Educación/Autoridad | Lanzamiento…
  cta: string;                  // CTA rectora de la campaña
  objetivo: string;             // qué busca (citas, recompra, awareness)
  temporada?: string | undefined;           // cuándo corre
  canal?: string | undefined;               // dónde
  presupuesto?: string | undefined;
  kpi?: string | undefined;
  mensaje?: string | undefined;             // idea/ángulo central
  formatos: FormatoMkt[];
}

// Un producto/servicio del catálogo con sus campañas.
export interface ProductoMkt {
  id: string;
  producto: string;             // nombre del producto/servicio
  categoria?: string | undefined;           // Piercing | Tatuaje | Uñas | Joyería
  descripcion?: string | undefined;
  precio?: string | undefined;
  campanas: CampanaMkt[];
}

export type CatalogoMkt = ProductoMkt[];

// ---- Conteos para índices y encabezados (no inventan nada, solo agregan) ----
export interface ConteoCatalogo { productos: number; campanas: number; formatos: number; tomas: number; minutas: number }

export function contarCatalogo(cat: CatalogoMkt): ConteoCatalogo {
  const c: ConteoCatalogo = { productos: cat.length, campanas: 0, formatos: 0, tomas: 0, minutas: 0 };
  for (const p of cat) {
    c.campanas += p.campanas.length;
    for (const camp of p.campanas) {
      c.formatos += camp.formatos.length;
      for (const f of camp.formatos) {
        c.tomas += f.guion?.length ?? 0;
        if (f.minuta && f.minuta.length) c.minutas += 1;
      }
    }
  }
  return c;
}

// Normaliza un valor crudo de la DB (JSON) a CatalogoMkt seguro para render.
export function normalizarCatalogo(raw: unknown): CatalogoMkt {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is ProductoMkt => !!p && typeof p === 'object')
    .map((p) => ({
      id: String(p.id ?? ''),
      producto: String(p.producto ?? ''),
      categoria: p.categoria ? String(p.categoria) : undefined,
      descripcion: p.descripcion ? String(p.descripcion) : undefined,
      precio: p.precio ? String(p.precio) : undefined,
      campanas: Array.isArray(p.campanas) ? p.campanas.map((c) => ({
        id: String(c.id ?? ''),
        nombre: String(c.nombre ?? ''),
        tipo: String(c.tipo ?? ''),
        cta: String(c.cta ?? ''),
        objetivo: String(c.objetivo ?? ''),
        temporada: c.temporada ? String(c.temporada) : undefined,
        canal: c.canal ? String(c.canal) : undefined,
        presupuesto: c.presupuesto ? String(c.presupuesto) : undefined,
        kpi: c.kpi ? String(c.kpi) : undefined,
        mensaje: c.mensaje ? String(c.mensaje) : undefined,
        formatos: Array.isArray(c.formatos) ? c.formatos.map((f) => ({
          id: String(f.id ?? ''),
          formato: String(f.formato ?? ''),
          objetivo: f.objetivo ? String(f.objetivo) : undefined,
          especificaciones: String(f.especificaciones ?? ''),
          caracteristicas: String(f.caracteristicas ?? ''),
          cta: String(f.cta ?? ''),
          hashtags: f.hashtags ? String(f.hashtags) : undefined,
          guion: Array.isArray(f.guion) ? f.guion.map((t, i) => ({
            n: typeof t.n === 'number' ? t.n : i + 1,
            plano: String(t.plano ?? ''),
            descripcion: String(t.descripcion ?? ''),
            vozTexto: t.vozTexto ? String(t.vozTexto) : undefined,
            duracion: t.duracion ? String(t.duracion) : undefined,
            audio: t.audio ? String(t.audio) : undefined,
          })) : [],
          minuta: Array.isArray(f.minuta) ? f.minuta.map((m) => ({
            momento: String(m.momento ?? ''),
            tema: String(m.tema ?? ''),
            responsable: String(m.responsable ?? ''),
            acuerdo: String(m.acuerdo ?? ''),
          })) : undefined,
        })) : [],
      })) : [],
    }));
}
