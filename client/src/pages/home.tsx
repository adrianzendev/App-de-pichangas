import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES, TAB, VALID_TABS } from "@/lib/routes";
import { useState, useEffect, lazy, Suspense, type ReactNode } from "react";
import { useLocation } from "wouter";
import { PublishFab } from "@/components/ui/publish-fab";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import BottomNavigation from "@/components/layout/bottom-navigation";
import { ThreeColumnLayout } from "@/components/layout/three-column-layout";
import ChatSection from "@/components/sections/chat-section";
import { syncAllPrices } from "@/lib/price-sync";
import { formatPrice } from "@/lib/timezone-utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle, MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useWebSocketFixed } from "@/hooks/useWebSocketFixed";

import type { UserWithType } from "@shared/schema";
import { PageLoader } from "@/components/ui/spinner";
import { sectionLoaders, prefetchAllSections } from "@/lib/section-loaders";
import { useMediaQuery } from "@/hooks/use-media-query";
import { MESSAGES_SPLIT_QUERY } from "@/lib/layout-queries";
import { IconCircle } from "@/components/ui/icon-circle";
import { HomeRightPanel } from "@/components/layout/home-right-panel";

// Secciones fuera de Inicio: se cargan al entrar (code-splitting, menos JS en el arranque).
// Contenido del shell movil/tablet. Mensajes ocupa exactamente el alto entre cabecera y barra inferior (h-chat-split) y la
// lista hace su propio scroll: sin min-h-screen ni pb-bottom-nav que estiren la pagina cuando hay pocos chats.
// Desde lg el contenido central es una tarjeta (borde y esquinas del sistema) dentro del shell de `max-w-shell`.
// Estilo X: columna central blanca con lineas a los lados (sin esquinas ni sombra); cada vista trae sus propias tarjetas.
const MAIN_CARD = "lg:bg-card lg:border-x lg:border-border";
// Pantallas sin barra inferior (NO_MOBILE_NAV_TABS: Publicar, Cuenta) cambian `pb-bottom-nav` por `pb-safe-nav`: 8px + el area
// segura inferior (env(safe-area-inset-bottom)), para que el ultimo elemento no quede bajo la barra de navegacion del celular.
const MAIN_BASE = `bg-white ${MAIN_CARD} pb-bottom-nav lg:pb-0 lg:min-h-0 lg:h-full flex-1 lg:min-w-0 lg:overflow-y-auto scrollbar-none`;
const MAIN_MENSAJES = `bg-white ${MAIN_CARD} h-chat-split overflow-y-auto lg:flex-1 lg:h-full lg:min-w-0 lg:overflow-y-auto scrollbar-none tablet:overflow-hidden`;

// Los import() viven en lib/section-loaders.ts para poder precargarlos (hover del menu + idle).
const PublishSection = lazy(sectionLoaders.publish);
const TutorsSection = lazy(sectionLoaders.tutors);
const ProfileSection = lazy(sectionLoaders.profile);
const ChangePassword = lazy(sectionLoaders.changePassword);
const AccountSection = lazy(sectionLoaders.account);
const MessagesSection = lazy(sectionLoaders.messages);
const MessagesDesktopSplit = lazy(sectionLoaders.messagesSplit);
const TutorProfileSection = lazy(sectionLoaders.tutorProfile);
const TutorStatsSection = lazy(sectionLoaders.tutorStats);
const TutorSpecialtiesSection = lazy(sectionLoaders.tutorSpecialties);
const UniversityPickerSection = lazy(sectionLoaders.university);
const TutorWorkSection = lazy(sectionLoaders.tutorWork);
const OrdersSection = lazy(sectionLoaders.orders);
const PushNotificationModal = lazy(() => import("@/components/modals/push-notification-modal").then((m) => ({ default: m.PushNotificationModal })));

interface TaskAssignedNotification {
  taskId: string;
  taskTitle: string;
  amount: string;
  currency?: string;
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-view">
      <div className="space-y-4 w-full max-w-md px-page-h">
        <Skeleton className="h-8 w-1/2 mx-auto" />
        <Skeleton className="h-4 w-3/4 mx-auto" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}

// Vistas con flecha de regresar propia: sin barra inferior movil (el sidebar de escritorio no cambia).
// Subpaginas a las que se llega desde Mi perfil (estadisticas, especialidades): en movil se oculta la barra inferior, como en Cuenta y Publicar.
const NO_MOBILE_NAV_TABS: string[] = [TAB.account, TAB.publish, TAB.tutorStats, TAB.tutorSpecialties, TAB.university];

// Pantallas de formulario donde el boton flotante "Publicar" tapa el boton principal.
const NO_PUBLISH_FAB_TABS: string[] = [TAB.publish, TAB.profile, TAB.studentProfile, TAB.changePassword, TAB.account, TAB.university];

function tabFromLocation(location: string): string {
  const segment = location.replace('/', '').split('/')[0] || TAB.home;
  return VALID_TABS.includes(segment) ? segment : TAB.home;
}

export default function Home() {
  // Mensajes: split (lista + chat) en escritorio/tablet, lista sola en movil. Se monta UNA sola vista (misma query que las clases tablet:/lg:).
  const isMessagesSplit = useMediaQuery(MESSAGES_SPLIT_QUERY);
  const [location, setLocation] = useLocation();
  // Pestana activa DERIVADA de la URL en el mismo render (no un estado sincronizado por useEffect):
  // con estado, el primer frame tras montar o tras "atras" mostraba "inicio" (valor inicial) antes
  // de que el efecto corrigiera la pestana, y se veia un parpadeo del item Inicio.
  const activeTab = tabFromLocation(location);
  const [showPushModal, setShowPushModal] = useState(false);
  const [showTaskAssignedModal, setShowTaskAssignedModal] = useState(false);
  const [assignedTaskInfo, setAssignedTaskInfo] = useState<TaskAssignedNotification | null>(null);
  const queryClient = useQueryClient();

  // Check if current user is a tutor
  const { data: currentUser, isLoading: isLoadingUser, isError: isUserError, refetch: refetchUser } = useQuery<UserWithType>({
    queryKey: ["/api/user/current"],
  });

  // CRITICAL: Maintain WebSocket connection at top level to receive payment notifications
  // This ensures the connection stays alive while the user is on any page within the app
  useWebSocketFixed(currentUser?.id);

  // useEffect A: role-based redirects — writes URL via setLocation, never touches setActiveTab directly
  useEffect(() => {
    if (!currentUser) return;
    if ((currentUser as any).userType === 'agent') {
      window.location.replace('/dashboard');
      return;
    }
    const basePath = location.replace('/', '').split('/')[0] || TAB.home;
    if (currentUser.userType === 'tutor' && (basePath === '' || basePath === TAB.home)) {
      setLocation(ROUTES.jobs);
      return;
    }
    if (currentUser.userType !== 'admin' && basePath === 'chat') {
      setLocation('/');
    }
  }, [currentUser, location]);

  // Show push notification modal on first login
  useEffect(() => {
    if (currentUser && !isLoadingUser) {
      const hasSeenModal = localStorage.getItem('push_modal_shown');
      if (!hasSeenModal) {
        // Espera ~3 s a que cargue la pantalla antes de mostrar el toast
        const timer = setTimeout(() => {
          setShowPushModal(true);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [currentUser, isLoadingUser]);

  // Con sesion confirmada, baja en ocio los chunks de las demas pestanas: el primer clic ya no muestra spinner.
  const hasUser = !!currentUser;
  useEffect(() => { if (hasUser) prefetchAllSections(); }, [hasUser]);

  // Save current user context to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('lastUserContext', JSON.stringify({
        userId: currentUser.id,
        userType: currentUser.userType,
        lastRoute: location
      }));
    }
  }, [currentUser, location]);


  useEffect(() => {
    if (currentUser) {
      syncAllPrices();
      const syncInterval = setInterval(syncAllPrices, 120000);
      return () => clearInterval(syncInterval);
    }
  }, [currentUser]);

  // Redirect to login if no user is logged in
  useEffect(() => {
    if (currentUser === undefined) return; // Still loading
    
    if (currentUser === null) {
      // No user logged in, redirect to login page. Client-side nav, no
      // reload: un hard reload aca reinicia PersistQueryClientProvider y
      // puede restaurar un snapshot de IndexedDB desactualizado antes de
      // que el write throttled del persister se haya guardado (ver
      // CLAUDE.md, rebote intermitente post-login).
      setLocation('/login');
    }
  }, [currentUser, setLocation]);

  // Admin/agente: mandar al dashboard. Efecto (no side-effect en el cuerpo
  // del render) para no romper las reglas de hooks — el bloque de abajo que
  // muestra el spinner viene despues de otros early-return condicionales.
  useEffect(() => {
    if (currentUser?.userType === 'admin' || (currentUser as any)?.userType === 'agent') {
      setLocation('/dashboard');
    }
  }, [currentUser, setLocation]);

  // GLOBAL PRICE SYNC: Listen for price updates and refresh all relevant queries
  useEffect(() => {
    const handleGlobalPriceUpdate = (event: CustomEvent) => {
      const { taskId, newPrice } = event.detail;
      
      // AGGRESSIVE REFRESH: Force refresh all task-related queries to show updated prices
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/last-messages"] });
      queryClient.refetchQueries({ queryKey: ["/api/tasks"] });
      queryClient.refetchQueries({ queryKey: ["/api/chat/last-messages"] });
      
      // Also trigger a general re-render event for all components
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('priceUpdateComplete', { 
          detail: { taskId, newPrice, timestamp: Date.now() }
        }));
      }, 100);
    };

    window.addEventListener('globalPriceUpdate', handleGlobalPriceUpdate as EventListener);
    
    return () => {
      window.removeEventListener('globalPriceUpdate', handleGlobalPriceUpdate as EventListener);
    };
  }, [queryClient]);

  // Listen for task_assigned WebSocket notifications (for tutors)
  useEffect(() => {
    if (!currentUser || currentUser.userType !== 'tutor') return;

    const handleWebSocketMessage = (event: CustomEvent) => {
      const message = event.detail;
      
      if (message.type === 'task_assigned' && message.tutorId === currentUser.id) {
        // DEDUPE: Check if already shown for this task in this session
        const shownKey = `task_assigned_shown_${message.taskId}`;
        if (sessionStorage.getItem(shownKey)) {
          return;
        }
        
        sessionStorage.setItem(shownKey, 'true');
        
        setAssignedTaskInfo({
          taskId: message.taskId,
          taskTitle: message.taskTitle,
          amount: message.amount,
          currency: message.currency
        });
        setShowTaskAssignedModal(true);
        
        // Refresh tasks to show new assignment
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      }
    };

    window.addEventListener('websocket_message', handleWebSocketMessage as EventListener);
    
    return () => {
      window.removeEventListener('websocket_message', handleWebSocketMessage as EventListener);
    };
  }, [currentUser, queryClient]);

  // Mismo grid que Inicio y Tutores (preset "list-heavy"): contenido en la
  // columna principal, derecha reservada. Alinea el borde izquierdo de todas
  // las vistas del shell (ver CLAUDE.md "Regla de tercera columna").
  // `fluid`: sin ancho de lectura (672px), la vista llena toda la columna como Pedidos y Tutores (perfiles).
  const inMainColumn = (content: ReactNode, fluid = false) => (
    <ThreeColumnLayout preset="list-heavy" breakpoint="lg" readingColumn={!fluid} className="lg:h-full" list={content} detail={null} />
  );

  // Inicio del alumno: el feed va en la tarjeta central del shell; el panel derecho (perfil + Tutores destacados) lo
  // pinta el shell (`HomeRightPanel`), no esta vista.
  const studentHome = <ChatSection />;

  const renderSection = () => {
    // Show loading state while user data is being fetched
    if (isLoadingUser) {
      return <LoadingFallback />;
    }
    
    switch (activeTab) {
      case TAB.home:
        // Tutores no tienen pestaña "Inicio" propia en el bottom nav — su
        // pantalla de entrada siempre fue la lista de chats, ahora el hilo
        // continuo (Mensajes). Estudiantes ven el feed de pedidos de siempre
        // (bento + Ultimos pedidos). Mismo grid que Tutores (preset
        // "list-heavy": feed 7/10 ~70%, ver CLAUDE.md "regla de tercera
        // columna") -- columna derecha reservada sin contenido por ahora
        // (futuros widgets/metricas/asistente IA), NO el split lista+detalle
        // de Mensajes (ese patron es "chat-heavy", ver messages-desktop-split.tsx).
        return currentUser?.userType === "tutor" ? <MessagesSection /> : studentHome;
      case TAB.jobs:
        // For tutors: Show all available tasks to apply
        return <TutorWorkSection />;
      case TAB.orders:
        // For tutors: Show all available tasks to apply (Trabajos) 
        // For students: Show their own orders/tasks
        return currentUser?.userType === "tutor" ? <TutorWorkSection /> : <OrdersSection />;
      case TAB.publish:
        // ONLY students can publish tasks, never tutors
        return currentUser?.userType !== "tutor" ? <PublishSection /> : <OrdersSection />;
      case TAB.tutors:
        // Only show tutors section for students, not for tutors
        return currentUser?.userType !== "tutor" ? <TutorsSection /> : <OrdersSection />;
      case TAB.profile:
        // Admin users should redirect to dashboard
        if (currentUser?.userType === "admin") {
          return (
            <div className="flex justify-center items-center min-h-view bg-white">
              <div className="bg-white p-8 rounded-xl max-w-md w-full mx-4 text-center">
                <h2 className="text-heading font-bold mb-4">Panel de Administración</h2>
                <p className="text-gray-700 mb-6">Accede al dashboard completo de administración</p>
                <Button onClick={() => setLocation('/dashboard')} className="w-full">
                  Ir al Dashboard
                </Button>
              </div>
            </div>
          );
        }
        // Always show ProfileSection for editing - both students and tutors can edit their profiles there
        return inMainColumn(currentUser?.userType === "tutor" ? <TutorProfileSection /> : <ProfileSection />, true);
      case TAB.studentProfile:
        return inMainColumn(<ProfileSection />, true);
      case TAB.changePassword:
        return inMainColumn(<ChangePassword />, true);
      case TAB.account:
        return inMainColumn(<AccountSection />, true);
      case TAB.messages:
        // Hilo continuo user-centric, mismo componente para ambos roles.
        // Desktop (lg:, >=1024px): lista + chat en dos columnas, ver
        // messages-desktop-split.tsx. Mobile/tablet: lista sola, navega a
        // /chat-fullscreen como siempre.
        return isMessagesSplit ? (
          <div className="h-full">
            <MessagesDesktopSplit />
          </div>
        ) : (
          <MessagesSection />
        );
      case TAB.university:
        // Elegir universidad (alumno y tutor); el admin no tiene perfil con universidad.
        return currentUser?.userType === "admin" ? studentHome : inMainColumn(<UniversityPickerSection />, true);
      case TAB.tutorSpecialties:
        // Elegir especialidades: solo para tutores.
        return currentUser?.userType === "tutor" ? inMainColumn(<TutorSpecialtiesSection />, true) : studentHome;
      case TAB.tutorStats:
        // Estadisticas propias: solo para tutores.
        return currentUser?.userType === "tutor" ? inMainColumn(<TutorStatsSection />, true) : studentHome;
      case TAB.tutorProfile:
        // Only show tutor profile if user is actually a tutor
        return inMainColumn(currentUser?.userType === "tutor" ? <TutorProfileSection /> : <ProfileSection />, true);
      default:
        // Mismo tratamiento que "inicio" (ver ese caso) — un activeTab no
        // reconocido cae aca y debe conservar el layout de 3 columnas.
        return currentUser?.userType === "tutor" ? <MessagesSection /> : studentHome;
    }
  };

  // Si la sesion no se pudo consultar (red/servidor), no dejar un spinner infinito: reintentar.
  if (isUserError && currentUser === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white px-page-h">
        <EmptyState
          icon={AlertCircle}
          title="No pudimos cargar tu cuenta"
          description="Revisa tu conexión e inténtalo de nuevo."
          action={<Button onClick={() => refetchUser()}>Reintentar</Button>}
        />
      </div>
    );
  }

  // Don't show anything until we know if user is logged in
  if (isLoadingUser || currentUser === undefined) {
    return (
      <PageLoader />
    );
  }

  // If admin or agent, the useEffect above already navigated - show spinner
  // while that happens (setLocation es async respecto a este render)
  if (currentUser?.userType === 'admin' || (currentUser as any)?.userType === 'agent') {
    return (
      <PageLoader />
    );
  }

  // If no user, the useEffect will redirect to login - show nothing
  if (currentUser === null) {
    return (
      <PageLoader />
    );
  }

  // Escritorio: grid de 12 columnas (menu 2 + contenido 10, o en Inicio del alumno contenido 7 + Tutores destacados 3).
  const showRightPanel = activeTab === TAB.home && currentUser?.userType !== "tutor";

  return (
    <div className={`flex min-h-dvh w-full flex-col lg:h-screen lg:overflow-hidden bg-white`}>
      {/* Movil/tablet sin cabecera: logo fuera y la cuenta es el ultimo item de la barra inferior (ver BottomNavigation).
          Todas las vistas reservan el espacio bajo la barra de estado. */}
      <div aria-hidden className="h-safe-top shrink-0 lg:hidden" />
      {/* En desktop (lg:) el shell ocupa exactamente 1 pantalla (Header +
          este bloque = 100vh) para que el scroll viva adentro de cada
          columna, no en el documento entero. En mobile/tablet se mantiene
          el scroll normal de la pagina (bottom nav fija abajo). */}
      <div className="shell-grid flex flex-1 flex-col lg:mx-auto lg:grid lg:min-h-0 lg:w-full lg:max-w-shell lg:grid-cols-12 lg:grid-rows-1 lg:gap-6 lg:px-6">
        <BottomNavigation activeTab={activeTab} onTabChange={() => {}} userType={currentUser?.userType} hideMobileBar={NO_MOBILE_NAV_TABS.includes(activeTab)} />
        {/* key = pestana: al cambiar de pestana se remonta y repite el fundido (`.page-fade-in`, index.css). */}
        <main key={activeTab} className={`page-fade-in ${showRightPanel ? "lg:col-span-7" : "lg:col-span-10"} ${activeTab === TAB.messages ? MAIN_MENSAJES : NO_MOBILE_NAV_TABS.includes(activeTab) ? MAIN_BASE.replace("pb-bottom-nav ", "pb-safe-nav ") : MAIN_BASE}`}>
          <Suspense fallback={<PageLoader inline />}>{renderSection()}</Suspense>
        </main>
        {showRightPanel && <HomeRightPanel />}
        {currentUser?.userType !== "tutor" && !NO_PUBLISH_FAB_TABS.includes(activeTab) && <PublishFab hideOnTablet={activeTab === TAB.messages} />}
      </div>
      
      {/* Push notification modal - shows on first login */}
      {currentUser && (
        <Suspense fallback={null}>
        <PushNotificationModal
          userId={currentUser.id}
          isOpen={showPushModal}
          onClose={() => setShowPushModal(false)}
        />
        </Suspense>
      )}

      {/* Task Assigned Modal - shows when tutor gets a new assignment */}
      {assignedTaskInfo && (
        <Dialog open={showTaskAssignedModal} onOpenChange={setShowTaskAssignedModal}>
          <DialogContent className=" p-0 overflow-hidden gap-0">
            <div className="p-6 text-center">
              <IconCircle size="xl" className="mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </IconCircle>
              <DialogTitle className="text-gray-900 mb-2">
                ¡Nuevo pedido en progreso!
              </DialogTitle>
              <DialogDescription className="mb-4">
                El estudiante ha confirmado el pago y te ha elegido para realizar este trabajo.
              </DialogDescription>
              <div className="bg-gray-100 rounded-lg p-4 mb-6 text-left">
                <p className="text-label font-medium text-gray-900 line-clamp-2 mb-2">
                  {assignedTaskInfo.taskTitle}
                </p>
                <p className="text-heading font-bold text-primary-600">
                  {formatPrice(assignedTaskInfo.amount, assignedTaskInfo.currency)}
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setShowTaskAssignedModal(false)}
                >
                  Cerrar
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    setShowTaskAssignedModal(false);
                    setLocation(`${ROUTES.chatFullscreen}?taskId=${assignedTaskInfo.taskId}`);
                  }}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Ir al chat
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
