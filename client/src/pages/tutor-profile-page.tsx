import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BackButton } from "@/components/ui/back-button";
import { ROUTES, ROUTE_PATTERNS, TAB, tutorRoute } from "@/lib/routes";
import { useRoute, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { TutorProfileContent } from "@/components/sections/tutor-profile-content";
import type { TutorProfile } from "@shared/schema";

export default function TutorProfilePage() {
  const [, params] = useRoute(ROUTE_PATTERNS.tutor);
  const [, setLocation] = useLocation();
  const tutorKey = params?.key;

  // Misma consulta que TutorProfileContent (una sola peticion): sirve para dejar la URL en su forma limpia.
  // Un enlace antiguo /tutor/<id> (o con mayusculas) pasa a /tutor/olga-perez sin sumar una entrada al historial.
  const { data: tutor } = useQuery<TutorProfile>({ queryKey: ["/api/tutors", tutorKey], enabled: !!tutorKey });
  useEffect(() => {
    if (tutor?.slug && tutorKey && tutor.slug !== tutorKey) setLocation(tutorRoute(tutor), { replace: true });
  }, [tutor, tutorKey, setLocation]);

  // Vuelve a donde se vino (chat, pedido, lista); sin historial (URL directa) cae a /tutors.
  const handleGoBack = () => {
    if (window.history.length > 1) window.history.back();
    else setLocation(ROUTES.tutors);
  };

  if (!tutorKey) {
    return null;
  }

  const openChat = ({ threadId, userId, userName }: { threadId?: string; userId: string; userName: string }) => setLocation(
    threadId
      ? `${ROUTES.messages}?threadId=${threadId}`
      : `${ROUTES.messages}?userId=${userId}&userName=${encodeURIComponent(userName)}`
  );

  return (
    <DashboardLayout activeTab={TAB.tutors}>
      {/* Header con botón de regreso */}
      <header className="bg-white px-page-h py-3 sticky top-0 z-sticky">
        <div className="flex items-center gap-3">
          <BackButton
            onClick={handleGoBack}
            className="-ml-2.5 lg:ml-0" />
          <h1 className="text-heading font-bold text-gray-900">Perfil del tutor</h1>
        </div>
      </header>

      <div className="px-page-h pb-page-top pt-2">
        <TutorProfileContent tutorKey={tutorKey} onChatStarted={openChat} flush />
      </div>
    </DashboardLayout>
  );
}
