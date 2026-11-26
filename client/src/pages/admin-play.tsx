import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CircleDollarSign, Gauge, Globe2, LayoutDashboard, ListChecks, MapPin, ScrollText, Users, type LucideIcon } from "lucide-react";
import { ListScreen } from "@/components/ui/list-screen";
import { PageLoader } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AdminActionsTd, AdminActionsTh, AdminBadge, AdminButton, AdminConfirm, AdminHeader, AdminMetric, AdminPanel, AdminPills, AdminSub,
  AdminTable, AdminTableState, AdminTbody, AdminTd, AdminTh, AdminThead, AdminTr,
} from "@/components/pichangas/admin-ui";
import { NightEmpty, PitchButton } from "@/components/pichangas/night-ui";
import { LOGOUT_ACTION, PlayerShell, type ShellItem } from "@/components/pichangas/player-shell";
import { ProfileMenuButton } from "@/components/layout/profile-menu-button";
import { toast } from "@/hooks/use-toast";
import { ADMIN_ROUTES, PLAY_ROUTES, ROUTES } from "@/lib/routes";
import { MatchForm } from "@/components/pichangas/match-form";
import { AdminVenueForm, AdminPlayerForm } from "@/components/pichangas/admin-forms";
import { AdminGeoView } from "@/components/pichangas/admin-geo";
import { AdminRulesView } from "@/components/pichangas/admin-rules";
import {
  cancelMatchRequest, createMatchRequest, createPlayerRequest, createVenueRequest, deleteMatchRequest, deletePlayerRequest, deleteVenueRequest,
  setPlayerStatusRequest, setVenueActiveRequest, updateMatchRequest, updatePlayerRequest, updateVenueRequest,
  useAdminAction, useAdminMatches, useAdminOverview, useAdminPlayers, useAdminVenues,
  type AdminMatch, type AdminMatchInput, type AdminPlayer, type AdminPlayerInput, type AdminVenue, type AdminVenueInput,
} from "@/lib/admin-pichangas";
import { FORMAT_LABEL, SURFACE_LABEL, dayLabel, priceLabel, timeLabel } from "@/lib/pichangas";

const NAV: ShellItem[] = [
  { id: "overview", label: "Resumen", icon: LayoutDashboard, path: ADMIN_ROUTES.overview },
  { id: "matches", label: "Partidos", icon: CalendarDays, path: ADMIN_ROUTES.matches },
  { id: "venues", label: "Canchas", icon: MapPin, path: ADMIN_ROUTES.venues },
  { id: "players", label: "Jugadores", icon: Users, path: ADMIN_ROUTES.players },
  { id: "rules", label: "Reglas", icon: ScrollText, path: ADMIN_ROUTES.rules },
  { id: "geo", label: "Geografía", icon: Globe2, path: ADMIN_ROUTES.geo },
];

// El admin solo tiene "Cerrar sesión": no hay perfil editable en este panel.
const ACCOUNT_ACTIONS = [LOGOUT_ACTION];

const soles = (n: number) => `S/ ${n.toLocaleString("es-PE")}`;
const errorText = (e: unknown) => (e instanceof Error ? e.message : undefined);

// ───────────── Resumen ─────────────

function OverviewView() {
  const [, setLocation] = useLocation();
  const { data, isLoading, isError, refetch } = useAdminOverview();

  if (isError) {
    return <NightEmpty fill icon={<ListChecks className="size-icon-empty" />} title="No pudimos cargar el resumen" action={<PitchButton onClick={() => refetch()}>Reintentar</PitchButton>} />;
  }
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28 rounded-md bg-night-container" />)}
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
    <div className="flex flex-1 flex-col space-y-section-gap">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {kpis.map((k) => <AdminMetric key={k.id} testId={`kpi-${k.id}`} title={k.title} value={k.value} icon={k.icon} subtitle={k.subtitle} />)}
      </div>

      {data.pendingVenues > 0 && (
        <AdminPanel className="flex flex-wrap items-center justify-between gap-3" aria-label="Pendientes">
          <div>
            <p className="text-body font-semibold text-night-text">
              {data.pendingVenues === 1 ? "Hay 1 cancha esperando aprobación" : `Hay ${data.pendingVenues} canchas esperando aprobación`}
            </p>
            <p className="text-body text-night-muted">Aparecen en la app cuando las apruebas.</p>
          </div>
          <AdminButton onClick={() => setLocation(ADMIN_ROUTES.venues)}>Revisar canchas</AdminButton>
        </AdminPanel>
      )}

      <AdminPanel className="space-y-4" aria-label="Partidos por ciudad">
        <h2 className="text-subheading font-semibold text-night-text">Partidos por ciudad</h2>
        <ul className="space-y-3">
          {data.byCity.map((c) => (
            <li key={c.city} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-body font-medium text-night-text">{c.city}</p>
                <p className="text-label text-night-muted">{c.matches} {c.matches === 1 ? "partido" : "partidos"}, {c.players} jugadores</p>
              </div>
              <div className="h-2 rounded-full bg-night-highest" role="presentation">
                <div className="h-2 rounded-full bg-pitch" style={{ width: `${(c.matches / maxMatches) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </AdminPanel>
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
  if (m.status === "cancelled") return <AdminBadge tone="danger">Cancelado</AdminBadge>;
  if (m.status === "finished") return <AdminBadge tone="neutral">Terminado</AdminBadge>;
  if (m.status === "full") return <AdminBadge tone="info">Completo</AdminBadge>;
  return <AdminBadge tone="success">Abierto</AdminBadge>;
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
    <div className="flex flex-1 flex-col space-y-section-gap">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdminPills options={MATCH_FILTERS} value={filter} onChange={setFilter} />
        <AdminButton tone="pitch" onClick={() => setForm(null)} data-testid="admin-match-new">Nuevo partido</AdminButton>
      </div>
      <AdminTableState isLoading={isLoading} isError={isError} empty={rows.length === 0} columns={7} onRetry={() => refetch()}>
        <AdminTable minWidth={960}>
          <AdminThead>
            <tr><AdminTh>Partido</AdminTh><AdminTh>Cancha</AdminTh><AdminTh>Organiza</AdminTh><AdminTh align="center">Cupos</AdminTh><AdminTh align="right">Cuota</AdminTh><AdminTh>Estado</AdminTh><AdminActionsTh /></tr>
          </AdminThead>
          <AdminTbody>
            {rows.map((m) => {
              const canCancel = m.status === "open" || m.status === "full";
              return (
                <AdminTr key={m.id} data-testid={`admin-match-${m.id}`}>
                  <AdminTd tone="primary">
                    {m.title}
                    <AdminSub>{dayLabel(m.startsAt)} {timeLabel(m.startsAt)}, {FORMAT_LABEL[m.format] ?? m.format}</AdminSub>
                  </AdminTd>
                  <AdminTd tone="secondary">{m.venue.name}<AdminSub>{m.venue.district}, {m.venue.city}</AdminSub></AdminTd>
                  <AdminTd tone="secondary">{m.organizerName}</AdminTd>
                  <AdminTd align="center" tone="secondary">
                    {m.confirmedCount}/{m.maxPlayers}
                    {m.waitlistCount > 0 && <AdminSub>+{m.waitlistCount} suplentes</AdminSub>}
                  </AdminTd>
                  <AdminTd align="right" tone="secondary">{priceLabel(m.pricePerPlayer)}</AdminTd>
                  <AdminTd><MatchStatusBadge m={m} /></AdminTd>
                  <AdminActionsTd>
                    <div className="flex justify-end gap-2">
                      <AdminButton compact onClick={() => setForm(m)}>Editar</AdminButton>
                      {canCancel && <AdminButton compact onClick={() => setTarget(m)}>Cancelar</AdminButton>}
                      <AdminButton compact tone="danger" onClick={() => setToDelete(m)}>Eliminar</AdminButton>
                    </div>
                  </AdminActionsTd>
                </AdminTr>
              );
            })}
          </AdminTbody>
        </AdminTable>
      </AdminTableState>
      <AdminConfirm
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title="¿Cancelar este partido?"
        description={target ? `${target.title}. Los ${target.confirmedCount} jugadores anotados lo verán cancelado.` : undefined}
        confirmLabel="Cancelar partido"
        cancelLabel="Volver"
        destructive
        onConfirm={confirmCancel}
      />
      <AdminConfirm
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="¿Eliminar este partido?"
        description={toDelete ? `${toDelete.title}. Se borra para siempre, con sus ${toDelete.confirmedCount + toDelete.waitlistCount} jugadores y el chat. Si solo quieres avisar a los anotados, usa Cancelar.` : undefined}
        confirmLabel="Eliminar partido"
        cancelLabel="Volver"
        destructive
        onConfirm={confirmDelete}
      />
      <MatchForm
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
  const create = useAdminAction(createVenueRequest);
  const update = useAdminAction(updateVenueRequest);
  const remove = useAdminAction(deleteVenueRequest);
  // form: undefined = cerrado, null = cancha nueva, AdminVenue = editando.
  const [form, setForm] = useState<AdminVenue | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<AdminVenue | null>(null);

  const setActive = (v: AdminVenue, isActive: boolean) =>
    toggle.mutate({ id: v.id, isActive }, {
      onSuccess: () => toast({ title: isActive ? "Cancha aprobada" : "Cancha desactivada", description: v.name, variant: isActive ? "success" : undefined }),
      onError: (e) => toast({ variant: "destructive", title: "No pudimos actualizar la cancha", description: errorText(e) }),
    });

  const save = (input: AdminVenueInput) => {
    const done = (title: string) => () => { toast({ title, description: input.name, variant: "success" }); setForm(undefined); };
    const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: errorText(e) });
    if (form) update.mutate({ id: form.id, data: input }, { onSuccess: done("Cancha actualizada"), onError: fail("No pudimos guardar la cancha") });
    else create.mutate(input, { onSuccess: done("Cancha creada"), onError: fail("No pudimos crear la cancha") });
  };

  return (
    <div className="flex flex-1 flex-col space-y-section-gap">
      <div className="flex justify-end"><AdminButton tone="pitch" onClick={() => setForm(null)} data-testid="admin-venue-new">Nueva cancha</AdminButton></div>
      <AdminTableState isLoading={isLoading} isError={isError} empty={data.length === 0} columns={7} onRetry={() => refetch()}>
        <AdminTable minWidth={960}>
          <AdminThead>
            <tr><AdminTh>Cancha</AdminTh><AdminTh>Ubicación</AdminTh><AdminTh>Superficie</AdminTh><AdminTh align="right">Por hora</AdminTh><AdminTh align="center">Partidos</AdminTh><AdminTh>Estado</AdminTh><AdminActionsTh /></tr>
          </AdminThead>
          <AdminTbody>
            {data.map((v) => (
              <AdminTr key={v.id} data-testid={`admin-venue-${v.id}`}>
                <AdminTd tone="primary">{v.name}{v.address && <AdminSub>{v.address}</AdminSub>}</AdminTd>
                <AdminTd tone="secondary">{v.district}<AdminSub>{v.city}</AdminSub></AdminTd>
                <AdminTd tone="secondary">{SURFACE_LABEL[v.surface] ?? v.surface}</AdminTd>
                <AdminTd align="right" tone="secondary">{v.pricePerHour ? priceLabel(v.pricePerHour) : "—"}</AdminTd>
                <AdminTd align="center" tone="secondary">{v.matchCount}</AdminTd>
                <AdminTd>{v.isActive ? <AdminBadge tone="success">Activa</AdminBadge> : <AdminBadge tone="info">En revisión</AdminBadge>}</AdminTd>
                <AdminActionsTd>
                  <AdminButton compact onClick={() => setForm(v)}>Editar</AdminButton>
                  {v.isActive
                    ? <AdminButton compact onClick={() => setActive(v, false)}>Desactivar</AdminButton>
                    : <AdminButton compact tone="pitch" onClick={() => setActive(v, true)}>Aprobar</AdminButton>}
                  <AdminButton compact tone="danger" onClick={() => setToDelete(v)}>Eliminar</AdminButton>
                </AdminActionsTd>
              </AdminTr>
            ))}
          </AdminTbody>
        </AdminTable>
      </AdminTableState>
      <AdminVenueForm open={form !== undefined} venue={form ?? null} saving={create.isPending || update.isPending} onClose={() => setForm(undefined)} onSubmit={save} />
      <AdminConfirm
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="¿Eliminar esta cancha?"
        description={toDelete ? (toDelete.matchCount > 0
          ? `${toDelete.name} tiene ${toDelete.matchCount} partido(s): no se puede eliminar. Elimina esos partidos primero o desactívala.`
          : `${toDelete.name}. Se borra para siempre.`) : undefined}
        confirmLabel="Eliminar cancha"
        destructive
        onConfirm={() => toDelete && remove.mutate(toDelete.id, {
          onSuccess: () => toast({ title: "Cancha eliminada", description: toDelete.name }),
          onError: (e) => toast({ variant: "destructive", title: "No pudimos eliminar la cancha", description: errorText(e) }),
        })}
      />
    </div>
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
  const create = useAdminAction(createPlayerRequest);
  const update = useAdminAction(updatePlayerRequest);
  const remove = useAdminAction(deletePlayerRequest);
  // form: undefined = cerrado, null = jugador nuevo, AdminPlayer = editando.
  const [form, setForm] = useState<AdminPlayer | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<AdminPlayer | null>(null);

  const apply = (p: AdminPlayer, status: "active" | "suspended") =>
    setStatus.mutate({ id: p.id, status }, {
      onSuccess: () => toast({ title: status === "suspended" ? "Jugador suspendido" : "Jugador reactivado", description: p.name }),
      onError: (e) => toast({ variant: "destructive", title: "No pudimos actualizar al jugador", description: errorText(e) }),
    });

  const save = (input: AdminPlayerInput) => {
    const done = (title: string) => () => { toast({ title, description: input.name, variant: "success" }); setForm(undefined); };
    const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: errorText(e) });
    if (form) update.mutate({ id: form.id, data: input }, { onSuccess: done("Jugador actualizado"), onError: fail("No pudimos guardar al jugador") });
    else create.mutate(input, { onSuccess: done("Jugador creado"), onError: fail("No pudimos crear al jugador") });
  };

  return (
    <div className="flex flex-1 flex-col space-y-section-gap">
      <div className="flex justify-end"><AdminButton tone="pitch" onClick={() => setForm(null)} data-testid="admin-player-new">Nuevo jugador</AdminButton></div>
      <AdminTableState isLoading={isLoading} isError={isError} empty={data.length === 0} columns={6} onRetry={() => refetch()}>
        <AdminTable minWidth={960}>
          <AdminThead>
            <tr><AdminTh>Jugador</AdminTh><AdminTh align="center">Anotado en</AdminTh><AdminTh align="center">Organizó</AdminTh><AdminTh>Última vez</AdminTh><AdminTh>Estado</AdminTh><AdminActionsTh /></tr>
          </AdminThead>
          <AdminTbody>
            {data.map((p) => {
              const suspended = p.status === "suspended";
              return (
                <AdminTr key={p.id} data-testid={`admin-player-${p.id}`}>
                  <AdminTd tone="primary">{p.name}<AdminSub>{p.email}</AdminSub></AdminTd>
                  <AdminTd align="center" tone="secondary">{p.joined}</AdminTd>
                  <AdminTd align="center" tone="secondary">{p.organized}</AdminTd>
                  <AdminTd tone="secondary">{lastSeenLabel(p.lastSeen)}</AdminTd>
                  <AdminTd>{suspended ? <AdminBadge tone="danger">Suspendido</AdminBadge> : <AdminBadge tone="success">Activo</AdminBadge>}</AdminTd>
                  <AdminActionsTd>
                    <AdminButton compact onClick={() => setForm(p)}>Editar</AdminButton>
                    {suspended
                      ? <AdminButton compact tone="pitch" onClick={() => apply(p, "active")}>Reactivar</AdminButton>
                      : <AdminButton compact onClick={() => setTarget(p)}>Suspender</AdminButton>}
                    <AdminButton compact tone="danger" onClick={() => setToDelete(p)}>Eliminar</AdminButton>
                  </AdminActionsTd>
                </AdminTr>
              );
            })}
          </AdminTbody>
        </AdminTable>
      </AdminTableState>
      <AdminPlayerForm open={form !== undefined} player={form ?? null} saving={create.isPending || update.isPending} onClose={() => setForm(undefined)} onSubmit={save} />
      <AdminConfirm
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title="¿Suspender a este jugador?"
        description={target ? `${target.name} no podrá anotarse a partidos hasta que lo reactives.` : undefined}
        confirmLabel="Suspender"
        destructive
        onConfirm={() => target && apply(target, "suspended")}
      />
      <AdminConfirm
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="¿Eliminar a este jugador?"
        description={toDelete ? `${toDelete.name}. Se borra la cuenta para siempre, con sus inscripciones y los partidos que organizó. Si solo quieres bloquearlo, usa Suspender.` : undefined}
        confirmLabel="Eliminar jugador"
        destructive
        onConfirm={() => toDelete && remove.mutate(toDelete.id, {
          onSuccess: () => toast({ title: "Jugador eliminado", description: toDelete.name }),
          onError: (e) => toast({ variant: "destructive", title: "No pudimos eliminar al jugador", description: errorText(e) }),
        })}
      />
    </div>
  );
}

// ───────────── Pagina ─────────────

const SECTIONS = {
  overview: { title: "Panel", subtitle: "Resumen de la plataforma.", View: OverviewView },
  matches: { title: "Partidos", subtitle: "Todos los partidos convocados.", View: MatchesView },
  venues: { title: "Canchas", subtitle: "Crea, edita y aprueba las canchas donde se juegan los partidos.", View: VenuesView },
  players: { title: "Jugadores", subtitle: "Crea, edita y administra las cuentas de los jugadores.", View: PlayersView },
  rules: { title: "Reglas", subtitle: "Las reglas del encuentro que ven los jugadores en cada partido y en su pase.", View: () => <AdminRulesView /> },
  geo: { title: "Geografía", subtitle: "Activa las regiones, provincias y distritos del Perú donde opera la app.", View: () => <AdminGeoView /> },
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
      <ListScreen className="flex min-h-dvh flex-col">
        <div className="flex items-start justify-between gap-3">
          <AdminHeader title={title} subtitle={subtitle} />
          {/* En movil no hay menu lateral: la cuenta (con Cerrar sesion) va como avatar en la cabecera. */}
          <ProfileMenuButton align="right" placement="below" actions={ACCOUNT_ACTIONS} className="shrink-0 lg:hidden" />
        </div>
        <div className="flex flex-1 flex-col"><View /></div>
      </ListScreen>
    </PlayerShell>
  );
}
