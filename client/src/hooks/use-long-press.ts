import { useCallback, useRef, type TouchEvent } from "react";

/** Milisegundos de pulsacion sostenida para disparar el long press. */
const LONG_PRESS_MS = 500;
/** Desplazamiento (px) a partir del cual el gesto es scroll/arrastre y se cancela. */
const MOVE_TOLERANCE_PX = 10;

/**
 * Handlers tactiles devueltos por {@link useLongPress}.
 */
export interface LongPressHandlers {
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  /**
   * Capturar el `click` que el navegador emite al soltar tras un long press, para
   * que no active (p. ej.) la imagen que hay debajo. Pasar como `onClickCapture`.
   */
  onClickCapture: (e: React.MouseEvent) => void;
}

/**
 * Detecta una pulsacion larga (~500 ms) en pantallas tactiles. Se cancela si el dedo
 * se desplaza (scroll normal del chat), se levanta antes o el toque se interrumpe.
 * Al cumplirse llama a `onLongPress` con las coordenadas del toque.
 *
 * Nota: los listeners tactiles de React son pasivos, por eso no se llama a
 * `preventDefault()`; el menu nativo del sistema y la seleccion de texto se
 * evitan con CSS (`select-none` + `-webkit-touch-callout: none`).
 *
 * @param {(x: number, y: number) => void} onLongPress - Se ejecuta al cumplirse el tiempo, con clientX/clientY.
 * @returns {LongPressHandlers} Handlers para esparcir sobre el contenedor.
 */
export function useLongPress(onLongPress: (x: number, y: number) => void): LongPressHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);

  return {
    onTouchStart: (e) => {
      const t = e.touches[0];
      if (!t || e.touches.length > 1) return cancel();
      fired.current = false;
      start.current = { x: t.clientX, y: t.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        fired.current = true;
        onLongPress(start.current?.x ?? t.clientX, start.current?.y ?? t.clientY);
      }, LONG_PRESS_MS);
    },
    onTouchMove: (e) => {
      const t = e.touches[0];
      const s = start.current;
      if (!t || !s) return;
      if (Math.hypot(t.clientX - s.x, t.clientY - s.y) > MOVE_TOLERANCE_PX) cancel();
    },
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    onClickCapture: (e) => {
      if (fired.current) {
        fired.current = false;
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };
}
