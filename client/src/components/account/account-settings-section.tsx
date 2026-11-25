import { useState } from "react";
import { FileText, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";
import { ROUTES } from "@/lib/routes";

const LEGAL_LINKS = [
  { href: ROUTES.terms, label: "Términos de servicio", icon: FileText, testId: "link-terms" },
  { href: ROUTES.privacy, label: "Política de privacidad", icon: ShieldCheck, testId: "link-privacy" },
];

// Pie de Mi perfil (alumno y tutor): "Informacion y legales" y "Zona peligrosa". Viven aqui y no en el menu de cuenta,
// donde quedaban pegados a "Cerrar sesion" y se tocaban sin querer. Sin borde ni relleno de tarjeta: arrancan en el margen de pagina,
// alineadas con el formulario de arriba (las filas de enlaces se extienden -mx-3 para que su resalte al pasar el cursor no recorte el texto).
export function AccountSettingsSection() {
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <div className="space-y-section-gap">
      <section aria-labelledby="legal-info-title" className="bg-white" data-testid="legal-info">
        <h2 id="legal-info-title" className="text-subheading font-semibold text-gray-900">Información y legales</h2>
        <ul className="-mx-3 mt-2 flex flex-col">
          {LEGAL_LINKS.map(({ href, label, icon: Icon, testId }) => (
            <li key={href}>
              <Link
                href={href}
                data-testid={testId}
                className="flex h-account-row items-center gap-4 rounded-md px-3 text-body font-medium text-gray-900 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Icon className="size-icon-badge shrink-0 text-gray-700" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="danger-zone-title" className="bg-white" data-testid="danger-zone">
        <h2 id="danger-zone-title" className="text-subheading font-semibold text-error-fg">Eliminar cuenta</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body text-gray-700">Elimina tu cuenta y tus datos personales. Esta acción no se puede deshacer.</p>
          <Button
            type="button"
            variant="destructive-outline"
            className="shrink-0"
            onClick={() => setDeleteOpen(true)}
            data-testid="button-open-delete-account"
          >
            Eliminar cuenta
          </Button>
        </div>
        <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
      </section>
    </div>
  );
}
