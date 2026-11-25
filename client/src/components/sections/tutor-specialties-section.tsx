import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ListHeader } from "@/components/ui/list-header";
import { ListScreen } from "@/components/ui/list-screen";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_SPECIALTIES, SpecialtiesPicker } from "@/components/ui/specialties-picker";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ROUTES } from "@/lib/routes";

interface CurrentTutor {
  id: string;
  specialties?: string[];
}

// Elegir las especialidades del tutor (hasta 8) en su propia pagina: buscador + lista de materias. Se llega desde "Especialidades"
// en Mi perfil; "Guardar" las envia y vuelve al perfil.
export default function TutorSpecialtiesSection() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const synced = useRef(false);

  const { data: tutor, isLoading } = useQuery<CurrentTutor>({ queryKey: ["/api/tutor/current"] });

  // Se carga una sola vez: un refetch en segundo plano no pisa lo que el tutor esta eligiendo.
  useEffect(() => {
    if (tutor && !synced.current) {
      synced.current = true;
      setSelected(tutor.specialties ?? []);
    }
  }, [tutor]);

  const dirty = !!tutor && selected.join("|") !== (tutor.specialties ?? []).join("|");
  const goBack = () => setLocation(ROUTES.tutorProfile);

  const save = useMutation({
    mutationFn: async () => {
      if (!tutor?.id) throw new Error("Perfil de tutor no encontrado");
      await apiRequest("PATCH", `/api/tutors/${tutor.id}`, { specialties: selected });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutors"] });
      toast({ variant: "success", title: "Especialidades guardadas", description: `${selected.length} de ${MAX_SPECIALTIES} materias elegidas.` });
      goBack();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudieron guardar las especialidades.", variant: "destructive" });
    },
  });

  return (
    <div className="flex min-h-full flex-col">
    <ListScreen className="flex-1">
      <ListHeader title="Especialidades" subtitle={`Elige hasta ${MAX_SPECIALTIES} materias en las que ayudas.`} onBack={goBack} />

      {isLoading ? <Skeleton className="h-96 w-full rounded-lg" /> : <SpecialtiesPicker value={selected} onChange={setSelected} fullHeight />}
    </ListScreen>

      {/* Barra siempre fija abajo (hermana de ListScreen, no hija): se pega al borde inferior de la pantalla sin hueco, haya o no scroll. */}
      <div className="sticky bottom-0 z-sticky flex justify-end gap-3 bg-white px-page-h py-3 shadow-float">
        <Button variant="outline" onClick={goBack} data-testid="button-cancel-specialties">Cancelar</Button>
        <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending} data-testid="button-save-specialties">
          {save.isPending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
