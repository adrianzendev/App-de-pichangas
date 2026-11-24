import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { TaskDetailPanel } from "@/components/ui/task-detail-panel";
import { pluralizeEs } from "@/lib/pluralize";
import { BackButton } from "@/components/ui/back-button";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Edit3, Calendar, Clock, Paperclip, Eye } from "lucide-react";

import { es } from "date-fns/locale";
import { CandidatesList } from "./candidates-list";
import { UserAvatar } from "./user-avatar";
import { Card } from "./card";
import { UnreadBadge } from "./unread-badge";
import { Sheet, SheetContent, SheetTitle } from "./sheet";
import { getTimeRemaining } from "@/utils/task-utils";
import { formatDateForUser, formatTimeForUser } from "@/lib/timezone-utils";
import { generateStudentAlias } from "@/utils/student-anonymization";
import { getConnectionStatus } from "@/lib/connection-utils";
import { getFileUrl } from "@/lib/file-url-utils";
import type { TaskWithCandidates } from "@shared/schema";
import { fmtRelative } from "@/lib/date-format";
import { EmptyState } from "@/components/ui/empty-state";

interface LastMessageInfo {
  message: string;
  timestamp: Date | null;
  isFromMe: boolean;
  isDelivered: boolean;
  isRead: boolean;
}

interface TaskDetailViewProps {
  task: TaskWithCandidates;
  currentUser: any;
  isCurrentUserTutor: boolean;
  onBack: () => void;
  onEdit?: () => void;
  onCandidateClick: (candidate: any) => void;
  onStudentClick?: () => void;
  getUnreadCount: (taskId: string, tutorId: string) => number;
  isUserOnline: (tutorId: string) => boolean;
  getLastMessageInfo?: (taskId: string, tutorId: string) => LastMessageInfo;
}

type TaskViewer = {
  tutorId: string;
  name: string;
  avatar: string | null;
  viewedAt: string | null;
};

export function TaskDetailView({
  task,
  currentUser,
  isCurrentUserTutor,
  onBack,
  onEdit,
  onCandidateClick,
  onStudentClick,
  getUnreadCount,
  isUserOnline,
  getLastMessageInfo,
}: TaskDetailViewProps) {
  const [viewersOpen, setViewersOpen] = useState(false);

  const timeRem = getTimeRemaining(task.deadline);
  const isExpired = timeRem.isExpired && (task.status === "active" || task.status === "available");
  const effectiveStatus = isExpired ? "expired" : task.status;

  const isOwner = !isCurrentUserTutor && currentUser?.id === task.userId;

  const { data: viewers, isLoading: viewersLoading } = useQuery<TaskViewer[]>({
    queryKey: ["/api/tasks", task.id, "views"],
    queryFn: () => fetch(`/api/tasks/${task.id}/views`).then(r => { if (!r.ok) throw new Error("Failed to fetch viewers"); return r.json(); }),
    enabled: isOwner,
  });

  // Mark proposals as viewed when student opens task with candidates (first time only)
  const hasCandidates = (task.candidates?.length ?? 0) > 0;
  useEffect(() => {
    if (!isOwner || isCurrentUserTutor || !hasCandidates || task.proposalsViewedAt) return;
    fetch(`/api/tasks/${task.id}/mark-proposals-viewed`, { method: "PATCH" }).catch(() => {});
  }, [task.id, isOwner, isCurrentUserTutor, hasCandidates, task.proposalsViewedAt]);

  return (
    <TaskDetailPanel>
      <div className="mx-auto max-w-content">
        
        {/* Header - Apple HIG Style */}
        <div className="bg-white sticky top-0 z-sticky px-page-h pt-4 pb-2">
          <div className="flex items-center gap-4">
            <BackButton
              onClick={onBack}
              data-testid="back-button" />
            
            <div className="flex-1 min-w-0">
              <h1 className="text-heading font-bold text-gray-900 truncate">
                {task.title}
              </h1>
              <p className="text-label text-gray-700">
                {task.candidates?.length || 0} {pluralizeEs(task.candidates?.length || 0, "candidato")}
              </p>
            </div>

            {!isCurrentUserTutor && onEdit && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Editar pedido"
                onClick={onEdit}
                data-testid="edit-task-button"
              >
                <Edit3 className="h-5 w-5 text-gray-700" />
              </Button>
            )}
          </div>

          {/* Viewer chip — only for task owner */}
          {isOwner && (
            <Chip
              onClick={() => setViewersOpen(true)}
              className="mt-2"
              data-testid="button-task-viewers"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>
                {viewers !== undefined
                  ? viewers.length === 0
                    ? "Sin vistas todavía"
                    : `${viewers.length} ${pluralizeEs(viewers.length, 'tutor lo vio', 'tutores lo vieron')}`
                  : "¿Quién vio este pedido?"}
              </span>
            </Chip>
          )}
        </div>

        {/* Candidates Section - Clean List */}
        <div className="px-page-h pb-8 pt-2">

          {isCurrentUserTutor ? (
            // For tutors: Show student they're chatting with
            <Card className="p-card-pad active:bg-gray-50 cursor-pointer transition-all"
              onClick={onStudentClick}
            >
              {(() => {
                const tutorUnreadCount = getUnreadCount(task.id, currentUser?.id || "");
                const studentConnectionStatus = getConnectionStatus(task.user?.lastSeen ?? null, isUserOnline(task.userId || ""));
                
                return (
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <UserAvatar 
                        name={generateStudentAlias(task.userId || "")} 
                        avatar={undefined}
                        size="md"
                      />
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${studentConnectionStatus.color} border-ring border-white rounded-full`}></div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-body ${tutorUnreadCount > 0 ? 'text-gray-900 font-semibold' : 'text-gray-900 font-medium'}`}>
                        {generateStudentAlias(task.userId || "")}
                      </h4>
                      <p className="text-label text-gray-700">Cliente</p>
                    </div>
                    
                    <UnreadBadge count={tutorUnreadCount} size="lg" className="font-semibold" />
                  </div>
                );
              })()}
            </Card>
          ) : (
            // For students: Show tutors who applied
            <CandidatesList
              candidates={task.candidates || []}
              taskId={task.id}
              currency={task.currency}
              onCandidateClick={onCandidateClick}
              getUnreadCount={getUnreadCount}
              isUserOnline={isUserOnline}
            />
          )}
        </div>
      </div>

      {/* Viewers panel */}
      <Sheet open={viewersOpen && isOwner} onOpenChange={(open) => !open && setViewersOpen(false)}>
        <SheetContent side="bottom" className="rounded-t-sheet max-h-sheet-md flex flex-col p-0 gap-0">
          <div className="flex items-center px-5 pt-5 pb-3">
            <SheetTitle className="font-semibold text-gray-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-gray-700" />
              Tutores que vieron este pedido
            </SheetTitle>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-3">
            {viewersLoading ? (
              <div className="py-8 text-center text-gray-700 text-label">Cargando…</div>
            ) : !viewers || viewers.length === 0 ? (
              <EmptyState title="Sin vistas todavía" />
            ) : (
              <ul className="space-y-3">
                {viewers.map((v) => (
                  <li key={v.tutorId} className="flex items-center gap-3">
                    <UserAvatar
                      name={v.name}
                      avatar={v.avatar ? getFileUrl(v.avatar) : undefined}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-label font-medium text-gray-900 truncate">{v.name}</p>
                      {v.viewedAt && (
                        <p className="text-caption text-gray-700">
                          {fmtRelative(new Date(v.viewedAt))}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </TaskDetailPanel>
  );
}
