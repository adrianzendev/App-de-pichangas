import { useEffect, useState } from "react";

/**
 * Escucha una media query CSS y devuelve si coincide ahora. El valor inicial se lee de forma
 * sincrona (`matchMedia`), asi que en el primer render ya es el correcto y no hay un frame
 * "equivocado" antes de reaccionar al viewport.
 *
 * @param {string} query - Media query, p. ej. `"(min-width: 1024px)"`.
 * @returns {boolean} `true` si la query coincide con el viewport actual.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
