import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

// Error del servidor sobre el formulario (credenciales incorrectas, enlace vencido…): un solo estilo para todas las pantallas de acceso.
export function AuthAlert({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div role="alert" className={cn("rounded-control bg-error-bg px-4 py-3 text-center text-body text-error-strong", className)} {...props} />;
}
