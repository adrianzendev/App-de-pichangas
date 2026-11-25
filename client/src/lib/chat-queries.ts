import { queryClient } from "@/lib/queryClient";
import type { Message } from "@/components/chat/chat-types";

// Fuente unica de la query de mensajes de un hilo: la comparten el chat
// abierto (chat-fullscreen.tsx) y la precarga en segundo plano
// (messages-section.tsx). Misma key + mismo fetcher = el prefetch llena
// exactamente la cache que el chat lee al abrir.
export const threadMessagesKey = (threadId: string) =>
  ["/api/chat/threads", threadId, "messages"] as const;

// "Hay mensajes mas antiguos" vive en la cache (no en estado de componente)
// para que un hilo precargado, restaurado de IndexedDB o servido fresco sin
// fetch conserve el boton "Cargar anteriores". Empieza con /api/chat/ asi que
// el persister (App.tsx shouldDehydrateQuery) tambien lo guarda en disco.
export const hasMoreKey = (messagesKey: readonly unknown[]) => [...messagesKey, "hasMore"] as const;

export const setHasMoreCache = (messagesKey: readonly unknown[], hasMore: boolean) =>
  queryClient.setQueryData(hasMoreKey(messagesKey), hasMore);

// Los endpoints de mensajes devuelven `tasks` (pedidos citados, misma forma
// que GET /api/tasks/:id): se siembran en la cache de pedidos para que las
// tarjetas de cotizacion pinten sin esperar su propio fetch. Nunca pisa un
// dato ya cacheado (podria ser mas fresco).
export function seedTaskCache(tasks?: Record<string, unknown>) {
  if (!tasks) return;
  for (const [id, task] of Object.entries(tasks)) {
    const key = ["/api/tasks", id];
    if (queryClient.getQueryData(key) === undefined) queryClient.setQueryData(key, task);
  }
}

// GET de una pagina de mensajes + efectos sobre la cache (hasMore, pedidos).
export async function fetchMessagesPage(url: string, messagesKey: readonly unknown[]): Promise<Message[]> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    console.error("Failed to load messages:", response.status, response.statusText);
    throw new Error("Error loading messages");
  }
  const result = await response.json();
  setHasMoreCache(messagesKey, !!result.hasMore);
  seedTaskCache(result.tasks);
  return result.messages as Message[];
}

export const fetchThreadMessages = (threadId: string, limit = 20) =>
  fetchMessagesPage(`/api/chat/threads/${threadId}/messages?limit=${limit}`, threadMessagesKey(threadId));

// Fresco mas corto que el staleTime global: si el usuario abre el hilo justo
// despues, la query del chat decide (su propio staleTime de 20s) si revalida.
export const prefetchThreadMessages = (threadId: string) =>
  queryClient.prefetchQuery({
    queryKey: threadMessagesKey(threadId),
    queryFn: () => fetchThreadMessages(threadId),
    staleTime: 60_000,
  });

export function scheduleIdle(cb: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(cb, { timeout: 2000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(cb, 300);
  return () => window.clearTimeout(id);
}
