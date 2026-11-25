import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type LayoutPreset = "list-heavy" | "list-detail" | "chat-heavy";

// Proporciones sobre un grid-cols-12, ver CLAUDE.md "Maquetacion: layout de
// 3 columnas". Clases completas y literales a proposito: Tailwind escanea
// texto estatico del archivo para generar CSS, un `col-span-${n}` armado en
// runtime con interpolacion no aparece en ese escaneo y no genera nada.
// Sin sidebar propio (vistas dentro del shell de home.tsx, que ya ocupa 2 de sus 12 columnas con el menu), lista + detalle
// usan los mismos spans sobre las 10 restantes.
const PRESETS: Record<LayoutPreset, { sidebar: string; list: string; detail: string }> = {
  // Tutores: la lista es la protagonista (sidebar 2, lista 7, detalle 3).
  "list-heavy": { sidebar: "col-span-2", list: "col-span-7", detail: "col-span-3" },
  // Pedidos: lista y panel de candidatos mas parejos (sidebar 2, lista 6, detalle 4).
  "list-detail": { sidebar: "col-span-2", list: "col-span-6", detail: "col-span-4" },
  // Mensajes/Chat: sin col-span; el ancho lo fija BP_CHAT_GRID (lista fija,
  // chat 1fr), estilo WhatsApp Web. Embebida desde lg: BP_CHAT_SPANS.
  "chat-heavy": { sidebar: "", list: "", detail: "" },
};

// chat-heavy: lista de conversaciones 320-380px fija, chat ocupa el resto (1fr).
// Desde lg dentro del shell de home.tsx (sin sidebar) es el mismo grid de 10 columnas que el resto: lista 3 + chat 7
// (BP_CHAT_SPANS), alineado con las 12 columnas del shell.
// Literales completos por el mismo motivo que BP_COLSPAN.
const BP_CHAT_GRID = {
  md: {
    withSidebar: "md:grid-cols-chat-3",
    withoutSidebar: "md:grid-cols-chat-2",
  },
  lg: {
    withSidebar: "lg:grid-cols-chat-3",
    withoutSidebar: "lg:grid-cols-10 lg:gap-6",
  },
  // tablet: variante raw (>=768px y >=600px de alto); se suma lg: para ventanas anchas pero bajas.
  tablet: {
    withSidebar: "tablet:grid-cols-chat-3 lg:grid-cols-chat-3",
    withoutSidebar: "tablet:grid-cols-chat-2 lg:grid-cols-10 lg:gap-6",
  },
} as const;
// La linea entre lista y chat es el borde derecho de la lista (pegada al final de las filas); el chat no lleva borde izquierdo.
// Su margen izquierdo es el gap-6 de la cuadricula (24px) y el derecho se lo pone el propio chat (`pr-6`): iguales.
const BP_CHAT_SPANS = {
  md: { list: "", detail: "" },
  lg: { list: "lg:col-span-3", detail: "lg:col-span-7 lg:border-l-0" },
  tablet: { list: "lg:col-span-3", detail: "lg:col-span-7 lg:border-l-0" },
} as const;

// Cada combinacion breakpoint x columna necesita su propia clase literal
// (mismo motivo que arriba) — de ahi la matriz en vez de interpolar "lg:" + span.
const BP_COLSPAN: Record<"md" | "lg" | "tablet", Record<string, string>> = {
  md: { "col-span-2": "md:col-span-2", "col-span-3": "md:col-span-3", "col-span-4": "md:col-span-4", "col-span-6": "md:col-span-6", "col-span-7": "md:col-span-7" },
  lg: { "col-span-2": "lg:col-span-2", "col-span-3": "lg:col-span-3", "col-span-4": "lg:col-span-4", "col-span-6": "lg:col-span-6", "col-span-7": "lg:col-span-7" },
  tablet: { "col-span-2": "tablet:col-span-2 lg:col-span-2", "col-span-3": "tablet:col-span-3 lg:col-span-3", "col-span-4": "tablet:col-span-4 lg:col-span-4", "col-span-6": "tablet:col-span-6 lg:col-span-6", "col-span-7": "tablet:col-span-7 lg:col-span-7" },
};
// Sidebar siempre pesa col-span-2 en ambos presets (2+7+3=12, 2+4+6=12).
// Sin sidebar (se omite cuando el shell que envuelve ya renderiza el suyo,
// ver prop `sidebar`), lista+detalle deben repartirse el total, no dejar 2
// columnas vacias a la derecha -- por eso el total de columnas del grid
// tambien cambia (12 -> 10, las que deja el menu del shell).
const BP_GRID = {
  md: { withSidebar: "md:grid-cols-12", withoutSidebar: "md:grid-cols-10" },
  lg: { withSidebar: "lg:grid-cols-12", withoutSidebar: "lg:grid-cols-10 lg:gap-6" },
  tablet: { withSidebar: "tablet:grid-cols-12 lg:grid-cols-12", withoutSidebar: "tablet:grid-cols-10 lg:grid-cols-10 lg:gap-6" },
} as const;
// Columna de lectura (672px centrada): solo cuando ya hay columnas (desde el breakpoint). Por debajo, movil y tablet
// vertical usan todo el ancho disponible. Literales completos por el mismo motivo que BP_COLSPAN.
const BP_READING = {
  md: "md:mx-auto md:max-w-content",
  lg: "lg:mx-auto lg:max-w-content",
  tablet: "tablet:mx-auto tablet:max-w-content lg:mx-auto lg:max-w-content",
} as const;
// Altura fija + scroll interno solo desde el breakpoint (donde el shell de home.tsx pasa a h-screen overflow-hidden);
// por debajo la pagina fluye en el documento (un solo scroll). Literales completos por el mismo motivo que BP_COLSPAN.
const BP_ROOT = {
  md: "md:h-dvh md:overflow-hidden",
  lg: "lg:h-dvh lg:overflow-hidden",
  tablet: "tablet:h-dvh tablet:overflow-hidden lg:h-dvh lg:overflow-hidden",
} as const;
const BP_SCROLL = {
  md: "md:h-full md:overflow-y-auto",
  lg: "lg:h-full lg:overflow-y-auto",
  tablet: "tablet:h-full tablet:overflow-y-auto lg:h-full lg:overflow-y-auto",
} as const;
// Sin detalle ni sidebar en el grid, la lista ocupa todas las columnas (no deja un hueco vacio a la derecha).
const BP_FULL = { md: "md:col-span-full", lg: "lg:col-span-full", tablet: "tablet:col-span-full lg:col-span-full" } as const;
const BP_FLEX ={ md: "md:flex", lg: "lg:flex", tablet: "tablet:flex lg:flex" } as const;

interface ThreeColumnLayoutProps {
  /** Columna 1. Omitila cuando el shell que envuelve esta vista (p.ej.
   * home.tsx) ya renderiza su propio sidebar — evita duplicarlo. */
  sidebar?: ReactNode;
  list: ReactNode;
  detail: ReactNode;
  /** true = mobile muestra la columna de detalle en vez de la lista. */
  showDetailOnMobile?: boolean;
  /** Breakpoint donde pasa de 1 columna (mobile) a grid de 12 (desktop).
   * Default "md" (spec generica). Vistas embebidas en el shell de home.tsx
   * deben pasar "lg" -- ese shell solo se vuelve flex/h-full a partir de
   * lg (ver home.tsx), asi que "md" pelearia con el en el rango tablet
   * 768-1024px (mismo ajuste hecho en profile-menu-button.tsx). "tablet" =
   * tablet (>=768px de ancho y >=600px de alto) o lg: — solo Mensajes (split). */
  breakpoint?: "md" | "lg" | "tablet";
  /** "list-heavy" (default, Tutores): lista 7 / detalle 3.
   * "chat-heavy" (Mensajes): lista fija 320-380px / chat 1fr. */
  preset?: LayoutPreset;
  /** true = el contenido de la columna central va en una columna de lectura
   * centrada (`max-w-content`, 672px), con aire a los lados en escritorio.
   * La vista pasa `Container fullWidth` por dentro, nunca un `Container` sin
   * `fullWidth` (doble centrado). */
  readingColumn?: boolean;
  className?: string;
}

export function ThreeColumnLayout({
  sidebar,
  list,
  detail,
  showDetailOnMobile = false,
  breakpoint = "md",
  preset = "list-heavy",
  readingColumn = false,
  className,
}: ThreeColumnLayoutProps) {
  const spans = PRESETS[preset];
  const colspan = BP_COLSPAN[breakpoint];
  const gridTable = preset === "chat-heavy" ? BP_CHAT_GRID : BP_GRID;
  const gridBp = gridTable[breakpoint][sidebar ? "withSidebar" : "withoutSidebar"];
  const flexBp = BP_FLEX[breakpoint];
  const scrollBp = BP_SCROLL[breakpoint];
  // Sin sidebar ni detalle la lista ocupa todo el ancho: no se dibuja la 3a columna vacia (caeria en una 2a fila y el gap-6 sumaria 24px de alto).
  const listIsFull = preset !== "chat-heavy" && !sidebar && !detail;
  const chatSpans = preset === "chat-heavy" && !sidebar ? BP_CHAT_SPANS[breakpoint] : { list: "", detail: "" };

  return (
    <div className={cn("grid grid-cols-1", gridBp, BP_ROOT[breakpoint], "w-full bg-white", className)}>
      {sidebar && (
        <div className={cn("hidden flex-col scrollbar-none", scrollBp, flexBp, colspan[spans.sidebar])}>
          {sidebar}
        </div>
      )}

      <div
        className={cn(
          "flex-col scrollbar-none", scrollBp,
          // Mensajes: lista blanca con borde derecho para separarla del chat.
          preset === "chat-heavy" && "border-r border-gray-100 bg-white",
          listIsFull ? BP_FULL[breakpoint] : colspan[spans.list],
          chatSpans.list,
          showDetailOnMobile ? cn("hidden", flexBp) : "flex"
        )}
      >
        {readingColumn ? <div className={cn("w-full", BP_READING[breakpoint])}>{list}</div> : list}
      </div>

      {!listIsFull && (
      <div
        className={cn(
          "flex-col scrollbar-none bg-white dark:bg-gray-900", scrollBp,
          // Solo el chat lleva linea entre lista y conversacion; en el resto separa la separacion del grid (gap-6).
          detail && preset === "chat-heavy" && "border-l border-gray-100",
          colspan[spans.detail],
          chatSpans.detail,
          showDetailOnMobile ? "flex" : cn("hidden", flexBp)
        )}
      >
        {detail}
      </div>
      )}
    </div>
  );
}
