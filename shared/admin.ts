// Cuenta administradora principal. Unico lugar donde vive el correo: el servidor lo compara con
// `session.user.email` para las rutas de admin (alertas, filtros de contacto, escaneos, pagos manuales).
export const MAIN_ADMIN_EMAIL = "admin@miltareas.com";

// Super admin = la cuenta administradora principal (puede impersonar usuarios). Si algun dia hay varios,
// cambiar solo esta funcion (p. ej. a una columna `role`).
export const isSuperAdmin = (email?: string | null): boolean => email === MAIN_ADMIN_EMAIL;
