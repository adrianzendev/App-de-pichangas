import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "dev-grid-overlay";
const COLUMNS = Array.from({ length: 12 });

// Solo en desarrollo (se monta en App.tsx bajo import.meta.env.DEV) y desde lg: dibuja las 12 columnas del shell de
// escritorio en rojo al 10% para revisar alineaciones. Mismo contenedor que home.tsx: max-w-shell + px-6, separacion gap-6.
// El boton (arriba a la derecha) lo enciende/apaga; el estado se recuerda en localStorage.
export function GridOverlay() {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
    } catch {
      /* sin almacenamiento: solo dura la sesion */
    }
  }, [on]);

  return (
    <>
      {on && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-toast hidden lg:block">
          <div className="mx-auto grid h-full w-full max-w-shell grid-cols-12 gap-6 px-6">
            {COLUMNS.map((_, i) => (
              <div key={i} className="h-full bg-error/10" />
            ))}
          </div>
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={on}
        onClick={() => setOn((v) => !v)}
        className="fixed right-4 top-4 z-toast hidden lg:inline-flex"
      >
        {on ? "Columnas: on" : "Columnas: off"}
      </Button>
    </>
  );
}
