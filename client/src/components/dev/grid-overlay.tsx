import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const GRID_STORAGE_KEY = "dev-grid-overlay";
const BORDERS_STORAGE_KEY = "dev-borders-overlay";
const WIDTHS_STORAGE_KEY = "dev-widths-overlay";
const COLUMNS = Array.from({ length: 12 });

interface Measured {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
  label: string;
}

function labelOf(el: HTMLElement) {
  const span = Array.from(el.classList).find((c) => c.includes("col-span"));
  return span ? span.replace(/^.*?:/g, "") : el.tagName.toLowerCase();
}

function measure(): Measured[] {
  const els = Array.from(
    new Set(document.querySelectorAll<HTMLElement>('.shell-grid > *, .shell-grid [class*="col-span"]')),
  );
  return els.map((el, i) => {
    const r = el.getBoundingClientRect();
    return {
      key: `${i}-${labelOf(el)}`,
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      label: `${labelOf(el)} · ${Math.round(r.width)}px`,
    };
  });
}

// Mide en vivo las secciones del layout (.shell-grid) y pinta un recuadro con su ancho en pixeles.
// Se remide al hacer scroll/resize y cada 200ms para capturar contenido que llega despues (React Query / rutas).
function WidthOverlay() {
  const [boxes, setBoxes] = useState<Measured[]>(() => measure());

  useEffect(() => {
    const update = () => setBoxes(measure());
    update();
    const timer = window.setInterval(update, 200);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-toast hidden lg:block">
      {boxes.map((b) => (
        <div
          key={b.key}
          className="absolute"
          style={{ left: b.left, top: b.top, width: b.width, height: b.height, outline: "1px solid var(--error)" }}
        >
          <span className="absolute left-0 top-0 whitespace-nowrap bg-error px-1 text-caption font-bold text-white">
            {b.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function useDevToggle(key: string) {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, on ? "1" : "0");
    } catch {
      /* sin almacenamiento: solo dura la sesion */
    }
  }, [key, on]);

  return [on, setOn] as const;
}

// Solo en desarrollo (se monta en App.tsx bajo import.meta.env.DEV). "Columnas" dibuja las 12 columnas del shell en rojo
// al 10%, "Bordes" perfila las columnas reales (col-span-N) y "Anchos" muestra el ancho en px de cada seccion del layout.
// Los tres botones van arriba a la derecha; el estado se recuerda en localStorage. Son utilidades de depuracion hechas a
// mano que solo reutilizan el Button compartido.
export function GridOverlay() {
  const [gridOn, setGridOn] = useDevToggle(GRID_STORAGE_KEY);
  const [bordersOn, setBordersOn] = useDevToggle(BORDERS_STORAGE_KEY);
  const [widthsOn, setWidthsOn] = useDevToggle(WIDTHS_STORAGE_KEY);

  return (
    <>
      {gridOn && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-toast hidden lg:block">
          <div className="mx-auto grid h-full w-full max-w-shell grid-cols-12 gap-6 px-6">
            {COLUMNS.map((_, i) => (
              <div key={i} className="h-full bg-error/10" />
            ))}
          </div>
        </div>
      )}
      {bordersOn && (
        <style>{`.shell-grid [class*="col-span"] { outline: 1px solid var(--error); }`}</style>
      )}
      {widthsOn && <WidthOverlay />}
      <div className="fixed right-4 top-4 z-toast hidden flex-col items-end gap-2 lg:flex">
        <Button type="button" variant="outline" size="sm" aria-pressed={gridOn} onClick={() => setGridOn((v) => !v)}>
          {gridOn ? "Columnas: on" : "Columnas: off"}
        </Button>
        <Button type="button" variant="outline" size="sm" aria-pressed={bordersOn} onClick={() => setBordersOn((v) => !v)}>
          {bordersOn ? "Bordes: on" : "Bordes: off"}
        </Button>
        <Button type="button" variant="outline" size="sm" aria-pressed={widthsOn} onClick={() => setWidthsOn((v) => !v)}>
          {widthsOn ? "Anchos: on" : "Anchos: off"}
        </Button>
      </div>
    </>
  );
}
