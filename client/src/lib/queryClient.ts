import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";

/**
 * Mensaje de error legible para una respuesta no-OK. Si el cuerpo es HTML (p.ej. la pagina
 * "502 Bad gateway" de Cloudflare cuando el servidor no responde) NO se muestra el HTML crudo
 * al usuario: se devuelve un texto en espanol. Si no es HTML: `${prefix}${cuerpo}`.
 *
 * @param {Response} res - Respuesta con `ok === false`.
 * @param {string} prefix - Prefijo para errores de texto plano/JSON (p.ej. `"404: "`).
 * @returns {Promise<string>} Texto apto para `new Error(...)` y toasts.
 */
export async function responseErrorMessage(res: Response, prefix = `${res.status}: `): Promise<string> {
  const text = (await res.text().catch(() => "")) || res.statusText;
  const isHtml = /^\s*<(!doctype|html|head|body)/i.test(text) || (res.headers.get("content-type") || "").includes("text/html");
  if (!isHtml) return `${prefix}${text}`;
  return res.status >= 502 && res.status <= 504 || (res.status >= 520 && res.status <= 530)
    ? "El servidor no responde en este momento. Intenta de nuevo en unos minutos."
    : "No se pudo completar la solicitud. Intenta de nuevo.";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    throw new Error(await responseErrorMessage(res));
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};

  let body: string | FormData | undefined;
  
  if (data instanceof FormData) {
    body = data;
  } else if (data) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(data);
  }

  const res = await fetch(url, {
    method,
    headers,
    body,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const queryKeyStr = queryKey.join("/");
    
    try {
      const res = await fetch(queryKeyStr as string, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        // A 401 right after login can be a transient session-store race,
        // not a real logout — confirm once more before giving up, since
        // callers treat null as "confirmed logged out" and redirect on it.
        if (queryKeyStr === "/api/user/current") {
          await new Promise((r) => setTimeout(r, 400));
          const retryRes = await fetch(queryKeyStr, { credentials: "include" });
          if (retryRes.ok) {
            const data = await retryRes.json();
            localStorage.setItem('cached_user_session', JSON.stringify(data));
            return data;
          }
          localStorage.removeItem('cached_user_session');
        }
        return null;
      }

      await throwIfResNotOk(res);
      const data = await res.json();
      
      // Cache user data for offline resilience
      if (queryKeyStr === "/api/user/current" && data) {
        localStorage.setItem('cached_user_session', JSON.stringify(data));
      }
      
      return data;
    } catch (error) {
      // Network error (no WiFi, offline, etc.)
      // For user/current, return cached session instead of failing
      if (queryKeyStr === "/api/user/current") {
        const cachedUser = localStorage.getItem('cached_user_session');
        if (cachedUser) {
          console.debug('[SESSION] Using cached session due to network error');
          return JSON.parse(cachedUser);
        }
      }
      // Re-throw for other queries
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }), // Don't throw on 401, return null
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 7 * 24 * 60 * 60 * 1000,
      retry: 1, // Allow one retry
      // Sin red la consulta se PAUSA (no falla ni reintenta: sin bucles que gasten bateria) y se
      // reanuda sola al volver la conexion (refetchOnReconnect). Estado de red: onlineManager.
      networkMode: "online",
    },
    mutations: {
      retry: false,
      // Igual que las consultas: una mutacion hecha sin red queda pausada (isPaused) y se envia al volver
      // la conexion. Un mensaje enviado offline se queda en "enviando" y no dispara onError hasta entonces.
      networkMode: "online",
    },
  },
});

export const persister = createAsyncStoragePersister({
  storage: { getItem: get, setItem: set, removeItem: del },
});
