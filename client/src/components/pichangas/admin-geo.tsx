import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { AdminButton, AdminInput, AdminPanel } from "@/components/pichangas/admin-ui";
import { NightCheckbox } from "@/components/pichangas/night-controls";
import { PageLoader } from "@/components/ui/spinner";
import { toast } from "@/hooks/use-toast";
import { PERU_DEPARTMENTS, PERU_DISTRICTS, PERU_PROVINCES } from "@shared/peru-geo";
import { setGeoRequest, useAdminGeo } from "@/lib/admin-pichangas";
import { cn } from "@/lib/utils";

interface Node { code: string; name: string; total: number; on: number }

/** Casilla de una zona: marcada si todos sus distritos estan activos, "mixta" si solo algunos. */
function ZoneCheck({ id, node, label, onToggle }: { id?: string; node: Node; label: string; onToggle: (active: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const all = node.on === node.total;
  const some = node.on > 0 && !all;
  useEffect(() => { if (ref.current) ref.current.indeterminate = some; }, [some]);
  return <NightCheckbox ref={ref} id={id} checked={all} aria-label={label} onChange={() => onToggle(!all)} />;
}

function Count({ node }: { node: Node }) {
  return <span className="shrink-0 text-caption text-night-muted tabular-nums">{node.on}/{node.total}</span>;
}

// Seccion "Geografía": activa departamentos, provincias y distritos de todo el Peru. Activar una zona activa todo lo que contiene.
export function AdminGeoView() {
  const { data, isLoading, isError, refetch } = useAdminGeo();
  const qc = useQueryClient();
  const [openDep, setOpenDep] = useState<Set<string>>(new Set());
  const [openProv, setOpenProv] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const mutation = useMutation({
    mutationFn: setGeoRequest,
    onSuccess: (d) => qc.setQueryData(["/api/admin/pichangas/geo"], d),
    onError: () => toast({ variant: "destructive", title: "No pudimos guardar el cambio" }),
  });
  const toggle = (code: string, active: boolean) => mutation.mutate({ code, active });

  const active = useMemo(() => new Set(data?.active ?? []), [data]);
  // Distritos activos y totales por prefijo de departamento (2) y de provincia (4).
  const counts = useMemo(() => {
    const on = new Map<string, number>();
    const total = new Map<string, number>();
    for (const [c] of PERU_DISTRICTS) {
      for (const k of [c.slice(0, 2), c.slice(0, 4)]) {
        total.set(k, (total.get(k) ?? 0) + 1);
        if (active.has(c)) on.set(k, (on.get(k) ?? 0) + 1);
      }
    }
    return (code: string, name: string): Node => ({ code, name, total: total.get(code) ?? 0, on: on.get(code) ?? 0 });
  }, [active]);

  const flip = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  };

  if (isError) {
    return (
      <AdminPanel className="space-y-3 p-4">
        <p className="text-body text-night-text">No pudimos cargar la geografía.</p>
        <AdminButton onClick={() => refetch()}>Reintentar</AdminButton>
      </AdminPanel>
    );
  }
  if (isLoading || !data) return <PageLoader />;

  const q = query.trim().toLowerCase();
  const depName = (code: string) => PERU_DEPARTMENTS.find(([d]) => d === code.slice(0, 2))?.[1];
  const provName = (code: string) => PERU_PROVINCES.find(([p]) => p === code.slice(0, 4))?.[1];
  const results = q.length < 2 ? [] : [
    ...PERU_DEPARTMENTS.filter(([, n]) => n.toLowerCase().includes(q)).map(([c, n]) => ({ ...counts(c, n), sub: "Departamento" })),
    ...PERU_PROVINCES.filter(([, n]) => n.toLowerCase().includes(q)).map(([c, n]) => ({ ...counts(c, n), sub: `Provincia · ${depName(c)}` })),
    ...PERU_DISTRICTS.filter(([, n]) => n.toLowerCase().includes(q)).map(([c, n]) => ({ code: c, name: n, total: 1, on: active.has(c) ? 1 : 0, sub: `Distrito · ${provName(c)}, ${depName(c)}` })),
  ].slice(0, 60);

  return (
    <div className="space-y-4">
      <AdminInput type="search" placeholder="Buscar departamento, provincia o distrito" value={query} onChange={(e) => setQuery(e.target.value)} />

      {q.length >= 2 ? (
        <AdminPanel className="divide-y divide-night-outline">
          {results.length === 0 && <p className="p-4 text-body text-night-muted">Sin resultados.</p>}
          {results.map((r) => (
            <label key={r.code} htmlFor={`geo-${r.code}`} className="flex cursor-pointer items-center gap-3 px-4 py-3">
              <ZoneCheck id={`geo-${r.code}`} node={r} label={r.name} onToggle={(a) => toggle(r.code, a)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-night-text">{r.name}</span>
                <span className="block truncate text-caption text-night-muted">{r.sub}</span>
              </span>
              {r.total > 1 && <Count node={r} />}
            </label>
          ))}
        </AdminPanel>
      ) : (
        <AdminPanel className="divide-y divide-night-outline">
          {PERU_DEPARTMENTS.map(([dc, dn]) => {
            const dep = counts(dc, dn);
            const isOpen = openDep.has(dc);
            return (
              <div key={dc}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <ZoneCheck node={dep} label={dn} onToggle={(a) => toggle(dc, a)} />
                  <AdminButton tone="soft" className="min-w-0 flex-1 justify-start" aria-expanded={isOpen} onClick={() => flip(openDep, setOpenDep, dc)}>
                    <ChevronRight className={cn("size-icon-md shrink-0 transition-transform", isOpen && "rotate-90")} aria-hidden />
                    <span className="truncate font-bold">{dn}</span>
                  </AdminButton>
                  <Count node={dep} />
                </div>
                {isOpen && (
                  <div className="space-y-1 pb-3 pl-10 pr-4">
                    {PERU_PROVINCES.filter(([pc]) => pc.startsWith(dc)).map(([pc, pn]) => {
                      const prov = counts(pc, pn);
                      const provOpen = openProv.has(pc);
                      return (
                        <div key={pc}>
                          <div className="flex items-center gap-3 py-2">
                            <ZoneCheck node={prov} label={pn} onToggle={(a) => toggle(pc, a)} />
                            <AdminButton tone="soft" compact className="min-w-0 flex-1 justify-start" aria-expanded={provOpen} onClick={() => flip(openProv, setOpenProv, pc)}>
                              <ChevronRight className={cn("size-icon-md shrink-0 transition-transform", provOpen && "rotate-90")} aria-hidden />
                              <span className="truncate">{pn}</span>
                            </AdminButton>
                            <Count node={prov} />
                          </div>
                          {provOpen && (
                            <div className="flex flex-wrap gap-x-6 gap-y-1 py-1 pl-10">
                              {PERU_DISTRICTS.filter(([c]) => c.startsWith(pc)).map(([c, n]) => (
                                <label key={c} htmlFor={`geo-${c}`} className="flex w-44 cursor-pointer items-center gap-2 py-1 text-body text-night-text">
                                  <NightCheckbox id={`geo-${c}`} checked={active.has(c)} onChange={() => toggle(c, !active.has(c))} />
                                  <span className="truncate">{n}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </AdminPanel>
      )}
    </div>
  );
}
