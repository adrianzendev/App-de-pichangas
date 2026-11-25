import { OutlinedControl } from "@/components/ui/outlined-field";
import { TaskDetailPanel } from "@/components/ui/task-detail-panel";
import { ROUTES, ROUTE_PATTERNS, TAB, tutorRoute } from "@/lib/routes";
import { Skeleton } from "@/components/ui/skeleton";
import { pluralizeEs } from "@/lib/pluralize";
import { EmptyState } from "@/components/ui/empty-state";
import { BackButton } from "@/components/ui/back-button";
import { useState, useEffect, useRef, useMemo } from "react";
import { ListScreen } from "@/components/ui/list-screen";
import { SectionLink } from "@/components/ui/section-link";
import { StudentHomeHero } from "@/components/sections/student-home-hero";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useExchangeRates } from "@/hooks/use-exchange-rates";
import { MessageCircle, Users, X, Calendar, FileText, Plus, GraduationCap, ClipboardList, Video, HelpCircle, BookOpen, PenTool, FileCheck, Search, Filter, Check, CheckCheck, Edit3, Paperclip, CheckCircle2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateTimeField } from "@/components/ui/datetime-field";
import { useLocation, useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { UserAvatar } from "@/components/ui/user-avatar";
import { SimpleTaskCard } from "@/components/ui/simple-task-card";
import { UnreadBadge } from "@/components/ui/unread-badge";
import { TaskList } from "@/components/ui/task-list";
import { CandidatesList } from "@/components/ui/candidates-list";
import { TaskDetailView } from "@/components/ui/task-detail-view";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TaskQuickViewDialog } from "@/components/ui/task-quick-view-dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { EnhancedFileDisplay } from "@/components/ui/enhanced-file-display";
import { generateStudentAlias } from "@/utils/student-anonymization";

import { getConnectionStatus, getTimeAgo } from "@/lib/connection-utils";
import { useWebSocketFixed } from "@/hooks/useWebSocketFixed";
import { getTutorStatusBadge, getTimeRemaining, generateTaskNumber, getSubjectDisplay } from "@/utils/task-utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { TaskNumber } from "@/components/ui/task-number";
import { formatDateForUser, formatTimeForUser, formatPrice } from "@/lib/timezone-utils";
import type { TaskWithCandidates, UserWithType, PublicTutor } from "@shared/schema";
import { calcUsdEquivalent } from "@/lib/currency-utils";
import { fmtTime12 } from "@/lib/date-format";

interface ChatSectionOpenChatInfo {
  taskId: string;
  userId: string;
  userName: string;
  taskTitle: string;
}

interface ChatSectionProps {
  // Sin caller activo (Inicio ya no usa split-view de 2 columnas, ver
  // home.tsx caso "inicio"). Se deja el prop y su fallback interno
  // (navega a /chat-fullscreen cuando no viene) por si un futuro layout
  // de detalle lo necesita, sin volver a tocar openChat().
  onOpenChat?: (info: ChatSectionOpenChatInfo) => void;
}

export default function ChatSection({ onOpenChat }: ChatSectionProps = {}) {
  const [location, setLocation] = useLocation();
  const [, inicioParams] = useRoute(ROUTE_PATTERNS.homeTask);
  const [, pedidosParams] = useRoute(ROUTE_PATTERNS.ordersTask);
  const selectedTaskId = inicioParams?.taskId || pedidosParams?.taskId;
  const isFromPedidos = !!pedidosParams?.taskId;
  
  const [selectedTask, setSelectedTask] = useState<TaskWithCandidates | null>(null);
  const [viewingTask, setViewingTask] = useState<TaskWithCandidates | null>(null);
  const [showRepublishModal, setShowRepublishModal] = useState(false);
  const [showRepublishSuccess, setShowRepublishSuccess] = useState(false);
  const [newDeadline, setNewDeadline] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks, isLoading, isError, refetch } = useQuery<TaskWithCandidates[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: currentUser } = useQuery<UserWithType>({
    queryKey: ["/api/user/current"],
  });

  // Fetch current tutor profile with assigned courses (for tutors only)
  const { data: tutorProfile } = useQuery<{
    id: string;
    hasGeneralAccess: boolean;
    assignedCourses: { id: string; value: string; label: string }[];
  }>({
    queryKey: ["/api/tutor/current"],
    enabled: !!currentUser && currentUser.userType === "tutor",
  });

  // Fetch last messages to get unread counts
  const { data: lastMessages } = useQuery<Record<string, { message: string; unreadCount: number }>>({
    queryKey: ["/api/chat/last-messages"],
    enabled: !!currentUser,
  });

  // Fetch tutors for home menu section
  const { data: tutors } = useQuery<PublicTutor[]>({
    queryKey: ["/api/tutors"],
    enabled: !!currentUser && currentUser.userType !== "tutor",
  });

  const { data: exchangeRates } = useExchangeRates();


  // Listen for WebSocket refresh events to update task lists immediately
  useEffect(() => {
    const handleTaskRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/last-messages"] });
    };
    
    window.addEventListener('task_list_refresh', handleTaskRefresh);
    window.addEventListener('chat_list_refresh', handleTaskRefresh);
    
    return () => {
      window.removeEventListener('task_list_refresh', handleTaskRefresh);
      window.removeEventListener('chat_list_refresh', handleTaskRefresh);
    };
  }, [queryClient]);

  // Helper to get unread count for a specific conversation
  const getUnreadCount = (taskId: string, otherUserId: string) => {
    if (!lastMessages || !currentUser || !otherUserId) return 0;
    
    // CRITICAL: Backend sorts participant IDs to create consistent keys
    const participants = [currentUser.id, otherUserId].sort();
    const key = `${taskId}-${participants[0]}-${participants[1]}`;
    
    const conversation = lastMessages[key];
    if (conversation?.unreadCount && conversation.unreadCount > 0) {
      return conversation.unreadCount;
    }
    return 0;
  };

  // Helper to get total unread count for a task (sum of all candidates)
  const getTotalUnreadForTask = (task: TaskWithCandidates) => {
    if (!lastMessages || !currentUser) return 0;
    
    let total = 0;
    
    if (currentUser.userType === "tutor") {
      // For tutors: count unread from the student
      // CRITICAL: Backend sorts participant IDs to create consistent keys
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

  // Helper to get last message info for a task
  const getLastMessageInfo = (task: TaskWithCandidates) => {
    if (!lastMessages || !currentUser) return { message: "", timestamp: null, isFromMe: false, isDelivered: false, isRead: false };
    
    // CRITICAL: Backend sorts participant IDs to create consistent keys
    const otherUserId = task.userId || "";
    if (otherUserId) {
      const participants = [currentUser.id, otherUserId].sort();
      const key = `${task.id}-${participants[0]}-${participants[1]}`;
      const conversation = lastMessages[key] as any;
      if (conversation?.message) {
        return {
          message: conversation.message,
          timestamp: conversation.timestamp ? new Date(conversation.timestamp) : null,
          isFromMe: conversation.fromCurrentUser === true,
          isDelivered: conversation.isDelivered === true,
          isRead: conversation.isReadByRecipient === true
        };
      }
    }
    
    // Fallback: Try to find any matching key for this task
    const matchingKey = Object.keys(lastMessages).find(key => key.includes(task.id));
    if (matchingKey) {
      const conversation = lastMessages[matchingKey] as any;
      return {
        message: conversation?.message || "",
        timestamp: conversation?.timestamp ? new Date(conversation.timestamp) : null,
        isFromMe: conversation?.fromCurrentUser === true,
        isDelivered: conversation?.isDelivered === true,
        isRead: conversation?.isReadByRecipient === true
      };
    }
    
    return { message: "", timestamp: null, isFromMe: false, isDelivered: false, isRead: false };
  };

  // Helper to get last message info for a specific candidate (tutor)
  const getLastMessageInfoForCandidate = (taskId: string, tutorId: string) => {
    if (!lastMessages || !currentUser) return { message: "", timestamp: null, isFromMe: false, isDelivered: false, isRead: false };
    
    const participants = [currentUser.id, tutorId].sort();
    const key = `${taskId}-${participants[0]}-${participants[1]}`;
    const conversation = lastMessages[key] as any;
    
    if (conversation?.message) {
      return {
        message: conversation.message,
        timestamp: conversation.timestamp ? new Date(conversation.timestamp) : null,
        isFromMe: conversation.fromCurrentUser === true,
        isDelivered: conversation.isDelivered === true,
        isRead: conversation.isReadByRecipient === true
      };
    }
    
    return { message: "", timestamp: null, isFromMe: false, isDelivered: false, isRead: false };
  };

  const { onlineUsers, isUserOnline } = useWebSocketFixed(currentUser?.id);

  // Find the selected task when viewing candidates
  const selectedViewTask = selectedTaskId ? tasks?.find(t => t.id === selectedTaskId) : null;

  // Handle browser back button when viewing a chat
  useEffect(() => {
    if (!selectedTaskId) return;
    
    // Push a state to handle back button
    window.history.pushState({ chatOpen: true, taskId: selectedTaskId }, '');
    
    const handlePopState = (event: PopStateEvent) => {
      // When back button is pressed, navigate to chat list instead of leaving
      if (event.state?.chatOpen || !event.state) {
        setLocation(isFromPedidos ? ROUTES.orders : "/");
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [selectedTaskId, isFromPedidos, setLocation]);

  // Initialize newDeadline when modal opens
  useEffect(() => {
    if (showRepublishModal && !newDeadline) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setNewDeadline(tomorrow.toISOString().slice(0, 16));
    }
  }, [showRepublishModal, newDeadline]);

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ tutorId, isFavorite }: { tutorId: string; isFavorite: boolean }) => {
      const method = isFavorite ? "DELETE" : "POST";
      const endpoint = isFavorite ? `/api/favorites/${tutorId}` : "/api/favorites";
      const body = isFavorite ? undefined : { tutorId };
      return apiRequest(method, endpoint, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Favoritos actualizados",
        description: "Los favoritos se han actualizado correctamente",
      });
    },
  });

  const republishMutation = useMutation({
    mutationFn: async ({ taskId, deadline }: { taskId: string; deadline: string }) => {
      // Use dedicated republish endpoint that clears candidates and keeps same task ID/number
      return apiRequest("POST", `/api/tasks/${taskId}/republish`, { deadline });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setShowRepublishModal(false);
      setNewDeadline("");
      setShowRepublishSuccess(true);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo republicar el pedido",
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

  const openChat = (candidate: any, task: TaskWithCandidates) => {
    if (isError) {
    return (
      <ListScreen>
        <EmptyState
          centered
          title="No pudimos cargar tus pedidos"
          description="Revisa tu conexión e inténtalo de nuevo."
          action={<Button onClick={() => refetch()}>Reintentar</Button>}
        />
      </ListScreen>
    );
  }

  const isCurrentUserTutor = currentUser?.userType === "tutor";
    const fromSection = isFromPedidos ? TAB.orders : TAB.home;

    if (isCurrentUserTutor) {
      // Navigate to fullscreen chat for tutors
      const studentAlias = generateStudentAlias(task.userId || "");
      if (onOpenChat) {
        onOpenChat({ taskId: task.id, userId: task.userId, userName: studentAlias, taskTitle: task.title });
        // Cierra la vista de candidatos (fixed overlay atado a la ruta
        // /home/:taskId) para volver a las dos columnas con el chat
        // elegido ya abierto a la derecha.
        setLocation(isFromPedidos ? ROUTES.orders : "/");
        return;
      }
      const chatUrl = `/chat-fullscreen?taskId=${task.id}&userId=${task.userId}&userName=${encodeURIComponent(studentAlias)}&taskTitle=${encodeURIComponent(task.title)}&from=${fromSection}&returnTaskId=${task.id}`;
      setLocation(chatUrl);
    } else {
      // Navigate to fullscreen chat for students
      let tutorId = candidate.tutorId;

      if (tutorId === currentUser?.id) {
        if (candidate.tutor?.user?.id && candidate.tutor.user.id !== currentUser?.id) {
          tutorId = candidate.tutor.user.id;
        } else {
          return;
        }
      }

      if (!tutorId || tutorId === currentUser?.id) {
        return;
      }

      const tutorName = candidate.tutor?.name || candidate.tutor?.user?.name || "Tutor";
      if (onOpenChat) {
        onOpenChat({ taskId: task.id, userId: tutorId, userName: tutorName, taskTitle: task.title });
        setLocation(isFromPedidos ? ROUTES.orders : "/");
        return;
      }
      const chatUrl = `/chat-fullscreen?taskId=${task.id}&userId=${tutorId}&userName=${encodeURIComponent(tutorName)}&taskTitle=${encodeURIComponent(task.title)}&from=${fromSection}&returnTaskId=${task.id}`;
      setLocation(chatUrl);
    }
  };


  if (!currentUser) {
    return (
      <div className="p-4">
        <div className="text-center py-8 bg-gray-100 rounded-lg">
          <p className="text-gray-700">Inicia sesión para ver tus conversaciones</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <ListScreen>
        <Skeleton className="h-banner-page rounded-xl" />
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-bento-pad">
            <div className="flex gap-4">
              <Skeleton className="size-avatar-mdl rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-skeleton-line w-skeleton-name-w" />
                <Skeleton className="h-skeleton-meta-h w-skeleton-meta-w" />
              </div>
            </div>
          </Card>
        ))}
      </ListScreen>
    );
  }

  const isCurrentUserTutor = currentUser?.userType === "tutor";

  const userTasks = tasks?.filter(task => {
    if (isCurrentUserTutor) {
      // First check if tutor has applied or is assigned to this task
      const isInvolvedInTask = task.candidates?.some(candidate => candidate.tutorId === currentUser.id) || 
             task.assignedTutorId === currentUser.id;
      
      if (!isInvolvedInTask) return false;
      
      // Then filter by tutor's course access (unless they have general access)
      if (tutorProfile?.hasGeneralAccess) {
        return true; // General access sees all chats they're involved in
      }
      
      // Check if task's studyArea matches tutor's assigned courses
      const assignedCourseValues = tutorProfile?.assignedCourses?.map(c => c.value) || [];
      if (assignedCourseValues.length === 0) {
        return false; // No courses assigned = no access to any chats
      }
      
      return task.studyArea && assignedCourseValues.includes(task.studyArea);
    } else {
      // Show all tasks for students, even without candidates
      return task.userId === currentUser.id;
    }
  }) || [];

  // If viewing a specific task's candidates - Match OrdersSection design exactly
  if (selectedTaskId && selectedViewTask) {
    return (
      <>
      {/* Movil/tablet: overlay a pantalla completa. Escritorio (lg:): sale del flujo fixed y ocupa la columna 2, sin tapar el sidebar. */}
      <TaskDetailPanel inlineOnDesktop>
        <div>
          {/* Header - Matches OrdersSection exactly */}
          <div className="bg-white sticky top-0 z-sticky px-page-h py-4">
            <div className="flex items-center gap-3">
              <BackButton
                onClick={() => setLocation(isFromPedidos ? ROUTES.orders : "/")}
                data-testid="back-to-section" />
              <div className="flex-1 min-w-0">
                <h2 className="font-medium text-gray-900 truncate text-label">{selectedViewTask.title}</h2>
                <p className="text-caption text-gray-700">{selectedViewTask.candidates?.length || 0} {pluralizeEs(selectedViewTask.candidates?.length || 0, "candidato")}</p>
              </div>
              {!isCurrentUserTutor && (
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Editar pedido"
                  onClick={() => setLocation(`${ROUTES.publish}?edit=${selectedViewTask.id}`)}
                  data-testid="edit-task-button"
                >
                  <Edit3 className="h-5 w-5" aria-hidden />
                </Button>
              )}
            </div>
          </div>

          {/* Candidates Section */}
          <div className="px-0">
            {isCurrentUserTutor ? (
              // For tutors: Show student they're chatting with
              (<Card className="overflow-hidden">
                {(() => {
                  const tutorUnreadCount = getUnreadCount(selectedViewTask.id, currentUser?.id || "");
                  const studentConnectionStatus = getConnectionStatus(selectedViewTask.user?.lastSeen ?? null, isUserOnline(selectedViewTask.userId || ""));
                  
                  return (
                    <div 
                      className="px-4 py-3 hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => openChat(null, selectedViewTask)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <UserAvatar
                            name={generateStudentAlias(selectedViewTask.userId || "")}
                            avatar={undefined}
                            size="md"
                          />
                          <div className={`absolute bottom-0 right-0 w-3 h-3 ${studentConnectionStatus.color} border-2 border-white rounded-full`}></div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className={`font-medium text-label ${tutorUnreadCount > 0 ? 'text-gray-900 font-semibold' : 'text-gray-900'}`}>
                              {generateStudentAlias(selectedViewTask.userId || "")}
                            </h4>
                          </div>
                          <p className={`text-caption mt-0.5 ${tutorUnreadCount > 0 ? 'text-gray-700 font-medium' : 'text-gray-700'}`}>Cliente</p>
                        </div>
                        
                        <UnreadBadge count={tutorUnreadCount} size="md" />
                      </div>
                    </div>
                  );
                })()}
              </Card>)
            ) : (
              // For students: Show tutors who applied using unified component
              (<CandidatesList
                candidates={selectedViewTask.candidates || []}
                taskId={selectedViewTask.id}
                currency={selectedViewTask.currency}
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
                onCandidateClick={(candidate) => {
                  // Check if task is expired
                  const timeRem = getTimeRemaining(selectedViewTask.deadline);
                  const isExp = timeRem.isExpired && (selectedViewTask.status === "active" || selectedViewTask.status === "available");
                  const effStatus = isExp ? "expired" : selectedViewTask.status;

                  if (effStatus === "expired") {
                    // Show republish modal instead of opening chat
                    setSelectedTask(selectedViewTask);
                    setShowRepublishModal(true);
                  } else {
                    openChat(candidate, selectedViewTask);
                  }
                }}
                getUnreadCount={getUnreadCount}
                isUserOnline={isUserOnline}
              />)
            )}
          </div>
        </div>
      </TaskDetailPanel>
      </>
    );
  }

  // Calculate stats for home menu
  const totalUnreadMessages = userTasks.reduce((sum, task) => sum + getTotalUnreadForTask(task), 0);
  const activeTasks = userTasks.filter(t => t.status === "active" || t.status === "in_progress").length;

  // Main task list view - App-style home menu
  return (
    <div className="bg-white">
      <ListScreen>
        
        {/* Estudiante: banner de tutores + saludo + publicar + servicios (hoja blanca sobre el banner) */}
        {!isCurrentUserTutor && (
          <StudentHomeHero
            firstName={currentUser?.name?.split(' ')[0]}
            onPublish={() => setLocation(ROUTES.publish)}
            onService={(service) => setLocation(`${ROUTES.publish}?service=${service}`)}
          />
        )}

        {/* Student Tasks Section - only for students */}
        {!isCurrentUserTutor && (
        <div data-testid="recent-tasks">
          <div className="flex items-center justify-between mb-card-gap">
            <h2 className="text-subheading font-semibold text-gray-900">Últimos pedidos</h2>
            {userTasks.length > 0 && (
              <SectionLink onClick={() => setLocation(ROUTES.orders)} data-testid="view-all-tasks">Ver todos</SectionLink>
            )}
          </div>

          {/* Task List - Using shared TaskList component */}
          <TaskList
            tasks={userTasks}
            onTaskClick={(task) => {
              setSelectedTask(task);
              // `from: "home"`: el boton Volver del detalle regresa a Inicio, no a Pedidos.
              setLocation(`${ROUTES.orders}/${task.id}`, { state: { from: "home" } });
            }}
            onRepublish={(task, e) => {
              e.stopPropagation();
              // Open modal immediately without navigation (same as Pedidos)
              setSelectedTask(task);
              setShowRepublishModal(true);
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
            emptyStateText="Publica tu primer pedido para recibir ayuda"
            showPaymentStates={true}
            maxItems={3}
          />
        </div>
        )}
      </ListScreen>
      {/* Republicar: nueva fecha límite */}
      <Dialog
        open={showRepublishModal && !!selectedTask}
        onOpenChange={(open) => { if (!open) { setShowRepublishModal(false); setNewDeadline(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-heading font-bold text-gray-900">Republicar pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-body text-gray-700 line-clamp-2 wrap-anywhere">{selectedTask?.title}</p>
            <div>
              <OutlinedControl htmlFor="deadline-inicio" label="Nueva fecha límite">
                <DateTimeField id="deadline-inicio" value={newDeadline} onChange={setNewDeadline} />
              </OutlinedControl>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowRepublishModal(false); setNewDeadline(""); }}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  if (newDeadline && selectedTask) {
                    republishMutation.mutate({ taskId: selectedTask.id, deadline: new Date(newDeadline).toISOString() });
                  }
                }}
                disabled={republishMutation.isPending || !newDeadline}
              >
                {republishMutation.isPending ? "Republicando…" : "Republicar"}
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
        currentUserCountry={(currentUser as any)?.country}
        showUsdEquivalent={isCurrentUserTutor}
        onGoToTask={(task) => {
          setViewingTask(null);
          setSelectedTask(task as TaskWithCandidates);
          setLocation(`${ROUTES.orders}/${task.id}`);
        }}
      />
    </div>
  );
}
