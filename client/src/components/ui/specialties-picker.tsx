import { useState } from "react";
import { Chip } from "@/components/ui/chip";
import { SearchField } from "@/components/ui/search-field";
import { useQuery } from "@tanstack/react-query";

export const MAX_SPECIALTIES = 8;

interface StudyArea {
  id: string;
  label: string;
  isActive: boolean | null;
}

interface SpecialtiesPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
  /** Sin altura maxima ni scroll propio: la lista usa todo el espacio y la pagina es la que se desplaza (pagina de especialidades). */
  fullHeight?: boolean;
}

export function SpecialtiesPicker({ value, onChange, fullHeight = false }: SpecialtiesPickerProps) {
  const [search, setSearch] = useState("");
  const { data: areas = [], isLoading } = useQuery<StudyArea[]>({ queryKey: ["/api/study-areas"] });

  const q = search.trim().toLowerCase();
  const options = areas
    .filter((a) => a.isActive !== false)
    .filter((a) => !q || a.label.toLowerCase().includes(q));
  const atLimit = value.length >= MAX_SPECIALTIES;

  const toggle = (label: string) =>
    onChange(value.includes(label) ? value.filter((v) => v !== label) : [...value, label]);

  return (
    <div className="space-y-2" data-testid="specialties-picker">
      <SearchField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar materia"
        aria-label="Buscar materia"
      />
      <div className={`flex flex-wrap gap-2 ${fullHeight ? "" : "max-h-48 overflow-y-auto"}`}>
        {isLoading && <span className="text-caption text-gray-700">Cargando…</span>}
        {options.map((a) => {
          const selected = value.includes(a.label);
          return (
            <Chip
              key={a.id}
              active={selected}
              disabled={!selected && atLimit}
              onClick={() => toggle(a.label)}
              data-testid={`specialty-option-${a.id}`}
            >
              {a.label}
            </Chip>
          );
        })}
        {!isLoading && options.length === 0 && (
          <span className="text-caption text-gray-700">Sin resultados</span>
        )}
      </div>
    </div>
  );
}
