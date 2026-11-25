import type { ReactNode } from "react";
import { PageBanner } from "@/components/ui/tutors-banner";
import { ListHeader, type ListHeaderSearch } from "@/components/ui/list-header";
import { useMediaQuery } from "@/hooks/use-media-query";
import { MQ } from "@/lib/breakpoints";
import { cn } from "@/lib/utils";

interface PageBannerSheetProps {
  title: string;
  subtitle?: string;
  /** Imagen propia del banner (Publicar); sin ella, la de tutores. */
  src?: string;
  alt?: string;
  imageClassName?: string;
  /** Flecha de regreso en movil (ver PageBanner / ListHeader). */
  onBack?: () => void;
  /** Sin portada en movil/tablet (<lg): el titulo, la lupa y los filtros pasan a la hoja blanca (`ListHeader`). Desde `lg` se ve el banner como siempre. */
  hideBannerOnMobile?: boolean;
  /** Sin portada tampoco desde `lg`: hoja blanca plana con el titulo visible (Publicar). Implica `hideBannerOnMobile`. */
  noBanner?: boolean;
  /** Buscador: en <lg lo despliega la lupa del titulo; desde `lg` va siempre visible. Solo con `hideBannerOnMobile`. */
  search?: ListHeaderSearch;
  /** Filtros y acciones: van en la hoja blanca que sube sobre el banner. */
  children: ReactNode;
}

// Cabecera de las pantallas de lista (Tutores, Pedidos) y de Publicar: `PageBanner` + hoja blanca con
// `shadow-float` (unica "tarjeta" con sombra: es una capa que se superpone a la imagen).
// Movil: a sangre (sin margenes laterales ni superior), como AuthShell; desde `lg` vuelve a ser tarjeta redondeada.
// Con `hideBannerOnMobile` no hay imagen que superponer: en <lg la hoja es plana (sin solape, esquinas, sombra ni relleno: el `Container` de la pantalla
// ya pone `py-page-top` y `px-page-h`) y lleva un `ListHeader`. Clases literales y condicionales (no `mt-0` sobre `-mt-sheet-overlap`): tailwind-merge no conoce ese token.
export function PageBannerSheet({ title, subtitle, src, alt, imageClassName, onBack, hideBannerOnMobile = false, noBanner = false, search, children }: PageBannerSheetProps) {
  const isDesktop = useMediaQuery(MQ.lg);
  const hideMobile = hideBannerOnMobile || noBanner;
  const banner = <PageBanner title={title} subtitle={subtitle} src={src} alt={alt} imageClassName={imageClassName} onBack={onBack} />;
  return (
    <div className={cn("rounded-none lg:mx-0 lg:mt-0", hideMobile ? "lg:overflow-hidden" : "overflow-hidden", !noBanner && "lg:rounded-xl lg:border lg:border-gray-200", hideMobile ? (noBanner ? "bg-white" : "bg-white lg:bg-primary-100") : "-mx-page-h -mt-page-top bg-primary-100")}>
      {noBanner ? null : hideMobile ? <div className="hidden lg:block">{banner}</div> : banner}
      <div className={cn(
        "relative flex flex-col gap-4 bg-white",
        noBanner ? "p-0" : hideMobile ? "p-0 lg:p-sheet-pad lg:-mt-sheet-overlap lg:rounded-t-xl lg:shadow-float" : "p-sheet-pad -mt-sheet-overlap rounded-t-xl shadow-float"
      )}>
        {hideMobile ? (
          <ListHeader title={title} subtitle={subtitle} onBack={onBack} search={search} searchAlwaysOpen={isDesktop} hideTitleOnDesktop={!noBanner}>
            {children}
          </ListHeader>
        ) : children}
      </div>
    </div>
  );
}
