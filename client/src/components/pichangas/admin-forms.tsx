import { useEffect, useState } from "react";
import { SURFACE_LABEL } from "@/lib/pichangas";
import type { AdminPlayer, AdminPlayerInput, AdminVenue, AdminVenueInput } from "@/lib/admin-pichangas";
import { AdminField, AdminFormDialog, AdminInput, AdminSelect } from "@/components/pichangas/admin-ui";

const SURFACES = Object.entries(SURFACE_LABEL).map(([value, label]) => ({ value, label }));

// ───────────── Cancha ─────────────

interface VenueState { name: string; district: string; city: string; address: string; surface: string; pricePerHour: string; phone: string }
const EMPTY_VENUE: VenueState = { name: "", district: "", city: "Lima", address: "", surface: "grass_sintetico", pricePerHour: "", phone: "" };

interface VenueFormProps {
  open: boolean;
  /** null = cancha nueva. */
  venue: AdminVenue | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (d: AdminVenueInput) => void;
}

export function AdminVenueForm({ open, venue, saving, onClose, onSubmit }: VenueFormProps) {
  const [f, setF] = useState<VenueState>(EMPTY_VENUE);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setTried(false);
    setF(venue ? {
      name: venue.name, district: venue.district, city: venue.city, address: venue.address ?? "", surface: venue.surface,
      pricePerHour: venue.pricePerHour ? String(Number(venue.pricePerHour)) : "", phone: venue.phone ?? "",
    } : EMPTY_VENUE);
  }, [open, venue]);

  const set = <K extends keyof VenueState>(k: K, v: string) => setF((s) => ({ ...s, [k]: v }));
  const price = f.pricePerHour.trim() === "" ? null : Number(f.pricePerHour);
  const bad = {
    name: f.name.trim().length < 3,
    district: f.district.trim().length < 2,
    city: f.city.trim().length < 2,
    price: price !== null && !(price >= 0 && price <= 5000),
  };
  const submit = () => {
    setTried(true);
    if (Object.values(bad).some(Boolean)) return;
    onSubmit({
      name: f.name.trim(), district: f.district.trim(), city: f.city.trim(), address: f.address.trim() || null,
      surface: f.surface, pricePerHour: price, phone: f.phone.trim() || null,
    });
  };

  return (
    <AdminFormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={venue ? "Editar cancha" : "Nueva cancha"}
      testId="admin-venue-form"
      onCancel={onClose}
      onSubmit={submit}
      submitLabel={saving ? "Guardando…" : venue ? "Guardar cambios" : "Crear cancha"}
      submitDisabled={saving}
    >
      <AdminField label="Nombre" htmlFor="av-name" error={tried && bad.name && "Mínimo 3 caracteres."}>
        <AdminInput id="av-name" value={f.name} maxLength={120} aria-invalid={tried && bad.name} onChange={(e) => set("name", e.target.value)} />
      </AdminField>
      <div className="grid grid-cols-2 gap-field-gap">
        <AdminField label="Distrito" htmlFor="av-district" error={tried && bad.district && "Indica el distrito."}>
          <AdminInput id="av-district" value={f.district} maxLength={80} aria-invalid={tried && bad.district} onChange={(e) => set("district", e.target.value)} />
        </AdminField>
        <AdminField label="Ciudad" htmlFor="av-city" error={tried && bad.city && "Indica la ciudad."}>
          <AdminInput id="av-city" value={f.city} maxLength={80} aria-invalid={tried && bad.city} onChange={(e) => set("city", e.target.value)} />
        </AdminField>
      </div>
      <AdminField label="Dirección (opcional)" htmlFor="av-address">
        <AdminInput id="av-address" value={f.address} maxLength={200} onChange={(e) => set("address", e.target.value)} />
      </AdminField>
      <div className="grid grid-cols-2 gap-field-gap">
        <AdminField label="Superficie" htmlFor="av-surface">
          <AdminSelect id="av-surface" options={SURFACES} value={f.surface} onChange={(e) => set("surface", e.target.value)} />
        </AdminField>
        <AdminField label="Por hora (S/)" htmlFor="av-price" error={tried && bad.price && "Entre 0 y 5000."}>
          <AdminInput id="av-price" type="number" inputMode="decimal" min={0} max={5000} value={f.pricePerHour} aria-invalid={tried && bad.price} onChange={(e) => set("pricePerHour", e.target.value)} />
        </AdminField>
      </div>
      <AdminField label="Teléfono (opcional)" htmlFor="av-phone">
        <AdminInput id="av-phone" type="tel" inputMode="tel" value={f.phone} maxLength={20} onChange={(e) => set("phone", e.target.value)} />
      </AdminField>
    </AdminFormDialog>
  );
}

// ───────────── Jugador ─────────────

interface PlayerFormProps {
  open: boolean;
  /** null = jugador nuevo. */
  player: AdminPlayer | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (d: AdminPlayerInput) => void;
}

export function AdminPlayerForm({ open, player, saving, onClose, onSubmit }: PlayerFormProps) {
  const [f, setF] = useState({ name: "", email: "", whatsapp: "" });
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!open) return;
    setTried(false);
    setF(player ? { name: player.name, email: player.email, whatsapp: player.whatsapp ?? "" } : { name: "", email: "", whatsapp: "" });
  }, [open, player]);

  const badName = f.name.trim().length < 2;
  const badEmail = !/^\S+@\S+\.\S+$/.test(f.email.trim());
  const submit = () => {
    setTried(true);
    if (badName || badEmail) return;
    onSubmit({ name: f.name.trim(), email: f.email.trim(), whatsapp: f.whatsapp.trim() || null });
  };

  return (
    <AdminFormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={player ? "Editar jugador" : "Nuevo jugador"}
      testId="admin-player-form"
      onCancel={onClose}
      onSubmit={submit}
      submitLabel={saving ? "Guardando…" : player ? "Guardar cambios" : "Crear jugador"}
      submitDisabled={saving}
    >
      <AdminField label="Nombre" htmlFor="ap-name" error={tried && badName && "Mínimo 2 caracteres."}>
        <AdminInput id="ap-name" value={f.name} maxLength={80} aria-invalid={tried && badName} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </AdminField>
      <AdminField label="Correo" htmlFor="ap-email" error={tried && badEmail && "Escribe un correo válido."}>
        <AdminInput id="ap-email" type="email" value={f.email} maxLength={120} aria-invalid={tried && badEmail} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </AdminField>
      <AdminField label="WhatsApp (opcional)" htmlFor="ap-wa" hint={player ? undefined : "La cuenta se crea sin contraseña: el jugador la define al activarla."}>
        <AdminInput id="ap-wa" type="tel" inputMode="tel" value={f.whatsapp} maxLength={20} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} />
      </AdminField>
    </AdminFormDialog>
  );
}
