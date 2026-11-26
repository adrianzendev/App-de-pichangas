import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { AdminButton, AdminInput, AdminPanel, AdminPills } from "@/components/pichangas/admin-ui";
import { PageLoader } from "@/components/ui/spinner";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { toast } from "@/hooks/use-toast";
import { PERU_DEPARTMENTS, PERU_DISTRICTS, PERU_PROVINCES, districtCodesUnder } from "@shared/peru-geo";
import { setGeoRequest, useAdminGeo } from "@/lib/admin-pichangas";
import { cn } from "@/lib/utils";

type Filter = "all" | "on" | "off";
const FILTERS = [{ id: "all", label: "Todas" }, { id: "on", label: "Activas" }, { id: "off", label: "Sin activar" }] as const;

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Para buscar una region por cualquier cosa que contenga (sus provincias y distritos), no solo por su nombre.
const SEARCH_INDEX = new Map<string, string>(
  PERU_DEPARTMENTS.map(([dc, dn]) => [
    dc,
    plain([dn, ...PERU_PROVINCES.filter(([c]) => c.startsWith(dc)).map(([, n]) => n), ...PERU_DISTRICTS.filter(([c]) => c.startsWith(dc)).map(([, n]) => n)].join("|")),
  ]),
);

// Seccion "Geografía": una region a la vez. A la izquierda la lista de regiones; a la derecha, sus provincias y distritos.
// Los cambios se acumulan en un borrador y solo se guardan al confirmar.
export function AdminGeoView() {
  const { data, isLoading, isError, refetch } = useAdminGeo();
  const qc = useQueryClient();
  const [dep, setDep] = useState("15"); // Lima
  const [prov, setProv] = useState("1501");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState<Set<string> | null>(null);

  const mutation = useMutation({
    mutationFn: setGeoRequest,
    onSuccess: (d) => {
      qc.setQueryData(["/api/admin/pichangas/geo"], d);
      setDraft(null);
      toast({ title: "Cambios guardados", variant: "success" });
    },
    onError: () => toast({ variant: "destructive", title: "No pudimos guardar los cambios" }),
  });

  const saved = useMemo(() => new Set(data?.active ?? []), [data]);
  const active = draft ?? saved;
  const changes = useMemo(() => {
    if (!draft) return 0;
    let n = 0;
    draft.forEach((c) => { if (!saved.has(c)) n++; });
    saved.forEach((c) => { if (!draft.has(c)) n++; });
    return n;
  }, [draft, saved]);

  const toggle = (code: string, on: boolean) => {
    const next = new Set(active);
    for (const c of districtCodesUnder(code)) { if (on) next.add(c); else next.delete(c); }
    setDraft(next);
  };

  // Distritos activos y totales por prefijo de departamento (2) y de provincia (4).
  const count = useMemo(() => {
    const on = new Map<string, number>();
    const total = new Map<string, number>();
    for (const [c] of PERU_DISTRICTS) {
      for (const k of [c.slice(0, 2), c.slice(0, 4)]) {
        total.set(k, (total.get(k) ?? 0) + 1);
        if (active.has(c)) on.set(k, (on.get(k) ?? 0) + 1);
      }
    }
    return (code: string) => ({ on: on.get(code) ?? 0, total: total.get(code) ?? 0 });
  }, [active]);

  if (isError) {
    return (
      <AdminPanel className="space-y-3 p-4">
        <p className="text-body text-night-text">No pudimos cargar la geografía.</p>
        <AdminButton onClick={() => refetch()}>Reintentar</AdminButton>
      </AdminPanel>
    );
  }
  if (isLoading || !data) return <PageLoader />;

  const q = plain(query.trim());
  const regions = PERU_DEPARTMENTS.filter(([dc]) => {
    const c = count(dc);
    if (filter === "on" && c.on === 0) return false;
    if (filter === "off" && c.on > 0) return false;
    return q.length < 2 || (SEARCH_INDEX.get(dc) ?? "").includes(q);
  });

  const depName = PERU_DEPARTMENTS.find(([c]) => c === dep)?.[1] ?? "";
  const provinces = PERU_PROVINCES.filter(([c]) => c.startsWith(dep));
  const provName = provinces.find(([c]) => c === prov)?.[1] ?? "";
  const districts = PERU_DISTRICTS.filter(([c]) => c.startsWith(prov));
  const depCount = count(dep);
  const provCount = count(prov);
  const pickRegion = (code: string) => {
    setDep(code);
    setProv(PERU_PROVINCES.find(([c]) => c.startsWith(code))?.[0] ?? "");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-5">
        {/* Lista de regiones */}
        <AdminPanel className="w-full space-y-3 p-4 lg:w-80 lg:shrink-0">
          <AdminInput type="search" aria-label="Buscar región, provincia o distrito" placeholder="Buscar región, provincia o distrito" value={query} onChange={(e) => setQuery(e.target.value)} />
          <AdminPills options={FILTERS} value={filter} onChange={setFilter} />
          <div className="flex gap-2">
            <AdminButton compact disabled={active.size === PERU_DISTRICTS.length} onClick={() => toggle("", true)}>Activar todo</AdminButton>
            <AdminButton compact disabled={active.size === 0} onClick={() => toggle("", false)}>Desactivar todo</AdminButton>
          </div>
          <div className="max-h-sheet space-y-1 overflow-y-auto">
            {regions.length === 0 && <p className="py-3 text-body text-night-muted">Sin resultados.</p>}
            {regions.map(([dc, dn]) => {
              const c = count(dc);
              return (
                <AdminButton
                  key={dc}
                  tone="ghost"
                  aria-pressed={dc === dep}
                  className={cn("w-full justify-start gap-3 px-3", dc === dep && "bg-pitch/10")}
                  onClick={() => pickRegion(dc)}
                >
                  <span className={cn("size-3 shrink-0 rounded-full", c.on === c.total ? "bg-pitch" : c.on > 0 ? "bg-pitch/40" : "bg-night-highest")} aria-hidden />
                  <span className={cn("min-w-0 flex-1 truncate text-left", dc === dep ? "font-bold" : "font-medium")}>{dn}</span>
                  <span className="shrink-0 text-caption text-night-muted tabular-nums">{c.on}/{c.total}</span>
                </AdminButton>
              );
            })}
          </div>
        </AdminPanel>

        {/* Detalle de la region */}
        <div className="min-w-0 flex-1 space-y-4">
        <AdminPanel className="space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-caption font-bold uppercase text-night-muted">Región</p>
              <h2 className="text-heading font-bold text-night-text">{depName}</h2>
              <p className="text-label text-night-muted">{provinces.length} provincias · {depCount.total} distritos</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-label font-bold text-night-text">Toda la región</span>
              <ToggleSwitch size="lg" checked={depCount.on === depCount.total} aria-label={`Activar toda la región ${depName}`} onChange={() => toggle(dep, depCount.on !== depCount.total)} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-3 flex-1 overflow-hidden rounded-full bg-night-high">
              <span className="block h-full rounded-full bg-pitch" style={{ width: `${Math.round((depCount.on / Math.max(1, depCount.total)) * 100)}%` }} />
            </span>
            <span className="text-label font-bold text-night-text tabular-nums">{depCount.on} de {depCount.total}</span>
          </div>

          <div className="space-y-2">
            <p className="text-label font-bold text-night-text">Provincias</p>
            <div className="flex flex-wrap gap-2">
              {provinces.map(([pc, pn]) => {
                const c = count(pc);
                return (
                  <AdminButton key={pc} compact tone={pc === prov ? "pitch" : "soft"} aria-pressed={pc === prov} onClick={() => setProv(pc)}>
                    {pn} <span className="font-medium opacity-70">{c.on}/{c.total}</span>
                  </AdminButton>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 border-t border-night-outline pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-label font-bold text-night-text">Distritos de la provincia de {provName} <span className="font-medium text-night-muted">({provCount.on}/{provCount.total})</span></p>
              <div className="flex gap-2">
                <AdminButton compact disabled={provCount.on === provCount.total} onClick={() => toggle(prov, true)}>Marcar todos</AdminButton>
                <AdminButton compact disabled={provCount.on === 0} onClick={() => toggle(prov, false)}>Quitar todos</AdminButton>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {districts.map(([c, n]) => {
                const on = active.has(c);
                return (
                  <AdminButton
                    key={c}
                    aria-pressed={on}
                    className={cn("justify-between border px-3 text-left font-medium", on ? "border-pitch bg-pitch/10 text-night-text" : "border-night-outline bg-white text-night-text")}
                    onClick={() => toggle(c, !on)}
                  >
                    <span className="truncate">{n}</span>
                    {on && <Check className="size-icon-md shrink-0 text-pitch" aria-hidden />}
                  </AdminButton>
                );
              })}
            </div>
          </div>
        </AdminPanel>

        {/* Confirmacion: debajo del detalle, siempre en el mismo lugar. */}
        <AdminPanel className="flex flex-wrap items-center justify-between gap-3 p-3">
          <p className="text-body text-night-text">
            {changes > 0 ? <>Tienes <strong>{changes}</strong> {changes === 1 ? "cambio" : "cambios"} sin guardar.</> : "No hay cambios por guardar."}
          </p>
          <div className="flex gap-2">
            <AdminButton disabled={changes === 0 || mutation.isPending} onClick={() => setDraft(null)}>Descartar</AdminButton>
            <AdminButton tone="pitch" disabled={changes === 0 || mutation.isPending} onClick={() => draft && mutation.mutate(Array.from(draft))}>
              {mutation.isPending ? "Guardando…" : "Confirmar cambios"}
            </AdminButton>
          </div>
        </AdminPanel>
        </div>
      </div>
    </div>
  );
}
