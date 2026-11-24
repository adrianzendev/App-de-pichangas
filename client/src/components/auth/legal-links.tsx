import { Link } from "wouter";
import { ROUTES } from "@/lib/routes";

// Aviso de terminos y privacidad al pie de login y registro (las tiendas piden enlaces visibles antes de crear la cuenta).
export function LegalLinks() {
  const link = "font-medium text-green-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm";
  return (
    <p className="text-center text-caption text-gray-700" data-testid="legal-links">
      Al continuar aceptas los{" "}
      <Link href={ROUTES.terms} className={link}>Términos de servicio</Link>
      {" "}y la{" "}
      <Link href={ROUTES.privacy} className={link}>Política de privacidad</Link>.
    </p>
  );
}
