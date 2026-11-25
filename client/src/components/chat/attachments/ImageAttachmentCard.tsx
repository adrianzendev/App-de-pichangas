import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ClickableMedia } from "../clickable-media";
import { Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { CHAT_IMAGE_INLINE_MAX_W, CHAT_IMAGE_MAX_H, CHAT_IMAGE_MAX_W, thumbnailUrl } from "./attachment-utils";

/** Dimensiones naturales ya vistas, por URL: al re-montar la fila (virtualizacion) la caja nace con su tamano final. */
const imageSizeCache = new Map<string, { w: number; h: number }>();

/**
 * Caja reservada para la imagen. Con dimensiones conocidas replica el ajuste
 * `max-w` x `max-h-thumb` sin ampliar mas alla del tamano natural; sin ellas
 * (primera carga) reserva 4:3 al ancho maximo hasta que `onLoad` informe el real.
 */
function reservedBox(size: { w: number; h: number } | undefined, maxW: number) {
  if (!size) return { width: maxW, aspectRatio: "4 / 3" };
  const width = Math.min(maxW, CHAT_IMAGE_MAX_H * (size.w / size.h), size.w);
  return { width, aspectRatio: `${size.w} / ${size.h}` };
}

/**
 * Propiedades de {@link ImageAttachmentCard}.
 */
export interface ImageAttachmentCardProps {
  /** URL de la imagen (http o `blob:` mientras se envia). */
  src: string;
  /** El mensaje es del usuario actual. */
  isCurrentUser: boolean;
  /** El mensaje aun se esta enviando: imagen tenue + spinner en lugar del boton de descarga. */
  isSending: boolean;
  /** El receptor ya descargo el archivo (muestra "Descargado"). */
  downloaded?: boolean;
  /**
   * La imagen es el unico contenido de la burbuja: se pinta de borde a borde
   * (sin esquinas propias) y los controles pasan arriba para dejar libre la
   * esquina inferior derecha a la hora.
   */
  fill?: boolean;
  /** Hora + checks; con `fill` flotan sobre un badge translucido (`backdrop-blur-sm`). */
  footer?: ReactNode;
  /** Dimensiones guardadas por el servidor: la caja nace con su proporcion final (sin salto al cargar). */
  dims?: { w: number; h: number } | null;
  /** Clic en la imagen (abre el visor a pantalla completa). */
  onOpen: () => void;
  /** La imagen no se pudo decodificar (el adjunto no era imagen). */
  onError: () => void;
}

/**
 * Tarjeta de imagen para la burbuja del chat. Con `fill` la imagen ocupa la
 * burbuja completa (max. 300 px de ancho, sin marco ni relleno) y la hora y los
 * checks flotan en la esquina inferior derecha sobre un badge `bg-black/40`.
 * Sin `fill` (imagen junto a texto u otros adjuntos) conserva esquinas
 * redondeadas y fondo suave. Siempre muestra la imagen completa (`object-contain`).
 * Reserva su caja (aspect-ratio + skeleton) antes de cargar para que la fila del
 * chat no cambie de alto cuando llega la imagen.
 *
 * @param {ImageAttachmentCardProps} props - Fuente, estado de envio y callbacks.
 * @returns {JSX.Element} La imagen con sus controles superpuestos.
 */
export function ImageAttachmentCard({
  src, isCurrentUser, isSending, downloaded, fill, footer, dims, onOpen, onError,
}: ImageAttachmentCardProps) {
  const [size, setSize] = useState(() => imageSizeCache.get(src) ?? dims ?? undefined);
  const [loaded, setLoaded] = useState(() => imageSizeCache.has(src));
  const maxW = fill ? CHAT_IMAGE_MAX_W : CHAT_IMAGE_INLINE_MAX_W;

  // Doble buffer: al cambiar `src` (el blob: local pasa a la URL del servidor al confirmarse el
  // envio) se sigue mostrando la imagen actual hasta que la nueva este decodificada: sin parpadeo.
  const target = thumbnailUrl(src);
  const [shown, setShown] = useState(target);
  useEffect(() => {
    if (target === shown) return;
    let alive = true;
    const next = new Image();
    next.src = target;
    next.decode().catch(() => {}).then(() => { if (alive) setShown(target); });
    return () => { alive = false; };
  }, [target, shown]);

  const markLoaded = useCallback((img: HTMLImageElement) => {
    if (!img.naturalWidth || !img.naturalHeight) return;
    const natural = { w: img.naturalWidth, h: img.naturalHeight };
    imageSizeCache.set(src, natural);
    setSize(natural);
    setLoaded(true);
  }, [src]);

  // ref callback: si la imagen ya estaba en cache del navegador, `onLoad` puede no volver a dispararse.
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) markLoaded(img);
  }, [markLoaded]);

  return (
    <div
      className={`relative max-w-full ${fill ? "" : "bg-scrim/5 rounded-xl overflow-hidden"}`}
      style={reservedBox(size, maxW)}
    >
      {!loaded && <Skeleton className="absolute inset-0 rounded-none bg-gray-300" aria-hidden="true" />}
      <ClickableMedia aria-label="Abrir imagen" onClick={onOpen} className="h-full w-full">
        <img
          ref={imgRef}
          src={shown}
          alt="Imagen adjunta"
          loading="lazy"
          decoding="async"
          className={`block h-full w-full object-contain ${isSending ? "opacity-60" : ""}`}
          onLoad={(e) => markLoaded(e.currentTarget)}
          onError={onError}
        />
      </ClickableMedia>
      {isSending && (
        <div className="absolute top-2 right-2 p-2 rounded-full bg-scrim/50 text-white backdrop-blur-sm shadow-float">
          <Spinner size="xs" className="border text-white" />
        </div>
      )}
      {!isCurrentUser && downloaded && (
        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-scrim/50 rounded-full px-2 py-0.5">
          <Check className="size-icon-sm text-primary-300" />
          <span className="text-caption text-primary-300">Descargado</span>
        </div>
      )}
      {fill && footer && (
        <div className="absolute bottom-2 right-1.5 bg-scrim/40 backdrop-blur-sm rounded-full px-1.5 py-0.5">
          {footer}
        </div>
      )}
    </div>
  );
}
