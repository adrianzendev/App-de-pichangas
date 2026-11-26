import { useEffect, useMemo, useState, type ReactNode } from "react";
import { surfaceClass } from "@/components/pichangas/surface";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpDown, CalendarCheck, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/user-avatar";
import { MatchCard } from "@/components/pichangas/match-card";
import { MatchDetailView } from "@/components/pichangas/match-detail";
import { MatchCheckoutView } from "@/components/pichangas/match-checkout";
import { ChatsView } from "@/components/pichangas/chats-view";
import { MatchPassView } from "@/components/pichangas/match-pass";
import { CitySelect, NightEmpty, NightMenu, PitchButton, QuickPill, WelcomeBanner } from "@/components/pichangas/night-ui";
import { NightBackLink, NightIconButton, NightInput, NightLinkButton, NightTabs } from "@/components/pichangas/night-controls";
import { PlayerShell } from "@/components/pichangas/player-shell";
import { HostMatchPage } from "@/components/pichangas/host-match-page";
import { HostView } from "@/components/pichangas/host-view";
import { NoMatchesIcon } from "@/components/pichangas/no-matches-icon";
import { ProfilePhoto } from "@/components/pichangas/profile-photo";
import { ProfileForm } from "@/components/pichangas/profile-form";
import { useMediaQuery } from "@/hooks/use-media-query";
import { MQ } from "@/lib/breakpoints";
import { logout } from "@/lib/logout";
import { cn } from "@/lib/utils";
import { ADMIN_ROUTES, PLAY_PATTERNS, PLAY_RESERVED, PLAY_ROUTES, ROUTES, matchIdFromParam } from "@/lib/routes";
import {
  FORMAT_LABEL, FORMAT_OPTIONS, GENDER_LABEL, GENDER_OPTIONS, LEVEL_LABEL, LEVEL_OPTIONS, SORT_OPTIONS, citiesOf, dayLabel, loadCity, saveCity, searchAndSort,
  useMatches, useMyMatches, useVenues,
  type MatchFilters, type MatchSort, type MatchSummary,
} from "@/lib/pichangas";

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  /** Telefono de contacto (columna users.whatsapp). */
  whatsapp?: string | null;
  userType?: string;
}

// Los filtros sobreviven al abrir un partido y volver (en movil el feed se desmonta al entrar al detalle).
let savedFilters: MatchFilters = { city: loadCity() };

/** Un grupo del panel de filtros: rotulo y sus pildoras. */
function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-caption font-bold uppercase text-night-muted">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[0, 1].map((i) => <Skeleton key={i} className="h-72 w-full rounded-md bg-night-container" />)}
    </div>
  );
}

// ───────────── Feed: partidos abiertos ─────────────

type DayFilter = "today" | "tomorrow";

function FeedScreen({ selectedId, userId, isDesktop }: { selectedId?: string; userId: string; isDesktop: boolean }) {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<MatchFilters>(savedFilters);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<MatchSort>("time");
  const [day, setDay] = useState<DayFilter | undefined>();
  const [advanced, setAdvanced] = useState(false);
  const update = (f: MatchFilters) => { savedFilters = f; setFilters(f); };
  const toggle = (key: keyof MatchFilters, value: string) => update({ ...filters, [key]: filters[key] === value ? undefined : value });

  const { data: venues = [] } = useVenues();
  const cities = useMemo(() => citiesOf(venues), [venues]);
  const city = filters.city ?? "Lima";
  const districts = useMemo(
    () => Array.from(new Set(venues.filter((v) => v.city === city).map((v) => v.district))).sort((a, b) => a.localeCompare(b, "es")),
    [venues, city],
  );
  const { data: matches, isLoading, isError, refetch } = useMatches(filters);
  const { data: mine = [] } = useMyMatches();
  const mineById = useMemo(() => new Map(mine.map((m) => [m.id, m.playerStatus])), [mine]);
  const paidById = useMemo(() => new Map(mine.map((m) => [m.id, !!m.playerPaid])), [mine]);

  const visible = useMemo(() => {
    let list = searchAndSort(matches ?? [], query, sort);
    if (day) list = list.filter((m) => dayLabel(m.startsAt) === (day === "today" ? "Hoy" : "Mañana"));
    return list;
  }, [matches, query, sort, day]);

  const hasFilters = Boolean(query.trim() || day || filters.district || filters.format || filters.level || filters.gender);
  const clearAll = () => { setQuery(""); setDay(undefined); update({ city }); };
  const changeCity = (next: string) => { saveCity(next); setQuery(""); setDay(undefined); update({ city: next }); };
  // Primero se paga, luego esta el ticket: "Ver mi cupo" abre el pase solo si ya pagaste; si no, el detalle (ahi se paga o se sale de suplentes).
  const open = (id: string) => {
    const m = (matches ?? []).find((x) => x.id === id) ?? id;
    setLocation(mineById.get(id) === "confirmed" && paidById.get(id) ? PLAY_ROUTES.pass(m) : PLAY_ROUTES.match(m));
  };

  const dayText = day === "today" ? "Hoy" : day === "tomorrow" ? "Mañana" : undefined;
  const activeFilters: { id: string; label: string; clear: () => void }[] = [
    ...(filters.district ? [{ id: "district", label: filters.district, clear: () => update({ ...filters, district: undefined }) }] : []),
    ...(dayText ? [{ id: "day", label: dayText, clear: () => setDay(undefined) }] : []),
    ...(filters.format ? [{ id: "format", label: FORMAT_LABEL[filters.format] ?? filters.format, clear: () => update({ ...filters, format: undefined }) }] : []),
    ...(filters.level ? [{ id: "level", label: LEVEL_LABEL[filters.level] ?? filters.level, clear: () => update({ ...filters, level: undefined }) }] : []),
    ...(filters.gender ? [{ id: "gender", label: GENDER_LABEL[filters.gender] ?? filters.gender, clear: () => update({ ...filters, gender: undefined }) }] : []),
  ];

  const feed = (
    <div className="flex flex-col gap-section-gap px-page-h py-4 lg:min-h-dvh lg:px-0 lg:py-6">
      {isDesktop && (
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-heading font-bold text-night-text">Pichangas</h1>
          <CitySelect value={city} cities={cities} onChange={changeCity} />
        </div>
      )}

      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-icon-lg -translate-y-1/2 text-night-muted" aria-hidden />
          <NightInput shape="pill" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cancha, distrito o nivel..." aria-label="Buscar partidos" className="pl-11 pr-14" />
          <NightIconButton
            size="sm"
            aria-label={activeFilters.length > 0 ? `Filtros (${activeFilters.length} activos)` : "Filtros"}
            aria-pressed={advanced}
            onClick={() => setAdvanced((v) => !v)}
            className={cn("absolute right-3 top-1/2 -translate-y-1/2 text-pitch hover:bg-night-highest", advanced && "bg-night-highest")}
          >
            <SlidersHorizontal className="size-icon-lg" aria-hidden />
            {activeFilters.length > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-pitch text-caption font-bold text-pitch-on" aria-hidden>{activeFilters.length}</span>
            )}
          </NightIconButton>
        </div>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" aria-label="Filtros activos">
            {activeFilters.map((f) => (
              <QuickPill key={f.id} active pin={false} onClick={f.clear} aria-label={`Quitar filtro ${f.label}`}>
                {f.label}
                <X className="size-icon-sm" aria-hidden />
              </QuickPill>
            ))}
            <NightLinkButton className="px-1 text-caption hover:text-night-text" onClick={clearAll}>Limpiar</NightLinkButton>
          </div>
        )}

        {advanced && (
          <div className={cn(surfaceClass(), "space-y-3 p-3")} role="group" aria-label="Filtros">
            <FilterGroup label="Distrito">
              <QuickPill active={!filters.district} onClick={() => update({ ...filters, district: undefined })}>Todos</QuickPill>
              {districts.map((d) => <QuickPill key={d} active={filters.district === d} onClick={() => toggle("district", d)}>{d}</QuickPill>)}
            </FilterGroup>
            <FilterGroup label="Cuándo">
              <QuickPill active={day === "today"} onClick={() => setDay(day === "today" ? undefined : "today")}>Hoy</QuickPill>
              <QuickPill active={day === "tomorrow"} onClick={() => setDay(day === "tomorrow" ? undefined : "tomorrow")}>Mañana</QuickPill>
            </FilterGroup>
            <FilterGroup label="Formato">
              {FORMAT_OPTIONS.map((o) => <QuickPill key={o.id} active={filters.format === o.id} onClick={() => toggle("format", o.id)}>{o.label}</QuickPill>)}
            </FilterGroup>
            <FilterGroup label="Nivel">
              {LEVEL_OPTIONS.map((o) => <QuickPill key={o.id} active={filters.level === o.id} onClick={() => toggle("level", o.id)}>{o.label}</QuickPill>)}
            </FilterGroup>
            <FilterGroup label="Quién juega">
              {GENDER_OPTIONS.map((o) => <QuickPill key={o.id} active={filters.gender === o.id} onClick={() => toggle("gender", o.id)}>{o.label}</QuickPill>)}
            </FilterGroup>
          </div>
        )}
      </div>

      <WelcomeBanner headingLevel={isDesktop ? "h2" : "h1"} />

      <section aria-label="Pichangas disponibles" className="flex flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-body font-extrabold uppercase text-night-text">Pichangas disponibles</h2>
            <span className="shrink-0 whitespace-nowrap rounded-sm bg-pitch/10 px-2 py-0.5 text-caption font-bold text-pitch">{visible.length} {visible.length === 1 ? "activa" : "activas"}</span>
          </div>
          <NightMenu value={sort} options={SORT_OPTIONS} onSelect={setSort} ariaLabel="Ordenar partidos" trigger={<>Ordenar<ArrowUpDown className="size-icon-md" aria-hidden /></>} />
        </div>

        {isLoading ? (
          <CardsSkeleton />
        ) : isError ? (
          <NightEmpty
            fill
            icon={<Search className="size-icon-empty" />}
            title="No pudimos cargar los partidos"
            description="Revisa tu conexión e inténtalo de nuevo."
            action={<PitchButton onClick={() => refetch()}>Reintentar</PitchButton>}
          />
        ) : visible.length === 0 ? (
          <NightEmpty
            fill
            icon={<NoMatchesIcon />}
            title={hasFilters ? "No hay pichangas con esos filtros" : "Todavía no hay pichangas convocadas"}
            description={hasFilters ? "Prueba con otro distrito o quita algún filtro." : "Vuelve en un rato: se arman todos los días."}
            action={hasFilters ? <PitchButton onClick={clearAll}>Quitar filtros</PitchButton> : undefined}
          />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2" aria-label="Partidos disponibles">
            {visible.map((m) => (
              <li key={m.id}>
                <MatchCard match={m} paid={paidById.get(m.id)} selected={!!selectedId && m.id.startsWith(selectedId)} onOpen={open} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );

  // Escritorio: abrir una pichanga reemplaza TODA la pantalla del feed (sin buscador ni filtros) y usa todo el ancho.
  if (isDesktop && selectedId) {
    return (
      <PlayerShell active="feed">
        <div className="space-y-3 py-6">
          <NightBackLink label="Volver a las pichangas" onClick={() => setLocation(PLAY_ROUTES.feed)} />
          <MatchDetailView key={selectedId} matchId={selectedId} currentUserId={userId} />
        </div>
      </PlayerShell>
    );
  }

  return (
    <PlayerShell active="feed" headerAction={!isDesktop ? <CitySelect value={city} cities={cities} onChange={changeCity} /> : undefined}>
      {feed}
    </PlayerShell>
  );
}

// ───────────── Mis partidos ─────────────

const MINE_TABS = [
  { id: "upcoming", label: "Próximas" },
  { id: "past", label: "Pasadas" },
] as const;

function MineView() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const { data: all = [], isLoading, isError, refetch } = useMyMatches();
  // Solo cuentan los partidos en los que ya estoy inscrito (cupo pagado); un cupo sin pagar no es una inscripcion.
  const data = useMemo(() => all.filter((m) => m.playerPaid), [all]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const isUpcoming = (m: MatchSummary) => new Date(m.startsAt).getTime() >= now && m.status !== "cancelled" && m.status !== "finished";
    return { upcoming: data.filter(isUpcoming), past: data.filter((m) => !isUpcoming(m)).reverse() };
  }, [data]);
  const list = tab === "upcoming" ? upcoming : past;
  const counts = { upcoming: upcoming.length, past: past.length };

  return (
    <div className="flex min-h-dvh flex-col space-y-section-gap px-page-h py-4 lg:px-0 lg:py-6">
      <h1 className="text-heading font-bold text-night-text">Mis pichangas</h1>
      <NightTabs ariaLabel="Mis pichangas" tabs={MINE_TABS.map((m) => ({ ...m, count: counts[m.id] }))} value={tab} onChange={setTab} />

      {isLoading ? (
        <CardsSkeleton />
      ) : isError ? (
        <NightEmpty icon={<CalendarCheck className="size-icon-empty" />} title="No pudimos cargar tus partidos" action={<PitchButton onClick={() => refetch()}>Reintentar</PitchButton>} />
      ) : list.length === 0 ? (
        <NightEmpty
          icon={tab === "upcoming" ? <NoMatchesIcon /> : <CalendarCheck className="size-icon-empty" />}
          fill
          title={tab === "upcoming" ? "No tienes partidos próximos" : "Aún no jugaste ninguna pichanga"}
          description={tab === "upcoming" ? "Busca una pichanga y anótate." : undefined}
          action={tab === "upcoming" ? <PitchButton onClick={() => setLocation(PLAY_ROUTES.feed)}>Buscar partidos</PitchButton> : undefined}
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {list.map((m) => (
            <li key={m.id}>
              <MatchCard
                match={m}
                paid={m.playerPaid}
                onOpen={() => setLocation(m.playerStatus === "confirmed" && m.playerPaid ? PLAY_ROUTES.pass(m) : PLAY_ROUTES.match(m))}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ───────────── Perfil ─────────────

function ProfileView({ user }: { user: CurrentUser }) {
  return (
    <div className="space-y-section-gap px-page-h py-4 lg:px-0 lg:py-6">
      <h1 className="text-heading font-bold text-night-text">Perfil</h1>
      <section className="flex items-center gap-4">
        <ProfilePhoto name={user.name} avatar={user.avatar} />
        <div className="min-w-0">
          <p className="truncate text-subheading font-bold text-night-text">{user.name}</p>
          <p className="truncate text-body text-night-muted">{user.email}</p>
        </div>
      </section>
      <ProfileForm user={user} />
      <Button type="button" variant="crimson-outline" size="lg" className="w-full" onClick={() => void logout()}>
        Cerrar sesión
      </Button>
    </div>
  );
}

// ───────────── Detalle en movil: pantalla completa ─────────────

function MatchPage({ matchId, userId }: { matchId: string; userId: string }) {
  const [, setLocation] = useLocation();
  return (
    <div className="flex min-h-dvh flex-col bg-night font-satoshi text-night-text">
      <header className="sticky top-0 z-sticky flex h-16 items-center gap-2 bg-night/90 px-page-h shadow-night-bar">
        <NightIconButton aria-label="Volver" onClick={() => (window.history.length > 1 ? window.history.back() : setLocation(PLAY_ROUTES.feed))}>
          <ArrowLeft className="size-icon-lg" aria-hidden />
        </NightIconButton>
        <p className="text-body font-bold uppercase text-night-text">Detalle del partido</p>
      </header>
      <div className="flex-1"><MatchDetailView matchId={matchId} currentUserId={userId} /></div>
    </div>
  );
}

// ───────────── Confirmar y pagar (movil: pantalla aparte) ─────────────

function PayPage({ matchId, user }: { matchId: string; user: CurrentUser }) {
  const [, setLocation] = useLocation();
  return (
    <div className="flex min-h-dvh flex-col bg-night font-satoshi text-night-text">
      <header className="sticky top-0 z-sticky flex h-16 items-center gap-2 bg-night/90 px-page-h shadow-night-bar">
        <NightIconButton aria-label="Volver" onClick={() => (window.history.length > 1 ? window.history.back() : setLocation(PLAY_ROUTES.match(matchId)))}>
          <ArrowLeft className="size-icon-lg" aria-hidden />
        </NightIconButton>
        <p className="text-body font-bold uppercase text-night-text">Confirmar y pagar</p>
      </header>
      <div className="flex flex-1 flex-col"><MatchCheckoutView matchId={matchId} me={user} /></div>
    </div>
  );
}

// ───────────── Pase digital (despues de pagar) ─────────────

function PassPage({ matchId, user }: { matchId: string; user: CurrentUser }) {
  const [, setLocation] = useLocation();
  return (
    <div className="flex min-h-dvh flex-col bg-night font-satoshi text-night-text">
      <header className="sticky top-0 z-sticky flex h-16 items-center gap-2 bg-night/90 px-page-h shadow-night-bar">
        <NightIconButton aria-label="Volver" onClick={() => (window.history.length > 1 ? window.history.back() : setLocation(PLAY_ROUTES.mine))}>
          <ArrowLeft className="size-icon-lg" aria-hidden />
        </NightIconButton>
        <p className="text-body font-bold uppercase text-night-text">Mi pase</p>
      </header>
      <div className="flex-1"><MatchPassView matchId={matchId} me={user} /></div>
    </div>
  );
}

// ───────────── Pagina ─────────────

export default function PlayPage() {
  const [location, setLocation] = useLocation();
  const isDesktop = useMediaQuery(MQ.lg);
  const [, matchParams] = useRoute<{ id: string }>(PLAY_PATTERNS.match);
  const [, passParams] = useRoute<{ id: string }>(PLAY_PATTERNS.pass);
  const [, payParams] = useRoute<{ id: string }>(PLAY_PATTERNS.pay);
  const [, chatParams] = useRoute<{ id: string }>(PLAY_PATTERNS.chat);
  const { data: user, isLoading } = useQuery<CurrentUser | null>({ queryKey: ["/api/user/current"] });

  useEffect(() => {
    if (isLoading) return;
    if (!user) setLocation(ROUTES.login, { replace: true });
    else if (user.userType === "admin") setLocation(ADMIN_ROUTES.overview, { replace: true });
  }, [isLoading, user, setLocation]);

  if (isLoading || !user || user.userType === "admin") return <PageLoader />;

  // El segmento de la URL es `slug-id8`; las pantallas trabajan con el id corto (el servidor lo resuelve).
  const reserved = (PLAY_RESERVED as readonly string[]).includes(matchParams?.id ?? "");
  const matchId = matchParams?.id && !reserved ? matchIdFromParam(matchParams.id) : undefined;
  const passId = passParams?.id ? matchIdFromParam(passParams.id) : undefined;
  const payId = payParams?.id ? matchIdFromParam(payParams.id) : undefined;

  // Confirmar y pagar: en movil es pantalla aparte; en escritorio vive en el shell del jugador, centrado.
  if (payId && !isDesktop) return <PayPage matchId={payId} user={user} />;
  if (payId) {
    return (
      <PlayerShell active="feed">
        <div className="flex min-h-dvh flex-col space-y-3 py-6">
          <NightBackLink label="Volver al partido" onClick={() => setLocation(PLAY_ROUTES.match(payId))} />
          <div className="flex w-full flex-1 flex-col">
            <MatchCheckoutView matchId={payId} me={user} />
          </div>
        </div>
      </PlayerShell>
    );
  }

  // Pase digital: en movil es pantalla aparte (sin barra inferior); en escritorio vive en el shell del jugador.
  if (passId && !isDesktop) return <PassPage matchId={passId} user={user} />;
  if (passId) {
    return (
      <PlayerShell active="mine">
        <div className="space-y-3 py-6">
          <NightBackLink label="Volver a mis pichangas" onClick={() => setLocation(PLAY_ROUTES.mine)} />
          <MatchPassView matchId={passId} me={user} />
        </div>
      </PlayerShell>
    );
  }

  // Movil: el detalle es una pantalla aparte, sin barra inferior.
  if (matchId && !isDesktop) return <MatchPage matchId={matchId} userId={user.id} />;

  if (location.startsWith(PLAY_ROUTES.mine)) {
    return <PlayerShell active="mine"><MineView /></PlayerShell>;
  }
  if (location.startsWith(PLAY_ROUTES.chats)) {
    return (
      // Movil con un chat abierto: sin cabecera ni barra inferior, el chat ocupa toda la pantalla.
      <PlayerShell active="chats" hideMobileBar={!isDesktop && !!chatParams?.id}>
        <ChatsView selectedId={chatParams?.id ? matchIdFromParam(chatParams.id) : undefined} me={user} isDesktop={isDesktop} />
      </PlayerShell>
    );
  }
  if (location.startsWith(PLAY_ROUTES.hostNew)) {
    return <PlayerShell active="host"><HostMatchPage /></PlayerShell>;
  }
  if (location.startsWith(PLAY_ROUTES.host)) {
    return <PlayerShell active="host"><HostView userId={user.id} /></PlayerShell>;
  }
  if (location.startsWith(PLAY_ROUTES.profile)) {
    return <PlayerShell active="profile"><ProfileView user={user} /></PlayerShell>;
  }
  return <FeedScreen selectedId={matchId} userId={user.id} isDesktop={isDesktop} />;
}
