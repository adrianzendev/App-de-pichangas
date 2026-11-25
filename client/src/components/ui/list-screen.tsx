import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/utils";

interface ListScreenProps {
  /** Margen lateral compacto (`px-card-gap`) para listas que deben aprovechar el ancho (Mensajes); ver `Container`. */
  compact?: boolean;
  className?: string;
  children: ReactNode;
}

// Hoja blanca de pagina: a sangre en movil, tarjeta desde lg. Compensa el relleno de ListScreen y reaplica `page-top`, asi su contenido arranca a la misma altura que las demas vistas.
export const PAGE_SHEET = "-mx-page-h -mt-page-top rounded-none bg-white p-sheet-pad pt-page-top lg:mx-0 lg:mt-0 lg:rounded-xl lg:pt-sheet-pad";
export const PAGE_SHEET_BORDERED = `${PAGE_SHEET} lg:border lg:border-field`;

// Envoltorio unico del contenido de una pantalla del shell (Inicio, Mensajes, Pedidos, Tutores): ancho completo dentro
// de su columna, margen lateral `px-page-h` (24px desde `lg`; `compact` usa `px-card-gap`, 16px: la columna central lleva lineas a los lados,
// estilo X, y el contenido no debe tocarlas), espacio superior/inferior `py-page-top` (24px desde `lg`, igual que el `pt-6` del sidebar y del panel
// derecho; va DENTRO del scroll para que al desplazar el contenido llegue hasta la cabecera sin banda en blanco) y separacion
// `space-y-section-gap` entre bloques (`ListHeader`, tarjetas, listas). El primer elemento arranca siempre a la misma altura.
// No armar `<Container fullWidth className="py-page-top …">` a mano en cada pantalla.
export function ListScreen({ compact = false, className, children }: ListScreenProps) {
  return (
    <Container fullWidth compact={compact} className={cn("py-page-top space-y-section-gap", className)}>
      {children}
    </Container>
  );
}
