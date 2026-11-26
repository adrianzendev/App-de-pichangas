import { useEffect, useState } from "react";
import { TicketBox } from "@/components/pichangas/ticket-box";
import { NightInput } from "@/components/pichangas/night-controls";
import { PitchButton } from "@/components/pichangas/night-ui";
import { GUEST_NAME_MAX, cleanGuestNames, guestNamesComplete } from "@/lib/guest-names";

interface GuestNamesEditorProps {
  /** Cuantos acompañantes tiene la inscripcion. */
  count: number;
  /** Nombres ya guardados (pueden faltar algunos). */
  saved?: string[];
  saving?: boolean;
  onSave: (names: string[]) => void;
}

// Contenedor del pase con un campo por acompañante: se editan y se guardan ahi mismo.
export function GuestNamesEditor({ count, saved, saving, onSave }: GuestNamesEditorProps) {
  const fromSaved = () => Array.from({ length: count }, (_, i) => saved?.[i] ?? "");
  const [names, setNames] = useState<string[]>(fromSaved);
  useEffect(() => { setNames(fromSaved()); }, [count, saved?.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = names.some((n, i) => n.trim() !== (saved?.[i] ?? "").trim());
  const complete = guestNamesComplete(names, count);

  return (
    <TicketBox
      as="form"
      label={count === 1 ? "Acompañante" : "Acompañantes"}
      className="space-y-3"
      onSubmit={(e) => { e.preventDefault(); if (complete && dirty) onSave(cleanGuestNames(names)); }}
    >
      {names.map((name, i) => (
        <NightInput
          key={i}
          aria-label={`Nombre del acompañante ${i + 1}`}
          value={name}
          maxLength={GUEST_NAME_MAX}
          autoComplete="off"
          placeholder={`Acompañante ${i + 1}: nombre y apellido`}
          onChange={(e) => setNames(names.map((n, j) => (j === i ? e.target.value : n)))}
        />
      ))}
      {dirty && (
        <PitchButton type="submit" className="w-full" disabled={!complete || saving}>
          {saving ? "Guardando…" : "Guardar nombres"}
        </PitchButton>
      )}
      {dirty && !complete && <p className="text-caption text-night-muted">Escribe el nombre de todos tus acompañantes para guardar.</p>}
    </TicketBox>
  );
}
