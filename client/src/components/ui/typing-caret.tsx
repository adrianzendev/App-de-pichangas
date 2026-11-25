import { cn } from "@/lib/utils";

// Cursor de texto (barra vertical) de los efectos de escritura: compositor del Inicio y "Buscando tutores…".
// Un solo lugar para sus medidas (tokens --caret-*); el color y el parpadeo los pone quien lo usa.
const SIZES = { md: "h-caret-h-md w-caret-w-md", sm: "h-caret-h-sm w-caret-w-sm" } as const;

export function TypingCaret({ size = "md", className }: { size?: keyof typeof SIZES; className?: string }) {
  return <span aria-hidden className={cn("inline-block shrink-0", SIZES[size], className)} />;
}
