import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export interface AuthUrlResult {
  session: Session | null;
  /** `type` del enlace (signup, recovery...), del query o del hash. */
  type: string | null;
  /** El proveedor devolvio un error (usuario cancelo o denego). */
  error: string | null;
  /** Habia un `code` y no se pudo intercambiar (vencido, ya usado o sin verificador en este dispositivo). */
  exchangeFailed: boolean;
}

// Un `code` PKCE es de un solo uso y StrictMode corre el efecto dos veces: se comparte la misma promesa.
const exchanges = new Map<string, Promise<AuthUrlResult>>();

/**
 * Completa la sesion a partir de la URL de retorno de Supabase (login con Google, correo de registro o de recuperacion).
 *
 * - Web: Supabase ya intercambio el `?code` al cargar (`detectSessionInUrl`); `getSession()` espera esa
 *   inicializacion, asi que aqui solo se lee la sesion resultante.
 * - Deep link nativo (`appUrlOpen`): la URL llega sin recargar la pagina, no hay intercambio automatico y se
 *   intercambia el `code` de forma explicita.
 * Solo se acepta `code` (PKCE): un `#access_token` recibido por deep link permitiria que otra app inicie la sesion
 * del usuario con la cuenta del atacante, asi que nunca se usa.
 */
export function completeAuthFromUrl(url: URL = new URL(window.location.href)): Promise<AuthUrlResult> {
  const code = url.searchParams.get("code");
  if (!code) return resolveAuth(url, null);
  const pending = exchanges.get(code);
  if (pending) return pending;
  const job = resolveAuth(url, code);
  exchanges.set(code, job);
  return job;
}

async function resolveAuth(url: URL, code: string | null): Promise<AuthUrlResult> {
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const type = hash.get("type") || url.searchParams.get("type");
  const error = url.searchParams.get("error") || hash.get("error");
  if (error) return { session: null, type, error, exchangeFailed: false };

  let { data: { session } } = await supabase.auth.getSession();
  if (!session && code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error) return { session: null, type, error: null, exchangeFailed: true };
    session = exchanged.data.session;
  }
  return { session, type, error: null, exchangeFailed: false };
}
