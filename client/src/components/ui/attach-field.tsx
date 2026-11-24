import type { MouseEvent, ReactNode } from "react";
import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = "flex min-h-field w-full cursor-pointer items-center justify-center gap-2 rounded-control border border-dashed border-field bg-white px-4 py-2 text-center transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

interface AttachFieldProps {
  children: ReactNode;
  /** Abre el selector propio de la pantalla. */
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  /** Id de un `<input type="file">`: el campo es su etiqueta. */
  htmlFor?: string;
  className?: string;
}

// Campo para adjuntar archivos: UNA sola fuente para Publicar y el comprobante de pago.
export function AttachField({ children, onClick, htmlFor, className }: AttachFieldProps) {
  const content = (
    <>
      <ImagePlus className="size-icon-lg shrink-0 text-green-600" aria-hidden />
      <span className="text-body font-medium text-gray-900">{children}</span>
    </>
  );
  if (htmlFor) {
    return <label htmlFor={htmlFor} className={cn(BASE, className)}>{content}</label>;
  }
  return <button type="button" onClick={onClick} className={cn(BASE, className)}>{content}</button>;
}
