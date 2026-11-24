import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CircleDollarSign, Gauge, LayoutDashboard, ListChecks, MapPin, ScrollText, Users, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterPills } from "@/components/ui/filter-pills";
import { ListScreen } from "@/components/ui/list-screen";
import { MetricCard } from "@/components/ui/metric-card";
import { PageLoader } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AdminActionsTd, AdminActionsTh, AdminTable, AdminTableBody, AdminTableCard, AdminTableHead, AdminTableSkeletonRows,
  AdminTd, AdminTh, AdminTr,
} from "@/components/ui/admin-table";
import { LOGOUT_ACTION, PlayerShell, type ShellItem } from "@/components/pichangas/player-shell";
import { ProfileMenuButton } from "@/components/layout/profile-menu-button";
import { toast } from "@/hooks/use-toast";
import { ADMIN_ROUTES, PLAY_ROUTES, ROUTES } from "@/lib/routes";
import { AdminMatchForm } from "@/components/pichangas/admin-match-form";
import { AdminRulesView } from "@/components/pichangas/admin-rules";
import {
  cancelMatchRequest, createMatchRequest, deleteMatchRequest, setPlayerStatusRequest, setVenueActiveRequest, updateMatchRequest,
  useAdminAction, useAdminMatches, useAdminOverview, useAdminPlayers, useAdminVenues,
  type AdminMatch, type AdminMatchInput, type AdminPlayer, type AdminVenue,
} from "@/lib/admin-pichangas";
import { FORMAT_LABEL, SURFACE_LABEL, dayLabel, priceLabel, timeLabel } from "@/lib/pichangas";

const NAV: ShellItem[] = [
  { id: "overview", label: "Resumen", icon: LayoutDashboard, path: ADMIN_ROUTES.overview },
  { id: "matches", label: "Partidos", icon: CalendarDays, path: ADMIN_ROUTES.matches },
  { id: "venues", label: "Canchas", icon: MapPin, path: ADMIN_ROUTES.venues },
  { id: "players", label: "Jugadores", icon: Users, path: ADMIN_ROUTES.players },
  { id: "rules", label: "Reglas", icon: ScrollText, path: ADMIN_ROUTES.rules },
];

// El admin solo tiene "Cerrar sesión": no hay perfil editable en este panel.
const ACCOUNT_ACTIONS = [LOGOUT_ACTION];

const soles = (n: number) => `S/ ${n.toLocaleString("es-PE")}`;
const errorText = (e: unknown) => (e instanceof Error ? e.message : undefined);

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="space-y-1">
      <h1 className="text-heading font-bold text-gray-900">{title}</h1>
      <p className="text-body text-gray-700">{subtitle}</p>
    </header>
  );
}

function TableState({ isLoading, isError, empty, columns, onRetry, children }: {
  isLoading: boolean; isError: boolean; empty: boolean; columns: number; onRetry: () => void; children: ReactNode;
}) {
  if (isError) {
    return <EmptyState centered title="No pudimos cargar los datos" description="Revisa tu conexión e inténtalo de nuevo." action={<Button onClick={onRetry}>Reintentar</Button>} />;
  }
  if (!isLoading && empty) return <EmptyState centered icon={ListChecks} title="No hay registros todavía" />;
  return (
    <AdminTableCard fill={false}>
      {isLoading ? <AdminTable minWidth={720}><AdminTableBody><AdminTableSkeletonRows columns={columns} /></AdminTableBody></AdminTable> : children}
    </AdminTableCard>
  );
}

// ───────────── Resumen ─────────────

function OverviewView() {
  const [, setLocation] = useLocation();
  const { data, isLoading, isError, refetch } = useAdminOverview();

  if (isError) {
    return <EmptyState centered title="No pudimos cargar el resumen" action={<Button onClick={() => refetch()}>Reintentar</Button>} />;
  }
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
      </div>
    );
  }
  const maxMatches = Math.max(1, ...data.byCity.map((c) => c.matches));
  const kpis: { title: string; value: string | number; icon: LucideIcon; subtitle: string; id: string }[] = [
    { id: "players", title: "Jugadores", value: data.players, icon: Users, subtitle: "Cuentas registradas" },
    { id: "upcoming", title: "Partidos próximos", value: data.upcomingMatches, icon: CalendarDays, subtitle: `${data.totalMatches} en total, ${data.cancelledMatches} cancelados` },
    { id: "occupancy", title: "Ocupación", value: `${data.occupancy}%`, icon: Gauge, subtitle: "Cupos llenos en partidos próximos" },
    { id: "waitlist", title: "Suplentes en espera", value: data.waitlistTotal, icon: ListChecks, subtitle: "Entran si alguien se baja" },
    { id: "venues", title: "Canchas activas", value: data.activeVenues, icon: MapPin, subtitle: data.pendingVenues > 0 ? `${data.pendingVenues} por revisar` : "Todas revisadas" },
    { id: "revenue", title: "Cuotas estimadas", value: soles(data.estimatedRevenue), icon: CircleDollarSign, subtitle: "Cupos confirmados por su cuota" },
  ];

  return (
    <div className="space-y-section-gap">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {kpis.map((k) => <MetricCard key={k.id} testId={`kpi-${k.id}`} title={k.title} value={k.value} icon={k.icon} subtitle={k.subtitle} />)}
      </div>

      {data.pendingVenues > 0 && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-card-pad" aria-label="Pendientes">
          <div>
            <p className="text-body font-semibold text-gray-900">
              {data.pendingVenues === 1 ? "Hay 1 cancha esperando aprobación" : `Hay ${data.pendingVenues} canchas esperando aprobación`}
            </p>
            <p className="text-body text-gray-700">Aparecen en la app cuando las apruebas.</p>
          </div>
          <Button variant="secondary" onClick={() => setLocation(ADMIN_ROUTES.venues)}>Revisar canchas</Button>
        </section>
      )}

      <section className="space-y-4 rounded-lg bg-white p-card-pad" aria-label="Partidos por ciudad">
        <h2 className="text-subheading font-semibold text-gray-900">Partidos por ciudad</h2>
        <ul className="space-y-3">
          {data.byCity.map((c) => (
            <li key={c.city} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-body font-medium text-gray-900">{c.city}</p>
                <p className="text-label text-gray-700">{c.matches} {c.matches === 1 ? "partido" : "partidos"}, {c.players} jugadores</p>
              </div>
              <div className="h-2 rounded-full bg-gray-100" role="presentation">
                <div className="h-2 rounded-full bg-green-600" style={{ width: `${(c.matches / maxMatches) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ───────────── Partidos ─────────────

const MATCH_FILTERS = [
  { id: "all", label: "Todos" },
  { id: "upcoming", label: "Próximos" },
  { id: "finished", label: "Terminados" },
  { id: "cancelled", label: "Cancelados" },
] as const;

function MatchStatusBadge({ m }: { m: AdminMatch }) {
  if (m.status === "cancelled") return <Badge variant="outline" className="border-error text-error-fg">Cancelado</Badge>;
  if (m.status === "finished") return <Badge variant="neutral">Terminado</Badge>;
  if (m.status === "full") return <Badge variant="info">Completo</Badge>;
  return <Badge variant="success">Abierto</Badge>;
}

function MatchesView() {
  const [filter, setFilter] = useState<(typeof MATCH_FILTERS)[number]["id"]>("upcoming");
  const [target, setTarget] = useState<AdminMatch | null>(null);
  const { data = [], isLoading, isError, refetch } = useAdminMatches();
  const { data: venues = [] } = useAdminVenues();
  const cancel = useAdminAction(cancelMatchRequest);
  const create = useAdminAction(createMatchRequest);
  const update = useAdminAction(updateMatchRequest);
  const remove = useAdminAction(deleteMatchRequest);
  // form: undefined = cerrado, null = partido nuevo, AdminMatch = editando.
  const [form, setForm] = useState<AdminMatch | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<AdminMatch | null>(null);

  const save = (input: AdminMatchInput) => {
    const done = (title: string) => () => { toast({ title, description: input.title, variant: "success" }); setForm(undefined); };
    const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: errorText(e) });
    if (form) update.mutate({ id: form.id, data: input }, { onSuccess: done("Partido actualizado"), onError: fail("No pudimos guardar el partido") });
    else create.mutate(input, { onSuccess: done("Partido creado"), onError: fail("No pudimos crear el partido") });
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    remove.mutate(toDelete.id, {
      onSuccess: () => toast({ title: "Partido eliminado", description: toDelete.title }),
      onError: (e) => toast({ variant: "destructive", title: "No pudimos eliminar el partido", description: errorText(e) }),
    });
  };

  const rows = useMemo(() => {
    const now = Date.now();
    const isUpcoming = (m: AdminMatch) => (m.status === "open" || m.status === "full") && new Date(m.startsAt).getTime() >= now;
    if (filter === "upcoming") return data.filter(isUpcoming).reverse();
    if (filter === "finished") return data.filter((m) => m.status === "finished");
    if (filter === "cancelled") return data.filter((m) => m.status === "cancelled");
    return data;
  }, [data, filter]);

  const confirmCancel = () => {
    if (!target) return;
    cancel.mutate(target.id, {
      onSuccess: () => toast({ title: "Partido cancelado", description: target.title }),
      onError: (e) => toast({ variant: "destructive", title: "No pudimos cancelar el partido", description: errorText(e) }),
    });
  };

  return (
    <div className="space-y-section-gap">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills options={MATCH_FILTERS} value={filter} onChange={setFilter} />
        <Button onClick={() => setForm(null)} data-testid="admin-match-new">Nuevo partido</Button>
      </div>
      <TableState isLoading={isLoading} isError={isError} empty={rows.length === 0} columns={7} onRetry={() => refetch()}>
        <AdminTable minWidth={960}>
          <AdminTableHead>
            <tr><AdminTh>Partido</AdminTh><AdminTh>Cancha</AdminTh><AdminTh>Organiza</AdminTh><AdminTh align="center">Cupos</AdminTh><AdminTh align="right">Cuota</AdminTh><AdminTh>Estado</AdminTh><AdminActionsTh /></tr>
          </AdminTableHead>
          <AdminTableBody>
            {rows.map((m) => {
              const canCancel = m.status === "open" || m.status === "full";
              return (
                <AdminTr key={m.id} data-testid={`admin-match-${m.id}`}>
                  <AdminTd variant="primary">
                    {m.title}
                    <span className="block text-caption font-normal text-gray-700">{dayLabel(m.startsAt)} {timeLabel(m.startsAt)}, {FORMAT_LABEL[m.format] ?? m.format}</span>
                  </AdminTd>
                  <AdminTd variant="secondary">{m.venue.name}<span className="block text-caption">{m.venue.district}, {m.venue.city}</span></AdminTd>
                  <AdminTd variant="secondary">{m.organizerName}</AdminTd>
                  <AdminTd align="center" variant="secondary">
                    {m.confirmedCount}/{m.maxPlayers}
                    {m.waitlistCount > 0 && <span className="block text-caption">+{m.waitlistCount} suplentes</span>}
                  </AdminTd>
                  <AdminTd align="right" variant="secondary">{priceLabel(m.pricePerPlayer)}</AdminTd>
                  <AdminTd><MatchStatusBadge m={m} /></AdminTd>
                  <AdminActionsTd endsWithIcon={false}>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setForm(m)}>Editar</Button>
                      {canCancel && <Button size="sm" variant="outline" onClick={() => setTarget(m)}>Cancelar</Button>}
                      <Button size="sm" variant="destructive-outline" onClick={() => setToDelete(m)}>Eliminar</Button>
                    </div>
                  </AdminActionsTd>
                </AdminTr>
              );
            })}
          </AdminTableBody>
        </AdminTable>
      </TableState>
      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title="¿Cancelar este partido?"
        description={target ? `${target.title}. Los ${target.confirmedCount} jugadores anotados lo verán cancelado.` : undefined}
        confirmLabel="Cancelar partido"
        cancelLabel="Volver"
        destructive
        onConfirm={confirmCancel}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="¿Eliminar este partido?"
        description={toDelete ? `${toDelete.title}. Se borra para siempre, con sus ${toDelete.confirmedCount + toDelete.waitlistCount} jugadores y el chat. Si solo quieres avisar a los anotados, usa Cancelar.` : undefined}
        confirmLabel="Eliminar partido"
        cancelLabel="Volver"
        destructive
        onConfirm={confirmDelete}
      />
      <AdminMatchForm
        open={form !== undefined}
        match={form ?? null}
        venues={venues}
        saving={create.isPending || update.isPending}
        onClose={() => setForm(undefined)}
        onSubmit={save}
      />
    </div>
  );
}

// ───────────── Canchas ─────────────

function VenuesView() {
  const { data = [], isLoading, isError, refetch } = useAdminVenues();
  const toggle = useAdminAction(setVenueActiveRequest);

  const setActive = (v: AdminVenue, isActive: boolean) =>
    toggle.mutate({ id: v.id, isActive }, {
      onSuccess: () => toast({ title: isActive ? "Cancha aprobada" : "Cancha desactivada", description: v.name, variant: isActive ? "success" : undefined }),
      onError: (e) => toast({ variant: "destructive", title: "No pudimos actualizar la cancha", description: errorText(e) }),
    });

  return (
    <TableState isLoading={isLoading} isError={isError} empty={data.length === 0} columns={7} onRetry={() => refetch()}>
      <AdminTable minWidth={900}>
        <AdminTableHead>
          <tr><AdminTh>Cancha</AdminTh><AdminTh>Ubicación</AdminTh><AdminTh>Superficie</AdminTh><AdminTh align="right">Por hora</AdminTh><AdminTh align="center">Partidos</AdminTh><AdminTh>Estado</AdminTh><AdminActionsTh /></tr>
        </AdminTableHead>
        <AdminTableBody>
          {data.map((v) => (
            <AdminTr key={v.id} data-testid={`admin-venue-${v.id}`}>
              <AdminTd variant="primary">{v.name}{v.address && <span className="block text-caption font-normal text-gray-700">{v.address}</span>}</AdminTd>
              <AdminTd variant="secondary">{v.district}<span className="block text-caption">{v.city}</span></AdminTd>
              <AdminTd variant="secondary">{SURFACE_LABEL[v.surface] ?? v.surface}</AdminTd>
              <AdminTd align="right" variant="secondary">{v.pricePerHour ? priceLabel(v.pricePerHour) : "—"}</AdminTd>
              <AdminTd align="center" variant="secondary">{v.matchCount}</AdminTd>
              <AdminTd>{v.isActive ? <Badge variant="success">Activa</Badge> : <Badge variant="info">En revisión</Badge>}</AdminTd>
              <AdminActionsTd endsWithIcon={false}>
                {v.isActive
                  ? <Button size="sm" variant="outline" onClick={() => setActive(v, false)}>Desactivar</Button>
                  : <Button size="sm" onClick={() => setActive(v, true)}>Aprobar</Button>}
              </AdminActionsTd>
            </AdminTr>
          ))}
        </AdminTableBody>
      </AdminTable>
    </TableState>
  );
}

// ───────────── Jugadores ─────────────

function lastSeenLabel(iso: string | null): string {
  if (!iso) return "Nunca";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  if (mins < 60 * 24) return `Hace ${Math.round(mins / 60)} h`;
  return `Hace ${Math.round(mins / 1440)} d`;
}

function PlayersView() {
  const { data = [], isLoading, isError, refetch } = useAdminPlayers();
  const [target, setTarget] = useState<AdminPlayer | null>(null);
  const setStatus = useAdminAction(setPlayerStatusRequest);

  const apply = (p: AdminPlayer, status: "active" | "suspended") =>
    setStatus.mutate({ id: p.id, status }, {
      onSuccess: () => toast({ title: status === "suspended" ? "Jugador suspendido" : "Jugador reactivado", description: p.name }),
      onError: (e) => toast({ variant: "destructive", title: "No pudimos actualizar al jugador", description: errorText(e) }),
    });

  return (
    <>
      <TableState isLoading={isLoading} isError={isError} empty={data.length === 0} columns={6} onRetry={() => refetch()}>
        <AdminTable minWidth={820}>
          <AdminTableHead>
            <tr><AdminTh>Jugador</AdminTh><AdminTh align="center">Anotado en</AdminTh><AdminTh align="center">Organizó</AdminTh><AdminTh>Última vez</AdminTh><AdminTh>Estado</AdminTh><AdminActionsTh /></tr>
          </AdminTableHead>
          <AdminTableBody>
            {data.map((p) => {
              const suspended = p.status === "suspended";
              return (
                <AdminTr key={p.id} data-testid={`admin-player-${p.id}`}>
                  <AdminTd variant="primary">{p.name}<span className="block text-caption font-normal text-gray-700">{p.email}</span></AdminTd>
                  <AdminTd align="center" variant="secondary">{p.joined}</AdminTd>
                  <AdminTd align="center" variant="secondary">{p.organized}</AdminTd>
                  <AdminTd variant="secondary">{lastSeenLabel(p.lastSeen)}</AdminTd>
                  <AdminTd>{suspended ? <Badge variant="outline" className="border-error text-error-fg">Suspendido</Badge> : <Badge variant="success">Activo</Badge>}</AdminTd>
                  <AdminActionsTd endsWithIcon={false}>
                    {suspended
                      ? <Button size="sm" variant="outline" onClick={() => apply(p, "active")}>Reactivar</Button>
                      : <Button size="sm" variant="destructive-outline" onClick={() => setTarget(p)}>Suspender</Button>}
                  </AdminActionsTd>
                </AdminTr>
              );
            })}
          </AdminTableBody>
        </AdminTable>
      </TableState>
      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title="¿Suspender a este jugador?"
        description={target ? `${target.name} no podrá anotarse a partidos hasta que lo reactives.` : undefined}
        confirmLabel="Suspender"
        cancelLabel="Volver"
        destructive
        onConfirm={() => target && apply(target, "suspended")}
      />
    </>
  );
}

// ───────────── Pagina ─────────────

const SECTIONS = {
  overview: { title: "Panel", subtitle: "Resumen de la plataforma.", View: OverviewView },
  matches: { title: "Partidos", subtitle: "Todos los partidos convocados.", View: MatchesView },
  venues: { title: "Canchas", subtitle: "Aprueba las canchas nuevas y desactiva las que ya no sirven.", View: VenuesView },
  players: { title: "Jugadores", subtitle: "Actividad de cada cuenta.", View: PlayersView },
  rules: { title: "Reglas", subtitle: "Las reglas del encuentro que ven los jugadores en cada partido y en su pase.", View: () => <AdminRulesView TableState={TableState} /> },
} as const;
type SectionId = keyof typeof SECTIONS;

export default function AdminPlayPage() {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading } = useQuery<{ id: string; userType?: string } | null>({ queryKey: ["/api/user/current"] });
  const isAdmin = user?.userType === "admin";

  useEffect(() => {
    if (isLoading) return;
    if (!user) setLocation(ROUTES.login, { replace: true });
    else if (!isAdmin) setLocation(PLAY_ROUTES.feed, { replace: true });
  }, [isLoading, user, isAdmin, setLocation]);

  if (isLoading || !isAdmin) return <PageLoader />;

  const seg = location.split("/")[2] as SectionId | undefined;
  const active: SectionId = seg && seg in SECTIONS ? seg : "overview";
  const { title, subtitle, View } = SECTIONS[active];

  return (
    <PlayerShell active={active} items={NAV} brand="Administración" accountActions={ACCOUNT_ACTIONS}>
      <ListScreen>
        <div className="flex items-start justify-between gap-3">
          <PageHeader title={title} subtitle={subtitle} />
          {/* En movil no hay menu lateral: la cuenta (con Cerrar sesion) va como avatar en la cabecera. */}
          <ProfileMenuButton align="right" placement="below" actions={ACCOUNT_ACTIONS} className="shrink-0 lg:hidden" />
        </div>
        <View />
      </ListScreen>
    </PlayerShell>
  );
}
