import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle, FileText } from "lucide-react";
import { AdminSection, AdminSectionHeader, AdminToolbar, AdminFilters, AdminPagination } from "@/components/admin/admin-layout";
import { AdminTableCard, AdminTable, AdminTableHead, AdminTableBody, AdminTr, AdminTh, AdminTd, AdminActionsTh, AdminActionsTd, AdminTableSkeletonRows } from "@/components/ui/admin-table";
import { AdminRowAction } from "@/components/admin/row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterSelect } from "@/components/ui/filter-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LIMA_TZ, fmtDateTimeShort } from "@/lib/date-format";
import type { ErrorLogLevel, ErrorLogWithUser } from "@shared/schema";

const PAGE_SIZE = 25;
const QUERY_KEY = "/api/admin/error-logs";

interface ErrorLogsPage {
  items: ErrorLogWithUser[];
  total: number;
  page: number;
  pageSize: number;
}

// Nivel -> etiqueta y colores (solo tokens del sistema). Critico = relleno; error = suave; advertencia = amarillo.
const LEVEL_UI: Record<ErrorLogLevel, { label: string; className: string }> = {
  critical: { label: "Crítico", className: "border-error bg-error text-white" },
  error: { label: "Error", className: "border-error bg-error-bg text-error-strong" },
  warning: { label: "Advertencia", className: "border-warning bg-warning-bg text-warning-fg" },
};

function LevelBadge({ level }: { level: string }) {
  const ui = LEVEL_UI[level as ErrorLogLevel] ?? LEVEL_UI.error;
  return <Badge variant="outline" className={ui.className}>{ui.label}</Badge>;
}

// Seccion "Errores" del panel de administracion: lo que registra server/middleware/error-logger.ts (respuestas 5xx,
// excepciones no capturadas y registros manuales). Solo administrador: el servidor responde 403 al resto.
export function ErrorLogsSection() {
  const { toast } = useToast();
  const [status, setStatus] = useState("pending");
  const [level, setLevel] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ErrorLogWithUser | null>(null);

  const { data, isPending, isError, refetch } = useQuery<ErrorLogsPage>({
    queryKey: [QUERY_KEY, status, level, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (status !== "all") params.set("status", status);
      if (level !== "all") params.set("level", level);
      return (await apiRequest("GET", `${QUERY_KEY}?${params}`)).json();
    },
    placeholderData: (previous) => previous, // al cambiar de pagina o filtro no parpadea la tabla
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("PATCH", `${QUERY_KEY}/${id}`, { status: "resolved" })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      setSelected(null);
      toast({ variant: "success", title: "Error marcado como resuelto" });
    },
    onError: () => toast({ variant: "destructive", title: "No se pudo actualizar el registro" }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const changeFilter = (setter: (v: string) => void) => (e: { target: { value: string } }) => { setter(e.target.value); setPage(1); };

  return (
    <AdminSection fill testId="section-errors">
      <AdminSectionHeader description="Errores del servidor (respuestas 500 y excepciones no capturadas) y adjuntos que fallaron en el teléfono del usuario (Advertencia)" />
      <AdminToolbar>
        <AdminFilters>
          <FilterSelect data-testid="select-error-status" value={status} onChange={changeFilter(setStatus)}>
            <option value="pending">Estado: Pendientes</option>
            <option value="resolved">Estado: Resueltos</option>
            <option value="all">Estado: Todos</option>
          </FilterSelect>
          <FilterSelect data-testid="select-error-level" value={level} onChange={changeFilter(setLevel)}>
            <option value="all">Nivel: Todos</option>
            <option value="critical">Crítico</option>
            <option value="error">Error</option>
            <option value="warning">Advertencia</option>
          </FilterSelect>
        </AdminFilters>
      </AdminToolbar>

      {isError ? (
        <EmptyState title="No pudimos cargar los errores" description="Revisa tu conexión e inténtalo de nuevo." action={<Button onClick={() => refetch()}>Reintentar</Button>} />
      ) : (
        <AdminTableCard fill>
          <AdminTable minWidth={1080} data-testid="table-error-logs">
            <AdminTableHead>
              <tr>
                <AdminTh>Nivel</AdminTh>
                <AdminTh>Fecha</AdminTh>
                <AdminTh>Usuario</AdminTh>
                <AdminTh>Ruta</AdminTh>
                <AdminTh>Mensaje</AdminTh>
                <AdminActionsTh />
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {isPending ? (
                <AdminTableSkeletonRows columns={6} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title={status === "pending" ? "Sin errores pendientes" : "No hay registros"} description="Los errores del servidor aparecerán aquí." />
                  </td>
                </tr>
              ) : (
                items.map((log) => (
                  <AdminTr key={log.id} data-testid={`row-error-${log.id}`}>
                    <AdminTd><LevelBadge level={log.level} /></AdminTd>
                    <AdminTd variant="secondary" className="whitespace-nowrap">
                      {log.createdAt ? fmtDateTimeShort(log.createdAt, LIMA_TZ) : "—"}
                    </AdminTd>
                    <AdminTd className="whitespace-nowrap" title={log.userEmail ?? undefined}>{log.userName || "—"}</AdminTd>
                    <AdminTd variant="muted">
                      <span className="font-mono break-words">{log.method ? `${log.method} ` : ""}{log.route || "—"}</span>
                    </AdminTd>
                    <AdminTd>
                      <p className="line-clamp-2 break-words" title={log.message}>{log.message}</p>
                    </AdminTd>
                    <AdminActionsTd endsWithIcon={false}>
                        <AdminRowAction icon={FileText} label="Ver detalle del error" data-testid={`button-error-detail-${log.id}`} onClick={() => setSelected(log)} />
                        {log.status === "pending" ? (
                          <Button
                            variant="outline"
                            size="xs"
                            data-testid={`button-error-resolve-${log.id}`}
                            disabled={resolveMutation.isPending}
                            onClick={() => resolveMutation.mutate(log.id)}
                          >
                            <CheckCircle className="size-icon-md" />
                            Marcar como resuelto
                          </Button>
                        ) : (
                          <Badge variant="success">Resuelto</Badge>
                        )}
                    </AdminActionsTd>
                  </AdminTr>
                ))
              )}
            </AdminTableBody>
          </AdminTable>
        </AdminTableCard>
      )}
      <AdminPagination page={data?.page ?? page} pageCount={pageCount} total={total} size={PAGE_SIZE} onPageChange={setPage} />

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-modal-md" data-testid="dialog-error-detail">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <LevelBadge level={selected.level} />
                  Detalle del error
                </DialogTitle>
                <DialogDescription>
                  {selected.createdAt ? fmtDateTimeShort(selected.createdAt, LIMA_TZ) : "—"} · <span className="font-mono">{selected.method ? `${selected.method} ` : ""}{selected.route || "—"}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-caption text-gray-700">Usuario</p>
                  <p className="text-body text-gray-900 break-words" data-testid="text-error-user">
                    {selected.userName ? `${selected.userName}${selected.userEmail ? ` · ${selected.userEmail}` : ""}` : "Sin sesión"}
                  </p>
                </div>
                <div>
                  <p className="text-caption text-gray-700">Mensaje</p>
                  <p className="text-body text-gray-900 break-words" data-testid="text-error-message">{selected.message}</p>
                </div>
                <div>
                  <p className="text-caption text-gray-700">Stack trace</p>
                  {selected.stack ? (
                    <pre
                      className="mt-1 max-h-modal-body overflow-auto whitespace-pre-wrap break-words rounded-md bg-gray-50 p-4 font-mono text-caption text-gray-900"
                      data-testid="text-error-stack"
                    >
                      {selected.stack}
                    </pre>
                  ) : (
                    <p className="text-label text-gray-700">{selected.method === "CLIENTE" ? "Sin stack: aviso enviado desde el teléfono o navegador del usuario." : "Sin stack: el endpoint respondió 500 sin lanzar una excepción."}</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="destructive" onClick={() => setSelected(null)}>Cerrar</Button>
                {selected.status === "pending" && (
                  <Button isLoading={resolveMutation.isPending} onClick={() => resolveMutation.mutate(selected.id)} data-testid="button-error-resolve-modal">
                    <CheckCircle className="size-icon-md" />
                    Marcar como resuelto
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminSection>
  );
}
