import { useEffect, useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { NightInput } from "@/components/pichangas/night-controls";
import { PitchButton } from "@/components/pichangas/night-ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCountries } from "@/hooks/use-countries";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { PLAYER_AGE_MAX, PLAYER_AGE_MIN, POSITION_OPTIONS, usePlayerProfile, type PlayerPosition } from "@/lib/pichangas";

function splitPhone(full: string, countries: { code: string; phoneCode?: string | null }[]) {
  const digits = full.replace(/[^\d+]/g, "");
  const match = countries.filter((c) => c.phoneCode && digits.startsWith(c.phoneCode)).sort((a, b) => b.phoneCode!.length - a.phoneCode!.length)[0];
  return match ? { country: match.code, number: digits.slice(match.phoneCode!.length) } : { country: "PE", number: digits.replace(/^\+/, "") };
}

// Editar cuenta del jugador: nombre (tabla de usuarios), edad y posicion (tabla player_profiles). El correo no se cambia aqui.
export function ProfileForm({ user }: { user: { id: string; name: string; email: string; whatsapp?: string | null } }) {
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const phoneId = useId();
  const ageId = useId();
  const { data: profile, isLoading } = usePlayerProfile();
  const [name, setName] = useState(user.name);
  const countries = useCountries().filter((c) => c.phoneCode);
  // El telefono se guarda junto (+51987654321): se separa en pais (prefijo mas largo que coincida) y numero.
  const initial = splitPhone(user.whatsapp ?? "", countries);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [country, setCountry] = useState(initial.country);
  const [number, setNumber] = useState(initial.number);
  const [age, setAge] = useState("");
  const [position, setPosition] = useState<PlayerPosition | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Cuando llega el perfil guardado, se rellena el formulario.
  useEffect(() => {
    if (!profile) return;
    setAge(profile.age == null ? "" : String(profile.age));
    setPosition(profile.position);
  }, [profile]);

  // Telefono: opcional; solo digitos; entre 7 y 15 contando el prefijo del pais.
  const dial = countries.find((c) => c.code === country)?.phoneCode ?? "";
  const phone = number.trim() === "" ? "" : `${dial}${number.replace(/D/g, "")}`;
  const phoneDigits = phone.replace(/D/g, "");
  const phoneError = number.trim() !== "" && (!/^[ds-]+$/.test(number.trim()) || phoneDigits.length < 7 || phoneDigits.length > 15)
    ? "Escribe un teléfono válido (7 a 15 dígitos)."
    : null;
  const ageNumber = age.trim() === "" ? null : Number(age);
  const emailChanged = email.trim().toLowerCase() !== user.email.toLowerCase();
  const emailError = emailChanged && !/^[^s@]+@[^s@]+.[^s@]+$/.test(email.trim()) ? "Escribe un correo válido." : null;
  const passwordError = emailChanged && !currentPassword ? "Escribe tu contraseña actual para cambiar el correo." : null;
  const nameError = name.trim() === "" ? "Escribe tu nombre." : null;
  const ageError = ageNumber !== null && (!Number.isInteger(ageNumber) || ageNumber < PLAYER_AGE_MIN || ageNumber > PLAYER_AGE_MAX)
    ? `La edad debe estar entre ${PLAYER_AGE_MIN} y ${PLAYER_AGE_MAX}.`
    : null;

  const save = useMutation({
    mutationFn: async () => {
      if (emailChanged) await apiRequest("POST", "/api/user/change-email", { newEmail: email.trim(), currentPassword });
      const userUpdates: Record<string, string> = {};
      if (name.trim() !== user.name) userUpdates.name = name.trim();
      if (phone !== (user.whatsapp ?? "")) userUpdates.whatsapp = phone;
      if (Object.keys(userUpdates).length > 0) await apiRequest("PUT", "/api/user/current", userUpdates);
      await apiRequest("PUT", "/api/player/profile", { age: ageNumber, position });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/user/current"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/player/profile"] });
      setCurrentPassword("");
      toast({ title: "Perfil actualizado", variant: "success" });
    },
    onError: (e) => toast({ variant: "destructive", title: "No pudimos guardar tu perfil", description: e instanceof Error ? e.message : undefined }),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (nameError || ageError || phoneError || emailError || passwordError) return;
    save.mutate();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-field-gap" aria-label="Editar cuenta" aria-busy={isLoading}>
      <h2 className="text-subheading font-bold text-night-text">Editar cuenta</h2>

      <div className="space-y-2">
        <label htmlFor={nameId} className="text-label font-bold text-night-muted">Nombre</label>
        <NightInput id={nameId} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" aria-invalid={submitted && !!nameError} />
        {submitted && nameError && <p className="text-caption font-bold text-crimson">{nameError}</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor={emailId} className="text-label font-bold text-night-muted">Correo</label>
        <NightInput id={emailId} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} aria-invalid={submitted && !!emailError} />
        {submitted && emailError && <p className="text-caption font-bold text-crimson">{emailError}</p>}
      </div>

      {emailChanged && (
        <div className="space-y-2">
          <label htmlFor={passwordId} className="text-label font-bold text-night-muted">Contraseña actual</label>
          <NightInput id={passwordId} type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} aria-invalid={submitted && !!passwordError} />
          {submitted && passwordError && <p className="text-caption font-bold text-crimson">{passwordError}</p>}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor={phoneId} className="text-label font-bold text-night-muted">Teléfono</label>
        <div className="flex gap-3">
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger aria-label="País del teléfono" className="w-28 shrink-0 px-3"><SelectValue>{dial}</SelectValue></SelectTrigger>
            <SelectContent>
              {countries.map((c) => <SelectItem key={c.code} value={c.code}>{c.name} ({c.phoneCode})</SelectItem>)}
            </SelectContent>
          </Select>
          <NightInput className="min-w-0 flex-1" id={phoneId} type="tel" inputMode="tel" autoComplete="tel-national" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={15} placeholder="987 654 321" aria-invalid={submitted && !!phoneError} />
        </div>
        {submitted && phoneError && <p className="text-caption font-bold text-crimson">{phoneError}</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor={ageId} className="text-label font-bold text-night-muted">Edad</label>
        <NightInput id={ageId} type="number" inputMode="numeric" min={PLAYER_AGE_MIN} max={PLAYER_AGE_MAX} value={age} onChange={(e) => setAge(e.target.value)} aria-invalid={submitted && !!ageError} />
        {submitted && ageError && <p className="text-caption font-bold text-crimson">{ageError}</p>}
      </div>

      <div className="space-y-2">
        <p className="text-label font-bold text-night-muted" id={`${ageId}-pos`}>Posición</p>
        <Select value={position ?? "none"} onValueChange={(v) => setPosition(v === "none" ? null : (v as PlayerPosition))}>
          <SelectTrigger aria-labelledby={`${ageId}-pos`}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin posición</SelectItem>
            {POSITION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <PitchButton type="submit" className="w-full" disabled={save.isPending || isLoading}>
        {save.isPending ? "Guardando…" : "Guardar cambios"}
      </PitchButton>
    </form>
  );
}
