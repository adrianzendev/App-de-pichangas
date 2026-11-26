import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg";
const SIZE: Record<LogoSize, string> = { sm: "text-subheading", md: "text-2xl", lg: "text-3xl" };

interface BrandLogoProps {
  size?: LogoSize;
  /** night = sobre fondo oscuro (Pichanga Black); light = sobre fondo blanco. */
  tone?: "night" | "light";
  className?: string;
}

// Logo tipografico de F7: la marca va en texto (sin imagen), una sola palabra del color del texto del tema (blanco en oscuro) (gris oscuro sobre fondo claro).
export function BrandLogo({ size = "md", tone = "night", className }: BrandLogoProps) {
  return (
    <span
      role="img"
      aria-label="F7"
      className={cn("inline-flex select-none items-baseline font-satoshi font-extrabold italic tracking-tight", SIZE[size], className)}
    >
      <span className={tone === "night" ? "text-pitch" : "text-gray-900"}>F7</span>
    </span>
  );
}
