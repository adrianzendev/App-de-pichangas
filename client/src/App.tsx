import { Switch, Route, Router as WouterRouter, useLocation, useParams } from "wouter";
import { aroundNav } from "@/lib/page-transition";
import { AUTH_ROUTES, LEGACY_ROUTES, PLAY_PATTERNS, PLAY_ROUTES, ROUTES, ROUTE_PATTERNS } from "@/lib/routes";
import { queryClient, persister } from "./lib/queryClient";
import { useQuery, defaultShouldDehydrateQuery } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { formatPrice } from "@/lib/timezone-utils";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { PageLoader } from "@/components/ui/spinner";
import PwaInstallBanner from "@/components/ui/pwa-install-banner";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { ImpersonationBanner } from "@/components/ui/impersonation-banner";
import { triggerPwaBanner } from "@/hooks/use-pwa-trigger";
import { toast } from "@/hooks/use-toast";
import paymentApprovedSound from "@/assets/sounds/payment-approved.mp3";
import OnboardingModal from "@/components/onboarding-modal";import { trackEvent } from "@/lib/pixel";
import type { UserWithType } from "@shared/schema";
import { IconCircle } from "@/components/ui/icon-circle";
import { syncClarity } from "@/lib/clarity";
import { GridOverlay } from "@/components/dev/grid-overlay";


// Cada pagina en su propio chunk: una ruta solo descarga lo suyo (admin-dashboard pesa >1 MB).
const Home = lazy(() => import("@/pages/home"));
const Play = lazy(() => import("@/pages/play"));
const AdminPlay = lazy(() => import("@/pages/admin-play"));
const AdminDashboard = lazy(() => import("@/pages/admin-dashboard"));
const Login = lazy(() => import("@/pages/login"));
const Register = lazy(() => import("@/pages/register"));
const ChatFullscreenRoute = lazy(() => import("@/pages/chat-fullscreen-route"));
const TutorProfilePage = lazy(() => import("@/pages/tutor-profile-page"));
const AgentPage = lazy(() => import("@/pages/agent-page"));
const AuthCallback = lazy(() => import("@/pages/auth-callback"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const ActivateAccount = lazy(() => import("@/pages/activate-account"));
const Styleguide = lazy(() => import("@/pages/styleguide"));
const PrivacyPage = lazy(() => import("@/pages/legal").then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import("@/pages/legal").then((m) => ({ default: m.TermsPage })));
const DeleteAccountPage = lazy(() => import("@/pages/delete-account"));

// Rutas antiguas en espanol (correos, push y atajos PWA ya emitidos): redirigen a la ruta en ingles conservando
// :taskId, la query y el hash. Navegacion del lado del cliente (sin hard reload), por el mismo motivo que arriba.
function LegacyRedirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  const params = useParams<Record<string, string>>();
  useEffect(() => {
    const path = to.replace(/:([A-Za-z]+)/g, (_, key: string) => params[key] ?? "");
    setLocation(path + window.location.search + window.location.hash, { replace: true });
  }, []);
  return null;
}

// /admin es ruta legacy (admin-page.tsx ya se borro) — redirige a /dashboard
// para bookmarks/links viejos en vez de 404.
function AdminRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation('/dashboard'); }, [setLocation]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path={ROUTES.root} component={Play} />
      <Route path="/play" component={Play} />
      <Route path="/play/mine" component={Play} />
      <Route path="/play/chats" component={Play} />
      <Route path="/play/chats/:id" component={Play} />
      <Route path="/play/profile" component={Play} />
      <Route path={PLAY_ROUTES.host} component={Play} />
      <Route path={PLAY_ROUTES.hostNew} component={Play} />
        <Route path={PLAY_PATTERNS.pass} component={Play} />
        <Route path={PLAY_PATTERNS.pay} component={Play} />
        <Route path={PLAY_PATTERNS.match} component={Play} />
      <Route path="/panel" component={AdminPlay} />
      <Route path="/panel/:section" component={AdminPlay} />
      <Route path={ROUTES.home} component={Home} />
      <Route path={ROUTE_PATTERNS.homeTask} component={Home} />
      <Route path="/chat" component={Home} />
      <Route path={ROUTES.orders} component={Home} />
      <Route path={ROUTE_PATTERNS.ordersTask} component={Home} />
      <Route path={ROUTES.jobs} component={Home} />
      <Route path={ROUTES.publish} component={Home} />
      <Route path={ROUTES.tutors} component={Home} />
      <Route path={ROUTES.profile} component={Home} />
      <Route path={ROUTES.studentProfile} component={Home} />
      <Route path={ROUTES.tutorProfile} component={Home} />
      <Route path={ROUTES.tutorStats} component={Home} />
      <Route path={ROUTES.tutorSpecialties} component={Home} />
      <Route path={ROUTES.university} component={Home} />
      <Route path={ROUTES.messages} component={Home} />
      <Route path={ROUTES.changePassword} component={Home} />
      <Route path={ROUTES.account} component={Home} />
      <Route path={ROUTES.login} component={Login} />
      <Route path={ROUTES.register} component={Register} />
      <Route path={`${ROUTES.dashboard}/:section?`} component={AdminDashboard} />
      <Route path="/admin" component={AdminRedirect} />
      <Route path="/agent" component={AdminRedirect} />
      <Route path={ROUTES.chatFullscreen} component={ChatFullscreenRoute} />
      <Route path={ROUTE_PATTERNS.tutor} component={TutorProfilePage} />
      <Route path={AUTH_ROUTES.callback} component={AuthCallback} />
      <Route path={AUTH_ROUTES.resetPassword} component={ResetPassword} />
      <Route path={AUTH_ROUTES.forgotPassword} component={ForgotPassword} />
      <Route path={ROUTES.activateAccount} component={ActivateAccount} />
      <Route path="/styleguide" component={Styleguide} />
      <Route path={ROUTES.privacy} component={PrivacyPage} />
      <Route path={ROUTES.terms} component={TermsPage} />
      <Route path={ROUTES.deleteAccount} component={DeleteAccountPage} />
      {Object.entries(LEGACY_ROUTES).map(([from, to]) => (
        <Route key={from} path={from}>
          <LegacyRedirect to={to} />
        </Route>
      ))}

      <Route>404 - Page not found</Route>
    </Switch>
  );
}

const AUTH_PATHS: string[] = [ROUTES.login, ROUTES.register, AUTH_ROUTES.callback, AUTH_ROUTES.resetPassword, AUTH_ROUTES.forgotPassword, ROUTES.activateAccount, ROUTES.dashboard, ROUTES.privacy, ROUTES.terms, ROUTES.deleteAccount];

function OnboardingGuard() {
  const [location] = useLocation();
  const { data: currentUser } = useQuery<UserWithType>({
    queryKey: ["/api/user/current"],
  });

  // El registro de WhatsApp es de Mil Tareas (alumnos): no aplica al jugador de pichangas (/, /play) ni al panel admin.
  const isPichangas = location === ROUTES.root || location.startsWith("/play") || location.startsWith("/panel");
  const isAuthPage = isPichangas || AUTH_PATHS.some(p => location.startsWith(p));
  if (isAuthPage || !currentUser) return null;

  const needsOnboarding =
    currentUser.userType === "student" &&
    (!currentUser.whatsapp || !currentUser.country || !currentUser.name?.trim());

  if (!needsOnboarding) return null;
  return <OnboardingModal currentUser={currentUser} />;
}

// Clarity espera a saber quien es el usuario (el email decide si se graba).
function ClarityGate() {
  const [location] = useLocation();
  const { data: currentUser, isLoading } = useQuery<UserWithType | null>({
    queryKey: ["/api/user/current"],
  });
  const email = currentUser?.email;
  useEffect(() => {
    if (!isLoading) syncClarity(email, location);
  }, [isLoading, email, location]);
  return null;
}

function PixelRouteTracker() {
  const [location] = useLocation();
  const { data: currentUser } = useQuery<UserWithType>({
    queryKey: ["/api/user/current"],
  });
  const isFirstRender = useRef(true);
  const userTypeRef = useRef(currentUser?.userType);
  userTypeRef.current = currentUser?.userType;

  useEffect(() => {
    // index.html ya disparo el PageView inicial — este efecto solo cubre
    // cambios de ruta posteriores. Depende solo de `location`: si dependiera
    // de currentUser, cada refetch dispararia otro PageView sin cambio de ruta.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (userTypeRef.current && userTypeRef.current !== 'student') return;
    trackEvent('PageView');
  }, [location]);

  // Registro con Google: auth-callback deja el flag y hace hard redirect. Este
  // componente siempre monta, asi el evento sale aunque el usuario no vea el
  // onboarding (perfil ya completo). Solo alumnos, igual que el registro por email.
  const userType = currentUser?.userType;
  useEffect(() => {
    if (!userType || !sessionStorage.getItem('fb_new_user')) return;
    sessionStorage.removeItem('fb_new_user');
    if (userType === 'student') trackEvent('CompleteRegistration', { userType, method: 'google' });
  }, [userType]);

  return null;
}

function PwaTriggerGuard() {
  const { data: currentUser } = useQuery<UserWithType>({
    queryKey: ["/api/user/current"],
  });

  const initialCheckDone = useRef(false);

  const { data: tasks } = useQuery<any[]>({
    queryKey: ["/api/tasks"],
    enabled: !!currentUser && !initialCheckDone.current,
  });

  // Initial-load trigger: once per session when tasks data arrives
  useEffect(() => {
    if (!currentUser || !tasks || initialCheckDone.current) return;
    if (sessionStorage.getItem('pwa-initial-checked')) {
      initialCheckDone.current = true;
      return;
    }
    initialCheckDone.current = true;
    sessionStorage.setItem('pwa-initial-checked', '1');

    const isTutor = currentUser.userType === "tutor";
    const timer = setTimeout(() => {
      if (isTutor) {
        const available = tasks.filter((t: any) =>
          t.status === 'available' || t.status === 'active'
        );
        if (available.length > 0) triggerPwaBanner();
      } else {
        const withCandidates = tasks.filter((t: any) =>
          (t.candidates?.length || 0) > 0
        );
        if (withCandidates.length > 0) triggerPwaBanner();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [currentUser, tasks]);

  // WebSocket event listeners
  useEffect(() => {
    if (!currentUser) return;

    const isTutor = currentUser.userType === "tutor";

    const handleWsMessage = (e: Event) => {
      const { detail: msg } = e as CustomEvent;
      if (msg?.type === 'new_message') {
        const receiverId = msg?.receiverId ?? msg?.message?.receiverId;
        const isForMe = receiverId
          ? receiverId === currentUser.id
          : msg?.senderId !== currentUser.id;
        if (isForMe) triggerPwaBanner();
      }
    };

    const handleNewCandidate = () => {
      if (!isTutor) triggerPwaBanner();
    };

    const handleNewTaskAvailable = () => {
      if (isTutor) triggerPwaBanner();
    };

    window.addEventListener('websocket_message', handleWsMessage);
    window.addEventListener('new_candidate', handleNewCandidate);
    window.addEventListener('new_task_available', handleNewTaskAvailable);

    return () => {
      window.removeEventListener('websocket_message', handleWsMessage);
      window.removeEventListener('new_candidate', handleNewCandidate);
      window.removeEventListener('new_task_available', handleNewTaskAvailable);
    };
  }, [currentUser]);

  return null;
}

function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentModalData, setPaymentModalData] = useState<{ taskTitle: string; amount: string; currency?: string } | null>(null);

  useEffect(() => {
    const handleTaskAssignedNotification = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { message } = customEvent.detail;
      toast({
        title: "Pedido en progreso",
        description: message || "Este pedido ya está siendo trabajado por otro tutor.",
        variant: "destructive",
      });
    };
    
    const handlePaymentApproved = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { taskTitle, amount, currency } = customEvent.detail;
      
      const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
      
      if (soundEnabled) {
        try {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          const audio = new Audio(paymentApprovedSound);
          audioRef.current = audio;
          audio.volume = 0.7;
          audio.play().catch((err) => {
          });
        } catch (error) {
        }
      }
      
      setPaymentModalData({ taskTitle: taskTitle || 'Nuevo pedido', amount: amount || '0', currency });
      setPaymentModalOpen(true);
    };

    window.addEventListener('show_task_assigned_notification', handleTaskAssignedNotification);
    window.addEventListener('payment_approved', handlePaymentApproved);

    return () => {
      window.removeEventListener('show_task_assigned_notification', handleTaskAssignedNotification);
      window.removeEventListener('payment_approved', handlePaymentApproved);
    };
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        buster: "v2",
        dehydrateOptions: {
          // Solo lo que el usuario necesita ver instantaneo entre sesiones
          // (sesion, tareas, chat). Vistas de admin y demas queries
          // volatiles/pesadas quedan fuera del disco — se refetchean
          // normal, no aportan a "instant load" y agrandan cada write.
          shouldDehydrateQuery: (query) => {
            if (!defaultShouldDehydrateQuery(query)) return false;
            const key = query.queryKey[0];
            return typeof key === 'string' && (
              key === '/api/user/current' ||
              key === '/api/tasks' ||
              key === '/api/tutors' ||
              key === '/api/my-tutors' ||
              key === '/api/exchange-rates' ||
              key.startsWith('/api/chat/')
            );
          },
        },
      }}
    >
      <WouterRouter aroundNav={aroundNav}>
      <TooltipProvider>
        {/* Edge-to-edge (Android): tapa la barra de estado para que el contenido no se vea bajo hora/bateria. 0px en navegador. */}
        <div aria-hidden className="vt-safe-top status-bar-cover pointer-events-none fixed inset-x-0 top-0 z-toast h-safe-top" />
        <Toaster />
        {import.meta.env.DEV && <GridOverlay />}
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Router />
          </Suspense>
        </ErrorBoundary>
        <OnboardingGuard />
        <PwaTriggerGuard />
        <PixelRouteTracker />
        <ClarityGate />
        
        {/* Payment Confirmation Modal for Tutors */}
        <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
          <DialogContent className="mx-auto text-center p-6">
            <DialogTitle className="sr-only">Pago Confirmado</DialogTitle>
            <DialogDescription className="sr-only">Tu pago ha sido verificado exitosamente</DialogDescription>
            <div className="flex flex-col items-center gap-4">
              <IconCircle size="xl" className="bg-primary-100">
                <CheckCircle className="w-10 h-10 text-success" />
              </IconCircle>
              <h2 className="text-heading font-bold text-gray-900">
                ¡Tienes un pago confirmado!
              </h2>
              <p className="text-gray-700">
                El pago de <span className="font-semibold text-success-fg">{formatPrice(paymentModalData?.amount || '0', paymentModalData?.currency)}</span> ha sido verificado.
              </p>
              <p className="text-label text-gray-500">
                Ya puedes iniciar con el pedido: <span className="font-medium">{paymentModalData?.taskTitle}</span>
              </p>
              <Button 
                onClick={() => setPaymentModalOpen(false)}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white mt-2"
              >
                Entendido
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
      <PwaInstallBanner />
      <OfflineBanner />
      <ImpersonationBanner />
      </WouterRouter>
    </PersistQueryClientProvider>
  );
}

export default App;
