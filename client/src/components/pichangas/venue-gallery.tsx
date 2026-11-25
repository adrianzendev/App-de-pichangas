import { useRef, useState } from "react";
import { DEFAULT_COVER } from "@/lib/pichangas";
import { cn } from "@/lib/utils";

export interface VenueGalleryProps {
  venue: { photos?: string[] | null };
  alt?: string;
  className?: string;
}

// Fotos de la cancha en un carrusel (desliza o toca los puntos). Con una sola foto, o ninguna (portada por defecto),
// no hay puntos.
export function VenueGallery({ venue, alt = "", className }: VenueGalleryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const photos = (venue.photos ?? []).filter((src) => Boolean(src) && !failed.has(src));
  const slides = photos.length > 0 ? photos : [DEFAULT_COVER];

  // Arrastre con mouse (el dedo ya desliza solo): mientras se arrastra se apaga el snap y al soltar se asienta en la foto mas cercana.
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  // Un arrastre termina en un "click": se ignora para que no cuente como clic en el costado.
  const justDragged = useRef(false);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = e.currentTarget;
    drag.current = { x: e.clientX, left: el.scrollLeft, moved: false };
    el.style.scrollSnapType = "none";
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.x) > 3) d.moved = true;
    e.currentTarget.scrollLeft = d.left - (e.clientX - d.x);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const el = e.currentTarget;
    justDragged.current = drag.current.moved;
    drag.current = null;
    el.style.scrollSnapType = "";
    el.scrollTo({ left: Math.round(el.scrollLeft / el.clientWidth) * el.clientWidth, behavior: "smooth" });
  };

  // Clic en el costado (20% izquierdo / derecho) = foto anterior / siguiente.
  // Dentro de una tarjeta clicable (feed): arrastrar y tocar los costados cambian de foto sin abrir el detalle; el centro si lo abre.
  const onEdgeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (justDragged.current) { justDragged.current = false; e.stopPropagation(); return; }
    if (slides.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (x < 0.2) { e.stopPropagation(); goTo(Math.max(0, active - 1)); }
    else if (x > 0.8) { e.stopPropagation(); goTo(Math.min(slides.length - 1, active + 1)); }
  };

  const goTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={onEdgeClick}
        onScroll={(e) => {
          const el = e.currentTarget;
          setActive(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="flex h-full snap-x snap-mandatory overflow-x-auto cursor-grab active:cursor-grabbing select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={slides.length > 1 ? `${alt} (${i + 1} de ${slides.length})` : alt}
            draggable={false}
            loading={i === 0 ? "eager" : "lazy"}
            onError={() => setFailed((prev) => new Set(prev).add(src))}
            className="h-full w-full shrink-0 snap-center object-cover"
            style={src === DEFAULT_COVER ? { objectPosition: "50% 62%" } : undefined}
          />
        ))}
      </div>
      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2" role="tablist" aria-label="Fotos de la cancha">
          {slides.map((src, i) => (
            <button
              key={src}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Foto ${i + 1} de ${slides.length}`}
              onClick={(e) => { e.stopPropagation(); goTo(i); }}
              className={cn("size-2 rounded-full transition-colors duration-fast", i === active ? "bg-white" : "bg-white/50 hover:bg-white/80")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
