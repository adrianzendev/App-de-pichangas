import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NightInput } from "@/components/pichangas/night-controls";
import { PitchButton } from "@/components/pichangas/night-ui";
import { GUEST_NAME_MAX, cleanGuestNames, guestNamesComplete } from "@/lib/guest-names";

interface GuestNamesDialogProps {
  open: boolean;
  /** Cuantos acompañantes se inscriben (un nombre por cada uno). */
  count: number;
  /** Nombres ya conocidos (los que ya estaban inscritos); se rellenan para no volver a escribirlos. */
  initial?: string[];
  onConfirm: (names: string[]) => void;
  onCancel: () => void;
}

// Cada acompañante ocupa un cupo y aparece en la plantilla con su nombre: se piden antes de reservar.
export function GuestNamesDialog({ open, count, initial, onConfirm, onCancel }: GuestNamesDialogProps) {
  const [names, setNames] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNames(Array.from({ length: count }, (_, i) => initial?.[i] ?? ""));
    setSubmitted(false);
  }, [open, count]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!guestNamesComplete(names, count)) return;
    onConfirm(cleanGuestNames(names));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="mx-4">
        <DialogHeader>
          <DialogTitle>{count === 1 ? "¿Quién te acompaña?" : "¿Quiénes te acompañan?"}</DialogTitle>
          <DialogDescription>Escribe el nombre de {count === 1 ? "tu acompañante" : `tus ${count} acompañantes`}. Aparecerá en la plantilla.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-field-gap">
          {names.map((name, i) => (
            <div key={i} className="space-y-2">
              <label htmlFor={`guest-name-${i}`} className="text-label font-bold text-night-muted">Acompañante {i + 1}</label>
              <NightInput
                id={`guest-name-${i}`}
                value={name}
                maxLength={GUEST_NAME_MAX}
                autoComplete="off"
                placeholder="Nombre y apellido"
                aria-invalid={submitted && name.trim() === ""}
                onChange={(e) => setNames(names.map((n, j) => (j === i ? e.target.value : n)))}
              />
              {submitted && name.trim() === "" && <p className="text-caption font-bold text-crimson">Escribe su nombre.</p>}
            </div>
          ))}
          <PitchButton type="submit" className="w-full uppercase">Guardar nombres</PitchButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
