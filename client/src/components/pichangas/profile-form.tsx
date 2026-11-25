import { useEffect, useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { surfaceClass } from "@/components/pichangas/surface";
import { NightInput } from "@/components/pichangas/night-controls";
import { NightChip, PitchButton } from "@/components/pichangas/night-ui";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PLAYER_AGE_MAX, PLAYER_AGE_MIN, POSITION_OPTIONS, usePlayerProfile, type PlayerPosition } from "@/lib/pichangas";

// Editar cuenta del jugador: nombre (tabla de usuarios), edad y posicion (tabla player_profiles). El correo no se cambia aqui.
export function ProfileForm({ user }: { user: { id: string; name: string; email: string; whatsapp?: string | null } }) {
  const nameId = useId();
  const phoneId = useId();
  const ageId = useId();
  const { data: profile, isLoading } = usePlayerProfile();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.whatsapp ?? "");
  const [age, setAge] = useState("");
  const [position, setPosition] = useState<PlayerPosition | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Cuando llega el perfil guardado, se rellena el formulario.
  useEffect(() => {
    if (!profile) return;
    setAge(profile.age == null ? "" : String(profile.age));
    setPosition(profile.position);
    setIsHost(profile.isHost);
  }, [profile]);

  // Telefono: opcional; solo numeros, espacios, + y guiones; entre 7 y 15 digitos.
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneError = phone.trim() !== "" && (!/^[+\d\s-]+$/.test(phone.trim()) || phoneDigits.length < 7 || phoneDigits.length > 15)
    ? "Escribe un teléfono válido (7 a 15 dígitos)."
    : null;
  const ageNumber = age.trim() === "" ? null : Number(age);
  const nameError = name.trim() === "" ? "Escribe tu nombre." : null;
  const ageError = ageNumber !== null && (!Number.isInteger(ageNumber) || ageNumber < PLAYER_AGE_MIN || ageNumber > PLAYER_AGE_MAX)
    ? `La edad debe estar entre ${PLAYER_AGE_MIN} y ${PLAYER_AGE_MAX}.`
    : null;

  const save = useMutation({
    mutationFn: async () => {
      const userUpdates: Record<string, string> = {};
      if (name.trim() !== user.name) userUpdates.name = name.trim();
      if (phone.trim() !== (user.whatsapp ?? "")) userUpdates.whatsapp = phone.trim();
      if (Object.keys(userUpdates).length > 0) await apiRequest("PUT", "/api/user/current", userUpdates);
      await apiRequest("PUT", "/api/player/profile", { age: ageNumber, position, isHost });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/user/current"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/player/profile"] });
      toast({ title: "Perfil actualizado", variant: "success" });
    },
    onError: (e) => toast({ variant: "destructive", title: "No pudimos guardar tu perfil", description: e instanceof Error ? e.message : undefined }),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (nameError || ageError || phoneError) return;
    save.mutate();
  };

  return (
    <form onSubmit={onSubmit} className={cn(surfaceClass(), "space-y-field-gap p-card-pad")} aria-label="Editar cuenta" aria-busy={isLoading}>
      <h2 className="text-subheading font-bold text-night-text">Editar cuenta</h2>

      <div className="space-y-2">
        <label htmlFor={nameId} className="text-label font-bold text-night-muted">Nombre</label>
        <NightInput id={nameId} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" aria-invalid={submitted && !!nameError} />
        {submitted && nameError && <p className="text-caption font-bold text-crimson">{nameError}</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor={phoneId} className="text-label font-bold text-night-muted">Teléfono <span className="font-normal">(opcional)</span></label>
        <NightInput id={phoneId} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="987 654 321" aria-invalid={submitted && !!phoneError} />
        {submitted && phoneError && <p className="text-caption font-bold text-crimson">{phoneError}</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor={ageId} className="text-label font-bold text-night-muted">Edad <span className="font-normal">(opcional)</span></label>
        <NightInput id={ageId} type="number" inputMode="numeric" min={PLAYER_AGE_MIN} max={PLAYER_AGE_MAX} value={age} onChange={(e) => setAge(e.target.value)} aria-invalid={submitted && !!ageError} />
        {submitted && ageError && <p className="text-caption font-bold text-crimson">{ageError}</p>}
      </div>

      <div className="space-y-2">
        <p className="text-label font-bold text-night-muted" id={`${ageId}-pos`}>Posición <span className="font-normal">(opcional)</span></p>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${ageId}-pos`}>
          {POSITION_OPTIONS.map((o) => (
            <NightChip key={o.value} pin={false} active={position === o.value} onClick={() => setPosition(position === o.value ? null : o.value)}>
              {o.label}
            </NightChip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-label font-bold text-night-muted" id={`${ageId}-host`}>Tipo de perfil</p>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${ageId}-host`}>
          <NightChip pin={false} active={!isHost} onClick={() => setIsHost(false)}>Jugador</NightChip>
          <NightChip pin={false} active={isHost} onClick={() => setIsHost(true)}>Host</NightChip>
        </div>
        <p className="text-caption text-night-muted">Como host puedes crear y organizar tus propios partidos.</p>
      </div>

      <PitchButton type="submit" className="w-full" disabled={save.isPending || isLoading}>
        {save.isPending ? "Guardando…" : "Guardar cambios"}
      </PitchButton>
    </form>
  );
}
