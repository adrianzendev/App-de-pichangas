import { useEffect, useRef, useState } from "react";
import { TAB } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { SimpleTaskCard } from "@/components/ui/simple-task-card";
import { TaskList } from "@/components/ui/task-list";
import { UserAvatar } from "@/components/ui/user-avatar";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { SpecialtyBadges } from "@/components/ui/specialty-badges";
import { TutorTaskCard } from "@/components/ui/tutor-task-card";
import CandidateCard from "@/components/ui/candidate-card";
import { TaskNumber } from "@/components/ui/task-number";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { MetricCard } from "@/components/ui/metric-card";
import { AdminTable, AdminTableHead, AdminTableBody, AdminTr, AdminTh, AdminTd } from "@/components/ui/admin-table";
import { FilterSelect } from "@/components/ui/filter-select";
import { DollarSign, Wifi } from "lucide-react";
import { Container } from "@/components/ui/Container";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import type { BackendHiringStatus } from "@/lib/hiring-states";
import type { TaskWithCandidates, Candidate, User } from "@shared/schema";

const ALL_STATUSES: BackendHiringStatus[] = [
  "SELECTION", "PAYMENT_REVIEW", "TUTOR_SELECTED", "ADJUDICATED",
  "IN_PROGRESS", "LATE", "EXTRA_REVIEW", "DELIVERED", "IN_REVISION",
  "DISPUTE", "COMPLETED", "TIP_REVIEW", "CANCELLED", "EXPIRED",
];

// Solo nombres: el valor se lee en runtime con getComputedStyle (ver Swatch), asi esta tabla no se
// desfasa de client/src/index.css (fuente de verdad).
const GREEN_TOKENS = [100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => `--green-${n}`);
const GRAY_TOKENS = [100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => `--gray-${n}`);

const RADIUS_TOKENS = [
  ["xs", "2px"], ["sm", "8px"], ["DEFAULT / md", "12px"], ["lg", "16px"],
  ["xl", "24px"], ["card", "14px → 16px"], ["sheet", "20px → 24px"],
  ["modal", "16px → 20px"], ["full", "9999px"],
] as const;

const SPACING_TOKENS = [
  ["0", "0"], ["1", "4px"], ["2", "8px"], ["3", "12px"], ["4", "16px"],
  ["6", "24px"], ["8", "32px"],
] as const;

// Un solo breakpoint (768px): "móvil" = <768px, "tablet/desktop" = >=768px.
// El sistema no distingue tablet de desktop, solo móvil vs el resto.
// heading/subheading/body/caption son responsivas de verdad (estan en
// tailwind.config.ts fontSize como var(--text-*)). text-body es el parrafo
// responsivo (14px movil -> 16px desktop); text-sm sigue siendo 14px fijo
// para texto denso (metadata, filas de lista).
const TYPE_TOKENS = [
  { name: "heading", mobile: "24px / 32", desktop: "28px / 36", cls: "text-heading font-bold", sample: "Título de pantalla y montos destacados" },
  { name: "subheading", mobile: "20px / 28", desktop: "20px / 28", cls: "text-subheading font-semibold", sample: "Título de sección y de modal" },
  { name: "body", mobile: "16px / 24", desktop: "16px / 24", cls: "text-body text-gray-700", sample: "Texto de párrafo e inputs" },
  { name: "label", mobile: "14px / 20", desktop: "14px / 20", cls: "text-label font-medium text-gray-900", sample: "Botones, chips, estados, etiquetas y descripciones de modal" },
  { name: "caption", mobile: "12px / 16", desktop: "12px / 16", cls: "text-caption text-gray-700", sample: "Metadatos y etiquetas de la barra inferior" },
] as const;

// Escala fija de tailwind.config.ts (fontSize), toda en la rejilla de 4pt.
const FIXED_TYPE_TOKENS = [
  ["xs", "12px"], ["sm", "14px"], ["base", "16px"],
  ["xl", "20px"], ["2xl", "24px"], ["3xl", "28px"],
  ["4xl", "36px"], ["5xl", "48px"],
] as const;

const now = new Date();
const inDays = (d: number) => new Date(now.getTime() + d * 86400000).toISOString();

const sampleUser: User = {
  id: "user-demo-1", name: "María Torres", email: "maria@demo.com", avatar: null,
} as User;

const sampleTutor: User = {
  id: "tutor-demo-1", name: "Carlos Ruiz", email: "carlos@demo.com",
  avatar: "https://i.pravatar.cc/150?img=12",
} as User;

function makeTask(overrides: Partial<TaskWithCandidates>): TaskWithCandidates {
  return {
    id: "task-demo-1",
    title: "Ensayo argumentativo sobre cambio climático — 3 páginas APA",
    description: "Necesito un ensayo con al menos 5 fuentes académicas.",
    subject: "redaccion",
    deadline: inDays(2),
    createdAt: now.toISOString(),
    status: "active",
    taskNumber: 189,
    assignedTutorId: null,
    candidateCount: 0,
    budget: "45.00",
    currency: "PEN",
    userId: sampleUser.id,
    user: sampleUser,
    candidates: [],
    attachments: [],
    ...overrides,
  } as unknown as TaskWithCandidates;
}

const taskSearching = makeTask({ id: "task-1", status: "active" });

const taskWithCandidates = makeTask({
  id: "task-2",
  title: "Resolver 15 ejercicios de cálculo diferencial",
  status: "active",
  candidateCount: 4,
  candidates: [
    { id: "c1", tutorId: "t1", createdAt: now, tutor: { id: "t1", name: "Ana Paredes" } },
    { id: "c2", tutorId: "t2", createdAt: now, tutor: { id: "t2", name: "Luis Vega" } },
    { id: "c3", tutorId: "t3", createdAt: now, tutor: { id: "t3", name: "Rosa Díaz" } },
  ] as unknown as TaskWithCandidates["candidates"],
});

const taskAssigned = makeTask({
  id: "task-3",
  title: "Diapositivas de exposición: Revolución Industrial",
  status: "in_progress",
  assignedTutorId: "t1",
  candidates: [
    { id: "c1", tutorId: "t1", createdAt: now, tutor: { id: "t1", name: "Ana Paredes" } },
  ] as unknown as TaskWithCandidates["candidates"],
});

const sampleCandidate: Candidate & { tutor: User } = {
  id: "c1", taskId: "task-2", tutorId: sampleTutor.id, createdAt: now,
  message: "Puedo ayudarte, tengo experiencia en cálculo diferencial.",
  proposedPrice: "40.00",
  tutor: sampleTutor,
} as unknown as Candidate & { tutor: User };

const buttonVariants = ["default", "secondary", "destructive", "ghost", "outline", "link"] as const;
const buttonSizes = ["default", "sm", "lg", "icon"] as const;
const badgeVariants = ["default", "secondary", "destructive", "outline", "success", "neutral", "info"] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-subheading font-semibold text-gray-900 border-b border-gray-200 pb-2">{title}</h2>
      {children}
    </section>
  );
}

function Frame({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div className={`bg-gray-100 rounded-lg p-4 ${className}`}>{children}</div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs overflow-x-auto">
      <code>{children}</code>
    </pre>
  );
}

function Swatch({ name }: { name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  useEffect(() => {
    if (ref.current) setValue(getComputedStyle(ref.current).backgroundColor);
  }, []);
  return (
    <div className="flex items-center gap-3">
      <div ref={ref} className="w-10 h-10 rounded-lg border border-gray-200 shrink-0" style={{ background: `var(${name})` }} />
      <div className="min-w-0">
        <p className="text-xs font-mono text-gray-900">{name}</p>
        <p className="text-xs text-gray-500">{value}</p>
      </div>
    </div>
  );
}

export default function Styleguide() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [legacyModalOpen, setLegacyModalOpen] = useState(false);
  const [toggleSm, setToggleSm] = useState(true);
  const [toggleMd, setToggleMd] = useState(true);
  const [toggleLg, setToggleLg] = useState(false);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white pb-24">
      <Container className="py-8 space-y-10">
        <div>
          <h1 className="text-heading font-bold text-gray-900">Sistema de diseño — MilTareas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tokens + instancias en vivo de los componentes reales, con snippet de uso. Fuente de verdad: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">client/src/index.css</code> y <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">tailwind.config.ts</code>.
          </p>
        </div>

        <Section title="Tokens — Color">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
            {GREEN_TOKENS.map((name) => <Swatch key={name} name={name} />)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 mt-4">
            {GRAY_TOKENS.map((name) => <Swatch key={name} name={name} />)}
          </div>
        </Section>

        <Section title="Tokens — Radius">
          <div className="flex flex-wrap gap-4">
            {RADIUS_TOKENS.map(([name, value]) => (
              <div key={name} className="text-center">
                <div className="w-16 h-16 bg-green-100 border border-green-300" style={{ borderRadius: value.split(" ")[0] }} />
                <p className="text-xs text-gray-500 mt-1">{name}</p>
                <p className="text-xs font-mono text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Tokens — Spacing">
          <div className="flex flex-col gap-2">
            {SPACING_TOKENS.map(([name, value]) => (
              <div key={name} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-16 shrink-0">space-{name}</span>
                <div className="h-3 bg-green-500 rounded-sm" style={{ width: value }} />
                <span className="text-xs font-mono text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Tipografía">
          <p className="text-xs text-gray-500 -mt-2">
            Fuente: <code className="bg-gray-100 px-1 rounded">Manrope</code> (texto y display). Un solo breakpoint responsivo en <code className="bg-gray-100 px-1 rounded">768px</code>: no hay escala separada para tablet, tablet usa los mismos valores que desktop.
          </p>
          <div className="space-y-4">
            {TYPE_TOKENS.map((t) => (
              <div key={t.name} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 pb-3">
                <span className="text-xs text-gray-500 w-32 shrink-0 font-mono">text-{t.name}</span>
                <span className={`text-gray-900 ${t.cls}`}>{t.sample}</span>
                <span className="text-xs text-gray-400 sm:ml-auto shrink-0">{t.mobile} móvil · {t.desktop} ≥768px</span>
              </div>
            ))}
          </div>
          <Code>{`<h1 className="text-heading font-bold">Título</h1>\n<p className="text-body text-gray-700">Párrafo</p>\n<span className="text-caption text-gray-500">Metadata</span>`}</Code>

          <p className="text-xs font-medium text-gray-500 mt-6 mb-2">Escala fija, solo para campos (text-base) y display — la interfaz usa los alias: text-heading, text-subheading, text-body, text-label, text-caption</p>
          <div className="flex flex-wrap items-baseline gap-4">
            {FIXED_TYPE_TOKENS.map(([name, px]) => (
              <div key={name} className="text-center">
                <p className={`text-${name} text-gray-900`}>Aa</p>
                <p className="text-xs text-gray-500 mt-1">{name} · {px}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Button">
          <div className="flex flex-col gap-3">
            {buttonVariants.map((variant) => (
              <div key={variant} className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500 w-24 shrink-0">{variant}</span>
                {buttonSizes.map((size) => (
                  <Button key={size} variant={variant} size={size}>
                    {size === "icon" ? "＋" : "Botón"}
                  </Button>
                ))}
                <Button variant={variant} isLoading>Cargando</Button>
                <Button variant={variant} disabled>Deshabilitado</Button>
              </div>
            ))}
          </div>
          <Code>{`<Button variant="default" size="default">Botón</Button>\n<Button variant="secondary" isLoading>Cargando</Button>\n<Button variant="outline" disabled>Deshabilitado</Button>`}</Code>
        </Section>

        <Section title="Badge">
          <div className="flex flex-wrap gap-2">
            {badgeVariants.map((v) => <Badge key={v} variant={v}>{v}</Badge>)}
          </div>
          <Code>{`<Badge variant="success">success</Badge>`}</Code>
        </Section>

        <Section title="ToggleSwitch">
          <div className="flex items-end gap-8">
            <Frame label="sm"><ToggleSwitch size="sm" checked={toggleSm} onChange={() => setToggleSm(v => !v)} /></Frame>
            <Frame label="md (default)"><ToggleSwitch checked={toggleMd} onChange={() => setToggleMd(v => !v)} /></Frame>
            <Frame label="lg"><ToggleSwitch size="lg" checked={toggleLg} onChange={() => setToggleLg(v => !v)} /></Frame>
            <Frame label="disabled"><ToggleSwitch checked disabled onChange={() => {}} /></Frame>
          </div>
          <Code>{`<ToggleSwitch checked={isActive} onChange={() => setIsActive(v => !v)} size="md" />`}</Code>
        </Section>

        <Section title="StatusBadge (todos los BackendHiringStatus)">
          <div className="flex flex-wrap gap-2">
            {ALL_STATUSES.map((s) => <StatusBadge key={s} status={s} />)}
          </div>
        </Section>

        <Section title="Card">
          <Card className="max-w-sm">
            <CardHeader>
              <CardTitle>Título de tarjeta</CardTitle>
              <p className="text-sm text-gray-500">Contenido de ejemplo dentro de un Card básico.</p>
            </CardHeader>
          </Card>
        </Section>

        <Section title="SimpleTaskCard">
          <div className="grid gap-4 sm:grid-cols-3">
            <Frame label="Buscando tutores">
              <SimpleTaskCard task={taskSearching} onClick={() => {}} />
            </Frame>
            <Frame label="Con candidatos">
              <SimpleTaskCard task={taskWithCandidates} onClick={() => {}} />
            </Frame>
            <Frame label="Asignado + no leídos">
              <SimpleTaskCard task={taskAssigned} onClick={() => {}} unreadCount={2} />
            </Frame>
          </div>
          <Code>{`<SimpleTaskCard task={task} onClick={handleClick} unreadCount={2} />`}</Code>
        </Section>

        <Section title="TaskList">
          <div className="grid gap-4 sm:grid-cols-2">
            <Frame label="Con tareas">
              <TaskList
                tasks={[taskSearching, taskWithCandidates, taskAssigned]}
                onTaskClick={() => {}}
                onRepublish={() => {}}
                getTotalUnreadForTask={() => 0}
              />
            </Frame>
            <Frame label="Estado vacío">
              <TaskList
                tasks={[]}
                onTaskClick={() => {}}
                onRepublish={() => {}}
                getTotalUnreadForTask={() => 0}
                emptyStateAction={() => {}}
              />
            </Frame>
          </div>
        </Section>

        <Section title="PresenceIndicator">
          <div className="flex flex-wrap items-center gap-6">
            <Frame label="En línea, punto + texto"><PresenceIndicator userId="sg-online" showLabel isOnline /></Frame>
            <Frame label="Desconectado, hace 5 min"><PresenceIndicator userId="sg-offline" showLabel isOnline={false} lastSeen={new Date(Date.now() - 5 * 60 * 1000)} /></Frame>
            <Frame label="Solo texto (hideDot)"><PresenceIndicator userId="sg-text" showLabel hideDot size="sm" isOnline /></Frame>
            <Frame label="Solo punto"><PresenceIndicator userId="sg-dot" isOnline /></Frame>
          </div>
          <p className="text-caption text-gray-700">
            Única forma de mostrar estado de conexión. No armar punto y texto a mano: pasar isOnline y lastSeen,
            o solo userId para leer la presencia del WebSocket.
          </p>
          <Code>{`<PresenceIndicator userId={id} showLabel hideDot size="sm" isOnline={isOnline} lastSeen={user.lastSeen} />`}</Code>
        </Section>

        <Section title="SpecialtyBadges">
          <SpecialtyBadges specialties={["Química", "Física", "Matemática", "Administración"]} />
          <p className="text-caption text-gray-700">
            Píldora blanca con borde fino y sin negrita. El estilo sale de Badge variant="outline"; con max se
            limita a una línea y el resto pasa a +N.
          </p>
          <Code>{`<SpecialtyBadges specialties={tutor.specialties} max={3} />`}</Code>
        </Section>

        <Section title="UserAvatar">
          <div className="flex items-end gap-6">
            <Frame label="xs · 24px"><UserAvatar name="Ana Paredes" size="xs" /></Frame>
            <Frame label="sm · 32px"><UserAvatar name="Luis Vega" size="sm" /></Frame>
            <Frame label="md · 40px (default)"><UserAvatar name={sampleTutor.name} avatar={sampleTutor.avatar} size="md" /></Frame>
            <Frame label="lg · 64px"><UserAvatar name="Rosa Díaz" size="lg" /></Frame>
            <Frame label="xl · 100px"><UserAvatar name="Carlos Ruiz" size="xl" /></Frame>
            <Frame label="Con presencia"><UserAvatar name={sampleTutor.name} avatar={sampleTutor.avatar} size="md" userId={sampleTutor.id} showPresence /></Frame>
          </div>
          <Code>{`<UserAvatar name="Carlos Ruiz" avatar={url} size="md" showPresence userId={id} />`}</Code>
        </Section>

        <Section title="TutorTaskCard">
          <div className="max-w-sm">
            <TutorTaskCard task={taskWithCandidates} proposedPrice="40.00" onClick={() => {}} />
          </div>
        </Section>

        <Section title="CandidateCard">
          <div className="max-w-sm">
            <CandidateCard candidate={sampleCandidate} taskId="task-2" currency="PEN" />
          </div>
        </Section>

        <Section title="TaskNumber">
          <div className="flex gap-4">
            <TaskNumber taskId="abc123456" taskNumber={189} />
            <TaskNumber taskId="xyz987654" />
          </div>
        </Section>

        <Section title="Container">
          <div className="bg-gray-100 rounded-lg py-4">
            <Container><div className="bg-white rounded p-3 text-sm text-gray-700">max-w-content, centrado, px-page-h</div></Container>
          </div>
        </Section>

        <Section title="Header">
          <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: 72 }}>
            <Header />
          </div>
        </Section>

        <Section title="BottomNavigation">
          {/* contain: layout/paint hace de containing block para position:fixed,
              asi el nav real (fixed bottom-0) queda clippeado dentro del Frame
              en vez de pegarse al viewport real. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Frame label="Mobile — estudiante" className="relative" >
              <div style={{ height: 76, contain: "layout paint", position: "relative" }}>
                <BottomNavigation activeTab={TAB.home} onTabChange={() => {}} userType="student" />
              </div>
            </Frame>
            <Frame label="Mobile — tutor" className="relative">
              <div style={{ height: 76, contain: "layout paint", position: "relative" }}>
                <BottomNavigation activeTab={TAB.jobs} onTabChange={() => {}} userType="tutor" />
              </div>
            </Frame>
          </div>
          <Frame label="Desktop (aside)">
            <div className="lg:!flex" style={{ height: 320 }}>
              <BottomNavigation activeTab={TAB.home} onTabChange={() => {}} userType="student" />
            </div>
          </Frame>
        </Section>

        <Section title="Admin — MetricCard">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-100 p-4 rounded-lg">
            <MetricCard title="En línea" value={12} icon={Wifi} subtitle="de 163 usuarios" testId="sg-metric-online" indicator />
            <MetricCard title="Ingresos" value="4520 PEN" icon={DollarSign} subtitle="13 pagos" testId="sg-metric-earnings" />
          </div>
          <Code>{`<MetricCard title="En línea" value={12} icon={Wifi} subtitle="de 163 usuarios" testId="metric-online" indicator />`}</Code>
        </Section>

        <Section title="Admin — Badge de rol (Alumno/Tutor/Agente)">
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">Alumno</Badge>
            <Badge variant="neutral">Tutor</Badge>
            <Badge variant="info">Agente</Badge>
          </div>
          <p className="text-xs text-gray-500">
            Único mapeo de color para este badge en toda la app — Alumno siempre verde, Tutor siempre gris, Agente siempre azul. No reimplementar con otros colores.
          </p>
          <Code>{`<Badge variant="success">Alumno</Badge>
<Badge variant="neutral">Tutor</Badge>
<Badge variant="info">Agente</Badge>`}</Code>
        </Section>

        <Section title="Admin — AdminTable">
          <div className="bg-white rounded-xl border border-field overflow-hidden">
            <AdminTable>
              <AdminTableHead>
                <tr>
                  <AdminTh>Nombre</AdminTh>
                  <AdminTh>Email</AdminTh>
                  <AdminTh>Estado</AdminTh>
                </tr>
              </AdminTableHead>
              <AdminTableBody>
                <AdminTr>
                  <AdminTd className="text-sm font-medium text-gray-900">María Torres</AdminTd>
                  <AdminTd className="text-sm text-gray-700">maria@demo.com</AdminTd>
                  <AdminTd><span className="text-xs px-2 py-1 rounded-full font-medium bg-green-500/10 text-green-700">Activo</span></AdminTd>
                </AdminTr>
                <AdminTr>
                  <AdminTd className="text-sm font-medium text-gray-900">Carlos Ruiz</AdminTd>
                  <AdminTd className="text-sm text-gray-700">carlos@demo.com</AdminTd>
                  <AdminTd><span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-700">Inactivo</span></AdminTd>
                </AdminTr>
              </AdminTableBody>
            </AdminTable>
          </div>
          <Code>{`<AdminTable>\n  <AdminTableHead><tr><AdminTh>Nombre</AdminTh></tr></AdminTableHead>\n  <AdminTableBody><AdminTr><AdminTd>...</AdminTd></AdminTr></AdminTableBody>\n</AdminTable>`}</Code>
        </Section>

        <Section title="Admin — FilterSelect">
          <FilterSelect defaultValue="all">
            <option value="all">Estado: Todos</option>
            <option value="active">Activos</option>
            <option value="paused">Inactivos</option>
          </FilterSelect>
          <Code>{`<FilterSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>\n  <option value="all">Estado: Todos</option>\n</FilterSelect>`}</Code>
        </Section>

        <Section title="Admin — AlertDialog">
          <Button variant="destructive" onClick={() => setAlertDialogOpen(true)}>Eliminar cuenta</Button>
          <p className="text-xs text-gray-500">
            Para confirmar acciones destructivas (a diferencia de <code className="bg-gray-100 px-1 rounded">Dialog</code>, que es para contenido/formularios).
          </p>
          <Code>{`<AlertDialog open={open} onOpenChange={setOpen}>\n  <AlertDialogContent>\n    <AlertDialogHeader>\n      <AlertDialogTitle>¿Seguro?</AlertDialogTitle>\n      <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>\n    </AlertDialogHeader>\n    <AlertDialogFooter>\n      <AlertDialogCancel>Cancelar</AlertDialogCancel>\n      <AlertDialogAction>Eliminar</AlertDialogAction>\n    </AlertDialogFooter>\n  </AlertDialogContent>\n</AlertDialog>`}</Code>
          <AlertDialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar esta cuenta?</AlertDialogTitle>
                <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => setAlertDialogOpen(false)}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Section>

        <Section title="Modales">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setDialogOpen(true)}>Abrir Dialog</Button>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>Abrir Sheet</Button>
            <Button variant="outline" onClick={() => setLegacyModalOpen(true)}>Abrir .modal-overlay</Button>
          </div>

          <div className="space-y-3">
            <Code>{`<Dialog open={open} onOpenChange={setOpen}>\n  <DialogContent>\n    <DialogHeader>\n      <DialogTitle>Título</DialogTitle>\n      <DialogDescription>Descripción corta.</DialogDescription>\n    </DialogHeader>\n    <DialogFooter><Button onClick={() => setOpen(false)}>Cerrar</Button></DialogFooter>\n  </DialogContent>\n</Dialog>`}</Code>
            <Code>{`<Sheet open={open} onOpenChange={setOpen}>\n  <SheetContent side="right">\n    <SheetHeader><SheetTitle>Título</SheetTitle></SheetHeader>\n  </SheetContent>\n</Sheet>`}</Code>
            <Code>{`// Patrón legado (sin componente React) — usado en home.tsx, chat-section.tsx\n<div className="modal-overlay">\n  <div className="modal-content">...</div>\n</div>`}</Code>
          </div>

          <p className="text-xs text-gray-500">
            Dialog/Sheet: primitivos Radix (<code className="bg-gray-100 px-1 rounded">@/components/ui/dialog</code>, <code className="bg-gray-100 px-1 rounded">sheet</code>) — usar en código nuevo.
            El patrón <code className="bg-gray-100 px-1 rounded">.modal-overlay</code>/<code className="bg-gray-100 px-1 rounded">.modal-content</code> es CSS suelto (index.css) usado en pantallas antiguas — no es un componente, solo clases.
          </p>
        </Section>
      </Container>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ejemplo de Dialog</DialogTitle>
            <DialogDescription>Modal centrado, ancho fijo (--modal-width), cierra con X, click afuera o Esc.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Ejemplo de Sheet</SheetTitle>
          </SheetHeader>
          <p className="text-sm text-gray-500 mt-2">Panel lateral, útil para filtros o detalle sin salir de la pantalla.</p>
        </SheetContent>
      </Sheet>

      {legacyModalOpen && (
        <div className="modal-overlay" onClick={() => setLegacyModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-subheading font-semibold text-gray-900 mb-2">Patrón .modal-overlay</h3>
            <p className="text-sm text-gray-700 mb-4">Clases CSS directas, sin wrapper React. Usado en flujos antiguos (republicar tarea, detalle de pedido).</p>
            <Button className="w-full" onClick={() => setLegacyModalOpen(false)}>Cerrar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
