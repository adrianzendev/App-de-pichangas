import { useEffect, useState } from "react";
import { AdminField, AdminFormDialog, AdminInput, AdminSelect, AdminTextarea } from "@/components/pichangas/admin-ui";
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
}

const EMPTY: FormState = {
  venueId: "", title: "", description: "", startsAt: "", durationMinutes: "60",
  format: "futbol_7", level: "recreativo", gender: "mixto", maxPlayers: "14", pricePerPlayer: "0",
};

const fromMatch = (m: AdminMatch): FormState => ({
  venueId: m.venue.id, title: m.title, description: m.description ?? "", startsAt: isoToLimaInput(m.startsAt),
  durationMinutes: String(m.durationMinutes), format: m.format, level: m.level, gender: m.gender,
  maxPlayers: String(m.maxPlayers), pricePerPlayer: String(Number(m.pricePerPlayer)),
});

interface AdminMatchFormProps {
  open: boolean;
  /** null = crear un partido nuevo. */
  match: AdminMatch | null;
  venues: AdminVenue[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (data: AdminMatchInput) => void;
}

// Formulario de partido del panel admin (crear y editar).
export function AdminMatchForm({ open, match, venues, saving, onClose, onSubmit }: AdminMatchFormProps) {
  const [f, setF] = useState<FormState>(EMPTY);
  const [tried, setTried] = useState(false);
  useEffect(() => { if (open) { setF(match ? fromMatch(match) : EMPTY); setTried(false); } }, [open, match]);

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
  const invalid = Object.values(errors).some(Boolean);
  const err = (k: keyof typeof errors) => tried && errors[k];

  const submit = () => {
    setTried(true);
    if (invalid) return;
    onSubmit({
      venueId: f.venueId, title: f.title.trim(), description: f.description.trim() || null,
      startsAt: limaInputToIso(f.startsAt), durationMinutes: duration, format: f.format, level: f.level,
      gender: f.gender, maxPlayers: max, pricePerPlayer: price,
    });
  };

  const venueOptions = venues
    .filter((v) => v.isActive || v.id === match?.venue.id)
    .map((v) => ({ value: v.id, label: `${v.name} (${v.district}, ${v.city})` }));

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
      <AdminField label="Descripción (opcional)" htmlFor="am-desc">
        <AdminTextarea id="am-desc" rows={3} maxLength={500} value={f.description} onChange={(e) => set("description", e.target.value)} />
      </AdminField>
    </AdminFormDialog>
  );
}
