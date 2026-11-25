import { BackButton } from "@/components/ui/back-button";
import { ROUTES, tutorRoute } from "@/lib/routes";
import { useState, useMemo } from "react";
import { ListScreen } from "@/components/ui/list-screen";
import { ListHeader, ListHeaderSkeleton } from "@/components/ui/list-header";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { TutorListItem } from "@/components/ui/tutor-list-item";
import { InviteTutorModal } from "@/components/ui/invite-tutor-modal";
import { TutorProfileContent } from "@/components/sections/tutor-profile-content";
import { ThreeColumnLayout } from "@/components/layout/three-column-layout";
import { Button } from "@/components/ui/button";
import { FilterPills } from "@/components/ui/filter-pills";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageBannerSheet } from "@/components/ui/page-banner-sheet";
import { useWebSocketFixed } from "@/hooks/useWebSocketFixed";
import type { PublicTutor, User } from "@shared/schema";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { MQ } from "@/lib/breakpoints";

type SortOption = "online" | "rating";

const SORT_LABELS: Record<SortOption, string> = {
  online: "En línea",
  rating: "Mejor calificados",
};

type TutorFilter = "todos" | "mis-tutores";

const TUTOR_FILTERS: { id: TutorFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "mis-tutores", label: "Mis tutores" },
];

type MyTutor = { id: string; user_id: string; name: string; avatar: string | null; profession: string | null; rating: string; isFavorite: boolean; };

export default function TutorsSection() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [tutorFilter, setTutorFilter] = useState<TutorFilter>("todos");
  const [sortBy, setSortBy] = useState<SortOption>("online");
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/user/current"],
  });

  const { onlineUsers } = useWebSocketFixed(currentUser?.id);
  
  const { data: tutors, isLoading, isError, refetch } = useQuery<PublicTutor[]>({
    queryKey: ["/api/tutors"],
    enabled: !!currentUser,
  });

  const { data: myTutors = [] } = useQuery<MyTutor[]>({
    queryKey: ["/api/my-tutors"],
    enabled: !!currentUser && (currentUser as any).userType === 'student',
  });


  const myTutorIds = useMemo(() => new Set(myTutors.map(t => t.user_id)), [myTutors]);

  const filteredTutors = useMemo(() => {
    if (!tutors) return [];
    
    let result = [...tutors];
    
    // Filter by "Mis tutores" tab
    if (tutorFilter === "mis-tutores") {
      result = result.filter(tutor => myTutorIds.has(tutor.user_id));
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(tutor => 
        tutor.user.name.toLowerCase().includes(query) ||
        tutor.profession?.toLowerCase().includes(query) ||
        tutor.specialties?.some(s => s.toLowerCase().includes(query))
      );
    }
    
    // Sort by selected option
    result.sort((a, b) => {
      const aRating = parseFloat(a.rating || "0");
      const bRating = parseFloat(b.rating || "0");
      if (sortBy === "online") {
        const aOnline = onlineUsers.has(a.user_id) ? 1 : 0;
        const bOnline = onlineUsers.has(b.user_id) ? 1 : 0;
        if (aOnline !== bOnline) return bOnline - aOnline;
        return bRating - aRating;
      }
      return bRating - aRating;
    });
    
    return result;
  }, [tutors, searchQuery, onlineUsers, tutorFilter, myTutorIds, sortBy]);

  // Desktop (lg:, breakpoint real del shell — ver DashboardLayout/home.tsx):
  // selecciona tutor para la columna derecha. Mobile/tablet: navega a la
  // pagina de detalle con boton de regresar (no hay columna derecha ahi).
  const handleSelectTutor = (tutorId: string) => {
    if (window.matchMedia(MQ.lg).matches) {
      setSelectedTutorId(tutorId);
    } else {
      setLocation(tutorRoute(tutors?.find((t) => t.id === tutorId) ?? { id: tutorId }));
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white">
        <ListScreen>
          <ListHeaderSkeleton />
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-bento-pad">
              <div className="flex items-center gap-3">
                <Skeleton className="size-avatar-mdl rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-skeleton-line w-skeleton-name-w" />
                  <Skeleton className="h-skeleton-meta-h w-skeleton-pill-w" />
                </div>
              </div>
            </Card>
          ))}
        </ListScreen>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white lg:h-full">
        <ListScreen className="lg:flex lg:h-full lg:flex-col">
          <ListHeader title="Tutores" />
          <EmptyState
            centered
            title="No pudimos cargar la información"
            description="Revisa tu conexión e inténtalo de nuevo."
            action={<Button onClick={() => refetch()}>Reintentar</Button>}
          />
        </ListScreen>
      </div>
    );
  }

  // El perfil reemplaza a la lista (no se abre al costado): ocupa todo el ancho de la pantalla y se desplaza con ella, sin scroll propio.
  if (selectedTutorId) {
    const openChat = ({ threadId, userId, userName }: { threadId?: string; userId: string; userName: string }) => setLocation(
      threadId
        ? `${ROUTES.messages}?threadId=${threadId}`
        : `${ROUTES.messages}?userId=${userId}&userName=${encodeURIComponent(userName)}`
    );
    return (
      <div className="bg-white">
        <ListScreen>
          <BackButton onClick={() => setSelectedTutorId(null)} className="-ml-2.5 lg:ml-0" />
          <TutorProfileContent key={selectedTutorId} tutorKey={selectedTutorId} onChatStarted={openChat} flush />
        </ListScreen>
      </div>
    );
  }

  return (
    <ThreeColumnLayout
      preset="list-detail"
      breakpoint="lg"
      className="lg:h-full"
      list={
        <div>
        <ListScreen>

        {/* Banner + hoja con buscador y filtros (mismo patron que Inicio / Publicar) */}
        <PageBannerSheet
          title="Tutores"
          noBanner
          subtitle="Elige al tutor ideal para tu pedido."
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: "Buscar por nombre, área o curso", label: "Buscar por nombre, área o curso", testId: "search-tutors" }}
        >
            <div className="flex flex-wrap items-center gap-2">
              {/* Solo estudiantes con tutores guardados */}
              {(currentUser as any)?.userType === 'student' && (
                <FilterPills
                  className="flex-shrink-0"
                  options={TUTOR_FILTERS}
                  value={tutorFilter}
                  onChange={setTutorFilter}
                />
              )}
              <FilterSelect
                className="ml-auto"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                data-testid="select-tutor-sort"
              >
                {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                  <option key={opt} value={opt}>{SORT_LABELS[opt]}</option>
                ))}
              </FilterSelect>
            </div>
        </PageBannerSheet>

        {/* Tutors List */}
        <div className="grid grid-cols-1 gap-card-gap sm:grid-cols-2 lg:gap-6 xl:grid-cols-3">
          {filteredTutors.map((tutor) => (
            <div key={tutor.id} data-testid={`tutor-card-${tutor.id}`}>
              <TutorListItem
                name={tutor.user.name}
                avatar={tutor.user.avatar}
                profession={tutor.profession}
                specialties={tutor.specialties}
                rating={tutor.rating}
                reviewCount={(tutor as any).reviewCount || 0}
                completedTasksCount={(tutor as any).completedTasksCount || 0}
                isVerified={tutor.isVerified}
                userId={tutor.user_id}
                isOnline={onlineUsers.has(tutor.user_id)}
                onClick={() => handleSelectTutor(tutor.id)}
                onMessageClick={() => setLocation(`${ROUTES.messages}?userId=${tutor.user_id}&userName=${encodeURIComponent(tutor.user.name)}`)}
              />
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredTutors.length === 0 && (
          <EmptyState title="No se encontraron tutores" className="py-12" />
        )}
        </ListScreen>
        </div>
      }
      detail={null}
    />
  );
}
