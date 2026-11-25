import { useCallback, useEffect, useRef, useState } from "react";

// Emisor: avisa mientras se teclea (latido cada HEARTBEAT_MS) y manda stop tras IDLE_MS sin teclear.
// Receptor: oculta el indicador si no llega senal en EXPIRE_MS (EXPIRE > HEARTBEAT para no parpadear).
const IDLE_MS = 3000;
const HEARTBEAT_MS = 2500;
const EXPIRE_MS = 6000;

/**
 * Logica del "Escribiendo..." de una conversacion (emision y recepcion por WebSocket).
 *
 * @param {string} peerId - Id de la otra persona del chat.
 * @param {(receiverId: string, isTyping: boolean) => void} sendTyping - Emisor del socket (`useWebSocketFixed`).
 * @returns {{ otherTyping: boolean, notifyTyping: () => void, stopMyTyping: () => void }}
 *   `otherTyping`: la otra persona esta redactando. `notifyTyping`: llamar en cada cambio del input
 *   con texto. `stopMyTyping`: al vaciar el input o enviar.
 */
export function useTypingIndicator(peerId: string, sendTyping: (receiverId: string, isTyping: boolean) => void) {
  const [otherTyping, setOtherTyping] = useState(false);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iAmTypingRef = useRef(false);
  const lastSentRef = useRef(0);

  const stopMyTyping = useCallback(() => {
    if (idleRef.current) { clearTimeout(idleRef.current); idleRef.current = null; }
    if (iAmTypingRef.current && peerId) sendTyping(peerId, false);
    iAmTypingRef.current = false;
  }, [sendTyping, peerId]);

  const notifyTyping = useCallback(() => {
    if (!peerId) return;
    const now = Date.now();
    if (!iAmTypingRef.current || now - lastSentRef.current > HEARTBEAT_MS) {
      iAmTypingRef.current = true;
      lastSentRef.current = now;
      sendTyping(peerId, true);
    }
    if (idleRef.current) clearTimeout(idleRef.current);
    idleRef.current = setTimeout(stopMyTyping, IDLE_MS);
  }, [sendTyping, stopMyTyping, peerId]);

  useEffect(() => {
    const onWs = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      if (msg?.userId !== peerId && msg?.senderId !== peerId) return;
      if (msg?.type === "typing_start") {
        setOtherTyping(true);
        if (expireRef.current) clearTimeout(expireRef.current);
        expireRef.current = setTimeout(() => setOtherTyping(false), EXPIRE_MS);
      } else if (msg?.type === "typing_stop" || msg?.type === "new_message") {
        setOtherTyping(false);
      }
    };
    window.addEventListener("websocket_message", onWs);
    return () => {
      window.removeEventListener("websocket_message", onWs);
      if (expireRef.current) clearTimeout(expireRef.current);
      stopMyTyping();
    };
  }, [peerId, stopMyTyping]);

  return { otherTyping, notifyTyping, stopMyTyping };
}

/**
 * Ids de TODAS las personas que estan redactando ahora (para la lista de chats, donde hay
 * varias conversaciones a la vez). Cada id expira a los EXPIRE_MS sin senal.
 *
 * @returns {Set<string>} Ids que estan escribiendo.
 */
export function useTypingPeers(): Set<string> {
  const [peers, setPeers] = useState<Set<string>>(new Set());
  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const remove = (id: string) => {
      const t = timers.get(id);
      if (t) clearTimeout(t);
      timers.delete(id);
      setPeers((prev) => { if (!prev.has(id)) return prev; const n = new Set(prev); n.delete(id); return n; });
    };
    const onWs = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      if (msg?.type === "typing_start" && msg.userId) {
        const t = timers.get(msg.userId);
        if (t) clearTimeout(t);
        timers.set(msg.userId, setTimeout(() => remove(msg.userId), EXPIRE_MS));
        setPeers((prev) => (prev.has(msg.userId) ? prev : new Set(prev).add(msg.userId)));
      } else if (msg?.type === "typing_stop" && msg.userId) {
        remove(msg.userId);
      } else if (msg?.type === "new_message" && msg.senderId) {
        remove(msg.senderId);
      }
    };
    window.addEventListener("websocket_message", onWs);
    return () => {
      window.removeEventListener("websocket_message", onWs);
      timers.forEach(clearTimeout);
    };
  }, []);
  return peers;
}
