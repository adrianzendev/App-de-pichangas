import { memo } from "react";
import { BUBBLE_OTHER_SURFACE } from "./chat-bubble-styles";

/**
 * Propiedades de {@link TypingIndicator}.
 */
export interface TypingIndicatorProps {
  /**
   * `label`: texto "Escribiendo" + puntos verdes (cabecera del chat).
   * `bubble`: burbuja blanca con tres puntos grises (final del historial).
   */
  variant?: "label" | "bubble";
}

// Retardo escalonado de cada punto (clases `delay-typing-*` de tailwind.config.ts).
const DELAY_CLASSES = ["", "delay-typing-1", "delay-typing-2"];

/**
 * Indicador visual de que la otra persona esta redactando: tres puntos que rebotan.
 * Solo presenta; la logica (eventos WS, tiempos) vive en `useTypingIndicator`.
 *
 * @param {TypingIndicatorProps} props - Variante visual.
 * @returns {JSX.Element} El indicador.
 */
export const TypingIndicator = memo(function TypingIndicator({ variant = "label" }: TypingIndicatorProps) {
  if (variant === "bubble") {
    return (
      <div className="flex justify-start" role="status" aria-label="Escribiendo">
        <div className={`${BUBBLE_OTHER_SURFACE} rounded-lg rounded-tl-xs px-4 py-3 flex items-center gap-1`}>
          {DELAY_CLASSES.map((d, i) => (
            <span key={i} className={`size-typing-dot-md rounded-full bg-gray-700 animate-bounce ${d}`} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <span className="text-body text-green-700 font-medium flex items-center gap-1.5" aria-live="polite">
      Escribiendo
      <span className="flex items-center gap-0.5" aria-hidden>
        {DELAY_CLASSES.map((d, i) => (
          <span key={i} className={`size-typing-dot-sm rounded-full bg-green-600 animate-bounce ${d}`} />
        ))}
      </span>
    </span>
  );
});
