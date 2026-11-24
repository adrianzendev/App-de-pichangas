import { OutlinedControl } from "@/components/ui/outlined-field";
import { useState } from "react";
import { SearchField } from "@/components/ui/search-field";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { LogOut, FileText, UserPlus, Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountrySelect } from "@/components/ui/country-select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { logout } from "@/lib/logout";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { TaskWithCandidates, User as UserType } from "@shared/schema";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:           { label: "Buscando...",   color: "bg-green-100 text-green-700" },
  in_progress:      { label: "En progreso",   color: "bg-blue-100 text-blue-700" },
  payment_pending:  { label: "Pago pendiente",color: "bg-gray-100 text-gray-700" },
  payment_rejected: { label: "Pago rechazado",color: "bg-gray-100 text-gray-700" },
  completed:        { label: "Terminada",     color: "bg-gray-100 text-gray-700" },
  expired:          { label: "Vencida",       color: "bg-gray-100 text-gray-700" },
};

export default function AgentPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"pedidos" | "agregar">("pedidos");
  const [search, setSearch] = useState("");
  const [tutorForm, setTutorForm] = useState({
    name: "", email: "", password: "123456", country: "PE", profession: ""
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: currentUser, isLoading: isLoadingUser, isError: isErrorUser } = useQuery<UserType & { userType?: string }>({
    queryKey: ["/api/user/current"],
  });

  const { data: tasks, isLoading: isLoadingTasks } = useQuery<TaskWithCandidates[]>({
    queryKey: ["/api/tasks"],
    enabled: !!currentUser,
  });

  const createTutorMutation = useMutation({
    mutationFn: (body: typeof tutorForm) =>
      apiRequest("POST", "/api/admin/tutors", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutors"] });
      setTutorForm({ name: "", email: "", password: "123456", country: "PE", profession: "" });
      toast({ title: "Tutor creado", description: "El tutor fue registrado correctamente." });
    },
    onError: async (err: any) => {
      const data = await err?.response?.json?.().catch?.(() => ({})) || {};
      toast({ title: "Error", description: data?.message || "No se pudo crear el tutor.", variant: "destructive" });
    },
  });

  const handleLogout = () => logout();

  const filteredTasks = (tasks || []).filter(t => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.title?.toLowerCase().includes(q) ||
      t.subject?.toLowerCase().includes(q) ||
      t.studyArea?.toLowerCase().includes(q)
    );
  });

  const handleCreateTutor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorForm.name.trim() || !tutorForm.email.trim()) {
      toast({ title: "Campos requeridos", description: "Nombre y correo son obligatorios.", variant: "destructive" });
      return;
    }
    createTutorMutation.mutate(tutorForm);
  };

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (isErrorUser || !currentUser) {
    window.location.href = "/login";
    return null;
  }

  if ((currentUser as any).userType !== "agent") {
    const userType = (currentUser as any).userType;
    window.location.href = userType === "admin" ? "/dashboard" : "/";
    return null;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-container mx-auto flex items-center justify-between">
          <BrandLogo size="sm" tone="light" />
          <div className="flex items-center gap-3">
            <span className="text-label text-gray-700 hidden sm:block">{currentUser.name}</span>
            <Badge variant="info">Agente</Badge>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-label text-gray-700 hover:text-gray-900 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-container mx-auto px-4 flex gap-1">
          <button
            onClick={() => setActiveTab("pedidos")}
            className={`flex items-center gap-2 px-4 py-3 text-label font-medium border-b-2 transition-colors ${
              activeTab === "pedidos"
                ? "border-primary text-green-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <FileText className="w-4 h-4" />
            Pedidos
          </button>
          <button
            onClick={() => setActiveTab("agregar")}
            className={`flex items-center gap-2 px-4 py-3 text-label font-medium border-b-2 transition-colors ${
              activeTab === "agregar"
                ? "border-primary text-green-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Agregar Tutor
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-container mx-auto w-full px-4 py-6">

        {/* PEDIDOS TAB */}
        {activeTab === "pedidos" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-heading font-bold text-gray-900">Pedidos</h1>
              <span className="text-label text-gray-500">{filteredTasks.length} pedidos</span>
            </div>

            {/* Search */}
            <SearchField
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por título, materia..."
              aria-label="Buscar por título o materia"
            />

            {isLoadingTasks ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <EmptyState icon={FileText} title="No hay pedidos" className="py-16" />
            ) : (
              <div className="bg-white rounded-lg border border-field overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left text-caption font-medium text-gray-700 px-4 py-3">#</th>
                        <th className="text-left text-caption font-medium text-gray-700 px-4 py-3">Título</th>
                        <th className="text-left text-caption font-medium text-gray-700 px-4 py-3">Materia</th>
                        <th className="text-left text-caption font-medium text-gray-700 px-4 py-3">Estado</th>
                        <th className="text-left text-caption font-medium text-gray-700 px-4 py-3">Vence</th>
                        <th className="text-left text-caption font-medium text-gray-700 px-4 py-3">Postulantes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map(task => {
                        const statusInfo = STATUS_LABELS[task.status] || { label: task.status, color: "bg-gray-100 text-gray-700" };
                        return (
                          <tr key={task.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-caption text-gray-700">{task.taskNumber || "-"}</td>
                            <td className="px-4 py-3">
                              <p className="text-label font-medium text-gray-900 line-clamp-1 max-w-xs">{task.title}</p>
                            </td>
                            <td className="px-4 py-3 text-label text-gray-700">{task.studyArea || task.subject}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-label font-medium ${statusInfo.color}`}>
                                {statusInfo.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-caption text-gray-700">
                              {task.deadline
                                ? format(new Date(task.deadline), "dd MMM yy", { locale: es })
                                : "-"}
                            </td>
                            <td className="px-4 py-3 text-label text-gray-700">
                              {task.candidates?.length ?? 0}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AGREGAR TUTOR TAB */}
        {activeTab === "agregar" && (
          <div className="max-w-md">
            <h1 className="text-heading font-bold text-gray-900 mb-6">Agregar Tutor</h1>
            <div className="bg-white rounded-lg border border-field p-6">
              <form onSubmit={handleCreateTutor} className="space-y-field-gap">
                <div className="space-y-1.5">
                  <OutlinedControl htmlFor="tutor-name" label={<>Nombre completo <span aria-hidden className="text-error-fg">*</span></>}>
                    <Input
                      id="tutor-name"
                      value={tutorForm.name}
                      onChange={e => setTutorForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ej: Juan Pérez"
                    />
                  </OutlinedControl>
                </div>
                <div className="space-y-1.5">
                  <OutlinedControl htmlFor="tutor-email" label={<>Correo electrónico <span aria-hidden className="text-error-fg">*</span></>}>
                    <Input
                      id="tutor-email"
                      type="email"
                      value={tutorForm.email}
                      onChange={e => setTutorForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="tutor@ejemplo.com"
                    />
                  </OutlinedControl>
                </div>
                <div className="space-y-1.5">
                  <OutlinedControl htmlFor="tutor-password" label="Contraseña">
                    <Input
                      id="tutor-password"
                      value={tutorForm.password}
                      onChange={e => setTutorForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="123456"
                    />
                  </OutlinedControl>
                  <p className="text-caption text-gray-700">El tutor podrá cambiarla después.</p>
                </div>
                <div className="space-y-1.5">
                  <OutlinedControl htmlFor="tutor-profession" label="Profesión / Especialidad">
                    <Input
                      id="tutor-profession"
                      value={tutorForm.profession}
                      onChange={e => setTutorForm(f => ({ ...f, profession: e.target.value }))}
                      placeholder="Ej: Ingeniero Civil, Psicólogo"
                    />
                  </OutlinedControl>
                </div>
                <div className="space-y-1.5">
                  <OutlinedControl htmlFor="tutor-country" label="País">
                    <CountrySelect
                      id="tutor-country"
                      value={tutorForm.country}
                      onValueChange={(v) => setTutorForm(f => ({ ...f, country: v }))}
                    />
                  </OutlinedControl>
                </div>
                <Button
                  type="submit"
                  disabled={createTutorMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  {createTutorMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creando tutor...</>
                  ) : (
                    "Crear Tutor"
                  )}
                </Button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
