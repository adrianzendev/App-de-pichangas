import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const SIZES = {
  md: "w-10 h-10",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
} as const;

interface IconCircleProps {
  size?: keyof typeof SIZES;
  className?: string;
  children: ReactNode;
}

// Circulo verde translucido con un icono adentro (filas de perfil, estados vacios, modales).
export function IconCircle({ size = "md", className, children }: IconCircleProps) {
  return (
    <div className={cn("rounded-full bg-primary/10 flex items-center justify-center", SIZES[size], className)}>
      {children}
    </div>
  );
}
