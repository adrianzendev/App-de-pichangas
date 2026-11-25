// Limpieza de lo que se guarda en error_logs. Funciones puras, sin acceso a la base ni a Express: las usa
// error-logger.ts y las prueba tests/error-logger.test.ts.

export const ROUTE_MAX = 300;

/** Quita lo que no debe quedar en la base: correos, JWT, cadenas de conexion, secretos y numeros largos (telefonos, ids). */
export function redact(text: string): string {
  return text
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[db-url]")
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[jwt]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\b(password|passwd|token|secret|api[_-]?key|authorization|cookie)(["']?\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s,;&]+)/gi, "$1$2[redacted]")
    .replace(/\b\d{9,}\b/g, "[num]");
}

/** Ruta sin query string ni hash: la query puede llevar tokens (reset de contrasena, OAuth). */
export function routeOf(url: string): string {
  return url.split(/[?#]/)[0].slice(0, ROUTE_MAX);
}
