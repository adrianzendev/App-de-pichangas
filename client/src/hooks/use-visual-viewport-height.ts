import { useEffect, useState } from "react";

/**
 * Alto del viewport visual cuando el teclado virtual lo reduce; `null` si no hay teclado (o la API no existe).
 * iOS Safari no encoge el viewport de layout con el teclado y `dvh` no reacciona: el chat usa este alto para
 * que el composer no quede tapado. En Chrome Android lo cubre `interactive-widget=resizes-content` (index.html).
 * Con Capacitor lo reemplaza `Keyboard.resize` nativo: basta con dejar de pasar este valor al chat.
 */
export function useVisualViewportHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => setHeight(vv.height < window.innerHeight - 1 ? Math.round(vv.height) : null);
    sync();
    vv.addEventListener("resize", sync);
    return () => vv.removeEventListener("resize", sync);
  }, []);
  return height;
}
