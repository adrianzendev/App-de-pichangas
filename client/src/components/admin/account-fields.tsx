import { Input } from "@/components/ui/input";
import { OutlinedControl, OutlinedField } from "@/components/ui/outlined-field";
import { CountrySelect, type CountryOption } from "@/components/ui/country-select";
import { ToggleSwitch } from "@/components/ui/toggle-switch";

/** Datos de cuenta comunes a todo usuario (alumno o tutor) en los formularios de admin. */
export type AccountStatus = "active" | "paused" | "suspended";

export interface AccountValues {
  name: string;
  email: string;
  whatsapp: string;
  university: string;
  country: string;
  status: AccountStatus;
}

interface AccountFieldsProps {
  /** Prefijo de ids del DOM; distinto por modal para no repetir ids. */
  idPrefix: string;
  value: AccountValues;
  onChange: (patch: Partial<AccountValues>) => void;
  countries?: CountryOption[];
  namePlaceholder?: string;
}

/** Nombre y correo: lo que comparten todos los usuarios (alumno, tutor, agente). */
type IdentityValues = Pick<AccountValues, "name" | "email">;

export function AccountIdentityFields({ idPrefix, value, onChange, namePlaceholder = "Nombre completo" }: {
  idPrefix: string;
  value: IdentityValues;
  onChange: (patch: Partial<IdentityValues>) => void;
  namePlaceholder?: string;
}) {
  return (
    <>
      <OutlinedControl htmlFor={`${idPrefix}-name`} label={<>Nombre completo <span aria-hidden className="text-error-fg">*</span></>}>
        <Input
          id={`${idPrefix}-name`}
          aria-required
          data-testid={`input-${idPrefix}-name`}
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={namePlaceholder}
        />
      </OutlinedControl>
      <OutlinedControl htmlFor={`${idPrefix}-email`} label={<>Correo electrónico <span aria-hidden className="text-error-fg">*</span></>}>
        <Input
          id={`${idPrefix}-email`}
          aria-required
          data-testid={`input-${idPrefix}-email`}
          type="email"
          value={value.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="correo@ejemplo.com"
        />
      </OutlinedControl>
    </>
  );
}

/** Nombre, correo, WhatsApp, universidad y país. */
export function AccountFields({ idPrefix, value, onChange, countries, namePlaceholder = "Nombre completo" }: AccountFieldsProps) {
  const hasCountries = (countries?.filter((c) => c.isActive).length ?? 0) > 0;
  return (
    <>
      <AccountIdentityFields idPrefix={idPrefix} value={value} onChange={onChange} namePlaceholder={namePlaceholder} />
      <OutlinedControl htmlFor={`${idPrefix}-whatsapp`} label="WhatsApp / Teléfono">
        <Input
          id={`${idPrefix}-whatsapp`}
          type="tel"
          value={value.whatsapp}
          onChange={(e) => onChange({ whatsapp: e.target.value })}
          placeholder="+51 999 999 999"
        />
      </OutlinedControl>
      <OutlinedControl htmlFor={`${idPrefix}-university`} label="Universidad">
        <Input
          id={`${idPrefix}-university`}
          value={value.university}
          onChange={(e) => onChange({ university: e.target.value })}
          placeholder="Nombre de la universidad"
        />
      </OutlinedControl>
      {hasCountries ? (
        <OutlinedControl htmlFor={`${idPrefix}-country`} label="País">
          <CountrySelect
            value={value.country}
            onValueChange={(country) => onChange({ country })}
            countries={countries}
            placeholder="Selecciona país"
          />
        </OutlinedControl>
      ) : (
        <p className="text-body text-gray-700 py-2">No hay países. Agrega países en el menú "Países" primero.</p>
      )}
    </>
  );
}

interface AccountActiveToggleProps {
  value: Pick<AccountValues, "status">;
  onChange: (patch: Partial<Pick<AccountValues, "status">>) => void;
  /** Quien es la cuenta: aparece en el texto de ayuda ("el tutor", "el usuario"). */
  subject?: string;
  /** Estado al que pasa una cuenta activa al desactivarla. Una cuenta suspendida sigue suspendida. */
  deactivateTo?: "paused" | "suspended";
}

/** Tarjeta "Cuenta activa": activa = status active; inactiva = paused (o suspended si ya lo estaba). */
export function AccountActiveToggle({ value, onChange, subject = "el usuario", deactivateTo = "paused" }: AccountActiveToggleProps) {
  return (
    <OutlinedField label="Cuenta activa">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-body text-gray-700">Si la desactivas, {subject} no puede iniciar sesión</p>
        <ToggleSwitch aria-label="Cuenta activa"
          checked={value.status === "active"}
          onChange={() => onChange({ status: value.status === "active" ? deactivateTo : "active" })}
        />
      </div>
    </OutlinedField>
  );
}
