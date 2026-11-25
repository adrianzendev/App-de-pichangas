import { useState, type RefObject } from "react";
import { Paperclip, Send } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { ChatIconButton } from "./chat-icon-button";

/**
 * Propiedades de {@link MessageComposer}.
 */
export interface MessageComposerProps {
  value: string;
  /** Cada cambio del texto. El padre conecta aqui el "Escribiendo..." (`useTypingIndicator`). */
  onChange: (value: string) => void;
  onSend: () => void;
  /** Abre el menu de adjuntos (camara / galeria / archivos). */
  onAttach: (trigger: HTMLElement) => void;
  /** Hay archivos seleccionados: permiten enviar aunque no haya texto. */
  hasFiles?: boolean;
  /** Envio en curso: deshabilita el boton y muestra spinner. */
  sending?: boolean;
  /** Ref del input, para que el padre le de foco al abrir la conversacion. */
  inputRef: RefObject<HTMLInputElement>;
}

/**
 * Area de redaccion: capsula (input + adjuntar) y boton de enviar.
 *
 * El input nace con `inputMode="none"`: el foco automatico muestra el cursor pero NO abre el teclado
 * virtual; al tocarlo pasa a `text` y reenfoca en el mismo gesto para que el teclado aparezca.
 * El borde verde de foco, de 2px (1px de borde + 1px de anillo interior: no cambia de tamano) y sin halo, va en la capsula (`focus-within`): el input interno no lleva borde propio.
 *
 * @param {MessageComposerProps} props - Texto, callbacks y estado de envio.
 * @returns {JSX.Element} El composer.
 */
export function MessageComposer({ value, onChange, onSend, onAttach, hasFiles = false, sending = false, inputRef }: MessageComposerProps) {
  const [keyboardOn, setKeyboardOn] = useState(false);
  const canSend = !!value.trim() || hasFiles;

  const enableKeyboard = () => {
    const el = inputRef.current;
    if (!el || el.inputMode === "text") return;
    setKeyboardOn(true);
    el.inputMode = "text";
    el.blur();
    el.focus();
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-field min-w-0 flex-1 items-center gap-2 rounded-full border border-field bg-white pl-4 pr-1 transition-colors focus-within:border-primary-600 focus-within:ring-1 focus-within:ring-inset focus-within:ring-primary-600">
        <input
          ref={inputRef}
          type="text"
          inputMode={keyboardOn ? "text" : "none"}
          onClick={enableKeyboard}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe un mensaje…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-gray-900 placeholder:text-placeholder outline-none focus-visible:outline-none focus:shadow-none"
        />
        <ChatIconButton aria-label="Adjuntar" onClick={e => onAttach(e.currentTarget)}>
          <Paperclip className="size-icon-lg" />
        </ChatIconButton>
      </div>

      <Button
        type="button"
        size="icon"
        aria-label="Enviar"
        onClick={onSend}
        disabled={sending || !canSend}
      >
        {sending ? <Spinner size="sm" className="text-white" /> : <Send className="size-icon-lg" />}
      </Button>
    </div>
  );
}
