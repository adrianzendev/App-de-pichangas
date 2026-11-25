import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { AdminField, AdminFormDialog, AdminInput, AdminSelect, AdminTextarea } from "@/components/pichangas/admin-ui";
import { MatchCoverField } from "@/components/pichangas/match-cover-field";
import { PitchButton } from "@/components/pichangas/night-ui";
import { FORMAT_LABEL, GENDER_LABEL, LEVEL_LABEL } from "@/lib/pichangas";
import type { AdminMatch, AdminMatchInput, AdminVenue } from "@/lib/admin-pichangas";

const toOptions = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));
const FORMATS = toOptions(FORMAT_LABEL);
const LEVELS = toOptions(LEVEL_LABEL);
const GENDERS = toOptions(GENDER_LABEL);

// Los partidos se programan en hora de Lima (UTC-5, sin horario de verano), sin importar la zona del navegador.
const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;
const isoToLimaInput = (iso: string) => new Date(new Date(iso).getTime() - LIMA_OFFSET_MS).toISOString().slice(0, 16);
const limaInputToIso = (v: string) => new Date(`${v}:00-05:00`).toISOString();

interface FormState {
  venueId: string; title: string; description: string; startsAt: string;
  durationMinutes: string; format: string; level: string; gender: string; maxPlayers: string; pricePerPlayer: string;
  photos: string[];
}

const EMPTY: FormState = {
  venueId: "", title: "", description: "", startsAt: "", durationMinutes: "60",
  format: "futbol_7", level: "recreativo", gender: "mixto", maxPlayers: "14", pricePerPlayer: "0", photos: [],
};

const fromMatch = (m: AdminMatch): FormState => ({
  venueId: m.venue.id, title: m.title, description: m.description ?? "", startsAt: isoToLimaInput(m.startsAt),
  durationMinutes: String(m.durationMinutes), format: m.format, level: m.level, gender: m.gender,
  maxPlayers: String(m.maxPlayers), pricePerPlayer: String(Number(m.pricePerPlayer)), photos: m.photos ?? [],
});

type VenueOption = Pick<AdminVenue, "id" | "name" | "district" | "city" | "isActive">;

/** Estado y validacion del formulario de partido. `active` = la pantalla esta abierta (al abrirla se reinicia con el partido dado). */
function useMatchForm(match: AdminMatch | null, active: boolean) {
  const [f, setF] = useState<FormState>(EMPTY);
  const [tried, setTried] = useState(false);
  useEffect(() => { if (active) { setF(match ? fromMatch(match) : EMPTY); setTried(false); } }, [active, match]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const max = Number(f.maxPlayers);
  const duration = Number(f.durationMinutes);
  const price = Number(f.pricePerPlayer);
  const errors = {
    venueId: !f.venueId,
    title: f.title.trim().length < 3,
    startsAt: !f.startsAt,
    durationMinutes: !(duration >= 30 && duration <= 240),
    maxPlayers: !(Number.isInteger(max) && max >= 4 && max <= 30),
    pricePerPlayer: !(price >= 0 && price <= 500),
  };
  const err = (k: keyof typeof errors) => tried && errors[k];

  /** Valida; con errores los muestra y devuelve null. */
  const build = (): AdminMatchInput | null => {
    setTried(true);
    if (Object.values(errors).some(Boolean)) return null;
    return {
      venueId: f.venueId, title: f.title.trim(), description: f.description.trim() || null,
      startsAt: limaInputToIso(f.startsAt), durationMinutes: duration, format: f.format, level: f.level,
      gender: f.gender, maxPlayers: max, pricePerPlayer: price, photos: f.photos,
    };
  };
  return { f, set, err, build };
}

/** Campos del partido: una sola fuente para el dialogo del admin y la pagina del host. */
function MatchFields({ form, venues, match }: { form: ReturnType<typeof useMatchForm>; venues: VenueOption[]; match: AdminMatch | null }) {
  const { f, set, err } = form;
  const venueOptions = venues
    .filter((v) => v.isActive || v.id === match?.venue.id)
    .map((v) => ({ value: v.id, label: `${v.name} (${v.district}, ${v.city})` }));
  return (
    <>
      <AdminField label="Título" htmlFor="am-title">
        <AdminInput id="am-title" value={f.title} maxLength={100} aria-invalid={err("title")} onChange={(e) => set("title", e.target.value)} />
        {err("title") && <p className="mt-1 text-caption font-bold text-crimson">Mínimo 3 caracteres.</p>}
      </AdminField>
      <AdminField label="Cancha" htmlFor="am-venue">
        <AdminSelect id="am-venue" options={venueOptions} value={f.venueId} onChange={(e) => set("venueId", e.target.value)} placeholder="Elige una cancha" />
        {err("venueId") && <p className="mt-1 text-caption font-bold text-crimson">Elige una cancha.</p>}
      </AdminField>
      <AdminField label="Fecha y hora (Lima)" htmlFor="am-date">
        <AdminInput id="am-date" type="datetime-local" value={f.startsAt} aria-invalid={err("startsAt")} onChange={(e) => set("startsAt", e.target.value)} />
        {err("startsAt") && <p className="mt-1 text-caption font-bold text-crimson">Indica la fecha y la hora.</p>}
      </AdminField>
      <div className="grid grid-cols-2 gap-field-gap">
        <AdminField label="Formato" htmlFor="am-format"><AdminSelect id="am-format" options={FORMATS} value={f.format} onChange={(e) => set("format", e.target.value)} /></AdminField>
        <AdminField label="Nivel" htmlFor="am-level"><AdminSelect id="am-level" options={LEVELS} value={f.level} onChange={(e) => set("level", e.target.value)} /></AdminField>
        <AdminField label="Género" htmlFor="am-gender"><AdminSelect id="am-gender" options={GENDERS} value={f.gender} onChange={(e) => set("gender", e.target.value)} /></AdminField>
        <AdminField label="Duración (min)" htmlFor="am-duration">
          <AdminInput id="am-duration" type="number" inputMode="numeric" min={30} max={240} value={f.durationMinutes} aria-invalid={err("durationMinutes")} onChange={(e) => set("durationMinutes", e.target.value)} />
        </AdminField>
        <AdminField label="Cupos" htmlFor="am-max">
          <AdminInput id="am-max" type="number" inputMode="numeric" min={4} max={30} value={f.maxPlayers} aria-invalid={err("maxPlayers")} onChange={(e) => set("maxPlayers", e.target.value)} />
        </AdminField>
        <AdminField label="Cuota (S/)" htmlFor="am-price">
          <AdminInput id="am-price" type="number" inputMode="decimal" min={0} max={500} step="0.5" value={f.pricePerPlayer} aria-invalid={err("pricePerPlayer")} onChange={(e) => set("pricePerPlayer", e.target.value)} />
        </AdminField>
      </div>
      <AdminField label="Portadas (opcional)" htmlFor="am-cover" hint="La primera es la principal. Si no subes ninguna se usan las fotos de la cancha.">
        <MatchCoverField value={f.photos} onChange={(photos) => set("photos", photos)} />
      </AdminField>
      <AdminField label="Descripción (opcional)" htmlFor="am-desc">
        <AdminTextarea id="am-desc" rows={3} maxLength={500} value={f.description} onChange={(e) => set("description", e.target.value)} />
      </AdminField>
    </>
  );
}

interface MatchFormProps {
  open: boolean;
  /** null = crear un partido nuevo. */
  match: AdminMatch | null;
  /** Canchas elegibles (el admin ve tambien las inactivas; el host solo las activas). */
  venues: VenueOption[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (data: AdminMatchInput) => void;
}

/** Formulario de partido en dialogo: lo usa el panel admin (crear y editar). */
export function MatchForm({ open, match, venues, saving, onClose, onSubmit }: MatchFormProps) {
  const form = useMatchForm(match, open);
  const submit = () => { const data = form.build(); if (data) onSubmit(data); };
  return (
    <AdminFormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={match ? "Editar partido" : "Nuevo partido"}
      testId="admin-match-form"
      onCancel={onClose}
      onSubmit={submit}
      submitLabel={saving ? "Guardando…" : match ? "Guardar cambios" : "Crear partido"}
      submitDisabled={saving}
    >
      <MatchFields form={form} venues={venues} match={match} />
    </AdminFormDialog>
  );
}

/** Formulario de partido como pagina completa: lo usa el host (/play/host/new). */
export function MatchFormPage({ match = null, venues, saving, submitLabel, onCancel, onSubmit }: {
  match?: AdminMatch | null;
  venues: VenueOption[];
  saving: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (data: AdminMatchInput) => void;
}) {
  const form = useMatchForm(match, true);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const data = form.build();
    if (data) onSubmit(data);
  };
  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-2xl space-y-field-gap" aria-label="Datos del partido" data-testid="match-form-page">
      <MatchFields form={form} venues={venues} match={match} />
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="night-secondary" size="lg" className="flex-1 uppercase" onClick={onCancel}>Cancelar</Button>
        <PitchButton type="submit" className="flex-1 uppercase" disabled={saving}>{saving ? "Guardando…" : submitLabel}</PitchButton>
      </div>
    </form>
  );
}
