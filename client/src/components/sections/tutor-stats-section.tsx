import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TutorOwnStats } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterPills } from "@/components/ui/filter-pills";
import { ListHeader } from "@/components/ui/list-header";
import { ListScreen } from "@/components/ui/list-screen";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { fmtDateShort } from "@/lib/date-format";
import { pluralizeEs } from "@/lib/pluralize";
import { ROUTES } from "@/lib/routes";

type Period = "7" | "30" | "90";

const PERIODS: readonly { id: Period; label: string }[] = [
  { id: "7", label: "7 días" },
  { id: "30", label: "30 días" },
  { id: "90", label: "90 días" },
];

/** "36 h" o "3 días" para el tiempo medio de entrega. */
function formatHours(hours: number): string {
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} días`;
}

/** Tarjeta de un dato: valor grande, etiqueta y una nota opcional debajo. */
function StatCard({ value, label, note, testId }: { value: string | number; label: string; note?: string; testId?: string }) {
  return (
    <Card className="flex flex-col gap-1 p-bento-pad" data-testid={testId}>
      <span className="text-heading font-bold text-gray-900">{value}</span>
      <span className="text-label text-gray-700">{label}</span>
      {note && <span className="text-caption text-gray-700">{note}</span>}
    </Card>
  );
}

// Mis estadisticas (solo tutores): cuantas personas vieron el perfil, pedidos completados, calificacion, guardados en
// favoritos y tiempo medio de entrega, mas las vistas por dia. Solo cifras: nunca quien vio el perfil ni quien lo guardo.
export default function TutorStatsSection() {
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState<Period>("30");

  const { data, isLoading, isError, refetch } = useQuery<TutorOwnStats>({
    queryKey: ["/api/tutor/stats", period],
    queryFn: async () => (await apiRequest("GET", `/api/tutor/stats?days=${period}`)).json(),
    staleTime: 60 * 1000,
  });

  const header = (
    <ListHeader title="Mis estadísticas" subtitle="Cómo te ven los alumnos." onBack={() => setLocation(ROUTES.tutorProfile)}>
      <FilterPills options={PERIODS} value={period} onChange={setPeriod} />
    </ListHeader>
  );

  if (isError) {
    return (
      <ListScreen>
        {header}
        <EmptyState
          centered
          title="No pudimos cargar tus estadísticas"
          description="Revisa tu conexión e inténtalo de nuevo."
          action={<Button onClick={() => refetch()}>Reintentar</Button>}
        />
      </ListScreen>
    );
  }

  const hasViews = !!data && data.daily.some((d) => d.views > 0);

  return (
    <ListScreen>
      {header}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3" data-testid="tutor-stats">
        {isLoading || !data ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)
        ) : (
          <>
            <StatCard
              value={data.viewers}
              label={`${pluralizeEs(data.viewers, "persona vio", "personas vieron")} tu perfil`}
              note={`${data.views} ${pluralizeEs(data.views, "vista")} en ${data.days} días`}
              testId="stat-viewers"
            />
            <StatCard value={data.completed} label={pluralizeEs(data.completed, "Pedido completado", "Pedidos completados")} />
            <StatCard
              value={data.rating > 0 ? data.rating.toFixed(1) : "—"}
              label="Calificación"
              note={`${data.reviews} ${pluralizeEs(data.reviews, "reseña")}`}
            />
            <StatCard value={data.favorites} label={pluralizeEs(data.favorites, "Persona te guardó en favoritos", "Personas te guardaron en favoritos")} />
            <StatCard
              value={data.avgDeliveryHours !== null ? formatHours(data.avgDeliveryHours) : "—"}
              label="Tiempo medio de entrega"
              note={data.avgDeliveryHours === null ? "Aún sin entregas" : "Desde que se aprueba el pago"}
            />
          </>
        )}
      </div>

      <Card className="flex flex-col gap-3 p-bento-pad" data-testid="stat-views-chart">
        <h2 className="text-subheading font-semibold text-gray-900">Vistas de tu perfil por día</h2>
        {isLoading || !data ? (
          <Skeleton className="h-56 w-full" />
        ) : !hasViews ? (
          <EmptyState title="Aún no hay vistas en este período" className="flex h-56 flex-col items-center justify-center py-0" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.daily.map((d) => ({ ...d, label: fmtDateShort(new Date(`${d.day}T12:00:00`)) }))} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ style: { fontSize: "var(--text-caption)" }, fill: "var(--gray-700)" }}
                tickLine={false}
                axisLine={false}
                interval={data.daily.length > 14 ? Math.floor(data.daily.length / 7) : 0}
              />
              <YAxis
                allowDecimals={false}
                tick={{ style: { fontSize: "var(--text-caption)" }, fill: "var(--gray-700)" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "var(--gray-100)" }}
                formatter={(v) => [v, "Vistas"]}
                contentStyle={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: "var(--text-caption)" }}
              />
              <Bar dataKey="views" fill="var(--green-600)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </ListScreen>
  );
}
