import { OutlinedControl } from "@/components/ui/outlined-field";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DELETE_CONFIRM_WORD, useDeleteAccount } from "@/components/account/use-delete-account";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/routes";
import type { UserWithType } from "@shared/schema";

// Pagina publica de "como eliminar tu cuenta" (URL que piden App Store y Google Play). Con sesion, el mismo formulario
// que el modal de Mi perfil (useDeleteAccount); sin sesion explica el proceso y lleva a iniciar sesion.
export default function DeleteAccountPage() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = useQuery<UserWithType | null>({ queryKey: ["/api/user/current"] });
  const del = useDeleteAccount();

  const goBack = () => (window.history.length > 1 ? window.history.back() : setLocation(ROUTES.root));

  return (
    <main className="min-h-dvh bg-white pb-12 pt-safe-top">
      <Container className="space-y-6 py-page-top">
        <div className="flex items-center gap-2">
          <BackButton onClick={goBack} />
          <h1 className="text-heading font-bold text-gray-900">Eliminar cuenta</h1>
        </div>

        <div className="space-y-2 text-body text-gray-700">
          <p>Al eliminar tu cuenta se borran tus datos personales: nombre, correo, teléfono, foto y los dispositivos con avisos activados. No podrás volver a entrar con ella.</p>
          <p>Los pedidos, pagos y mensajes compartidos con otra persona se conservan sin tu identidad, para no alterar su historial. Tus pedidos abiertos sin tutor se cancelan.</p>
          <p>No puedes eliminar la cuenta mientras tengas un pedido con pago o trabajo en curso.</p>
          <p>Con la sesión iniciada también puedes hacerlo desde Mi perfil, en «Ajustes de cuenta».</p>
        </div>

        {isLoading ? null : !user ? (
          <div className="space-y-3">
            <p className="text-body text-gray-700">Inicia sesión para eliminar tu cuenta.</p>
            <Button className="w-full" onClick={() => setLocation(ROUTES.login)} data-testid="button-login-to-delete">
              Iniciar sesión
            </Button>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              del.submit();
            }}
          >
            <OutlinedControl htmlFor="delete-confirmation" label={<>Escribe {DELETE_CONFIRM_WORD} para confirmar</>}>
              <Input
                id="delete-confirmation"
                value={del.confirmation}
                onChange={(e) => del.setConfirmation(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                placeholder={DELETE_CONFIRM_WORD}
                aria-invalid={!!del.error}
                data-testid="input-delete-confirmation"
              />
            </OutlinedControl>
            {del.error && (
              <p role="alert" className="text-body text-error-fg" data-testid="delete-account-error">
                {del.error}
              </p>
            )}
            <Button type="submit" variant="destructive" className="w-full" disabled={!del.canSubmit} data-testid="button-delete-account">
              {del.isPending ? "Eliminando…" : "Eliminar mi cuenta"}
            </Button>
          </form>
        )}
      </Container>
    </main>
  );
}
