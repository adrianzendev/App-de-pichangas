import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminSection, AdminSectionHeader, AdminToolbar, AdminFilters, AdminPagination } from "@/components/admin/admin-layout";
import { AdminTableCard, AdminTable, AdminTableHead, AdminTableBody, AdminTr, AdminTh, AdminTd, AdminTableSkeletonRows } from "@/components/ui/admin-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterSelect } from "@/components/ui/filter-select";
import { apiRequest } from "@/lib/queryClient";
import { LIMA_TZ, fmtDateTimeShort } from "@/lib/date-format";
import type { SuperadminAuditAction } from "@shared/schema";

const PAGE_SIZE = 25;
const QUERY_KEY = "/api/admin/audit-log";
const COLUMNS = 6;

interface AuditDetail {
  method?: string;
  route?: string;
  status?: number;
  reason?: "stop" | "logout" | "expired";
}

interface AuditRow {
  id: string;
  action: SuperadminAuditAction;
  detail: AuditDetail | null;
  ip: string | null;
  createdAt: string;
  actorName: string | null;
  targetName: string | null;
  targetEmail: string | null;
}

interface AuditPage {
  items: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
}

const END_REASON: Record<NonNullable<AuditDetail["reason"]>, string> = {
  stop: "Pulsó Salir",
  logout: "Cerró sesión",
  expired: "Venció a los 30 min",
};

function ActionBadge({ row }: { row: AuditRow }) {
  if (row.action === "impersonate_start") return <Badge variant="success">Inició</Badge>;
  if (row.action === "impersonate_end") return <Badge variant="neutral">Terminó</Badge>;
  if (row.action === "read") return <Badge variant="info">Lectura</Badge>;
  if (row.detail?.status === 403) return <Badge variant="outline" className="border-error bg-error-bg text-error-strong">Bloqueada</Badge>;
  return <Badge variant="outline">Escritura</Badge>;
}

// Seccion "Auditoria" del panel: lo que registra server/superadmin.ts (suplantaciones y acciones del super admin).
// Solo lectura y solo para el super admin: el servidor responde 403 al resto.
export function AuditLogSection() {
  const [action, setAction] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isPending, isError, refetch } = useQuery<AuditPage>({
    queryKey: [QUERY_KEY, action, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (action !== "all") params.set("action", action);
      return (await apiRequest("GET", `${QUERY_KEY}?${params}`)).json();
    },
    placeholderData: (previous) => previous, // al cambiar de pagina o filtro no parpadea la tabla
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminSection fill testId="section-audit">
      <AdminSectionHeader description="Suplantaciones y acciones del super administrador. Este registro no se puede editar." />
      <AdminToolbar>
        <AdminFilters>
          <FilterSelect data-testid="select-audit-action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
            <option value="all">Acción: Todas</option>
            <option value="impersonate_start">Inició</option>
            <option value="impersonate_end">Terminó</option>
            <option value="read">Lectura</option>
            <option value="request">Escritura o bloqueada</option>
          </FilterSelect>
        </AdminFilters>
      </AdminToolbar>

      {isError ? (
        <EmptyState title="No pudimos cargar la auditoría" description="Revisa tu conexión e inténtalo de nuevo." action={<Button onClick={() => refetch()}>Reintentar</Button>} />
      ) : (
        <AdminTableCard fill>
          <AdminTable minWidth={1000} data-testid="table-audit-log">
            <AdminTableHead>
              <tr>
                <AdminTh>Fecha</AdminTh>
                <AdminTh>Acción</AdminTh>
                <AdminTh>Administrador</AdminTh>
                <AdminTh>Cuenta</AdminTh>
                <AdminTh>Detalle</AdminTh>
                <AdminTh>IP</AdminTh>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {isPending ? (
                <AdminTableSkeletonRows columns={COLUMNS} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS}>
                    <EmptyState title="No hay registros" description="Las suplantaciones y acciones del super administrador aparecerán aquí." />
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <AdminTr key={row.id} data-testid={`row-audit-${row.id}`}>
                    <AdminTd variant="secondary" className="whitespace-nowrap">{fmtDateTimeShort(row.createdAt, LIMA_TZ)}</AdminTd>
                    <AdminTd><ActionBadge row={row} /></AdminTd>
                    <AdminTd>{row.actorName ?? "—"}</AdminTd>
                    <AdminTd>
                      <p>{row.targetName ?? "—"}</p>
                      {row.targetEmail && <p className="text-caption text-gray-700 break-words">{row.targetEmail}</p>}
                    </AdminTd>
                    <AdminTd variant="muted">
                      {row.detail?.route ? (
                        <span className="font-mono break-words">{row.detail.method} {row.detail.route} · {row.detail.status}</span>
                      ) : row.detail?.reason ? (
                        END_REASON[row.detail.reason]
                      ) : "—"}
                    </AdminTd>
                    <AdminTd variant="muted" className="whitespace-nowrap">{row.ip || "—"}</AdminTd>
                  </AdminTr>
                ))
              )}
            </AdminTableBody>
          </AdminTable>
        </AdminTableCard>
      )}
      <AdminPagination page={data?.page ?? page} pageCount={pageCount} total={total} size={PAGE_SIZE} onPageChange={setPage} />
    </AdminSection>
  );
}
