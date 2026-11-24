import type { ReactNode } from "react";
import { ThreeColumnLayout } from "@/components/layout/three-column-layout";

/**
 * Layout de Mensajes dentro del shell de `home.tsx`: lista de chats de ancho fijo (320-380px) +
 * chat activo `1fr`. Atajo de `ThreeColumnLayout` con `preset="chat-heavy"` y
 * `breakpoint="tablet"` (tablet o escritorio; sin sidebar: ya lo pone el shell).
 *
 * En tablet (<1024px) el shell sigue mostrando Header y la barra inferior, asi que el split
 * ocupa el alto de la pantalla menos ambos (62px de header + `--spacing-bottom-nav`); desde
 * `lg:` el shell es de una sola pantalla y el split llena el `<main>` (`h-full`): con `h-dvh` desbordaba el alto
 * del header + padding del shell y, al enfocar el campo de mensaje, el navegador desplazaba el `<main>`.
 */
export function ChatSplitLayout({ list, detail }: { list: ReactNode; detail: ReactNode }) {
  return (
    <ThreeColumnLayout
      preset="chat-heavy"
      breakpoint="tablet"
      className="tablet:h-chat-split lg:h-full"
      list={list}
      detail={detail}
    />
  );
}
