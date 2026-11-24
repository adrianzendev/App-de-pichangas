/**
 * Media query en la que Mensajes muestra lista + conversacion lado a lado (split) en vez de la
 * lista sola que navega a /chat-fullscreen: escritorio (>=1024px) o tablet (>=768px de ancho y
 * >=600px de alto). Debe coincidir con las clases `tablet:` (tailwind.config.ts) y `lg:` que
 * pintan el split en `home.tsx`; la usan los guards en JS (`useMediaQuery` / `matchMedia`).
 */
import { MQ } from "./breakpoints";

export const MESSAGES_SPLIT_QUERY = `${MQ.lg}, ${MQ.tablet}`;
