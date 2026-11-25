import { Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import { OutlinedControl, OutlinedField } from "@/components/ui/outlined-field";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CountryOption } from "@/components/ui/country-select";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { LanguageSelect } from "@/components/ui/language-select";
import { UserAvatar } from "@/components/ui/user-avatar";
import { AccountActiveToggle, AccountFields, type AccountValues } from "@/components/admin/account-fields";

/** Campos del tutor: los de cuenta + carrera, descripcion, verificado y acceso a pedidos. */
export interface TutorFormValues extends AccountValues {
  profession: string;
  /** Idioma principal (nativo): "Español", "Inglés"... Vacio = sin indicar. */
  language: string;
  bio: string;
  isVerified: boolean;
  hasGeneralAccess: boolean;
  assignedCourseIds: string[];
}

interface TutorFormFieldsProps {
  idPrefix: string;
  value: TutorFormValues;
  onChange: (patch: Partial<TutorFormValues>) => void;
  countries?: CountryOption[];
  careers?: { id: string; name: string; isActive?: boolean | null }[];
  courses?: { id: string; label: string; isActive?: boolean | null }[];
  deactivateTo?: "paused" | "suspended";
  photo: { preview: string | null; hasNewFile: boolean; onPick: (file: File) => void };
}

export function TutorFormFields({
  idPrefix,
  value,
  onChange,
  countries,
  careers,
  courses,
  deactivateTo,
  photo,
}: TutorFormFieldsProps) {
  const activeCourses = courses?.filter((c) => c.isActive) ?? [];
  const toggleCourse = (id: string, checked: boolean) =>
    onChange({
      assignedCourseIds: checked
        ? [...value.assignedCourseIds, id]
        : value.assignedCourseIds.filter((x) => x !== id),
    });

  return (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-photo`}>Foto de perfil</Label>
        <div className="flex items-center gap-4 mt-2">
          <div className="relative">
            <UserAvatar name={value.name || "Tutor"} avatar={photo.preview || undefined} size="lg" />
            <label
              htmlFor={`${idPrefix}-photo`}
              aria-label="Cambiar foto de perfil"
              className="absolute bottom-0 right-0 size-icon-badge bg-green-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-green-700 transition-colors"
            >
              <Pencil className="size-icon-sm text-white" />
            </label>
            <input
              id={`${idPrefix}-photo`}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) photo.onPick(file);
              }}
            />
          </div>
          <div className="text-caption text-gray-700">
            {photo.hasNewFile ? (
              <span className="text-green-600">Nueva foto seleccionada</span>
            ) : (
              <span>Haz clic en el ícono para cambiar</span>
            )}
          </div>
        </div>
      </div>

      <AccountFields
        idPrefix={idPrefix}
        value={value}
        onChange={onChange}
        countries={countries}
        namePlaceholder="Nombre del tutor"
      />

      <OutlinedControl htmlFor={`${idPrefix}-profession`} label="Carrera / Área académica">
        <Select value={value.profession || undefined} onValueChange={(profession) => onChange({ profession })}>
          <SelectTrigger id={`${idPrefix}-profession`} data-testid={`select-${idPrefix}-profession`}>
            <SelectValue placeholder="Selecciona una carrera" />
          </SelectTrigger>
          <SelectContent>
            {careers?.filter((c) => c.isActive).map((area) => (
              <SelectItem key={area.id} value={area.name}>
                {area.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </OutlinedControl>
      <OutlinedControl htmlFor={`${idPrefix}-language`} label="Idioma">
        <LanguageSelect
          id={`${idPrefix}-language`}
          data-testid={`select-${idPrefix}-language`}
          value={value.language}
          onValueChange={(language) => onChange({ language })}
          placeholder="Selecciona el idioma"
        />
      </OutlinedControl>
      <OutlinedControl htmlFor={`${idPrefix}-bio`} label="Descripción (bio)">
        <Textarea
          id={`${idPrefix}-bio`}
          rows={3}
          value={value.bio}
          onChange={(e) => onChange({ bio: e.target.value })}
          placeholder="Presentación del tutor"
        />
      </OutlinedControl>

      <AccountActiveToggle value={value} onChange={onChange} subject="el tutor" deactivateTo={deactivateTo} />

      <OutlinedField label="Verificado">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-body text-gray-700">Muestra la insignia de tutor verificado</p>
          <ToggleSwitch aria-label="Verificado" checked={value.isVerified} onChange={() => onChange({ isVerified: !value.isVerified })} />
        </div>
      </OutlinedField>
      <OutlinedField label="Acceso General">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-body text-gray-700">Si está activo, el tutor ve TODOS los pedidos</p>
          <ToggleSwitch aria-label="Acceso General"
            checked={value.hasGeneralAccess}
            onChange={() => onChange({ hasGeneralAccess: !value.hasGeneralAccess })}
          />
        </div>

        {!value.hasGeneralAccess && (
          <div className="mt-4 min-w-0">
            <p className="text-body font-medium leading-none">Cursos Asignados</p>
            <p className="text-caption text-gray-700 mb-2">Solo verá pedidos de estos cursos</p>
            <div className="max-h-48 overflow-y-auto rounded-md border border-border p-1 space-y-1">
              {activeCourses.map((course) => (
                <label
                  key={course.id}
                  className="flex min-w-0 items-center gap-2 px-3 py-2 text-body cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <Checkbox
                    checked={value.assignedCourseIds.includes(course.id)}
                    onCheckedChange={(checked) => toggleCourse(course.id, !!checked)}
                  />
                  <span className="truncate">{course.label}</span>
                </label>
              ))}
              {activeCourses.length === 0 && (
                <p className="text-body text-gray-700 px-3 py-3">No hay cursos configurados</p>
              )}
            </div>
          </div>
        )}
      </OutlinedField>
    </>
  );
}
