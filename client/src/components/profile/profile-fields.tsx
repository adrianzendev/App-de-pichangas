import { OutlinedControl } from "@/components/ui/outlined-field";
import { useLocation } from "wouter";
import { FieldLinkRow } from "@/components/ui/field-link-row";
import { FIELD_PLACEHOLDER, Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { CountrySelect } from "@/components/ui/country-select";

export interface ProfileFieldsValue {
  name: string;
  university: string;
  whatsapp: string;
  country: string;
}

interface ProfileFieldsProps {
  value: ProfileFieldsValue;
  onChange: (patch: Partial<ProfileFieldsValue>) => void;
  /** Solo lectura: el login vive en supabase.auth, se cambia por soporte. */
  email: string;
  /** Mensajes bajo el nombre y la universidad; solo se pasan tras el primer intento de envio. */
  nameError?: string;
  universityError?: string;
}

const SUPPORT_EMAIL_CHANGE_URL = "https://wa.me/51935436864?text=Hola%20quiero%20cambiar%20el%20correo%20de%20mi%20cuenta";

// Seccion "Datos personales" compartida por Mi perfil del alumno y del tutor: una sola columna,
// obligatorios con asterisco, opcionales marcados, email de solo lectura.
export function ProfileFields({ value, onChange, email, nameError, universityError }: ProfileFieldsProps) {
  const [, setLocation] = useLocation();
  return (
    <section className="space-y-3">
      <h2 className="text-subheading font-semibold text-gray-900">Datos personales</h2>
      <div className="space-y-field-gap">
        <div>
          <OutlinedControl htmlFor="profile-name" label={<>Nombre <span aria-hidden className="text-error-fg">*</span></>}>
            <Input
              id="profile-name"
              aria-required
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "profile-name-error" : undefined}
              value={value.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Tu nombre completo"
            />
          </OutlinedControl>
          {nameError && <p id="profile-name-error" className="mt-1 text-caption text-error-fg">{nameError}</p>}
        </div>

        <div>
          <OutlinedControl htmlFor="profile-university" label={<>Universidad <span className="font-normal text-gray-700">(opcional)</span></>}>
            {/* La universidad se elige en su propia pagina (lista que mantiene el admin); aqui solo se ve la elegida. */}
            <FieldLinkRow
              id="profile-university"
              onClick={() => setLocation(ROUTES.university)}
              invalid={!!universityError}
              aria-describedby={universityError ? "profile-university-error" : undefined}
              data-testid="profile-university"
            >
              <span className={cn("truncate", value.university ? "text-gray-900" : FIELD_PLACEHOLDER)}>
                {value.university || "Selecciona tu universidad"}
              </span>
            </FieldLinkRow>
          </OutlinedControl>
          {universityError && <p id="profile-university-error" className="mt-1 text-caption text-error-fg">{universityError}</p>}
        </div>

        <div>
          <OutlinedControl htmlFor="profile-email" label="Email">
            <Input
              id="profile-email"
              type="email"
              disabled
              aria-describedby="profile-email-help"
              value={email}
            />
          </OutlinedControl>
          <p id="profile-email-help" className="mt-1 text-caption text-gray-700">
            Para cambiarlo,{" "}
            <a
              href={SUPPORT_EMAIL_CHANGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              escribe a soporte
            </a>
            .
          </p>
        </div>

        <div>
          <OutlinedControl htmlFor="profile-whatsapp" label={<>WhatsApp <span className="font-normal text-gray-700">(opcional)</span></>}>
            <Input
              id="profile-whatsapp"
              type="tel"
              value={value.whatsapp}
              onChange={(e) => onChange({ whatsapp: e.target.value })}
              placeholder="+51 999 999 999"
            />
          </OutlinedControl>
        </div>

        <div>
          <OutlinedControl htmlFor="profile-country" label={<>País <span className="font-normal text-gray-700">(opcional)</span></>}>
            <CountrySelect
              id="profile-country"
              value={value.country}
              onValueChange={(country) => onChange({ country })}
              placeholder="Selecciona tu país"
            />
          </OutlinedControl>
        </div>
      </div>
    </section>
  );
}
