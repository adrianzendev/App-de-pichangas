// Alias publico de un cliente ("Cliente 31215"): estable por usuario, sin revelar su nombre. Lo usan las listas de pedidos para
// tutores y las reseñas del perfil publico (el nombre real y la foto del alumno no salen en ninguna respuesta publica).
export function getStudentAlias(userId: string): string {
  const hash = userId.replace(/-/g, "").substring(0, 8);
  const numericHash = parseInt(hash, 16) % 100000;
  return `Cliente ${numericHash.toString().padStart(5, "0")}`;
}
