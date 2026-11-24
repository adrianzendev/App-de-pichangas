import { OutlinedControl } from "@/components/ui/outlined-field";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ROUTES } from "@/lib/routes";
import { SearchField } from "@/components/ui/search-field";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useExchangeRates } from "@/hooks/use-exchange-rates";
import { Clock, Calendar, MapPin, Star, Eye, MessageCircle, Send, FileText, Paperclip, Search, Inbox, ShieldAlert } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ThreeColumnLayout } from "@/components/layout/three-column-layout";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterPills } from "@/components/ui/filter-pills";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { UserAvatar } from "@/components/ui/user-avatar";
import { TaskQuickViewDialog } from "@/components/ui/task-quick-view-dialog";
import { TutorTaskCard } from "@/components/ui/tutor-task-card";
import { ExpiredTaskModal } from "@/components/ui/expired-task-modal";
import { getEffectiveStatus } from "@/components/ui/status-badge";
import { anonymizeStudentData } from "@/utils/student-anonymization";
import type { TaskWithCandidates, User } from "@shared/schema";
import { useWebSocketFixed } from "@/hooks/useWebSocketFixed";
import { calcUsdEquivalent } from "@/lib/currency-utils";
import { getTimeRemaining, isTaskAvailableForTutor } from "@/utils/task-utils";

// ponytail: false = oculta el boton de busqueda/filtros de "Pedidos" (tutor).
// Restaurar: cambiar a true.
const SHOW_SEARCH_FILTERS_BUTTON = false;

export default function TutorWorkSection() {
  const [, setLocation] = useLocation();
  const [selectedTask, setSelectedTask] = useState<TaskWithCandidates | null>(null);
  const [expiredTask, setExpiredTask] = useState<TaskWithCandidates | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applicationMessage, setApplicationMessage] = useState("");
  const [proposedPrice, setProposedPrice] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "price" | "urgent">("date");
  const [showFilters, setShowFilters] = useState(false);
  const [tutorTab, setTutorTab] = useState<"disponibles" | "en_progreso" | "historial">("disponibles");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // In-memory task accumulator: ID → task (survives re-polls within the same session)
  const cachedTasksRef = useRef<Map<string, TaskWithCandidates>>(new Map());
  const [mergedTasks, setMergedTasks] = useState<TaskWithCandidates[]>([]);

  // localStorage cursor helpers
  const getCursor = (tutorId: string) =>
    localStorage.getItem(`tutor_tasks_cursor_${tutorId}`);
  const setCursor = (tutorId: string, iso: string) =>
    localStorage.setItem(`tutor_tasks_cursor_${tutorId}`, iso);

  // Update timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Get current user (MOVED UP to fix dependency order)
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/user/current"],
  });

  const { data: exchangeRates } = useExchangeRates();

  // Listen for payment/message notifications
  useEffect(() => {
    // Payment notification listener for tutors
    const handlePaymentNotification = (event: CustomEvent) => {
      const data = event.detail;
      // Solo el evento de negocio: ping/pong y demas mensajes de control se ignoran sin log.
      if (data?.type === 'payment_received') {
        // Check if this payment is for the current tutor
        if (data.receiverId === currentUser?.id) {
          // Show toast notification
          toast({
            title: "💰 Pago Recibido",
            description: `Un estudiante ha enviado un comprobante de pago. Revisa tu chat.`,
            duration: 6000,
          });
          
          // Refresh conversations to show new message immediately
          queryClient.invalidateQueries({ queryKey: ['/api/chat/last-messages'] });
          queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
        }
      }
    };

    // El badge de mensajes nuevos lo actualiza bottom-navigation (siempre montado):
    // aqui un refetch mas de last-messages por cada mensaje era trabajo duplicado.
    const handleNewMessage = (event: CustomEvent) => {
      const data = event.detail;
      // Task invitation notification
      if (data?.type === 'task_invitation') {
        toast({
          title: '📋 Te han invitado',
          description: data.message || `Un estudiante te invitó a un pedido: "${data.taskTitle}"`,
          duration: 8000,
        });
        // Refresh available tasks to show the invited task
        if (tutorProfile?.id) {
          queryClient.invalidateQueries({ queryKey: ['/api/tutors', tutorProfile.id, 'available-tasks'] });
        }
      }
    };

    window.addEventListener('websocket_message', handlePaymentNotification as EventListener);
    window.addEventListener('websocket_message', handleNewMessage as EventListener);

    return () => {
      window.removeEventListener('websocket_message', handlePaymentNotification as EventListener);
      window.removeEventListener('websocket_message', handleNewMessage as EventListener);
    };
  }, [currentUser?.id, toast, queryClient]);

  // WebSocket for chat and payment notifications
  const { sendChatMessage } = useWebSocketFixed(currentUser?.id);
  
  // Note: Payment notifications are now handled in the main useEffect above

  // Get current tutor profile (includes tutorId and hasGeneralAccess)
  const { data: tutorProfile } = useQuery<{ id: string; hasGeneralAccess: boolean }>({
    queryKey: ["/api/tutor/current"],
  });

  // Get filtered tasks for tutor (based on assigned courses or general access)
  // Uses ?since= cursor when in-memory cache already has data (incremental fetches)
  const { data: freshTasks, isLoading } = useQuery<TaskWithCandidates[]>({
    queryKey: ["/api/tutors", tutorProfile?.id, "available-tasks"],
    queryFn: async () => {
      if (!tutorProfile?.id) return [];
      // Use cursor only when we already have in-session data (not on first page load)
      const hasCached = cachedTasksRef.current.size > 0;
      const cursor = hasCached ? getCursor(tutorProfile.id) : null;
      const url = cursor
        ? `/api/tutors/${tutorProfile.id}/available-tasks?since=${encodeURIComponent(cursor)}`
        : `/api/tutors/${tutorProfile.id}/available-tasks`;
      const res = await fetch(url);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tutorProfile?.id,
    // PENDIENTE (reducir este poll): solo POST /api/tasks emite `new_task_available`. Antes de quitarlo,
    // emitir un evento (y que useWebSocketFixed invalide `available-tasks`) en los 5 casos sin aviso:
    // republicar (routes.ts POST /api/tasks/:id/republish), editar (PATCH /api/tasks/:id),
    // cancelar/borrar (DELETE /api/tasks/:taskId), elegir tutor (POST /api/admin/tasks/:taskId/select-tutor)
    // y vencimiento (job updateExpiredTasks). `task_status_changed` solo llega al dueño y al tutor asignado.
    refetchInterval: 2 * 60 * 1000,
    refetchIntervalInBackground: false,
  });

  // Merge incoming tasks into the in-memory accumulator and update display
  useEffect(() => {
    if (!freshTasks || !tutorProfile?.id) return;
    // Merge: new/updated tasks replace old entries by ID
    freshTasks.forEach(task => cachedTasksRef.current.set(task.id, task));
    setMergedTasks(Array.from(cachedTasksRef.current.values()));
    // Advance the cursor so the next poll only fetches newer tasks
    setCursor(tutorProfile.id, new Date().toISOString());
  }, [freshTasks, tutorProfile?.id]);

  // Get viewed task IDs for "Nuevo" badge
  const { data: viewedData } = useQuery<{ viewedTaskIds: string[] }>({
    queryKey: ["/api/tutor/viewed-tasks"],
    refetchInterval: 2 * 60 * 1000,
    refetchIntervalInBackground: false,
  });

  const viewedTaskIds = new Set(viewedData?.viewedTaskIds || []);

  // Mutation to mark task as viewed
  const markAsViewedMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest("POST", `/api/tasks/${taskId}/view`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/viewed-tasks"] });
    },
  });

  // Get last messages with unread counts for badge display
  const { data: lastMessages = {} } = useQuery<Record<string, { message: string; timestamp: string; fromCurrentUser: boolean; unreadCount: number }>>({
    queryKey: ["/api/chat/last-messages"],
    refetchInterval: 10 * 60 * 1000,
    refetchIntervalInBackground: false,
  });

  // FILTRAR TAREAS: Disponibles / En progreso / Historial
  const tasks = mergedTasks;

  // Helpers de estado
  const isPaymentConfirmed = (task: TaskWithCandidates) =>
    task.status === 'in_progress' || task.status === 'completed' || task.status === 'in_review';

  // EN PROGRESO: solo tareas donde YO fui seleccionado (assignedTutorId === mi ID)
  const inProgressTasks = tasks.filter((task: TaskWithCandidates) => {
    const isAssignedToMe = task.assignedTutorId === currentUser?.id;
    const isCompleted = task.status === 'completed';
    const isCancelled = task.status === 'cancelled';
    return isAssignedToMe && !isCompleted && !isCancelled;
  });

  // DISPONIBLES: tareas activas/vigentes donde no fui seleccionado (incluso si ya postulé)
  // Misma función que el badge de la barra inferior (utils/task-utils.ts).
  const availableTasks = tasks.filter((task: TaskWithCandidates) =>
    isTaskAvailableForTutor(task, currentUser?.id, currentTime)
  );

  // HISTORIAL: expiradas (todas), completadas/canceladas/elegido otro (solo si hubo interacción)
  const closedTasks = tasks.filter((task: TaskWithCandidates) => {
    const isExpired = new Date(task.deadline).getTime() <= currentTime.getTime();

    // Tareas vencidas: siempre aparecen (oportunidades pasadas), sin importar si postulé
    if (isExpired) return true;

    // Para el resto, solo si el tutor tuvo alguna interacción
    const myCandidate = task.candidates?.find((c: any) => c.tutorId === currentUser?.id);
    const isAssignedToMe = task.assignedTutorId === currentUser?.id;
    const hadInteraction = !!myCandidate || isAssignedToMe;
    if (!hadInteraction) return false;

    const isCompleted = task.status === 'completed';
    const isCancelled = task.status === 'cancelled';
    const anotherConfirmed = isPaymentConfirmed(task) && task.assignedTutorId && !isAssignedToMe;

    return isCompleted || isCancelled || anotherConfirmed;
  });

  // Función para filtrar y ordenar tareas
  const filterAndSortTasks = (taskList: TaskWithCandidates[], forAvailable = false) => {
    let filteredTasks = taskList;

    // Filtrar por búsqueda
    if (searchTerm) {
      filteredTasks = filteredTasks.filter(task => 
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Ordenar tareas
    filteredTasks.sort((a, b) => {
      // Invited tasks always first (only for available tab)
      if (forAvailable) {
        const aInvited = !!(a as any).isInvited ? 1 : 0;
        const bInvited = !!(b as any).isInvited ? 1 : 0;
        if (aInvited !== bInvited) return bInvited - aInvited;
      }
      switch (sortBy) {
        case "price":
          return Number(b.budget) - Number(a.budget); // Precio más alto primero
        case "urgent":
          const deadlineA = new Date(a.deadline).getTime();
          const deadlineB = new Date(b.deadline).getTime();
          return deadlineA - deadlineB; // Deadline más cercano primero
        case "date":
        default:
          return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime(); // Más reciente primero
      }
    });

    return filteredTasks;
  };

  // Aplicar filtros y ordenamiento
  const filteredAvailableTasks = filterAndSortTasks(availableTasks, true);
  const filteredInProgressTasks = filterAndSortTasks(inProgressTasks);
  const filteredClosedTasks = filterAndSortTasks(closedTasks);

  // Active list based on selected tab
  const activeTaskList =
    tutorTab === "disponibles"  ? filteredAvailableTasks  :
    tutorTab === "en_progreso"  ? filteredInProgressTasks :
                                  filteredClosedTasks;

  // Apply to task mutation
  const applyToTaskMutation = useMutation({
    mutationFn: async ({ taskId, message, price, studentId }: { taskId: string; message: string; price: number; studentId: string }) => {
      const result = await apiRequest("POST", "/api/candidates", {
        taskId,
        message,
        proposedPrice: String(price), // Convert to string as expected by schema
      });
      
      // Send chat message with application details via API
      const taskCurrency = selectedTask?.currency || 'PEN';
      const chatMessage = `${message}\n\n💰 Mi cotización: ${price} ${taskCurrency}`;
      try {
        const sent = await (await apiRequest("POST", "/api/chat/send", {
          taskId,
          receiverId: studentId,
          message: chatMessage,
        })).json();
        // El servidor censuro datos de contacto del mensaje: se le avisa al tutor.
        if (sent?.moderation?.censored) {
          toast({ title: "Mensaje enviado sin datos de contacto", description: sent.moderation.notice, icon: ShieldAlert });
        }
      } catch (error) {
        console.error("❌ [TUTOR_APPLY] Failed to send chat message:", error);
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/last-messages"] });
      setShowApplyModal(false);
      setApplicationMessage("");
      setProposedPrice("");
      setSelectedTask(null);
      toast({
        title: "Postulación enviada",
        description: "Tu postulación ha sido enviada al estudiante",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo enviar la postulación",
        variant: "destructive",
      });
    },
  });

  const handleApply = (task: TaskWithCandidates) => {
    setSelectedTask(task);
    setApplicationMessage(""); // sin plantilla: cada tutor escribe su propia propuesta
    setProposedPrice(String(Number(task.budget))); // budget llega como "33.00" (numeric de Postgres); Number quita el ",00"
    setShowApplyModal(true);
  };

  const submitApplication = () => {
    if (!selectedTask || !applicationMessage.trim() || !proposedPrice) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa todos los campos",
        variant: "destructive",
      });
      return;
    }

    const price = parseFloat(proposedPrice);
    if (isNaN(price) || price <= 0) {
      toast({
        title: "Precio inválido",
        description: "Por favor ingresa un precio válido",
        variant: "destructive",
      });
      return;
    }

    applyToTaskMutation.mutate({
      taskId: selectedTask.id,
      message: applicationMessage,
      price: price,
      studentId: selectedTask.userId || "",
    });
  };



  if (isLoading && mergedTasks.length === 0) {
    return (
      <ThreeColumnLayout
        breakpoint="lg"
        className="lg:h-full"
        detail={null}
        list={
          <div>
          <Container fullWidth className="py-page-top space-y-section-gap">
            <div className="mb-section-gap">
              <Skeleton className="h-6 w-24 mb-1" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex gap-2 mb-4">
              <Skeleton className="h-9 w-28 rounded-full" />
              <Skeleton className="h-9 w-28 rounded-full" />
            </div>
            <div className="space-y-card-gap">
              <Card className="p-card-pad">
                <Skeleton className="h-4 w-16 rounded-full mb-3" />
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-4" />
                <div className="flex gap-2">
                  <Skeleton className="h-9 flex-1 rounded-xl" />
                  <Skeleton className="h-9 flex-1 rounded-xl" />
                </div>
              </Card>
              <Card className="p-card-pad">
                <Skeleton className="h-4 w-16 rounded-full mb-3" />
                <Skeleton className="h-5 w-2/3 mb-2" />
                <Skeleton className="h-4 w-full mb-4" />
                <div className="flex gap-2">
                  <Skeleton className="h-9 flex-1 rounded-xl" />
                  <Skeleton className="h-9 flex-1 rounded-xl" />
                </div>
              </Card>
            </div>
          </Container>
          </div>
        }
      />
    );
  }

  const listContent = (
    <div>
      <Container fullWidth className="py-page-top space-y-section-gap">
      {/* Header - App Style */}
      <div className="flex items-center justify-between">
        <h1 className="text-heading font-bold text-gray-900">Pedidos</h1>
        {SHOW_SEARCH_FILTERS_BUTTON && (
          <Button
            variant={showFilters ? "default" : "ghost"}
            size="icon-lg"
            aria-label="Buscar y filtrar"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="toggle-search-filters"
          >
            <Search className="h-5 w-5" />
          </Button>
        )}
      </div>


      {/* Search and Filters - Expandable */}
      {showFilters && (
        <Card className="p-card-pad mb-card-pad animate-in slide-in-from-top-2 duration-200">
          {/* Search Bar */}
          <SearchField
            wrapperClassName="mb-3"
            placeholder="Buscar pedidos..."
            aria-label="Buscar pedidos"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {/* Filters Row */}
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Recientes</SelectItem>
                <SelectItem value="price">Mayor precio</SelectItem>
                <SelectItem value="urgent">Urgentes</SelectItem>
              </SelectContent>
            </Select>

          </div>

          {/* Results Info */}
          <div className="mt-2 text-caption text-gray-700">
            {tasks.length} pedidos
            {searchTerm && <span> · "{searchTerm}"</span>}
          </div>
        </Card>
      )}

      <FilterPills
        options={[
          { id: "disponibles", label: "Disponibles" },
          { id: "en_progreso", label: "En progreso" },
          { id: "historial",   label: "Historial"   },
        ]}
        value={tutorTab}
        onChange={setTutorTab}
      />

      {/* Tasks List */}
      {activeTaskList.length === 0 ? (
        <EmptyState
          className="flex min-h-empty-center flex-col items-center justify-center"
          icon={Inbox}
          title={tutorTab === "disponibles"
            ? "Sin tareas disponibles"
            : tutorTab === "en_progreso"
            ? "No tienes trabajos en progreso"
            : "Tu historial está vacío"}
          description={tutorTab === "disponibles"
            ? "Vuelve pronto, se publican nuevas tareas constantemente"
            : tutorTab === "en_progreso"
            ? "Aquí aparecerán tus postulaciones activas y trabajos en curso"
            : "Los trabajos terminados, cancelados y vencidos aparecerán aquí"}
        />
      ) : (
        <div className="space-y-card-gap">
          {activeTaskList.map((task) => {
            const conversationKey = `${task.id}-${task.userId}`;
            const lastMessageData = lastMessages[conversationKey];
            
            const myCandidate = task.candidates?.find((c: any) => c.tutorId === currentUser?.id);
            const myProposedPrice = myCandidate?.proposedPrice ? String(myCandidate.proposedPrice) : null;
            
            const isNewTask = task.status === 'active' && !viewedTaskIds.has(task.id);
            
            const handleTaskClick = () => {
              const timeRemaining = getTimeRemaining(task.deadline);
              const isExpired = (task.status === "active" || task.status === "available") && timeRemaining.expired;
              
              // Mark as viewed when opened
              if (isNewTask) {
                markAsViewedMutation.mutate(task.id);
              }
              
              if (isExpired) {
                setExpiredTask(task);
              } else {
                setSelectedTask(task);
              }
            };
            
            // Show last message for applied tasks (both in Activo and Cerrado)
            const hasApplied = task.candidates?.some((c: any) => c.tutorId === currentUser?.id);
            
            return (
              <TutorTaskCard
                key={task.id}
                task={task}
                proposedPrice={hasApplied ? myProposedPrice : null}
                onClick={handleTaskClick}
                lastMessage={lastMessageData}
                showLastMessage={hasApplied}
                isNew={isNewTask}
                currentTutorId={currentUser?.id}
                isInvited={!!(task as any).isInvited}
              />
            );
          })}
        </div>
      )}
      </Container>
    </div>
  );

  return (
    <>
      <ThreeColumnLayout breakpoint="lg" className="lg:h-full" list={listContent} detail={null} />

      {/* Detalle del pedido — modal compartido (mismo que Pedidos/Admin/Chat). Se cierra mientras el modal de aplicar esta abierto. */}
      <TaskQuickViewDialog
        task={showApplyModal ? null : selectedTask}
        onClose={() => setSelectedTask(null)}
        currentUserCountry={selectedTask?.user?.country}
        showUsdEquivalent
        publisher={(() => {
          const studentData = selectedTask?.user ? anonymizeStudentData(selectedTask.user, 'tutor') : null;
          if (!studentData || !selectedTask) return null;
          return (
            <div className="flex items-center gap-2">
              <UserAvatar name={studentData.name} avatar={selectedTask.user?.avatar} size="xs" />
              <p className="text-body font-medium text-gray-900 min-w-0 truncate">{studentData.name}</p>
            </div>
          );
        })()}
        footer={selectedTask && (() => {
          const timeRemaining = getTimeRemaining(selectedTask.deadline);
          const hasApplied = selectedTask.candidates?.some((c: any) => c.tutorId === currentUser?.id);
          const effectiveStatus = getEffectiveStatus(selectedTask.status, timeRemaining.expired);

          // Solo considerar "asignado a otro" cuando el pago fue confirmado
          const paymentConfirmed = selectedTask.status === 'in_progress' || selectedTask.status === 'completed' || selectedTask.status === 'in_review';
          const isAssignedToOther = paymentConfirmed && selectedTask.assignedTutorId && selectedTask.assignedTutorId !== currentUser?.id;
          const isExpired = timeRemaining.expired;

          // Use backend status enums for consistent checking
          // REMOVED payment_pending from closed statuses - it stays active until admin confirms
          const closedStatuses = ["CANCELLED", "COMPLETED", "IN_PROGRESS", "ADJUDICATED"];
          const legacyClosedStatuses = ["payment_rejected", "completed", "in_progress", "cancelled", "expired"];
          const isStatusClosed = closedStatuses.includes(effectiveStatus) || legacyClosedStatuses.includes(selectedTask.status);
          const isUnavailable = isAssignedToOther || isExpired || isStatusClosed;

          if (hasApplied) {
            return (
              <Button
                onClick={() => {
                  setLocation(`${ROUTES.chatFullscreen}?taskId=${selectedTask.id}&userId=${selectedTask.userId}`);
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Ir al chat
              </Button>
            );
          }

          return (
            <Button
              onClick={() => handleApply(selectedTask)}
              className={`w-full py-3 font-semibold ${isUnavailable ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
              disabled={isUnavailable}
              data-testid="button-apply-task"
            >
              Aplicar
            </Button>
          );
        })()}
      />

      {/* Application Modal - App Style */}
      <Dialog open={showApplyModal && !!selectedTask} onOpenChange={setShowApplyModal}>
        <DialogContent className="p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-4 shadow-sm">
            <DialogTitle className="text-heading font-bold text-gray-900">Enviar Aplicación</DialogTitle>
          </DialogHeader>

          {/* Content */}
          <div className="p-4 space-y-field-gap">
            <div>
              <OutlinedControl htmlFor="message" label="Tu propuesta">
                <Textarea
                  id="message"
                  value={applicationMessage}
                  onChange={(e) => setApplicationMessage(e.target.value)}
                  placeholder="Explica brevemente al estudiante tu experiencia en este tema y cómo le ayudarás a resolver la tarea..."
                  className="min-h-panel border-field rounded-control focus:border-primary "
                />
              </OutlinedControl>
            </div>

            <div>
              <OutlinedControl htmlFor="price" label={<>Tu precio ({selectedTask?.currency || 'PEN'})</>}>
                <div className="relative">
                  <Input
                    id="price"
                    type="number"
                    value={proposedPrice}
                    onChange={(e) => setProposedPrice(e.target.value)}
                    placeholder="0"
                    min="1"
                    className="border-field rounded-control focus:border-primary pr-28 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  {/* Equivalente aproximado en USD (se recalcula al escribir): el tutor ve cuanto esta pujando */}
                  {(() => {
                    const usdProposed = calcUsdEquivalent(proposedPrice, selectedTask?.currency, exchangeRates?.rates);
                    return usdProposed ? (
                      <span
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-caption text-gray-700 pointer-events-none"
                        data-testid="price-usd-equivalent"
                      >
                        ≈ {usdProposed} USD
                      </span>
                    ) : null;
                  })()}
                </div>
              </OutlinedControl>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="p-4 shadow-md flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowApplyModal(false)}
              className="flex-1 border-field text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </Button>
            <Button
              onClick={submitApplication}
              disabled={applyToTaskMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {applyToTaskMutation.isPending ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expired Task Modal */}
      {expiredTask && (
        <ExpiredTaskModal
          task={expiredTask}
          onClose={() => setExpiredTask(null)}
        />
      )}
    </>
  );
}