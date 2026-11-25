import { OutlinedControl } from "@/components/ui/outlined-field";
import { TaskDetailPanel } from "@/components/ui/task-detail-panel";
import { ROUTES, ROUTE_PATTERNS, tutorRoute } from "@/lib/routes";
import { useMediaQuery } from "@/hooks/use-media-query";
import { MQ } from "@/lib/breakpoints";
import { BackButton } from "@/components/ui/back-button";
import { useState, useEffect, useMemo } from "react";
import { OrderSummary } from "@/components/ui/order-summary";
import { taskSummaryRows } from "@/components/orders/task-summary-rows";
import { EnhancedFileDisplay } from "@/components/ui/enhanced-file-display";
import { ListScreen } from "@/components/ui/list-screen";
import { ListHeader, ListHeaderSkeleton } from "@/components/ui/list-header";
import { ThreeColumnLayout } from "@/components/layout/three-column-layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Eye, Paperclip, Upload, MessageCircle, Inbox } from "lucide-react";
import { pluralizeEs } from "@/lib/pluralize";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageBannerSheet } from "@/components/ui/page-banner-sheet";
import { FilterPills } from "@/components/ui/filter-pills";
import { DateTimeField } from "@/components/ui/datetime-field";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { TaskActionsMenu, type TaskAction } from "@/components/ui/task-actions-menu";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TaskQuickViewDialog } from "@/components/ui/task-quick-view-dialog";
import { TaskList } from "@/components/ui/task-list";
import { getEffectiveStatus } from "@/utils/task-utils";
import { useLocation, useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CandidatesList } from "@/components/ui/candidates-list";
import { useWebSocketFixed } from "@/hooks/useWebSocketFixed";
import type { TaskWithCandidates, UserWithType, PublicTutor } from "@shared/schema";

type TabFilter = "active_group" | "completed" | "cancelled_group" | "tutor_available" | "tutor_progress" | "tutor_history";

export default function OrdersSection() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute(ROUTE_PATTERNS.ordersTask);
  const [selectedTaskRaw, setSelectedTask] = useState<TaskWithCandidates | null>(null);
  const [republishTask, setRepublishTask] = useState<TaskWithCandidates | null>(null);
  // El detalle del pedido se monta una sola vez: columna 3 en escritorio, overlay a pantalla completa en movil/tablet.
  const isDesktop = useMediaQuery(MQ.lg);
  const [newDeadline, setNewDeadline] = useState("");
  const [showExtendDeadline, setShowExtendDeadline] = useState(false);
  const [extensionDeadline, setExtensionDeadline] = useState("");
  const [showAddFiles, setShowAddFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showRepublishSuccess, setShowRepublishSuccess] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editComment, setEditComment] = useState("");
  const [viewingTask, setViewingTask] = useState<TaskWithCandidates | null>(null);

  // Filter states — default differs by user type (tutor vs student)
  const [tabFilter, setTabFilter] = useState<TabFilter>("active_group");
  const [tabInitialized, setTabInitialized] = useState(false);
  const [searchText, setSearchText] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // DYNAMIC PRICING: Listen for price updates
  const [, setForceRefresh] = useState(0);
  
  useEffect(() => {
    const handlePriceUpdate = () => {
      setForceRefresh(prev => prev + 1);
    };

    window.addEventListener('globalPriceUpdate', handlePriceUpdate as EventListener);
    window.addEventListener('priceUpdate', handlePriceUpdate as EventListener);
    window.addEventListener('taskPriceUpdate', handlePriceUpdate as EventListener);

    return () => {
      window.removeEventListener('globalPriceUpdate', handlePriceUpdate as EventListener);
      window.removeEventListener('priceUpdate', handlePriceUpdate as EventListener);
      window.removeEventListener('taskPriceUpdate', handlePriceUpdate as EventListener);
    };
  }, []);

  // Real-time: refresh task list when a new candidate applies
  useEffect(() => {
    const handleTaskRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    };
    window.addEventListener('task_list_refresh', handleTaskRefresh);
    window.addEventListener('new_candidate', handleTaskRefresh);
    return () => {
      window.removeEventListener('task_list_refresh', handleTaskRefresh);
      window.removeEventListener('new_candidate', handleTaskRefresh);
    };
  }, [queryClient]);

  const { data: currentUser } = useQuery<UserWithType>({
    queryKey: ["/api/user/current"],
  });

  const { data: tasks, isLoading, isError, refetch } = useQuery<TaskWithCandidates[]>({
    queryKey: ["/api/tasks"],
    enabled: !!currentUser,
  });

  // El pedido abierto se relee de la lista viva (/api/tasks) en cada render: asi la lista de candidatos
  // refleja cotizaciones nuevas. El estado solo guarda cual esta abierto (antes era una copia congelada).
  const selectedTask = useMemo(
    () => (selectedTaskRaw ? tasks?.find((t) => t.id === selectedTaskRaw.id) ?? selectedTaskRaw : null),
    [selectedTaskRaw, tasks],
  );

  // Set correct default tab once userType is known
  useEffect(() => {
    if (!currentUser || tabInitialized) return;
    setTabInitialized(true);
    if (currentUser.userType === "tutor") setTabFilter("tutor_available");
  }, [currentUser, tabInitialized]);

  // El pedido de la URL (/orders/:id) manda: al volver del chat, al abrir el enlace o con atras/adelante, la
  // seleccion se sincroniza con la ruta (antes solo se elegia si no habia ninguno).
  useEffect(() => {
    if (params?.taskId && tasks && selectedTaskRaw?.id !== params.taskId) {
      const taskFromUrl = tasks.find(t => t.id === params.taskId);
      if (taskFromUrl) {
        setSelectedTask(taskFromUrl);
      }
    }
  }, [params?.taskId, tasks, selectedTaskRaw?.id]);

  // Presence system for online status — needs currentUser.id to open the WebSocket connection
  const { isUserOnline } = useWebSocketFixed(currentUser?.id);

  const { data: tutors } = useQuery<PublicTutor[]>({
    queryKey: ["/api/tutors"],
    enabled: !!currentUser,
  });

  // Query for last messages to calculate unread counts
  const { data: lastMessages } = useQuery<Record<string, any>>({
    queryKey: ["/api/chat/last-messages"],
    enabled: !!currentUser,
  });

  // Helper to get unread count for a specific conversation
  const getUnreadCount = (taskId: string, otherUserId: string): number => {
    if (!lastMessages || !currentUser || !otherUserId) return 0;
    
    // CRITICAL: Backend sorts participant IDs to create consistent keys with DASHES
    const participants = [currentUser.id, otherUserId].sort();
    const key = `${taskId}-${participants[0]}-${participants[1]}`;
    
    const conversation = lastMessages[key];
    if (conversation?.unreadCount && conversation.unreadCount > 0) {
      return conversation.unreadCount;
    }
    return 0;
  };

  // Helper to get total unread count for a task (sum of all candidates)
  const getTotalUnreadForTask = (task: TaskWithCandidates): number => {
    if (!lastMessages || !currentUser) return 0;
    
    let total = 0;
    
    if (currentUser.userType === "tutor") {
      // For tutors: count unread from the student
      const studentId = task.userId || "";
      if (studentId) {
        const participants = [currentUser.id, studentId].sort();
        const key = `${task.id}-${participants[0]}-${participants[1]}`;
        const conversation = lastMessages[key];
        if (conversation?.unreadCount && conversation.unreadCount > 0) {
          total = conversation.unreadCount;
        }
      }
    } else {
      // For students: sum unread from all candidates
      task.candidates?.forEach(candidate => {
        const tutorId = candidate.tutorId;
        if (tutorId) {
          total += getUnreadCount(task.id, tutorId);
        }
      });
    }
    
    return total;
  };

  const republishMutation = useMutation({
    mutationFn: async ({ taskId, deadline }: { taskId: string; deadline: string }) => {
      // Use dedicated republish endpoint that clears candidates and keeps same task ID/number
      return apiRequest("POST", `/api/tasks/${taskId}/republish`, {
        deadline: new Date(deadline)
      });
    },
    onSuccess: () => {
      setRepublishTask(null);
      setNewDeadline("");
      setShowRepublishSuccess(true);
      // Invalidate in background (non-blocking)
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: () => {
      toast({
        title: "Error al republicar",
        description: "No se pudo republicar el pedido. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  const cancelTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return apiRequest("PATCH", `/api/tasks/${taskId}`, { status: "cancelled" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Pedido cancelado" });
    },
    onError: () => {
      toast({ title: "Error al cancelar", description: "Inténtalo de nuevo.", variant: "destructive" });
    },
  });

  const handleRepublishClick = (task: TaskWithCandidates) => {
    setRepublishTask(task);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setNewDeadline(tomorrow.toISOString().slice(0, 16));
  };

  // Click en la fila/tarjeta del candidato ("Mensaje"): ir a chatear con el,
  // dentro de la grilla oficial /messages (Bento, sidebar+lista+chat) — no
  // Antes navegaba a /chat-fullscreen (vista legacy sin sidebar);
  // mismo patrón get-or-create + /messages?threadId= que "Chatear" en
  // tutor-profile-content.tsx (ver tutors-section.tsx onChatStarted).
  const navigateToCandidateChat = async (task: TaskWithCandidates, candidate: any) => {
    // Mensaje siempre activo, tambien con el pedido vencido o cancelado: el hilo es por par alumno-tutor y no
    // depende del estado del pedido. Republicar es una accion aparte (opcion "Republicar" del menu ⋮ de la tarjeta).
    const tutorId = candidate.tutorId;
    try {
      const res = await apiRequest("POST", "/api/chat/get-or-create", { tutorId });
      const { threadId } = await res.json();
      setSelectedTask(null);
      if (threadId) {
        setLocation(`${ROUTES.messages}?threadId=${threadId}`);
      } else {
        // Sin conversacion todavia — modo borrador (no crea el thread
        // hasta el primer mensaje real). taskId ya se conoce en este
        // flujo, se pasa directo para que el composer no quede
        // deshabilitado esperando sendableTaskId.
        const userName = candidate.tutor?.name || candidate.tutorName || '';
        setLocation(`${ROUTES.messages}?userId=${tutorId}&userName=${encodeURIComponent(userName)}&taskId=${task.id}`);
      }
    } catch {
      toast({ title: "No se pudo abrir el chat", variant: "destructive" });
    }
  };

  const handleRepublishSubmit = () => {
    if (!republishTask || !newDeadline) return;
    republishMutation.mutate({
      taskId: republishTask.id,
      deadline: newDeadline
    });
  };

  const extendDeadlineMutation = useMutation({
    mutationFn: async ({ taskId, deadline }: { taskId: string, deadline: string }) => {
      const response = await apiRequest("PATCH", `/api/tasks/${taskId}`, { deadline });
      return response.json();
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["/api/tasks"] });
      queryClient.refetchQueries({ queryKey: ["/api/tasks"] });
      setShowExtendDeadline(false);
      setExtensionDeadline("");
      toast({
        title: "Fecha extendida",
        description: "La fecha límite se actualizó correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la fecha límite",
        variant: "destructive",
      });
    }
  });

  const addFilesMutation = useMutation({
    mutationFn: async ({ taskId, files }: { taskId: string, files: File[] }) => {
      const fileNames = files.map(f => f.name);
      const task = await queryClient.getQueryData<TaskWithCandidates[]>(["/api/tasks"]);
      const currentTask = task?.find(t => t.id === taskId);
      const currentAttachments = currentTask?.attachments || [];
      
      const response = await apiRequest("PATCH", `/api/tasks/${taskId}`, { 
        attachments: [...currentAttachments, ...fileNames]
      });
      return response.json();
    },
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      if (selectedTask) {
        setSelectedTask({ ...selectedTask, attachments: updatedTask.attachments });
      }
      setShowAddFiles(false);
      setSelectedFiles([]);
      toast({
        title: "Archivos agregados",
        description: "Los archivos se agregaron correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "No se pudieron agregar los archivos",
        variant: "destructive",
      });
    }
  });

  const updateCommentMutation = useMutation({
    mutationFn: async ({ taskId, comment }: { taskId: string, comment: string }) => {
      const response = await apiRequest("PATCH", `/api/tasks/${taskId}`, { comment });
      return response.json();
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["/api/tasks"] });
      queryClient.refetchQueries({ queryKey: ["/api/tasks"] });
      setShowEditModal(false);
      setEditComment("");
      toast({
        title: "Comentario actualizado",
        description: "El comentario se guardó correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "No se pudo actualizar el comentario",
        variant: "destructive",
      });
    }
  });

  const handleUpdateComment = () => {
    if (!selectedTask) return;
    updateCommentMutation.mutate({
      taskId: selectedTask.id,
      comment: editComment
    });
  };

  const handleExtendDeadline = () => {
    if (!selectedTask || !extensionDeadline) return;
    extendDeadlineMutation.mutate({
      taskId: selectedTask.id,
      deadline: extensionDeadline
    });
  };

  const handleAddFiles = () => {
    if (!selectedTask || selectedFiles.length === 0) return;
    addFilesMutation.mutate({
      taskId: selectedTask.id,
      files: selectedFiles
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  // Filter tasks based on user type
  const baseUserTasks = (() => {
    if (!tasks || !currentUser) return [];
    
    if (currentUser.userType === 'tutor') {
      return tasks.filter(task => 
        task.assignedTutorId === currentUser.id || 
        task.candidates?.some(candidate => candidate.tutor.id === currentUser.id)
      );
    } else {
      return tasks.filter(task => task.userId === currentUser.id);
    }
  })();

  // Group statuses per tab
  const CANCELLED_STATUSES = new Set(["cancelled", "expired"]);
  const TUTOR_PROGRESS_STATUSES = new Set(["in_progress", "in_review", "payment_pending", "payment_rejected"]);

  const getTabForTask = (task: TaskWithCandidates): TabFilter => {
    const eff = getEffectiveStatus(task);
    if (eff === "completed") return "completed";
    if (CANCELLED_STATUSES.has(eff) || CANCELLED_STATUSES.has(task.status)) return "cancelled_group";
    return "active_group";
  };

  const getTutorTabForTask = (task: TaskWithCandidates): TabFilter => {
    const eff = getEffectiveStatus(task);
    if (eff === "completed" || CANCELLED_STATUSES.has(eff) || CANCELLED_STATUSES.has(task.status)) return "tutor_history";
    if (TUTOR_PROGRESS_STATUSES.has(eff)) return "tutor_progress";
    return "tutor_available";
  };

  // Filter tasks by tab and search
  const userTasks = (() => {
    let filteredTasks = [...baseUserTasks];

    // Apply tab filter
    if (currentUser?.userType === "tutor") {
      filteredTasks = filteredTasks.filter(task => getTutorTabForTask(task) === tabFilter);
    } else {
      filteredTasks = filteredTasks.filter(task => getTabForTask(task) === tabFilter);
    }

    // Apply search filter
    if (searchText) {
      filteredTasks = filteredTasks.filter(task =>
        task.title.toLowerCase().includes(searchText.toLowerCase()) ||
        task.description.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    return filteredTasks;
  })();


  const isTutorUser = currentUser?.userType === 'tutor';

  // Si el pedido abierto cae en otra pestana (Cancelados, Completados...), se cambia a esa pestana para que
  // la tarjeta no quede oculta. Solo al cambiar el pedido: elegir otra pestana a mano no la revierte.
  useEffect(() => {
    if (!selectedTask) return;
    setTabFilter(isTutorUser ? getTutorTabForTask(selectedTask) : getTabForTask(selectedTask));
  }, [selectedTask?.id]);

  // Lleva la tarjeta del pedido abierto a la vista (tambien despues de cambiar de pestana).
  useEffect(() => {
    if (!selectedTask) return;
    document.querySelector(`[data-testid="task-card-${selectedTask.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedTask?.id, tabFilter]);

  // Carga y error dentro del mismo ListScreen que el contenido real, con el titulo de la pantalla.
  if (isLoading) {
    return (
      <div className="bg-white">
        <ListScreen>
          <ListHeaderSkeleton />
          <div className="space-y-card-gap">
            {[1, 2, 3].map(i => (
              <Card key={i} className="p-bento-pad">
                <div className="flex items-center justify-between mb-2">
                  <Skeleton className="h-skeleton-title w-2/3" />
                  <Skeleton className="h-skeleton-badge-h w-skeleton-badge-w rounded-full" />
                </div>
                <Skeleton className="h-skeleton-line w-1/2" />
              </Card>
            ))}
          </div>
        </ListScreen>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white lg:h-full">
        <ListScreen className="lg:flex lg:h-full lg:flex-col">
          <ListHeader title="Mis pedidos" />
          <EmptyState
            centered
            title="No pudimos cargar tus pedidos"
            description="Revisa tu conexión e inténtalo de nuevo."
            action={<Button onClick={() => refetch()}>Reintentar</Button>}
          />
        </ListScreen>
      </div>
    );
  }

  // 3-tab config — students
  const studentTabs: { id: TabFilter; label: string }[] = [
    { id: "active_group",    label: "Activos"     },
    { id: "completed",       label: "Completados" },
    { id: "cancelled_group", label: "Cancelados"  },
  ];

  // 3-tab config — tutors
  const tutorTabs: { id: TabFilter; label: string }[] = [
    { id: "tutor_available", label: "Disponibles"  },
    { id: "tutor_progress",  label: "En progreso"  },
    { id: "tutor_history",   label: "Historial"    },
  ];

  // Columna central (lista de pedidos) — reusada igual en mobile (dentro
  // del shell de abajo) y en la columna 2 de ThreeColumnLayout en escritorio.
  const emptyCopy = isTutorUser
    ? {
        title: tabFilter === "tutor_available" ? "No tienes postulaciones activas" : tabFilter === "tutor_progress" ? "No tienes trabajos en progreso" : "Tu historial está vacío",
        description: tabFilter === "tutor_available" ? "Postúlate a pedidos disponibles" : tabFilter === "tutor_progress" ? "Aquí aparecerán tus trabajos en curso" : "Los trabajos terminados y cancelados aparecerán aquí",
        showCta: tabFilter === "tutor_available",
      }
    : {
        title: searchText ? "Sin resultados" : tabFilter === "active_group" ? "No tienes pedidos activos" : tabFilter === "completed" ? "No tienes pedidos completados" : "No tienes pedidos cancelados",
        description: searchText ? `No encontramos "${searchText}"` : tabFilter === "active_group" ? "Conecta con tutores expertos" : tabFilter === "completed" ? "Tus pedidos completados aparecerán aquí" : "Tus pedidos cancelados o vencidos aparecerán aquí",
        showCta: false,
      };

  const listContent = (
    <div className="flex flex-1 flex-col">
      <ListScreen className="flex flex-1 flex-col">

        {/* Cabecera compartida: banner + hoja con buscador, pestanas y Publicar */}
        <PageBannerSheet
          title="Mis pedidos"
          noBanner
          search={{ value: searchText, onChange: setSearchText, placeholder: "Buscar pedido", label: "Buscar pedido", testId: "search-orders" }}
          subtitle={currentUser?.userType === "tutor" ? "Sigue tus postulaciones y trabajos." : "Sigue tus pedidos y elige una cotización."}
        >
          {/* Sin boton Publicar aqui: en movil y tablet es el boton flotante (PublishFab); en escritorio, el del sidebar. */}
          <FilterPills
            options={currentUser?.userType === "tutor" ? tutorTabs : studentTabs}
            value={tabFilter}
            onChange={setTabFilter}
          />
        </PageBannerSheet>

        {/* Empty State - Enhanced */}
        {userTasks.length === 0 ? (
          <EmptyState
            className="flex flex-1 flex-col items-center justify-center py-12"
            icon={Inbox}
            title={emptyCopy.title}
            description={emptyCopy.description}
            action={emptyCopy.showCta ? <Button onClick={() => setLocation("/")} data-testid="empty-cta">Ver pedidos</Button> : undefined}
          />
        ) : (
          /* Task Cards - Using shared TaskList component */
          <TaskList
            tasks={userTasks}
            onTaskClick={(task) => {
              setSelectedTask(task);
              setLocation(`${ROUTES.orders}/${task.id}`);
            }}
            onRepublish={(task, e) => {
              e.stopPropagation();
              handleRepublishClick(task);
            }}
            onView={(task, e) => {
              e.stopPropagation();
              setViewingTask(task);
            }}
            onCancel={(task, e) => {
              e.stopPropagation();
              cancelTaskMutation.mutate(String(task.id));
            }}
            getTotalUnreadForTask={getTotalUnreadForTask}
            showPaymentStates={true}
            isTutor={currentUser?.userType === "tutor"}
            currentTutorId={currentUser?.id}
            selectedTaskId={selectedTask?.id}
          />
        )}
      </ListScreen>
    </div>
  );

  // Columna derecha (candidatos del pedido seleccionado) — misma constante
  // usada en la columna 3 de ThreeColumnLayout (escritorio, persistente) y
  // en el overlay full-screen de mobile/tablet (`lg:hidden` mas abajo).
  const detailActions: TaskAction[] = selectedTask ? [
    { label: "Ver pedido", icon: Eye, testId: "view-task-option", onSelect: () => setViewingTask(selectedTask) },
  ] : [];

  const candidatesPanel = selectedTask && (
          <div className="mx-auto flex min-h-full w-full max-w-content flex-col lg:max-w-none">
            <div className="px-card-gap pt-card-gap lg:px-0 lg:pt-0">
              {/* Resumen del pedido: volver + menu, titulo, estado, presupuesto, entrega y descripcion */}
              <OrderSummary
                rows={taskSummaryRows(selectedTask, currentUser?.country).map((r) =>
                  r.label === "Archivos" && selectedTask.attachments?.length
                    ? { ...r, label: "Archivos adjuntos", node: <EnhancedFileDisplay files={selectedTask.attachments} names={selectedTask.attachmentNames ?? undefined} sizes={selectedTask.attachmentSizes ?? undefined} showTitle={false} flat /> }
                    : r
                )}
                key={selectedTask.id}
                collapsible
                defaultOpen={false}
                leading={
                  <BackButton
                    onClick={() => {
                      const fromHome = window.history.state?.from === "home";
                      setSelectedTask(null);
                      setLocation(fromHome ? ROUTES.home : ROUTES.orders);
                    }}
                    data-testid="back-button" />
                }
                trailing={<TaskActionsMenu triggerTestId="task-detail-menu" actions={detailActions} />}
              />

              <div className="mt-section-gap mb-3 flex items-baseline justify-between">
                <h2 className="text-subheading font-semibold text-gray-900">Propuestas</h2>
                <span className="text-label font-normal text-gray-700">{selectedTask.candidates?.length || 0} {pluralizeEs(selectedTask.candidates?.length || 0, "candidato")}</span>
              </div>

            </div>

            {/* Candidates List (flex-1: el estado vacio se centra en el alto que queda) */}
            <div className="flex flex-1 flex-col">
              <CandidatesList
                candidates={selectedTask.candidates || []}
                taskId={selectedTask.id}
                currency={selectedTask.currency}
                allTutors={tutors}
                onViewTutorProfile={(candidate) => {
                  const candidateTutorId = candidate.tutorId;
                  const tutorRecord = tutors?.find(
                    (t: PublicTutor) => t.user_id === candidateTutorId
                  );
                  if (tutorRecord) {
                    setLocation(tutorRoute(tutorRecord));
                  }
                }}
                onCandidateClick={(candidate) => navigateToCandidateChat(selectedTask, candidate)}
                getUnreadCount={getUnreadCount}
                isUserOnline={isUserOnline}
              />
            </div>
          </div>
  );

  return (
    <>
      {isDesktop && candidatesPanel ? (
        // Escritorio: el detalle (Resumen + Propuestas) reemplaza a la lista y usa todo el ancho, sin columna vacia al costado.
        <div className="h-full overflow-y-auto scrollbar-none px-page-h py-page-top" data-testid="order-detail-desktop">{candidatesPanel}</div>
      ) : (
        <ThreeColumnLayout
          preset="list-detail"
          breakpoint="lg"
          // Un solo scroll en movil (el del documento), como /tutors: sin h-dvh la columna no scrollea por dentro.
          className="lg:h-full"
          list={listContent}
          detail={null}
        />
      )}

      {/* Detalle de pedido — overlay full-screen solo mobile/tablet;
          en escritorio (lg:) reemplaza a la lista, ver `list` arriba. */}
      {!isDesktop && candidatesPanel && (
        <TaskDetailPanel>{candidatesPanel}</TaskDetailPanel>
      )}

      {/* Extend Deadline Modal */}
      <FormDialog
        open={showExtendDeadline && !!selectedTask}
        onOpenChange={(open) => !open && setShowExtendDeadline(false)}
        title="Extender fecha límite"
        onCancel={() => setShowExtendDeadline(false)}
        onSubmit={handleExtendDeadline}
        submitLabel={extendDeadlineMutation.isPending ? "Guardando…" : "Guardar"}
        submitDisabled={!extensionDeadline || extendDeadlineMutation.isPending}
      >
        <div>
          <OutlinedControl htmlFor="extension-deadline" label="Nueva fecha límite">
            <DateTimeField id="extension-deadline" value={extensionDeadline} onChange={setExtensionDeadline} />
          </OutlinedControl>
        </div>
      </FormDialog>

      {/* Add Files Modal */}
      <FormDialog
        open={showAddFiles && !!selectedTask}
        onOpenChange={(open) => !open && setShowAddFiles(false)}
        title="Agregar archivos"
        onCancel={() => setShowAddFiles(false)}
        onSubmit={handleAddFiles}
        submitLabel={addFilesMutation.isPending ? "Agregando…" : "Agregar"}
        submitDisabled={selectedFiles.length === 0 || addFilesMutation.isPending}
      >
        <div>
          <OutlinedControl htmlFor="file-input" label="Seleccionar archivos">
            <Input id="file-input" type="file" multiple onChange={handleFileSelect} className="border-field" />
          </OutlinedControl>
        </div>

        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="flex items-center gap-2 text-body text-gray-900 bg-card border border-border p-3 rounded-md">
                <Paperclip className="size-icon-md text-gray-700" />
                <span className="truncate">{file.name}</span>
              </div>
            ))}
          </div>
        )}
      </FormDialog>

      {/* Republish Modal */}
      <FormDialog
        open={!!republishTask}
        onOpenChange={(open) => !open && setRepublishTask(null)}
        title="Republicar pedido"
        onCancel={() => setRepublishTask(null)}
        onSubmit={handleRepublishSubmit}
        submitLabel={republishMutation.isPending ? "Republicando…" : "Republicar"}
        submitDisabled={republishMutation.isPending || !newDeadline}
      >
        <p className="text-body text-gray-700 line-clamp-2 wrap-anywhere">{republishTask?.title}</p>

        <div>
          <OutlinedControl htmlFor="deadline" label="Nueva fecha límite">
            <DateTimeField id="deadline" value={newDeadline} onChange={setNewDeadline} />
          </OutlinedControl>
        </div>
      </FormDialog>

      {/* Edit Task Modal - Limited to: extend deadline, add files, add comments */}
      <Dialog open={showEditModal && !!selectedTask} onOpenChange={(open) => !open && setShowEditModal(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar pedido</DialogTitle>
          </DialogHeader>

          <p className="text-body text-gray-700 line-clamp-2 wrap-anywhere">
            {selectedTask?.title}
          </p>

          <div className="space-y-3">
            {/* Option 1: Extend Deadline */}
            <button
              onClick={() => {
                setShowEditModal(false);
                setExtensionDeadline(selectedTask?.deadline ? new Date(selectedTask.deadline).toISOString().slice(0, 16) : "");
                setShowExtendDeadline(true);
              }}
              className="w-full flex items-center gap-3 p-card-pad rounded-lg bg-card border border-border hover:bg-gray-50 transition-colors text-left"
            >
              <div className="size-icon-box bg-primary-50 rounded-full flex items-center justify-center">
                <Calendar className="size-icon-lg text-primary-600" />
              </div>
              <div>
                <p className="text-body font-semibold text-gray-900">Ampliar fecha</p>
                <p className="text-caption text-gray-700">Extender el tiempo límite</p>
              </div>
            </button>

            {/* Option 2: Add Files */}
            <button
              onClick={() => {
                setShowEditModal(false);
                setSelectedFiles([]);
                setShowAddFiles(true);
              }}
              className="w-full flex items-center gap-3 p-card-pad rounded-lg bg-card border border-border hover:bg-gray-50 transition-colors text-left"
            >
              <div className="size-icon-box bg-primary-50 rounded-full flex items-center justify-center">
                <Upload className="size-icon-lg text-primary-600" />
              </div>
              <div>
                <p className="text-body font-semibold text-gray-900">Agregar archivos</p>
                <p className="text-caption text-gray-700">Adjuntar documentos adicionales</p>
              </div>
            </button>

            {/* Option 3: Edit Comment */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-card-pad rounded-lg bg-card border border-border">
                <div className="size-icon-box bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="size-icon-lg text-gray-700" />
                </div>
                <div className="flex-1">
                  <p className="text-body font-semibold text-gray-900 mb-2">Comentario adicional</p>
                  <Textarea
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    placeholder="Agrega instrucciones o notas adicionales…"
                    rows={3}
                    />
                </div>
              </div>
              <Button
                onClick={handleUpdateComment}
                disabled={updateCommentMutation.isPending}
                className="w-full"
              >
                {updateCommentMutation.isPending ? "Guardando…" : "Guardar comentario"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      <Dialog open={showRepublishSuccess} onOpenChange={setShowRepublishSuccess}>
        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle className="text-heading font-bold text-gray-900 text-center">Pedido republicado</DialogTitle>
          </DialogHeader>
          <p className="text-body text-gray-700">Tu pedido está activo nuevamente</p>
          <Button onClick={() => setShowRepublishSuccess(false)} className="w-full">Entendido</Button>
        </DialogContent>
      </Dialog>

      <TaskQuickViewDialog
        task={viewingTask}
        onClose={() => setViewingTask(null)}
        currentUserCountry={currentUser?.country}
        onGoToTask={(task) => {
          setViewingTask(null);
          setSelectedTask(task as TaskWithCandidates);
          setLocation(`${ROUTES.orders}/${task.id}`);
        }}
      />
    </>
  );
}
