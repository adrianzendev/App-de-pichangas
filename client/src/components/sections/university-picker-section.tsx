import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListHeader } from "@/components/ui/list-header";
import { ListScreen } from "@/components/ui/list-screen";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { OutlinedControl } from "@/components/ui/outlined-field";
import { validateUniversity } from "@shared/profile-validation";
import { SearchField } from "@/components/ui/search-field";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface UniversityOption {
  id: string;
  name: string;
  country: string | null;
  acronym: string | null;
  status?: "approved" | "pending";
}

// Elegir la universidad (alumno y tutor) de la lista que mantiene el admin: una sola opcion, con buscador. "Guardar" la envia y
// vuelve a Mi perfil; "Quitar universidad" la deja vacia. Ya no se escribe a mano.
export default function UniversityPickerSection() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const synced = useRef(false);
  const [adding, setAdding] = useState<string | null>(null);

  const { data: user } = useQuery<{ university?: string | null; userType?: string }>({ queryKey: ["/api/user/current"] });
  const { data: options = [], isLoading } = useQuery<UniversityOption[]>({ queryKey: ["/api/universities"] });

  // Se carga una sola vez: un refetch en segundo plano no pisa lo que se esta eligiendo.
  useEffect(() => {
    if (user && !synced.current) {
      synced.current = true;
      setSelected(user.university ?? "");
    }
  }, [user]);

  const current = user?.university ?? "";
  const dirty = !!user && selected !== current;
  const goBack = () => setLocation(user?.userType === "tutor" ? ROUTES.tutorProfile : ROUTES.studentProfile);

  const q = search.trim().toLowerCase();
  const visible = useMemo(() => options.filter((o) => !q || o.name.toLowerCase().includes(q) || (o.acronym ?? "").toLowerCase().includes(q)), [options, q]);

  const save = useMutation({
    mutationFn: async () => { await apiRequest("PUT", "/api/user/current", { university: selected }); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/current"] });
      toast({ variant: "success", title: selected ? "Universidad guardada" : "Universidad quitada" });
      goBack();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "No se pudo guardar la universidad.", variant: "destructive" });
    },
  });

  const addCheck = adding === null ? { value: "", error: "" } : validateUniversity(adding);
  const add = useMutation({
    mutationFn: async (name: string) => (await apiRequest("POST", "/api/universities", { name })).json() as Promise<UniversityOption>,
    onSuccess: (u) => {
      queryClient.invalidateQueries({ queryKey: ["/api/universities"] });
      setSelected(u.name);
      setAdding(null);
      setSearch("");
      toast({ variant: "success", title: u.status === "pending" ? "Enviada a revisión" : "Universidad elegida", description: u.status === "pending" ? "Queda elegida mientras la revisamos: pulsa Guardar." : "Ya está elegida: pulsa Guardar." });
    },
    onError: (error: any) => toast({ title: "Error", description: error?.message || "No se pudo agregar la universidad.", variant: "destructive" }),
  });

  const addButton = (
    <div className="pt-2 text-center">
      <p className="text-label text-gray-700">¿No encuentras tu universidad?</p>
      <Button variant="ghost" onClick={() => setAdding(search.trim())} data-testid="button-add-university">Agregar mi universidad</Button>
    </div>
  );

  return (
    <div className="flex min-h-full flex-col">
    <ListScreen className="flex-1">
      <ListHeader title="Universidad" subtitle="Elige tu universidad de la lista." onBack={goBack} />

      <SearchField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nombre o siglas"
        aria-label="Buscar universidad por nombre o siglas"
        data-testid="search-university"
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : options.length === 0 ? (
        <EmptyState title="Aún no hay universidades disponibles" description="Estamos preparando la lista. Vuelve a intentarlo más tarde." />
      ) : visible.length === 0 ? (
        <EmptyState title="Sin resultados" description="Prueba con otra palabra o agrégala." action={<Button variant="outline" onClick={() => setAdding(search.trim())} data-testid="button-add-university">Agregar mi universidad</Button>} />
      ) : (
        <ul className="flex flex-col" data-testid="university-options">
          {visible.map((o) => {
            const active = o.name === selected;
            return (
              <li key={o.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelected(o.name)}
                  data-testid={`university-option-${o.id}`}
                  className={cn(
                    "flex min-h-14 w-full items-center justify-between gap-3 rounded-row px-3 py-2 text-left text-body transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    active ? "font-semibold text-gray-900" : "font-normal text-gray-900",
                  )}
                >
                  <span className="min-w-0">
                    {o.name}
                    {o.acronym && <span className="ml-2 text-label font-normal text-gray-700">{o.acronym}</span>}
                    {o.status === "pending" && <span className="ml-2 text-label font-normal text-gray-700">(en revisión)</span>}
                  </span>
                  {active && <Check aria-hidden className="size-icon-lg shrink-0 text-green-600" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!isLoading && options.length > 0 && visible.length > 0 && addButton}

      {adding !== null && (
        <FormDialog
          open
          onOpenChange={(open) => { if (!open) setAdding(null); }}
          title="Agregar mi universidad"
          testId="modal-add-university"
          onCancel={() => setAdding(null)}
          onSubmit={() => add.mutate(addCheck.value)}
          submitLabel={add.isPending ? "Agregando…" : "Agregar"}
          submitDisabled={add.isPending || !addCheck.value || !!addCheck.error}
          submitTestId="button-confirm-add-university"
        >
          <OutlinedControl htmlFor="add-university-name" label={<>Nombre completo <span aria-hidden className="text-error-fg">*</span></>}>
            <Input id="add-university-name" aria-required autoFocus value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Universidad Nacional de San Antonio Abad" data-testid="input-add-university" />
          </OutlinedControl>
          {adding.trim() && addCheck.error && <p className="text-caption text-error-fg">{addCheck.error}</p>}
        </FormDialog>
      )}
    </ListScreen>

      {/* Barra siempre fija abajo (hermana de ListScreen, no hija): se pega al borde inferior de la pantalla sin hueco, haya o no scroll. */}
      <div className="sticky bottom-0 z-sticky flex items-center justify-between gap-3 bg-white px-page-h py-3 shadow-float">
        {selected ? (
          <Button variant="ghost" onClick={() => setSelected("")} data-testid="button-clear-university">Quitar universidad</Button>
        ) : <span />}
        <div className="flex gap-3">
          <Button variant="outline" onClick={goBack} data-testid="button-cancel-university">Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending} data-testid="button-save-university">
            {save.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
