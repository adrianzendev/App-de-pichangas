import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { logout } from "@/lib/logout";
import { apiRequest } from "@/lib/queryClient";

export const DELETE_CONFIRM_WORD = "ELIMINAR";

// apiRequest lanza `${status}: ${cuerpo}`; el servidor manda { message } y el usuario debe leer eso.
function serverMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  try {
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"))) as { message?: string };
    if (parsed.message) return parsed.message;
  } catch { /* texto plano */ }
  return "No se pudo eliminar la cuenta. Inténtalo de nuevo.";
}

/**
 * Eliminacion de la propia cuenta (DELETE /api/user/account) con la palabra de confirmacion. La usan el modal del perfil
 * y la pagina publica /delete-account: una sola logica. Al terminar cierra sesion y limpia el dispositivo (`logout`).
 */
export function useDeleteAccount() {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/user/account", { confirmation }),
    onSuccess: () => void logout(), // la sesion ya no existe en el servidor
    onError: (e) => setError(serverMessage(e)),
  });

  const canSubmit = confirmation === DELETE_CONFIRM_WORD && !mutation.isPending;

  return {
    confirmation,
    setConfirmation: (value: string) => { setConfirmation(value); setError(""); },
    error,
    canSubmit,
    isPending: mutation.isPending,
    submit: () => { if (canSubmit) { setError(""); mutation.mutate(); } },
    reset: () => { setConfirmation(""); setError(""); },
  };
}
