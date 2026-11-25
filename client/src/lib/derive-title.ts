// Titulo de un pedido a partir del texto unico "¿Que necesitas?" (metodo excerpt de Fiverr/Upwork):
// primera frase (hasta el primer salto de linea o punto), recortada a 60 caracteres en el limite de
// una palabra y con "..." si se omitio texto. La descripcion guarda el texto completo.
const MAX_TITLE = 60;
const MIN_TITLE = 10; // el esquema del formulario exige >= 10 caracteres

export function deriveTitle(text: string): string {
  const flat = text.trim().replace(/\s+/g, " ");
  if (!flat) return "";

  const firstLine = text.trim().split(/\r?\n/)[0].trim();
  const sentenceEnd = firstLine.search(/[.!?](\s|$)/);
  let candidate = (sentenceEnd >= 0 ? firstLine.slice(0, sentenceEnd) : firstLine).trim();
  // Una primera frase demasiado corta ("Hola.") no sirve de titulo: se usa el texto aplanado.
  if (candidate.length < MIN_TITLE) candidate = flat;

  if (candidate.length > MAX_TITLE) {
    const cut = candidate.slice(0, MAX_TITLE);
    const lastSpace = cut.lastIndexOf(" ");
    candidate = (lastSpace > MIN_TITLE ? cut.slice(0, lastSpace) : cut).trim();
  }

  candidate = candidate.replace(/[\s,;:.-]+$/, "");
  return candidate.length < flat.length ? `${candidate}...` : candidate;
}
