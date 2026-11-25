import { ROUTES } from "@/lib/routes";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

// Boton flotante "Publicar" (solo movil/tablet, `lg:hidden`), solo texto como el del sidebar de escritorio: abajo a la derecha, justo sobre la barra inferior.
// Va en el shell de `home.tsx` para todas las pantallas del alumno salvo /publish. En escritorio la accion
// vive en el sidebar y en la cabecera de cada pantalla. `hideOnTablet`: en Mensajes el split de tablet (lista + chat)
// pone el compositor en esa misma esquina y el boton taparia "Enviar".
export function PublishFab({ hideOnTablet = false }: { hideOnTablet?: boolean }) {
  const [, setLocation] = useLocation();
  return (
    <Button
      size="lg"
      onClick={() => setLocation(ROUTES.publish)}
      className={`fixed bottom-nav-dynamic right-page-h z-sticky mb-3 shadow-float lg:hidden${hideOnTablet ? " tablet:hidden" : ""}`}
      data-testid="fab-publish"
    >
      Publicar
    </Button>
  );
}
