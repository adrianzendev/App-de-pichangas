import type { ReactNode } from "react";
import tutorsBanner from "@/assets/auth-tutors-banner.png";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/ui/back-button";

interface TutorsBannerProps {
  className?: string;
  /** Imagen de la cabecera. Por defecto, los tutores (login, registro, Inicio). */
  src?: string;
  alt?: string;
  /** Posicion/escala de la imagen cuando `src` es otra; reemplaza las clases por defecto. */
  imageClassName?: string;
  children?: ReactNode;
}

// Cabecera con una imagen sobre un degradado blanco -> primary-100. Por defecto el PNG de los tutores es
// transparente: se apoya abajo y la hoja blanca que sube encima (-mt-sheet-overlap, rounded-t-xl) tapa los pies.
// Los hijos se posicionan encima (logo, saludo). La imagen se cambia por pagina con `src`.
export function TutorsBanner({
  className,
  src = tutorsBanner,
  alt = "Tutores verificados",
  imageClassName = "origin-bottom object-bottom scale-125 md:scale-110",
  children,
}: TutorsBannerProps) {
  return (
    <div className={cn("relative h-banner-hero shrink-0 bg-gradient-to-b from-white to-primary-100", className)}>
      <img src={src} alt={alt} className={cn("h-full w-full object-contain", imageClassName)} />
      {children}
    </div>
  );
}

// Cabecera unica de las pantallas principales (Inicio, Pedidos, Tutores, Publicar): mismo alto,
// misma posicion del titulo/subtitulo y misma imagen (a la derecha, para no tapar el texto).
// No armar el titulo a mano con `absolute` en cada pantalla: pasar `title` / `subtitle`.
// Login y registro usan `TutorsBanner` directo (mas alto a proposito).
const PAGE_BANNER_IMAGE = "origin-bottom-right object-right-bottom scale-90 translate-x-12 md:scale-110 md:translate-x-24";

interface PageBannerProps {
  title: string;
  subtitle?: string;
  src?: string;
  alt?: string;
  /** Solo si `src` es otra imagen: reemplaza la posicion/escala por defecto. */
  imageClassName?: string;
  className?: string;
  /** Flecha de regreso a la izquierda del titulo, solo en movil/tablet (<lg): pantallas sin barra inferior (Publicar). */
  onBack?: () => void;
}

export function PageBanner({ title, subtitle, src, alt, imageClassName = PAGE_BANNER_IMAGE, className, onBack }: PageBannerProps) {
  return (
    <TutorsBanner className={cn("h-banner-page", className)} src={src} alt={alt} imageClassName={imageClassName}>
      <div className={cn("absolute w-2/3", onBack ? "left-1.5 top-5 flex items-center gap-1 lg:left-sheet-pad lg:top-6" : "left-sheet-pad top-6")}>
        {onBack && <BackButton onClick={onBack} className="lg:hidden" data-testid="back-button" />}
        <div>
          <h1 className="text-heading font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-body text-gray-700">{subtitle}</p>}
        </div>
      </div>
    </TutorsBanner>
  );
}
