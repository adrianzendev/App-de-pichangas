import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg";
const SIZE: Record<LogoSize, string> = { sm: "text-subheading", md: "text-2xl", lg: "text-3xl" };

interface BrandLogoProps {
  size?: LogoSize;
  /** night = sobre fondo oscuro (Pichanga Black); light = sobre fondo blanco. */
  tone?: "night" | "light";
  className?: string;
}

// Logo tipografico de Pinkiball: la marca va en texto (sin imagen), "Pinki" en rosa y "ball" en verde.
export function BrandLogo({ size = "md", tone = "night", className }: BrandLogoProps) {
  return (
    <span
      role="img"
      aria-label="Pinkiball"
      className={cn("inline-flex select-none items-baseline font-satoshi font-extrabold italic tracking-tight", SIZE[size], className)}
    >
      <span className={tone === "night" ? "text-orchid" : "text-gray-900"}>Pinki</span>
      <span className={tone === "night" ? "text-pitch" : "text-green-600"}>ball</span>
    </span>
  );
}
