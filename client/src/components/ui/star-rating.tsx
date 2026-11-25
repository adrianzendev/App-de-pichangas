import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAR_FILLED } from "@/components/ui/rating-stars";

interface StarRatingProps {
  /** Calificacion actual (0 = sin elegir). */
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

// Selector de 1 a 5 estrellas (reseñas). Cada estrella es un boton de 40px con foco visible y `aria-label`;
// al pasar el cursor se previsualiza la nota. Las llenas usan `STAR_FILLED` (verde), las vacias `gray-200`.
export function StarRating({ value, onChange, className }: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div role="radiogroup" aria-label="Calificación" className={cn("flex justify-center gap-1", className)} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} ${star === 1 ? "estrella" : "estrellas"}`}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          className="flex size-touch items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Star className={cn("h-8 w-8 transition-colors", star <= shown ? STAR_FILLED : "fill-gray-200 text-gray-200")} />
        </button>
      ))}
    </div>
  );
}
