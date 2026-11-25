import { PAGE_SHEET_BORDERED } from "@/components/ui/list-screen";
import { useLocation } from "wouter";
import { Container } from "@/components/ui/Container";
import { BackButton } from "@/components/ui/back-button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { useAccountActions } from "@/components/account/use-account-actions";

// Pantalla /account (movil/tablet): lo que abre tocar la foto de perfil. Todo blanco, sin tarjetas ni chevrons
// (estilo WhatsApp). En escritorio la cuenta es un popover (ProfileMenuButton); esta ruta tambien se ve ahi como hoja.
export default function AccountSection() {
  const [, setLocation] = useLocation();
  const { user, roleLabel, actions } = useAccountActions();

  return (
    <Container fullWidth className="py-page-top space-y-section-gap">
      {/* Mismo borde y alto que las demas hojas: a sangre en movil, tarjeta desde lg */}
      <div className={PAGE_SHEET_BORDERED}>
        <div className="-mt-1 flex items-center gap-2">
          <BackButton onClick={() => setLocation("/")} data-testid="back-button" />
          <h1 className="text-heading font-bold text-gray-900">Cuenta</h1>
        </div>

        <section className="flex flex-col items-center gap-2 py-6 text-center" aria-label="Tu cuenta">
          <UserAvatar name={user?.name || "Usuario"} avatar={user?.avatar || undefined} size="xl" />
          <h2 className="mt-1 text-subheading font-semibold text-gray-900">{user?.name || "Usuario"}</h2>
          <p className="text-body text-gray-700">{roleLabel}</p>
        </section>

        <nav aria-label="Cuenta">
          <ul className="flex flex-col">
            {actions.map((a) => (
              <li key={a.id} className={cn(a.danger && "mt-2")}>
                <button
                  type="button"
                  onClick={a.onSelect}
                  data-testid={`account-${a.testId}`}
                  className={cn(
                    "flex h-account-row w-full items-center gap-4 rounded-md px-3 text-left text-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    a.danger ? "text-error-fg hover:bg-error-bg hover:text-error-strong active:bg-error-bg active:text-error-strong" : "text-gray-900 hover:bg-gray-50 active:bg-gray-50"
                  )}
                >
                  <a.icon className="size-icon-badge shrink-0" aria-hidden />
                  {a.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </Container>
  );
}
