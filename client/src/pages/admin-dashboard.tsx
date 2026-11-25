import { useState, useEffect, useMemo } from "react";
import { ignoreClarity } from "@/lib/clarity";
import { SearchField } from "@/components/ui/search-field";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  Label as PieLabel,
} from "recharts";
import { 
  CheckCircle, XCircle, Clock, User, Users, UserCheck, GraduationCap, CalendarDays,
  Settings, BarChart3, DollarSign, FileText, Star,
  Bell, Search, Home, Award, AlertTriangle, Bug, Globe, Phone, ScrollText, School,
  Eye, X, TrendingUp, Activity, Wifi, Pencil, Plus, LogOut, ChevronUp, ChevronDown, Key, CreditCard, Briefcase, Check, Download, BellRing, BellOff, Shield, MessageSquare, RefreshCw, Paperclip, Mail
} from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImagePreviewModal } from "@/components/ui/image-preview-modal";
import { SYSTEM_MESSAGE_CLASS, BUBBLE_TIME_CLASS, bubbleTextClass } from "@/components/chat/chat-bubble-styles";
import { MessageAttachment, DocumentViewerModal, buildChatAttachments, type ChatAttachment } from "@/components/chat/attachments";
import { Badge } from "@/components/ui/badge";
import { UnreadBadge } from "@/components/ui/unread-badge";
import { Tooltip as UiTooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { FilterSelect } from "@/components/ui/filter-select";
import { LocalTime } from "@/components/ui/local-time";
import { AdminTableCard, AdminTable, AdminTableHead, AdminTableBody, AdminTr, AdminTh, AdminTd, AdminCountryTd, AdminActionsTh, AdminActionsTd, AdminTableSkeletonRows, AdminEyebrowLabel } from "@/components/ui/admin-table";
import { MetricCard } from "@/components/ui/metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useExchangeRates } from "@/hooks/use-exchange-rates";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { TutorFormDialog, useResendActivation, type AdminTutor } from "@/components/admin/tutor-form-dialog";
import { UserFormDialog } from "@/components/admin/user-form-dialog";
import { AgentFormDialog } from "@/components/admin/agent-form-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { SectionLink } from "@/components/ui/section-link";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TaskQuickViewDialog } from "@/components/ui/task-quick-view-dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimeField } from "@/components/ui/datetime-field";
import { OutlinedControl, OutlinedField } from "@/components/ui/outlined-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountrySelect } from "@/components/ui/country-select";
import { useToast } from "@/hooks/use-toast";
import { isSuperAdmin } from "@shared/admin";
import { startImpersonation } from "@/lib/impersonation";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { logout } from "@/lib/logout";
import { getFileUrl, downloadFile } from "@/lib/file-url-utils";
import { getTimeRemaining } from "@/utils/task-utils";
import { useLocation, useParams } from "wouter";
import { TaskNumber } from "@/components/ui/task-number";
import { Combobox } from "@/components/ui/combobox";
import { SidebarNav, SidebarNavList, type SidebarNavItem } from "@/components/layout/sidebar-nav";
import { AdminProfileMenu } from "@/components/layout/admin-profile-menu";
import Header from "@/components/layout/header";
import { generateStudentAlias } from "@/utils/student-anonymization";
import { calcUsdEquivalent, formatPrice, formatPriceGrouped, DEFAULT_CURRENCY } from "@/lib/currency-utils";
import { pluralizeEs } from "@/lib/pluralize";
import { fmtTime12, fmtDateShort, fmtDate, fmtDateTime, fmtDateTimeShort, fmtRelative, LIMA_TZ } from "@/lib/date-format";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { EnumSelect } from "@/components/ui/enum-select";
import { ACCOUNT_STATUSES, PAYMENT_METHODS, BANK_ACCOUNT_TYPES, BANK_CURRENCIES, ALERT_SCAN_RANGES, FILTER_RULE_TYPES, ALERT_TABS, type AlertTab } from "@/lib/options";
import { QueryErrorBanner } from "@/components/admin/query-error-banner";
import { AdminSection, AdminSectionHeader, AdminCreateButton, AdminToolbar, AdminToolbarRow, AdminFilters, AdminPagination, paginate } from "@/components/admin/admin-layout";
import { ErrorLogsSection } from "@/components/admin/error-logs-section";
import { AuditLogSection } from "@/components/admin/audit-log-section";
import { UniversitiesSection } from "@/components/admin/universities-section";
import { DeleteButton } from "@/components/ui/delete-button";
import { AdminDeleteButton, AdminRowAction, RowActions } from "@/components/admin/row-actions";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AlertCard, GeneralAlertCard, type EnrichedAlert } from "@/components/admin/alert-card";
import { ScanRow } from "@/components/admin/scan-row";
import { fileToDataUrl } from "@/lib/utils";
import { FormDialog } from "@/components/ui/form-dialog";
import type { 
  PaymentVerification, 
  TaskWithCandidates, 
  Candidate,
  User as UserType, 
  TutorWithUser, 
  AdminAlert,
  Career,
  Country,
  BankAccount,
  CountrySettings,
  ContactFilterRule,
  TaskAuditLog
} from "@shared/schema";

type SectionId = 'dashboard' | 'payments' | 'tasks' | 'tutors' | 'users' | 'agents' | 'services' | 'courses' | 'areas' | 'universities' | 'countries' | 'bank_accounts' | 'min_budgets' | 'alerts' | 'errors' | 'audit' | 'exchange_rates' | 'settings' | 'no-permissions';

interface SidebarItem {
  id: SectionId;
  label: string;
  icon: typeof Home;
}

const sidebarItems: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'payments', label: 'Pagos', icon: DollarSign },
  { id: 'tasks', label: 'Pedidos', icon: FileText },
  { id: 'tutors', label: 'Tutores', icon: GraduationCap },
  { id: 'users', label: 'Estudiantes', icon: Users },
  { id: 'agents', label: 'Agentes', icon: UserCheck },
  { id: 'services', label: 'Servicios', icon: Briefcase },
  { id: 'courses', label: 'Materias', icon: Award },
  { id: 'areas', label: 'Carreras', icon: GraduationCap },
  { id: 'universities', label: 'Universidades', icon: School },
  { id: 'countries', label: 'Países', icon: Globe },
  { id: 'bank_accounts', label: 'Cuentas Bancarias', icon: CreditCard },
  { id: 'min_budgets', label: 'Presupuesto Mínimo', icon: DollarSign },
  { id: 'alerts', label: 'Alertas', icon: AlertTriangle },
  { id: 'errors', label: 'Errores', icon: Bug },
  { id: 'audit', label: 'Auditoría', icon: ScrollText },
  { id: 'exchange_rates', label: 'Divisas / USD', icon: TrendingUp },
  { id: 'settings', label: 'Configuración', icon: Settings },
];

// `account`: estado de una CUENTA (tutor, usuario, agente) -> Activo / Inactivo. Sin `account`, es estado de pedido/pago.
const TASK_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "active", label: "Disponible" },
  { value: "payment_pending", label: "Pago en revisión" },
  { value: "payment_rejected", label: "Pago rechazado" },
  { value: "in_progress", label: "En progreso" },
  { value: "in_review", label: "En revisión" },
  { value: "completed", label: "Completado" },
  { value: "cancelled", label: "Cancelado" },
  { value: "expired", label: "Expirado" },
];

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  register: { label: 'Registro', color: 'bg-green-50 text-green-700' },
  login: { label: 'Inicio sesión', color: 'bg-gray-100 text-gray-700' },
  logout: { label: 'Cerró sesión', color: 'bg-gray-100 text-gray-700' },
  publish_task: { label: 'Publicó pedido', color: 'bg-green-50 text-green-700' },
  send_message: { label: 'Mensaje', color: 'bg-gray-100 text-gray-700' },
  payment: { label: 'Pago', color: 'bg-green-50 text-green-700' },
  upload_file: { label: 'Subió archivo', color: 'bg-gray-100 text-gray-700' },
  edit_profile: { label: 'Editó perfil', color: 'bg-gray-100 text-gray-700' },
};

function ActivityLogContent({ userId }: { userId: string }) {
  const { data: logs, isLoading } = useQuery<any[]>({
    queryKey: [`/api/activity-logs/${userId}`],
  });

  if (isLoading) return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton className="h-skeleton-title w-skeleton-meta-w rounded-full" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
  if (!logs || logs.length === 0) return <EmptyState title="No hay actividad registrada aún" />;

  return (
    <div className="space-y-2 max-h-sheet-sm overflow-y-auto">
      {logs.map((log: any) => {
        const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-700' };
        return (
          <div key={log.id} className="flex items-start gap-3 py-2">
            <div className="flex-shrink-0 mt-0.5">
              <Badge variant="outline" className={`border-transparent ${actionInfo.color}`}>
                {actionInfo.label}
              </Badge>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body text-gray-900 truncate">{log.detail || '-'}</p>
              <div className="flex gap-2 text-caption text-gray-700 mt-0.5">
                <span>{log.createdAt ? fmtDateTime(log.createdAt) : '-'}</span>
                {log.device && <span className="capitalize">· {log.device}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Valor de filtro propio de cada seccion: lo que se busca en una tabla no se cruza con las demas.
// Se recuerda al recargar; la clave lleva el prefijo `admin_` para que logout.ts la borre.
function useSectionFilter(storageKey: string, section: string, initial: string) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(values)); } catch { /* storage bloqueado */ }
  }, [storageKey, values]);
  const setValue = (value: string) => setValues((prev) => ({ ...prev, [section]: value }));
  return [values[section] ?? initial, setValue] as const;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const params = useParams<{ section?: string }>();
  useEffect(ignoreClarity, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>("dashboard");
  const [searchTerm, setSearchTerm] = useSectionFilter('admin_searchBySection', activeSection, "");
  const [statusFilter, setStatusFilter] = useSectionFilter('admin_statusBySection', activeSection, "all");
  const [countryFilter, setCountryFilter] = useState(() => localStorage.getItem('admin_countryFilter') || "all");
  const [deviceFilter, setDeviceFilter] = useState(() => localStorage.getItem('admin_deviceFilter') || "all");
  const [sortOrder, setSortOrder] = useState(() => localStorage.getItem('admin_sortOrder') || "newest");
  const [taskServiceFilter, setTaskServiceFilter] = useState("all");
  const [tutorStatusFilter, setTutorStatusFilter] = useState("all");
  const [tutorProfessionFilter, setTutorProfessionFilter] = useState("all");
  const [tutorCountryFilter, setTutorCountryFilter] = useState("all");
  const [tutorVerifiedFilter, setTutorVerifiedFilter] = useState("all");
  const [tutorAccessFilter, setTutorAccessFilter] = useState("all");
  const [tutorDateFilter, setTutorDateFilter] = useState("all");
  const [tutorSortOrder, setTutorSortOrder] = useState("newest");
  const [selectedPayment, setSelectedPayment] = useState<PaymentVerification | null>(null);
  const [connStatsPeriod, setConnStatsPeriodState] = useState<string>(() => localStorage.getItem("admin_conn_period") || "30d");
  const setConnStatsPeriod = (v: string) => { setConnStatsPeriodState(v); localStorage.setItem("admin_conn_period", v); };
  const [customRange, setCustomRangeState] = useState<{from: string; to: string} | null>(() => {
    try { const s = localStorage.getItem("admin_conn_custom"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const setCustomRange = (v: {from: string; to: string} | null) => {
    setCustomRangeState(v);
    if (v) localStorage.setItem("admin_conn_custom", JSON.stringify(v));
    else localStorage.removeItem("admin_conn_custom");
  };
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [showStudents, setShowStudents] = useState(true);
  const [showTutors, setShowTutors] = useState(true);
  
  useEffect(() => {
    localStorage.setItem('admin_countryFilter', countryFilter);
    localStorage.setItem('admin_deviceFilter', deviceFilter);
    localStorage.setItem('admin_sortOrder', sortOrder);
  }, [countryFilter, deviceFilter, sortOrder]);

  // Sync URL → activeSection via route param (single Route keeps component alive, no remount)
  useEffect(() => {
    const section = params.section as SectionId | undefined;
    const validIds = sidebarItems.map(i => i.id);
    if (section && validIds.includes(section)) {
      setActiveSection(section);
    } else {
      setActiveSection('dashboard');
    }
  }, [params.section]);

  // CRITICAL: Route protection - check if user is admin
  // isPending (no isLoading): durante la restauracion de PersistQueryClientProvider (F5) la query
  // esta en pausa con isLoading=false y data=undefined; con isLoading el guard redirigia a "/" y se perdia la ruta.
  const { data: currentUser, isPending: isLoadingUser } = useQuery<UserType & { userType?: string }>({
    queryKey: ["/api/user/current"],
  });

  // Push notifications for admin
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, isLoading: pushLoading, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications(currentUser?.id ?? null);

  const handleLogout = () => logout();

  const [impersonateTarget, setImpersonateTarget] = useState<{ id: string; name: string } | null>(null);

  // For agents: hard section guard — enforce allowed sections at all times
  useEffect(() => {
    if (!currentUser) return;
    if ((currentUser as any)?.userType !== 'agent') return;
    const perms: string[] = (currentUser as any)?.agentPermissions || [];
    const allowed: SectionId[] = ['no-permissions' as SectionId];
    if (perms.includes('view_tasks') || perms.includes('manage_candidates') || perms.includes('republish_tasks')) allowed.push('tasks');
    if (perms.includes('view_tutors') || perms.includes('add_tutors')) allowed.push('tutors');
    if (!allowed.includes(activeSection)) {
      if (perms.includes('view_tasks') || perms.includes('manage_candidates') || perms.includes('republish_tasks')) { setActiveSection('tasks'); return; }
      if (perms.includes('view_tutors') || perms.includes('add_tutors')) { setActiveSection('tutors'); return; }
      setActiveSection('no-permissions' as SectionId);
    }
  }, [activeSection, currentUser]);

  // Route protection: no admin/agente -> afuera. Client-side nav (setLocation,
  // no window.location.href): un hard reload aca reinicia
  // PersistQueryClientProvider y puede restaurar un snapshot viejo de
  // IndexedDB antes de que el write throttled del persister se guarde,
  // cascadeando en mas rebotes (ver CLAUDE.md, mismo bug que login.tsx).
  useEffect(() => {
    if (isLoadingUser) return;
    const isAdminUser = (currentUser as any)?.userType === 'admin';
    const isAgentUser = (currentUser as any)?.userType === 'agent';
    if (!currentUser || (!isAdminUser && !isAgentUser)) {
      setLocation('/');
    }
  }, [isLoadingUser, currentUser, setLocation]);

  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [changePasswordUser, setChangePasswordUser] = useState<{ id: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null);
  const [viewingTask, setViewingTask] = useState<TaskWithCandidates | null>(null);
  const [isEditingTaskContent, setIsEditingTaskContent] = useState(false);
  const [taskEditForm, setTaskEditForm] = useState({ title: '', description: '', comment: '' });
  const [showCreateTutorModal, setShowCreateTutorModal] = useState(false);
  const [repairTutorId, setRepairTutorId] = useState<string | null>(null);
  const [repairEmail, setRepairEmail] = useState('');
  const [repairedTutorIds, setRepairedTutorIds] = useState<Set<string>>(new Set());
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [newCourseForm, setNewCourseForm] = useState({ name: '' });
  const [editingCourse, setEditingCourse] = useState<{ id: string; name: string } | null>(null);
  const [showCreateAreaModal, setShowCreateAreaModal] = useState(false);
  const [newAreaForm, setNewAreaForm] = useState({ name: '', category: '', description: '' });
  const [showCreateServiceModal, setShowCreateServiceModal] = useState(false);
  const [newServiceForm, setNewServiceForm] = useState({ name: '' });
  const [editingService, setEditingService] = useState<{ id: string; name: string } | null>(null);
  const [editingArea, setEditingArea] = useState<{ id: string; name: string; category: string } | null>(null);
  const [showCreateCountryModal, setShowCreateCountryModal] = useState(false);
  const [newCountryForm, setNewCountryForm] = useState({ code: '', name: '', phoneCode: '' });
  const [editingCountry, setEditingCountry] = useState<{ id: string; code: string; name: string; phoneCode: string } | null>(null);
  const [showCreateBankAccountModal, setShowCreateBankAccountModal] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<any | null>(null);
  const [newBankAccountForm, setNewBankAccountForm] = useState({ 
    countryCode: 'PE', 
    bankName: '', 
    accountHolder: '', 
    accountNumber: '', 
    accountType: 'ahorro', 
    currency: 'PEN' 
  });
  const [showCreateCountrySettingModal, setShowCreateCountrySettingModal] = useState(false);
  const [editingCountrySetting, setEditingCountrySetting] = useState<CountrySettings | null>(null);
  const [newCountrySettingForm, setNewCountrySettingForm] = useState({ 
    countryCode: '', 
    countryName: '', 
    flag: '', 
    currency: '', 
    minBudget: '10' 
  });
  const [showCreateStudentModal, setShowCreateStudentModal] = useState(false);
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any | null>(null);
  const [permissionsAgent, setPermissionsAgent] = useState<any | null>(null);
  const [editingTutor, setEditingTutor] = useState<TutorWithUser | null>(null);
  const resendActivation = useResendActivation();
  const [activityLogUser, setActivityLogUser] = useState<{ id: string; name: string } | null>(null);
  const [taskViewersDialog, setTaskViewersDialog] = useState<{ taskId: string; title: string } | null>(null);
  const [taskCandidatesDialog, setTaskCandidatesDialog] = useState<{
    taskId: string;
    title: string;
    currency: string;
    candidates: Array<{ tutorId: string; tutor: { name: string; avatar: string | null } | null; proposedPrice: string | null; createdAt: string | null }>;
  } | null>(null);
  const [taskChatDialog, setTaskChatDialog] = useState<{ taskId: string; title: string; studentId: string } | null>(null);
  const [republishDialog, setRepublishDialog] = useState<{ taskId: string; title: string } | null>(null);
  // Aviso al poner "Disponible" un pedido cuya fecha límite ya paso (la expiracion automatica lo revertiria)
  const [deadlineWarning, setDeadlineWarning] = useState<{ taskId: string; title: string; deadline: string | Date } | null>(null);
  const [republishDeadline, setRepublishDeadline] = useState('');

  const handleClosePaymentModal = () => {
    setSelectedPayment(null);
  };

  const [showCreatePayment, setShowCreatePayment] = useState(false);
  const [createPaymentForm, setCreatePaymentForm] = useState({ taskId: '', tutorId: '', studentId: '', amount: '', paymentMethod: 'manual', notes: '' });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pages, setPages] = useState({ payments: 1, tasks: 1, tutors: 1, users: 1 });

  const { data: verifications, isLoading: isLoadingVerifications } = useQuery<PaymentVerification[]>({
    queryKey: ["/api/payment-verifications"],
    staleTime: 60 * 1000,
    enabled: activeSection === 'payments' && (currentUser as any)?.userType === 'admin',
  });

  const { data: tasks, isLoading: isLoadingTasks } = useQuery<TaskWithCandidates[]>({
    queryKey: ["/api/tasks"],
    staleTime: 2 * 60 * 1000,
    enabled: activeSection === 'tasks' && (
      (currentUser as any)?.userType === 'admin' ||
      ((currentUser as any)?.agentPermissions || []).includes('view_tasks') ||
      ((currentUser as any)?.agentPermissions || []).includes('manage_candidates') ||
      ((currentUser as any)?.agentPermissions || []).includes('republish_tasks')
    ),
  });

  const { data: exchangeRates } = useExchangeRates();

  const { data: users, isLoading: isLoadingUsers } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
    staleTime: 2 * 60 * 1000,
    enabled: (activeSection === 'users' || activeSection === 'tasks' || activeSection === 'dashboard') && (currentUser as any)?.userType === 'admin',
  });

  const { data: tutors, isLoading: isLoadingTutors } = useQuery<TutorWithUser[]>({
    queryKey: ["/api/admin/tutors"], // lista completa (correo, WhatsApp...): solo admin/agente. /api/tutors es la publica
    staleTime: 2 * 60 * 1000,
    enabled: (activeSection === 'tutors' || activeSection === 'tasks' || activeSection === 'dashboard') && (
      (currentUser as any)?.userType === 'admin' ||
      ((currentUser as any)?.agentPermissions || []).includes('view_tutors') ||
      ((currentUser as any)?.agentPermissions || []).includes('add_tutors')
    ),
  });

  // Entregas por tutor (clave = id de usuario): solo el administrador.
  const { data: deliveryStats } = useQuery<{ tutorId: string; delivered: number; onTimePct: number; late: number; avgHours: number; medianHours: number }[]>({
    queryKey: ["/api/admin/delivery-stats"],
    staleTime: 5 * 60 * 1000,
    enabled: activeSection === 'tutors' && (currentUser as any)?.userType === 'admin',
  });
  // Vistas del perfil de cada tutor en los ultimos 30 dias (clave = id de la tabla tutors).
  const { data: profileViewStats } = useQuery<{ tutorId: string; views: number; viewers: number }[]>({
    queryKey: ["/api/admin/tutor-profile-views"],
    staleTime: 5 * 60 * 1000,
    enabled: activeSection === 'tutors' && (currentUser as any)?.userType === 'admin',
  });
  const profileViewsByTutor = useMemo(() => new Map((profileViewStats ?? []).map((s) => [s.tutorId, s])), [profileViewStats]);
  const deliveryByTutor = useMemo(() => new Map((deliveryStats ?? []).map((s) => [s.tutorId, s])), [deliveryStats]);

  const { data: alerts } = useQuery<AdminAlert[]>({
    queryKey: ["/api/admin-alerts"],
    staleTime: 2 * 60 * 1000,
    enabled: (activeSection === 'dashboard' || activeSection === 'alerts') && (currentUser as any)?.userType === 'admin',
  });

  const { data: filterRules } = useQuery<ContactFilterRule[]>({
    queryKey: ["/api/admin/contact-filter-rules"],
    staleTime: 2 * 60 * 1000,
    enabled: activeSection === 'alerts',
  });

  const [alertsTab, setAlertsTab] = useState<AlertTab>('contact');
  const [newFilterValue, setNewFilterValue] = useState('');
  const [newFilterType, setNewFilterType] = useState<'blacklist' | 'whitelist'>('blacklist');

  const patchAlertMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest('PATCH', `/api/admin-alerts/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin-alerts"] }),
  });

  // Moderacion rapida desde la tarjeta de alerta (el servidor deja la alerta como revisada con su accion).
  const moderationErrorToast = (err: Error) => toast({ title: "No se pudo completar la acción", description: err.message, variant: "destructive" });
  const hideAlertMessageMutation = useMutation({
    mutationFn: (alertId: string) => apiRequest('POST', `/api/admin-alerts/${alertId}/hide-message`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin-alerts"] }); toast({ title: "Mensaje ocultado", description: "Ya no se ve en la conversación." }); },
    onError: moderationErrorToast,
  });
  const warnAlertUserMutation = useMutation({
    mutationFn: (alertId: string) => apiRequest('POST', `/api/admin-alerts/${alertId}/warn`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin-alerts"] }); toast({ title: "Advertencia enviada", description: "El usuario la recibió en su chat." }); },
    onError: moderationErrorToast,
  });
  const suspendAlertUserMutation = useMutation({
    mutationFn: async ({ alertId, userId }: { alertId: string; userId: string }) => {
      await apiRequest('PATCH', `/api/users/${userId}/status`, { status: 'suspended' });
      return await apiRequest('PATCH', `/api/admin-alerts/${alertId}`, { status: 'reviewed', actionTaken: 'suspended' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Cuenta suspendida", description: "Puedes reactivarla desde Usuarios." });
    },
    onError: moderationErrorToast,
  });

  const [scanResult, setScanResult] = useState<{ scanned: number; newAlerts: number } | null>(null);
  const scanExistingTasksMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/scan-existing-tasks'),
    onSuccess: async (res) => {
      const data = await res.json();
      setScanResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin-alerts"] });
    },
  });

  const [messageScanDays, setMessageScanDays] = useState('1');
  const [messageScanResult, setMessageScanResult] = useState<{ scanned: number; newAlerts: number } | null>(null);
  const scanExistingMessagesMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/scan-existing-messages', { days: Number(messageScanDays) }),
    onSuccess: async (res) => {
      const data = await res.json();
      setMessageScanResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin-alerts"] });
    },
  });

  const addFilterRuleMutation = useMutation({
    mutationFn: (body: { type: string; value: string }) =>
      apiRequest('POST', '/api/admin/contact-filter-rules', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contact-filter-rules"] });
      setNewFilterValue('');
    },
  });

  const deleteFilterRuleMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest('DELETE', `/api/admin/contact-filter-rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/contact-filter-rules"] }),
  });

  const { data: specialties, isLoading: isLoadingSpecialties } = useQuery<Career[]>({
    queryKey: ["/api/careers"],
    staleTime: 30 * 60 * 1000,
    enabled: activeSection === 'courses' || activeSection === 'tutors' || activeSection === 'areas',
  });

  const { data: services, isLoading: isLoadingServices } = useQuery<{ id: string; value: string; label: string; isActive: boolean }[]>({
    queryKey: ["/api/request-types"],
    staleTime: 30 * 60 * 1000,
    enabled: activeSection === 'services',
  });

  const { data: profesiones, isLoading: isLoadingProfesiones } = useQuery<{ id: string; value: string; label: string; isActive: boolean }[]>({
    queryKey: ["/api/study-areas"],
    staleTime: 30 * 60 * 1000,
    enabled: activeSection === 'courses' || activeSection === 'areas' || activeSection === 'tutors',
  });

  const { data: countriesList, isLoading: isLoadingCountries } = useQuery<Country[]>({
    queryKey: ["/api/countries"],
    staleTime: 30 * 60 * 1000,
    enabled: !['dashboard', 'tasks', 'services', 'areas', 'courses'].includes(activeSection),
  });

  const { data: bankAccountsList, isLoading: isLoadingBankAccounts } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
    staleTime: 5 * 60 * 1000,
    enabled: activeSection === 'bank_accounts',
  });

  const { data: countrySettingsList, isLoading: isLoadingCountrySettings } = useQuery<CountrySettings[]>({
    queryKey: ["/api/country-settings"],
    staleTime: 5 * 60 * 1000,
    enabled: activeSection === 'min_budgets',
  });

  const isDashboardActive = activeSection === 'dashboard';
  const isPresenceActive = activeSection === 'dashboard' || activeSection === 'tutors' || activeSection === 'users';

  const { data: presenceData } = useQuery<{ onlineUsers: string[]; totalOnline: number }>({
    queryKey: ["/api/debug/presence"],
    staleTime: 30 * 1000,
    refetchInterval: isPresenceActive ? 60000 : false,
    refetchIntervalInBackground: false,
    enabled: isPresenceActive,
  });

  const { data: taskViewerCounts } = useQuery<{ taskId: string; count: number }[]>({
    queryKey: ["/api/tasks/views/counts"],
    staleTime: 2 * 60 * 1000,
    enabled: activeSection === 'tasks',
  });

  const { data: orphanedTutors, refetch: refetchOrphaned } = useQuery<{ id: string; profession: string | null; user_id: string }[]>({
    queryKey: ["/api/admin/orphaned-tutors"],
    staleTime: 2 * 60 * 1000,
    enabled: activeSection === 'tutors',
  });

  const repairTutorMutation = useMutation({
    mutationFn: async ({ tutorId, email }: { tutorId: string; email: string }) => {
      const res = await apiRequest("POST", `/api/admin/repair-tutor/${tutorId}`, { email });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Error al reparar tutor");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      toast({ title: "Tutor reparado", description: "El tutor fue vinculado correctamente." });
      setRepairedTutorIds(prev => new Set(prev).add(variables.tutorId));
      setRepairTutorId(null);
      setRepairEmail('');
      refetchOrphaned();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutors"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Build unified query params string used by both chart and table
  const rangeParams = customRange
    ? `from=${customRange.from}&to=${customRange.to}`
    : `period=${connStatsPeriod}`;

  const { data: connStats, isLoading: isLoadingConnStats } = useQuery<{ date: string; students: number; tutors: number }[]>({
    queryKey: ["/api/admin/connection-stats", rangeParams],
    queryFn: () => fetch(`/api/admin/connection-stats?${rangeParams}`).then(r => r.json()),
    staleTime: 2 * 60 * 1000,
    refetchInterval: isDashboardActive ? 60000 : false,
    enabled: isDashboardActive && (currentUser as any)?.userType === 'admin',
  });

  type VisitDetail = {
    id: number; userId: string; name: string; email: string; avatar: string | null;
    country: string | null; role: string; visitedAt: string; device: string | null;
  };
  const visitDetailsQuery = useQuery<VisitDetail[]>({
    queryKey: ["/api/admin/visit-details", rangeParams],
    queryFn: () => fetch(`/api/admin/visit-details?${rangeParams}`).then(r => r.json()),
    staleTime: 2 * 60 * 1000,
    refetchInterval: isDashboardActive ? 60000 : false,
    enabled: isDashboardActive && (currentUser as any)?.userType === 'admin',
  });

  // Task audit log query — fetches when admin opens a task's detail dialog
  const { data: taskAuditLogs } = useQuery<(TaskAuditLog & { adminName?: string })[]>({
    queryKey: ["/api/tasks", viewingTask?.id, "audit-log"],
    queryFn: () => fetch(`/api/tasks/${viewingTask!.id}/audit-log`).then(r => r.json()),
    staleTime: 2 * 60 * 1000,
    enabled: !!viewingTask,
  });

  // Period picker options
  const periodOptions = [
    { label: "Hoy", value: "today" },
    { label: "Ayer", value: "yesterday" },
    { label: "Últimos 7 días", value: "7d" },
    { label: "Últimos 15 días", value: "15d" },
    { label: "Últimos 30 días", value: "30d" },
    { label: "Últimos 60 días", value: "60d" },
    { label: "Últimos 90 días", value: "90d" },
    { label: "Este mes", value: "thisMonth" },
    { label: "Mes pasado", value: "lastMonth" },
    { label: "Este año", value: "thisYear" },
    { label: "Año pasado", value: "lastYear" },
    { label: "Todo el tiempo", value: "allTime" },
  ];

  const currentPeriodLabel = customRange
    ? `${customRange.from} → ${customRange.to}`
    : (periodOptions.find(o => o.value === connStatsPeriod)?.label ?? connStatsPeriod);

  const uploadProfilePhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("profilePhoto", file);
      const response = await apiRequest("POST", "/api/user/upload-photo", formData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/current"] });
      toast({
        title: "Foto actualizada",
        description: "Tu foto de perfil ha sido cambiada correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo subir la foto.",
        variant: "destructive",
      });
    },
  });

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Solo se permiten archivos de imagen.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "La imagen no puede superar 5MB.",
        variant: "destructive",
      });
      return;
    }

    uploadProfilePhotoMutation.mutate(file);
    event.target.value = '';
  };

  const updateVerificationMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      return await apiRequest("PATCH", `/api/payment-verifications/${id}`, { status, adminNotes: notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-verifications"] });
      toast({ title: "Verificación actualizada", description: "El estado ha sido actualizado" });
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/payment-verifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-verifications"] });
      setDeleteConfirm(null);
      toast({ title: "Pago eliminado", description: "El registro de pago fue eliminado." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar el pago.", variant: "destructive" });
    },
  });

  const createManualPaymentMutation = useMutation({
    mutationFn: async (data: { taskId: string; tutorId: string; studentId: string; amount: string; paymentMethod: string; notes: string }) => {
      return await apiRequest("POST", `/api/payment-verifications`, {
        taskId: data.taskId,
        tutorId: data.tutorId,
        studentId: data.studentId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        receiptUrl: "",
        adminNotes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-verifications"] });
      setShowCreatePayment(false);
      setCreatePaymentForm({ taskId: '', tutorId: '', studentId: '', amount: '', paymentMethod: 'manual', notes: '' });
      toast({ title: "Pago registrado", description: "El pago manual fue registrado correctamente." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo registrar el pago.", variant: "destructive" });
    },
  });

  const updateUserStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      return await apiRequest("PATCH", `/api/users/${userId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Estado actualizado" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutors"] });
      setDeleteConfirm(null);
      toast({ title: "Usuario eliminado" });
    },
    onError: () => {
      setDeleteConfirm(null);
      toast({ title: "Error al eliminar usuario", description: "No se pudo eliminar el usuario. Intenta de nuevo.", variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setDeleteConfirm(null);
      toast({ title: "Pedido eliminado" });
    },
    onError: () => {
      setDeleteConfirm(null);
      toast({ title: "Error al eliminar pedido", description: "No se pudo eliminar el pedido. Intenta de nuevo.", variant: "destructive" });
    },
  });

  const updateTaskContentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { title: string; description: string; comment: string } }) => {
      const res = await apiRequest("PATCH", `/api/tasks/${id}`, data);
      return await res.json();
    },
    onSuccess: (updatedTask: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      if (viewingTask) {
        queryClient.invalidateQueries({ queryKey: ["/api/tasks", viewingTask.id, "audit-log"] });
      }
      const pendingPhoneAlerts = (alerts || []).filter(
        a => a.taskId === variables.id && a.type === 'personal_contact' && a.status === 'pending' && !a.messageId
      );
      for (const alert of pendingPhoneAlerts) {
        patchAlertMutation.mutate({ id: alert.id, status: 'reviewed' });
      }
      setViewingTask((prev) => prev ? { ...prev, ...updatedTask } : prev);
      setIsEditingTaskContent(false);
      toast({ title: "Pedido actualizado" });
    },
    onError: () => {
      toast({ title: "Error al actualizar pedido", description: "No se pudieron guardar los cambios. Intenta de nuevo.", variant: "destructive" });
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/tasks/${id}/status`, { status });
      return await res.json();
    },
    onSuccess: (_updatedTask: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", variables.id, "audit-log"] });
      toast({ title: "Estado actualizado" });
    },
    onError: () => {
      toast({ title: "Error al actualizar estado", description: "No se pudo cambiar el estado. Intenta de nuevo.", variant: "destructive" });
    },
  });

  const deleteTutorMutation = useMutation({
    mutationFn: async (tutorId: string) => {
      return await apiRequest("DELETE", `/api/tutors/${tutorId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDeleteConfirm(null);
      toast({ title: "Tutor eliminado" });
    },
    onError: () => {
      setDeleteConfirm(null);
      toast({ title: "Error al eliminar tutor", description: "No se pudo eliminar el tutor. Intenta de nuevo.", variant: "destructive" });
    },
  });

  const toggleTutorStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: 'active' | 'paused' | 'suspended' }) => {
      return await apiRequest("PATCH", `/api/admin/tutors/${userId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Estado actualizado" });
    },
  });

  const createCourseMutation = useMutation({
    mutationFn: async (data: typeof newCourseForm) => {
      return await apiRequest("POST", "/api/study-areas", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-areas"] });
      setShowCreateCourseModal(false);
      setNewCourseForm({ name: '' });
      toast({ title: "Curso creado exitosamente" });
    },
  });

  const deleteCourseMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/study-areas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-areas"] });
      toast({ title: "Curso eliminado" });
    },
  });

  const updateCourseMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return await apiRequest("PATCH", `/api/study-areas/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-areas"] });
      setEditingCourse(null);
      toast({ title: "Curso actualizado" });
    },
  });

  const createAreaMutation = useMutation({
    mutationFn: async (data: typeof newAreaForm) => {
      return await apiRequest("POST", "/api/careers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/careers"] });
      setShowCreateAreaModal(false);
      setNewAreaForm({ name: '', category: '', description: '' });
      toast({ title: "Carrera creada exitosamente" });
    },
    onError: () => {
      toast({ title: "Ya existe una carrera con ese nombre", variant: "destructive" });
    },
  });

  const deleteAreaMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/careers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/careers"] });
      toast({ title: "Carrera eliminada" });
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: typeof newServiceForm) => {
      return await apiRequest("POST", "/api/request-types", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/request-types"] });
      setShowCreateServiceModal(false);
      setNewServiceForm({ name: '' });
      toast({ title: "Servicio creado exitosamente" });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/request-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/request-types"] });
      toast({ title: "Servicio eliminado" });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return await apiRequest("PATCH", `/api/request-types/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/request-types"] });
      setEditingService(null);
      toast({ title: "Servicio actualizado" });
    },
  });

  const updateAreaMutation = useMutation({
    mutationFn: async ({ id, name, category }: { id: string; name: string; category: string }) => {
      return await apiRequest("PATCH", `/api/careers/${id}`, { name, category });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/careers"] });
      setEditingArea(null);
      toast({ title: "Carrera actualizada" });
    },
  });

  const createCountryMutation = useMutation({
    mutationFn: async (data: typeof newCountryForm) => {
      return await apiRequest("POST", "/api/countries", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/countries"] });
      setShowCreateCountryModal(false);
      setNewCountryForm({ code: '', name: '', phoneCode: '' });
      toast({ title: "País creado exitosamente" });
    },
  });

  const deleteCountryMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/countries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/countries"] });
      toast({ title: "País eliminado" });
    },
  });

  const updateCountryMutation = useMutation({
    mutationFn: async ({ id, code, name, phoneCode }: { id: string; code: string; name: string; phoneCode?: string }) => {
      return await apiRequest("PATCH", `/api/countries/${id}`, { code, name, phoneCode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/countries"] });
      setEditingCountry(null);
      toast({ title: "País actualizado" });
    },
  });

  const createBankAccountMutation = useMutation({
    mutationFn: async (data: typeof newBankAccountForm) => {
      return await apiRequest("POST", "/api/bank-accounts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      setShowCreateBankAccountModal(false);
      setNewBankAccountForm({ countryCode: 'PE', bankName: '', accountHolder: '', accountNumber: '', accountType: 'ahorro', currency: 'PEN' });
      toast({ title: "Cuenta bancaria creada exitosamente" });
    },
  });

  const deleteBankAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/bank-accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Cuenta bancaria eliminada" });
    },
  });

  const toggleBankAccountMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiRequest("PATCH", `/api/bank-accounts/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
    },
  });

  const updateBankAccountMutation = useMutation({
    mutationFn: async (data: { id: string; bankName: string; accountHolder: string; accountNumber: string; accountType: string; currency: string }) => {
      return await apiRequest("PATCH", `/api/bank-accounts/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      setEditingBankAccount(null);
      toast({ title: "Cuenta bancaria actualizada" });
    },
  });

  // Agent permissions mutation (admin only)
  const selectTutorMutation = useMutation({
    mutationFn: async ({ taskId, tutorId }: { taskId: string; tutorId: string }) => {
      return await apiRequest("POST", `/api/admin/tasks/${taskId}/select-tutor`, { tutorId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setTaskCandidatesDialog(null);
      toast({ title: "Tutor asignado correctamente" });
    },
    onError: () => {
      toast({ title: "Error al asignar tutor", variant: "destructive" });
    },
  });

  const rejectCandidateMutation = useMutation({
    mutationFn: async ({ taskId, tutorId }: { taskId: string; tutorId: string }) => {
      return await apiRequest("POST", `/api/admin/tasks/${taskId}/reject-candidate`, { tutorId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setTaskCandidatesDialog(null);
      toast({ title: "Candidato rechazado" });
    },
    onError: () => {
      toast({ title: "Error al rechazar candidato", variant: "destructive" });
    },
  });

  const republishTaskMutation = useMutation({
    mutationFn: async ({ taskId, deadline }: { taskId: string; deadline: string }) => {
      return await apiRequest("POST", `/api/tasks/${taskId}/republish`, { deadline });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setRepublishDialog(null);
      setRepublishDeadline('');
      toast({ title: "Pedido republicado correctamente" });
    },
    onError: () => {
      toast({ title: "Error al republicar el pedido", variant: "destructive" });
    },
  });

  // Country Settings mutations (min budget per country)
  const createCountrySettingMutation = useMutation({
    mutationFn: async (data: { countryCode: string; countryName: string; flag: string; currency: string; minBudget: string }) => {
      return await apiRequest("POST", "/api/country-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/country-settings"] });
      setShowCreateCountrySettingModal(false);
      setNewCountrySettingForm({ countryCode: '', countryName: '', flag: '', currency: '', minBudget: '10' });
      toast({ title: "Configuración de país creada" });
    },
  });

  const updateCountrySettingMutation = useMutation({
    mutationFn: async (data: { id: string; countryCode?: string; countryName?: string; flag?: string; currency?: string; minBudget?: string }) => {
      const { id, ...updateData } = data;
      return await apiRequest("PATCH", `/api/country-settings/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/country-settings"] });
      setEditingCountrySetting(null);
      toast({ title: "Configuración actualizada" });
    },
  });

  const deleteCountrySettingMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/country-settings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/country-settings"] });
      toast({ title: "Configuración eliminada" });
    },
  });

  // CRITICAL: Route protection - redirect non-admin users
  if (isLoadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto text-green-600" />
          <p className="mt-2 text-gray-700">Verificando acceso…</p>
        </div>
      </div>
    );
  }

  const isAdmin = (currentUser as any)?.userType === 'admin';
  const isAgent = (currentUser as any)?.userType === 'agent';
  const agentPerms: string[] = (currentUser as any)?.agentPermissions || [];

  if (!currentUser || (!isAdmin && !isAgent)) {
    // El useEffect de arriba ya dispara la navegacion — esto solo evita
    // renderizar el dashboard mientras tanto.
    return null;
  }

  // Permission-based sidebar for agents
  const visibleSidebarItems = isAdmin ? sidebarItems : sidebarItems.filter(item => {
    if (item.id === 'tasks') return agentPerms.includes('view_tasks') || agentPerms.includes('manage_candidates') || agentPerms.includes('republish_tasks');
    if (item.id === 'tutors') return agentPerms.includes('view_tutors') || agentPerms.includes('add_tutors') || agentPerms.includes('edit_tutors');
    // Agents do not see any other sections
    return false;
  });

  const metrics = {
    totalEarnings: verifications?.filter(v => v.status === 'approved').reduce((sum, v) => sum + parseFloat(v.amount), 0) || 0,
    totalTasks: tasks?.length || 0,
    activeTasks: tasks?.filter(t => t.status === 'active').length || 0,
    completedTasks: tasks?.filter(t => t.status === 'completed').length || 0,
    totalUsers: users?.length || 0,
    totalTutors: tutors?.length || 0,
    totalStudents: (users?.length || 0) - (tutors?.length || 0),
    onlineUsers: presenceData?.totalOnline || 0,
    pendingPayments: verifications?.filter(v => v.status === 'pending').length || 0,
    approvedPayments: verifications?.filter(v => v.status === 'approved').length || 0,
    pendingAlerts: alerts?.filter(a => a.status === 'pending' && a.type === 'personal_contact').length || 0,
  };

  const currentSection = sidebarItems.find(item => item.id === activeSection);

  // Toda navegacion entre secciones actualiza tambien la URL: asi recargar y "atras" conservan la seccion.
  const goToSection = (id: SectionId) => {
    setActiveSection(id);
    setLocation(id === 'dashboard' ? '/dashboard' : `/dashboard/${id}`);
  };

  // Una sola lista para el sidebar de escritorio y el menu movil.
  const navItems: SidebarNavItem[] = visibleSidebarItems.map((item) => ({
    id: item.id,
    label: item.label,
    icon: item.icon,
    isActive: activeSection === item.id,
    onClick: () => goToSection(item.id),
    badge: item.id === 'alerts' && metrics.pendingAlerts > 0
      ? <span className="absolute top-0 right-0 size-presence-sm bg-error rounded-full" data-testid="alerts-badge" />
      : item.id === 'payments' && metrics.pendingPayments > 0
      ? <UnreadBadge size="icon" count={metrics.pendingPayments} srLabel="pagos pendientes" />
      : undefined,
  }));

    const paymentsList = (verifications?.filter(v => {
                        const matchesSearch = v.id.includes(searchTerm) || v.amount.includes(searchTerm);
                        const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
                        return matchesSearch && matchesStatus;
                      })) ?? [];
  const paymentsPage = paginate(paymentsList, pages.payments);

  const tasksList = (tasks?.filter(t => {
                          const matchesSearch = !searchTerm || t.title.toLowerCase().includes(searchTerm.toLowerCase());
                          const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
                          const matchesService = taskServiceFilter === 'all' || t.service === taskServiceFilter;
                          return matchesSearch && matchesStatus && matchesService;
                        })) ?? [];
  const tasksPage = paginate(tasksList, pages.tasks);

  const tutorsList = (tutors?.filter(t => {
                        const matchesSearch = !searchTerm ||
                          t.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.profession?.toLowerCase().includes(searchTerm.toLowerCase());
                        const matchesStatus = tutorStatusFilter === 'all' || t.user?.status === tutorStatusFilter;
                        const matchesProfession = tutorProfessionFilter === 'all' || t.profession === tutorProfessionFilter;
                        const matchesCountry = tutorCountryFilter === 'all' || t.user?.country === tutorCountryFilter;
                        const matchesVerified = tutorVerifiedFilter === 'all' || (tutorVerifiedFilter === 'yes' ? t.isVerified : !t.isVerified);
                        const matchesAccess = tutorAccessFilter === 'all' || (tutorAccessFilter === 'general' ? t.hasGeneralAccess : !t.hasGeneralAccess);
                        const matchesDate = (() => {
                          if (tutorDateFilter === 'all') return true;
                          if (!t.user?.createdAt) return false;
                          const created = new Date(t.user.createdAt).getTime();
                          const now = Date.now();
                          const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[tutorDateFilter] ?? 0;
                          return created >= now - days * 24 * 60 * 60 * 1000;
                        })();
                        return matchesSearch && matchesStatus && matchesProfession && matchesCountry && matchesVerified && matchesAccess && matchesDate;
                      }).sort((a, b) => {
                        if (tutorSortOrder === 'oldest') {
                          return new Date(a.user?.createdAt || 0).getTime() - new Date(b.user?.createdAt || 0).getTime();
                        }
                        if (tutorSortOrder === 'name_asc') return (a.user?.name || '').localeCompare(b.user?.name || '');
                        if (tutorSortOrder === 'name_desc') return (b.user?.name || '').localeCompare(a.user?.name || '');
                        if (tutorSortOrder === 'last_seen') {
                          return new Date(b.user?.lastSeen || 0).getTime() - new Date(a.user?.lastSeen || 0).getTime();
                        }
                        // newest (default)
                        return new Date(b.user?.createdAt || 0).getTime() - new Date(a.user?.createdAt || 0).getTime();
                      })) ?? [];
  const tutorsPage = paginate(tutorsList, pages.tutors);


  const usersList = (users?.filter(u => {
                      const isTutor = tutors?.some(t => t.user_id === u.id);
                      if (isTutor) return false;
                      const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                           u.email.toLowerCase().includes(searchTerm.toLowerCase());
                      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
                      const matchesCountry = countryFilter === 'all' || u.country === countryFilter;
                      const matchesDevice = deviceFilter === 'all' || (u as any).registrationDevice === deviceFilter;
                      return matchesSearch && matchesStatus && matchesCountry && matchesDevice;
                    }).sort((a, b) => {
                      if (sortOrder === 'newest') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                      if (sortOrder === 'oldest') return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                      if (sortOrder === 'name_asc') return a.name.localeCompare(b.name);
                      if (sortOrder === 'name_desc') return b.name.localeCompare(a.name);
                      if (sortOrder === 'last_seen') return new Date(b.lastSeen || 0).getTime() - new Date(a.lastSeen || 0).getTime();
                      return 0;
                    })) ?? [];
  const usersPage = paginate(usersList, pages.users);

  return (
    <div className="h-screen w-full bg-white flex overflow-hidden" data-testid="admin-dashboard">
      {/* Sidebar - Desktop */}
      <SidebarNav
        data-testid="sidebar-desktop"
        profile={
          <AdminProfileMenu
            placement="above"
            isAdmin={isAdmin}
            isUploadingPhoto={uploadProfilePhotoMutation.isPending}
            onPhotoUpload={handlePhotoUpload}
            onSettingsClick={() => goToSection('settings')}
            onLogout={handleLogout}
          />
        }
        items={navItems}
      />

      {/* Mobile Header — mismo componente global que Alumno/Tutor (header.tsx), ver auditoria de unificacion */}
      <Header
        role="admin"
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        pushSupported={pushSupported}
        pushLoading={pushLoading}
        pushSubscribed={pushSubscribed}
        onTogglePush={() => pushSubscribed ? pushUnsubscribe() : pushSubscribe()}
        isAdmin={isAdmin}
        pendingAlertsCount={metrics.pendingAlerts}
        onAlertsClick={() => goToSection('alerts')}
      />

      {/* Mobile Menu Drawer — <Sheet> base (sidebar.tsx/styleguide.tsx),
          con animacion slide-in/out incluida (antes aparecia de golpe). */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-0 flex flex-col gap-0 lg:hidden">
          {/* Perfil arriba, mismo patron que sidebar-nav.tsx:32-34 en
              desktop (ver comentario de admin-profile-menu.tsx: la
              posicion "arriba" ya es la convencion establecida). */}
          <div className="p-4 shrink-0">
            <AdminProfileMenu
              isAdmin={isAdmin}
              isUploadingPhoto={uploadProfilePhotoMutation.isPending}
              onPhotoUpload={handlePhotoUpload}
              onSettingsClick={() => { goToSection('settings'); setMobileMenuOpen(false); }}
              onLogout={() => { handleLogout(); setMobileMenuOpen(false); }}
            />
          </div>
          <nav aria-label="Navegación principal" className="p-4 flex-1 overflow-y-auto flex flex-col gap-2">
            <SidebarNavList
              testIdPrefix="nav-mobile"
              items={navItems.map((item) => ({
                ...item,
                onClick: () => { item.onClick(); setMobileMenuOpen(false); },
              }))}
            />
          </nav>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 lg:pt-0 pt-14">
        {/* Header */}
        <header className="bg-white px-4 lg:px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-heading font-bold text-gray-900" data-testid="text-section-title">{currentSection?.label || 'Dashboard'}</h1>
            </div>
            <div className="hidden lg:flex items-center gap-2">
              {pushSupported && (
                <Button
                  variant="ghost"
                  size="icon-lg"
                  data-testid="button-push-toggle"
                  aria-label={pushSubscribed ? "Desactivar notificaciones push" : "Activar notificaciones push"}
                  aria-pressed={pushSubscribed}
                  onClick={() => pushSubscribed ? pushUnsubscribe() : pushSubscribe()}
                  disabled={pushLoading}
                  title={pushSubscribed ? "Notificaciones push activas — clic para desactivar" : "Activar notificaciones push en este dispositivo"}
                  className={pushSubscribed ? "relative text-green-700" : "relative"}
                >
                  {pushLoading ? (
                    <Spinner size="md" className="block" />
                  ) : pushSubscribed ? (
                    <BellRing className="size-icon-lg" />
                  ) : (
                    <BellOff className="size-icon-lg" />
                  )}
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon-lg"
                  data-testid="button-notifications"
                  aria-label={metrics.pendingAlerts > 0 ? `Alertas (${metrics.pendingAlerts} pendientes)` : "Alertas"}
                  onClick={() => goToSection('alerts')}
                  className="relative"
                >
                  <Bell className="size-icon-lg" />
                  {metrics.pendingAlerts > 0 && (
                    <span className="absolute top-1 right-1 size-dot-sm bg-gray-700 rounded-full" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 px-4 pt-4 lg:px-6 lg:pt-6 overflow-y-auto lg:overflow-hidden flex flex-col min-h-0">
          <QueryErrorBanner />
          {/* No-permissions fallback for agents with zero permissions */}
          {activeSection === 'no-permissions' && (
            <div className="flex flex-col items-center justify-center flex-1 text-center gap-4">
              <div className="text-gray-300 text-5xl">🔒</div>
              <h2 className="text-subheading font-semibold text-gray-700">Sin acceso</h2>
              <p className="text-body text-gray-700 max-w-xs">
                No tienes permisos habilitados. Contacta al administrador para que active tu acceso.
              </p>
            </div>
          )}
          {/* Dashboard Section */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6 flex-1 overflow-y-auto pt-2 pb-6" data-testid="section-dashboard">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard title="En línea" value={metrics.onlineUsers} subtitle={`de ${metrics.totalUsers} usuarios`} testId="metric-online" />
                <MetricCard title="Ingresos" value={formatPrice(Math.round(metrics.totalEarnings), DEFAULT_CURRENCY)} subtitle={`${metrics.approvedPayments} pagos`} testId="metric-earnings" />
                <MetricCard title="Pedidos" value={metrics.totalTasks} subtitle={`${metrics.activeTasks} activos`} testId="metric-tasks" />
                <MetricCard title="Usuarios" value={metrics.totalUsers} subtitle={`${metrics.totalStudents} alumnos · ${metrics.totalTutors} tutores`} testId="metric-users" />
              </div>

              {/* Pedidos recientes */}
              <div className="bg-white rounded-lg border border-field p-6" data-testid="card-recent-tasks">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-subheading font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="size-icon-lg text-gray-700" />
                    Pedidos recientes
                  </h3>
                  <SectionLink
                    onClick={() => goToSection('tasks')}>
                    Ver todos
                  </SectionLink>
                </div>
                {(() => {
                  const recent = [...(tasks || [])].sort((a, b) =>
                    new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
                  ).slice(0, 8);

                  if (recent.length === 0) {
                    return <EmptyState title="Sin pedidos registrados" className="py-6" />;
                  }

                  const statusConfig: Record<string, { label: string; dot: string }> = {
                    active:      { label: "Buscando",    dot: "bg-green-600" },
                    in_progress: { label: "En progreso", dot: "bg-info" },
                    in_review:   { label: "En revisión", dot: "bg-warning" },
                    completed:   { label: "Terminada",   dot: "bg-green-600" },
                    cancelled:   { label: "Cancelada",   dot: "bg-gray-300" },
                    expired:     { label: "Vencida",     dot: "bg-gray-300" },
                  };

                  return (
                    <div className="overflow-x-auto">
                      <AdminTable>
                        <AdminTableHead>
                          <tr>
                            <AdminTh>Título</AdminTh>
                            <AdminTh>Alumno</AdminTh>
                            <AdminTh>Tutor</AdminTh>
                            <AdminTh>Estado</AdminTh>
                            <AdminTh>Publicado</AdminTh>
                          </tr>
                        </AdminTableHead>
                        <AdminTableBody>
                          {recent.map((t) => {
                            const publisher = users?.find(u => u.id === t.userId);
                            const assignedTutor = t.assignedTutorId ? tutors?.find(tt => tt.user_id === t.assignedTutorId) : null;
                            const cfg = statusConfig[t.status] ?? { label: t.status, dot: "bg-gray-300" };
                            return (
                              <AdminTr key={t.id}>
                                <AdminTd className="max-w-truncate-lg">
                                  <Button
                                    variant="ghost"
                                    size="touch"
                                    className="-ml-3 justify-start max-w-full text-gray-900 hover:text-green-600"
                                    title={t.title}
                                    onClick={() => setViewingTask(t)}
                                  >
                                    <span className="truncate text-body font-medium">{t.title}</span>
                                  </Button>
                                </AdminTd>
                                <AdminTd className="text-gray-700 whitespace-nowrap">
                                  {publisher ? `Cliente ${publisher.id.slice(-5)}` : '—'}
                                </AdminTd>
                                <AdminTd className="text-gray-700 whitespace-nowrap">
                                  {assignedTutor ? (assignedTutor as any).name || 'Tutor' : <span className="text-gray-700">—</span>}
                                </AdminTd>
                                <AdminTd className="whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className={`size-typing-dot-md rounded-full ${cfg.dot}`} />
                                    <span className="text-caption text-gray-700">{cfg.label}</span>
                                  </span>
                                </AdminTd>
                                <AdminTd className="text-caption text-gray-700 whitespace-nowrap">
                                  {t.createdAt ? fmtDateTimeShort(t.createdAt) : '—'}
                                </AdminTd>
                              </AdminTr>
                            );
                          })}
                        </AdminTableBody>
                      </AdminTable>
                    </div>
                  );
                })()}
              </div>

              {/* Charts row: Visitas + Pedidos por estado */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Connection Stats Chart */}
              <div className="bg-white rounded-lg border border-field p-6" data-testid="card-connection-stats">
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <h3 className="text-subheading font-semibold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="size-icon-lg text-gray-700" />
                    Visitas / Conexiones
                  </h3>
                  {/* Period picker button */}
                  <div className="relative">
                    <Button variant="outline" size="touch"
                      onClick={() => setShowPeriodPicker(v => !v)} aria-expanded={showPeriodPicker}>
                      <Clock className="size-icon-md text-gray-700" />
                      {currentPeriodLabel}
                      <ChevronUp className={`size-icon-md text-gray-700 transition-transform ${showPeriodPicker ? '' : 'rotate-180'}`} />
                    </Button>

                    {showPeriodPicker && (
                      <div className="absolute right-0 top-full mt-1 z-toast bg-white border border-gray-200 rounded-xl shadow-float p-4 w-80">
                        {/* Quick options grid */}
                        <AdminEyebrowLabel className="mb-2">Opciones rápidas</AdminEyebrowLabel>
                        <div className="grid grid-cols-2 gap-1 mb-4">
                          {periodOptions.map(opt => (
                            <Chip
                              key={opt.value}
                              active={!customRange && connStatsPeriod === opt.value}
                              onClick={() => { setConnStatsPeriod(opt.value); setCustomRange(null); setShowPeriodPicker(false); }}
                              data-testid={`conn-filter-${opt.value}`}
                            >
                              {opt.label}
                            </Chip>
                          ))}
                        </div>
                        {/* Custom range */}
                        <AdminEyebrowLabel className="mb-2">Rango personalizado</AdminEyebrowLabel>
                        <div className="flex items-center gap-2">
                          <Input type="date" max={new Date().toISOString().slice(0,10)}
                            defaultValue={customRange?.from ?? ""}
                            id="custom-from"
                            aria-label="Desde"
                            className="flex-1 min-w-0 px-2"
                          />
                          <span className="text-gray-700 text-caption">→</span>
                          <Input type="date" max={new Date().toISOString().slice(0,10)}
                            defaultValue={customRange?.to ?? ""}
                            id="custom-to"
                            aria-label="Hasta"
                            className="flex-1 min-w-0 px-2"
                          />
                          <Button
                            onClick={() => {
                              const f = (document.getElementById('custom-from') as HTMLInputElement)?.value;
                              const t = (document.getElementById('custom-to') as HTMLInputElement)?.value;
                              if (f && t) { setCustomRange({ from: f, to: t }); setShowPeriodPicker(false); }
                            }}
                          >
                            OK
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Totals + toggles row */}
                <div className="flex flex-wrap gap-3 mb-4">
                  <Chip active={showStudents} onClick={() => setShowStudents(v => !v)}>
                    <span className="size-presence-sm rounded-full bg-green-500 ring-2 ring-white" aria-hidden />
                    Alumnos
                    <span className="font-semibold">{connStats?.reduce((s, r) => s + r.students, 0) ?? 0}</span>
                  </Chip>
                  <Chip active={showTutors} onClick={() => setShowTutors(v => !v)}>
                    <span className="size-presence-sm rounded-full bg-blue-500 ring-2 ring-white" aria-hidden />
                    Tutores
                    <span className="font-semibold">{connStats?.reduce((s, r) => s + r.tutors, 0) ?? 0}</span>
                  </Chip>
                  <span className="text-caption text-gray-700 self-center ml-auto">Clic en el gráfico para filtrar la tabla</span>
                </div>

                {isLoadingConnStats ? (
                  <Skeleton className="h-56 w-full" />
                ) : !Array.isArray(connStats) || connStats.every(r => r.students === 0 && r.tutors === 0) ? (
                  <EmptyState title="Sin conexiones en este período" className="h-56 flex flex-col items-center justify-center py-0" />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart
                      data={connStats.map(row => ({
                        ...row,
                        label: (connStatsPeriod === "today" || connStatsPeriod === "yesterday")
                          ? row.date
                          : fmtDateShort(new Date(row.date + "T12:00:00")),
                      }))}
                      margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                      onClick={(data) => {
                        const d = connStats[Number(data.activeTooltipIndex)]?.date;
                        if (d) {
                          setCustomRange({ from: d, to: d });
                          setShowPeriodPicker(false);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
                      <XAxis
                        dataKey="label"
                        tick={{ style: { fontSize: "var(--text-caption)" }, fill: "var(--gray-700)" }}
                        tickLine={false}
                        axisLine={false}
                        interval={connStats.length > 20 ? Math.floor(connStats.length / 10) : "preserveStartEnd"}
                      />
                      <YAxis
                        tick={{ style: { fontSize: "var(--text-caption)" }, fill: "var(--gray-700)" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: "var(--radius-sm)", border: "none", boxShadow: "var(--shadow-float)", fontSize: "var(--text-caption)" }}
                        formatter={(val, name) => [val, name === "students" ? "Alumnos" : "Tutores"]}
                        labelStyle={{ fontWeight: 600, color: "var(--gray-900)" }}
                      />
                      {showStudents && (
                        <Line
                          type="monotone"
                          dataKey="students"
                          stroke="var(--primary)"
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                          name="students"
                        />
                      )}
                      {showTutors && (
                        <Line
                          type="monotone"
                          dataKey="tutors"
                          stroke="var(--blue-500)"
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: "var(--blue-500)", strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                          name="tutors"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Pedidos por estado — donut */}
              <div className="bg-white rounded-lg border border-field p-6" data-testid="card-tasks-by-status">
                <h3 className="text-subheading font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="size-icon-lg text-gray-700" />
                  Pedidos por estado
                </h3>
                {(() => {
                  const statusConfig = [
                    { label: "Disponibles",    status: "active",           color: "var(--primary)" },
                    { label: "En progreso",    status: "in_progress",      color: "var(--blue-500)" },
                    { label: "Pago pendiente", status: "payment_pending",  color: "var(--yellow-500)"  },
                    { label: "Pago rechazado", status: "payment_rejected", color: "var(--error)"   },
                    { label: "Completados",    status: "completed",        color: "var(--primary-700)" },
                    { label: "Expirados",      status: "expired",          color: "var(--gray-500)"  },
                  ];
                  const allSlices = statusConfig
                    .map(s => ({ ...s, value: tasks?.filter(t => t.status === s.status).length ?? 0 }));
                  const nonZeroSlices = allSlices.filter(s => s.value > 0);
                  const total = tasks?.length ?? 0;
                  if (total === 0) {
                    return <EmptyState title="Sin pedidos registrados" className="h-56 flex flex-col items-center justify-center py-0" />;
                  }
                  return (
                    <>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={nonZeroSlices}
                            cx="50%"
                            cy="50%"
                            innerRadius={65}
                            outerRadius={90}
                            dataKey="value"
                            nameKey="label"
                            strokeWidth={0}
                          >
                            {nonZeroSlices.map((entry) => (
                              <Cell key={entry.status} fill={entry.color} />
                            ))}
                            <PieLabel
                              content={({ viewBox }) => {
                                // recharts 3 pasa el rectangulo del grafico (x, y, width, height): el centro del donut es el centro del rectangulo.
                                const vb = viewBox as { x: number; y: number; width: number; height: number };
                                const cx = vb.x + vb.width / 2;
                                const cy = vb.y + vb.height / 2;
                                return (
                                  <text textAnchor="middle" dominantBaseline="middle">
                                    <tspan x={cx} y={cy - 8} className="font-bold text-heading" style={{ fill: 'var(--gray-900)' }}>{total}</tspan>
                                    <tspan x={cx} y={cy + 14} className="text-caption" style={{ fill: 'var(--gray-700)' }}>pedidos</tspan>
                                  </text>
                                );
                              }}
                              position="center"
                            />
                          </Pie>
                          <Tooltip
                            contentStyle={{ borderRadius: "var(--radius-sm)", border: 'none', boxShadow: "var(--shadow-float)", fontSize: "var(--text-caption)" }}
                            formatter={(val, name) => [val, name]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-1">
                        {allSlices.map((s) => (
                          <div key={s.status} className="flex items-center gap-2 text-caption text-gray-700">
                            <span className="size-presence-sm rounded-full flex-shrink-0" style={{ background: s.color }} />
                            <span className="truncate">{s.label}</span>
                            <span className="ml-auto font-semibold text-gray-900">{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>

              </div>{/* end charts grid */}

              {/* Visit Details Table — synced to chart period above */}
              <div className="bg-white rounded-lg border border-field p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <h3 className="text-subheading font-semibold text-gray-900 flex items-center gap-2">
                    <Activity className="size-icon-lg text-gray-700" />
                    Detalle de visitas
                    <span className="text-caption font-normal text-gray-700 ml-1">— {currentPeriodLabel}</span>
                  </h3>
                  {customRange && (
                    <Button variant="link" size="touch"
                      onClick={() => setCustomRange(null)} className="self-start sm:self-auto">
                      Limpiar rango
                    </Button>
                  )}
                </div>

                {!visitDetailsQuery.isLoading && (!Array.isArray(visitDetailsQuery.data) || visitDetailsQuery.data.length === 0) ? (
                  <EmptyState title="Sin actividad en este período" />
                ) : (
                  <div className="overflow-x-auto overflow-y-auto max-h-table">
                    <AdminTable>
                      <AdminTableHead>
                        <tr>
                          <AdminTh align="center" className="w-8">#</AdminTh>
                          <AdminTh>Usuario</AdminTh>
                          <AdminTh>Rol</AdminTh>
                          <AdminTh>País</AdminTh>
                          <AdminTh>Fecha y hora</AdminTh>
                          <AdminTh>Dispositivo</AdminTh>
                        </tr>
                      </AdminTableHead>
                      <AdminTableBody>
                        {visitDetailsQuery.isLoading ? (
                          <AdminTableSkeletonRows columns={6} />
                        ) : (visitDetailsQuery.data ?? []).map((row, idx) => (
                          <AdminTr key={row.id}>
                            <AdminTd align="center" className="text-caption text-gray-700 font-medium">{idx + 1}</AdminTd>
                            <AdminTd>
                              <div className="flex items-center gap-2">
                                <UserAvatar name={row.name} avatar={row.avatar} size="sm" />
                                <div>
                                  <div className="text-body font-medium text-gray-900">{row.name}</div>
                                  <div className="text-caption text-gray-700">{row.email}</div>
                                </div>
                              </div>
                            </AdminTd>
                            <AdminTd>
                              <Badge
                                variant={row.role === 'agent' || row.role === 'tutor' ? 'neutral' : 'success'}
                              >
                                {row.role === 'tutor' ? 'Tutor' : row.role === 'agent' ? 'Agente' : 'Alumno'}
                              </Badge>
                            </AdminTd>
                            <AdminCountryTd country={row.country} />
                            <AdminTd className="text-gray-700 text-caption whitespace-nowrap">
                              {row.visitedAt ? (() => {
                                const d = new Date(row.visitedAt);
                                return (
                                  <div className="flex flex-col">
                                    <span className="font-medium">{fmtTime12(d, LIMA_TZ)}</span>
                                    <span className="text-gray-700">{fmtDate(d, LIMA_TZ)}</span>
                                  </div>
                                );
                              })() : '—'}
                            </AdminTd>
                            <AdminTd className="text-body text-gray-700 capitalize">{row.device ?? '—'}</AdminTd>
                          </AdminTr>
                        ))}
                      </AdminTableBody>
                    </AdminTable>
                    {!visitDetailsQuery.isLoading && (
                      <p className="text-caption text-gray-700 mt-3 text-right">{visitDetailsQuery.data?.length ?? 0} {pluralizeEs(visitDetailsQuery.data?.length ?? 0, "ingreso")}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg border border-field p-6" data-testid="card-summary">
                  <h3 className="text-subheading font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="size-icon-lg text-gray-700" />
                    Resumen
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2">
                      <span className="text-body text-gray-700">Usuarios en línea</span>
                      <span className="font-medium flex items-center gap-2" data-testid="text-online-users">
                        {metrics.onlineUsers > 0 && <span className="size-dot-sm bg-success rounded-full" />}
                        {metrics.onlineUsers}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-body text-gray-700">Pagos pendientes</span>
                      <span className="font-medium" data-testid="text-pending-payments">{metrics.pendingPayments}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-body text-gray-700">Pedidos activos</span>
                      <span className="font-medium" data-testid="text-active-tasks">{metrics.activeTasks}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-body text-gray-700">Pedidos completados</span>
                      <span className="font-medium" data-testid="text-completed-tasks">{metrics.completedTasks}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-body text-gray-700">Alertas pendientes</span>
                      <span className="font-medium" data-testid="text-alerts">{metrics.pendingAlerts}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-field p-6" data-testid="card-users-online">
                  <h3 className="text-subheading font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Wifi className="size-icon-lg text-gray-700" />
                    Usuarios conectados
                  </h3>
                  <div className="space-y-3">
                    {presenceData?.onlineUsers && presenceData.onlineUsers.length > 0 ? (
                      presenceData.onlineUsers.slice(0, 5).map((userId) => {
                        const user = users?.find(u => u.id === userId);
                        const isTutor = tutors?.some(t => t.user_id === userId);
                        const isAgent = (user as any)?.role === 'agent';
                        return (
                          <div key={userId} className="flex items-center gap-3 py-2" data-testid={`online-user-${userId}`}>
                            <span className="size-dot-sm bg-success rounded-full" />
                            <div className="flex-1 min-w-0">
                              <p className="text-body text-gray-900 truncate">{user?.name || `Usuario ${userId.slice(0, 8)}`}</p>
                              <p className="text-caption text-gray-700">{isAgent ? 'Agente' : isTutor ? 'Tutor' : 'Alumno'}</p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <EmptyState title="Sin usuarios conectados" className="py-4" />
                    )}
                    {presenceData?.onlineUsers && presenceData.onlineUsers.length > 5 && (
                      <p className="text-caption text-gray-700 text-center">+{presenceData.onlineUsers.length - 5} más</p>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-field p-6" data-testid="card-activity">
                  <h3 className="text-subheading font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Activity className="size-icon-lg text-gray-700" />
                    Actividad reciente
                  </h3>
                  <div className="space-y-3">
                    {verifications?.slice(0, 5).map((v) => (
                      <div key={v.id} className="flex items-center gap-3 py-2" data-testid={`activity-item-${v.id}`}>
                        <div className={`size-dot-sm rounded-full ${v.status === 'approved' ? 'bg-success' : 'bg-gray-300'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-body text-gray-900 truncate">Pago {formatPrice(v.amount, (v as any).taskCurrency)}</p>
                          <p className="text-caption text-gray-700">{v.paymentMethod}</p>
                        </div>
                        <AdminStatusBadge status={v.status} testId={`status-${v.id}`} />
                      </div>
                    ))}
                    {(!verifications || verifications.length === 0) && (
                      <EmptyState title="Sin actividad reciente" className="py-4" />
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Payments Section - Card-based responsive layout */}
          {/* Registro de errores del servidor: solo administrador (el API tambien responde 403 al resto) */}
          {activeSection === 'universities' && isAdmin && <UniversitiesSection />}
          {activeSection === 'errors' && isAdmin && <ErrorLogsSection />}
          {activeSection === 'audit' && isAdmin && <AuditLogSection />}

          {activeSection === 'payments' && (
            <AdminSection fill testId="section-payments">
              <AdminToolbar>
                <AdminToolbarRow>
                  <SearchField
                    data-testid="input-search-payments"
                    placeholder="Buscar pagos…"
                    aria-label="Buscar pagos"
                    wrapperClassName="flex-1 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <AdminCreateButton data-testid="button-create-payment" onClick={() => setShowCreatePayment(true)}>
                    Registrar pago
                  </AdminCreateButton>
                </AdminToolbarRow>
                <AdminFilters>
                  <FilterSelect data-testid="select-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">Estado: Todos</option>
                    <option value="pending">Pendientes</option>
                    <option value="approved">Aprobados</option>
                    <option value="rejected">Rechazados</option>
                  </FilterSelect>
                </AdminFilters>
              </AdminToolbar>

              <AdminTableCard fill>
                
                  <AdminTable minWidth={1200} data-testid="table-payments">
                    <AdminTableHead>
                      <tr>
                        <AdminTh>Nº</AdminTh>
                        <AdminTh>Pedido</AdminTh>
                        <AdminTh>Alumno → Tutor</AdminTh>
                        <AdminTh>Método</AdminTh>
                        <AdminTh>Monto</AdminTh>
                        <AdminTh>Enviado</AdminTh>
                        <AdminTh>Verificado</AdminTh>
                        <AdminTh>Estado</AdminTh>
                        <AdminActionsTh />
                      </tr>
                    </AdminTableHead>
                    <AdminTableBody>
                      {isLoadingVerifications ? (
                        <AdminTableSkeletonRows columns={9} />
                      ) : paymentsPage.items.map((v) => (
                        <AdminTr key={v.id} data-testid={`row-payment-${v.id}`}>
                          <AdminTd>
                            <span className="text-caption text-gray-700" data-testid={`text-payment-id-${v.id}`}>Nº{v.id.slice(-6)}</span>
                          </AdminTd>
                          <AdminTd>
                            <div className="text-body text-gray-900 font-medium truncate max-w-truncate-sm" title={(v as any).taskTitle}>
                              {(v as any).taskTitle || '-'}
                            </div>
                            <div className="text-caption text-gray-700">Nº{(v as any).taskNumber}</div>
                          </AdminTd>
                          <AdminTd>
                            <div className="text-body text-gray-700">
                              <span className="font-medium">{(v as any).studentName}</span>
                              <span className="text-gray-700"> → </span>
                              <span className="font-medium">{(v as any).tutorName}</span>
                            </div>
                          </AdminTd>
                          <AdminTd className="text-body text-gray-700 capitalize">{v.paymentMethod}</AdminTd>
                          <AdminTd variant="primary" data-testid={`text-payment-amount-${v.id}`}>{formatPrice(v.amount, (v as any).taskCurrency)}</AdminTd>
                          <AdminTd variant="secondary">
                            {v.createdAt ? (
                              <div>
                                <div>{fmtDate(new Date(v.createdAt), LIMA_TZ)}</div>
                                <div className="text-gray-700">{fmtTime12(new Date(v.createdAt), LIMA_TZ)}</div>
                              </div>
                            ) : '-'}
                          </AdminTd>
                          <AdminTd variant="secondary">
                            {v.verifiedAt ? (
                              <div>
                                <div>{fmtDate(new Date(v.verifiedAt), LIMA_TZ)}</div>
                                <div className="text-gray-700">{fmtTime12(new Date(v.verifiedAt), LIMA_TZ)}</div>
                              </div>
                            ) : <span className="text-gray-700">-</span>}
                          </AdminTd>
                          <AdminTd>
                            <AdminStatusBadge status={v.status} testId={`status-payment-${v.id}`} />
                          </AdminTd>
                          <AdminActionsTd>
                              <AdminRowAction icon={Eye} label="Ver pago"
                                data-testid={`button-view-payment-${v.id}`}
                                onClick={() => setSelectedPayment(v)}
                              />
                              <AdminDeleteButton aria-label="Eliminar pago"
                                data-testid={`button-delete-payment-${v.id}`}
                                onClick={() => setDeleteConfirm({ type: 'payment', id: v.id, name: `Pago #${v.id.slice(-6)}` })}
                              />
                              {v.status === 'pending' && (
                                <>
                                  <AdminRowAction icon={CheckCircle} label="Aprobar pago" tone="success"
                                    data-testid={`button-approve-${v.id}`}
                                    onClick={() => updateVerificationMutation.mutate({ id: v.id, status: 'approved' })}
                                    disabled={updateVerificationMutation.isPending}
                                  />
                                  <AdminRowAction icon={XCircle} label="Rechazar pago" tone="danger"
                                    data-testid={`button-reject-${v.id}`}
                                    onClick={() => updateVerificationMutation.mutate({ id: v.id, status: 'rejected' })}
                                    disabled={updateVerificationMutation.isPending}
                                  />
                                </>
                              )}
                          </AdminActionsTd>
                        </AdminTr>
                      ))}
                    </AdminTableBody>
                  </AdminTable>
                
                {!isLoadingVerifications && verifications?.filter(v => {
                  const matchesSearch = v.id.includes(searchTerm) || v.amount.includes(searchTerm);
                  const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
                  return matchesSearch && matchesStatus;
                }).length === 0 && (
                  <div className="p-8 text-center text-gray-700">
                    No hay pagos que coincidan con la búsqueda
                  </div>
                )}
              </AdminTableCard>
              <AdminPagination {...paymentsPage} onPageChange={(p) => setPages((prev) => ({ ...prev, payments: p }))} />
              {!isLoadingVerifications && (!verifications || verifications.length === 0) && (
                <div className="bg-white rounded-lg border border-field"><EmptyState title="No hay pagos registrados" /></div>
              )}
            </AdminSection>
          )}

          {/* Tasks Section - Table layout */}
          {activeSection === 'tasks' && (
            <AdminSection fill testId="section-tasks">
              <AdminToolbar>
                <AdminToolbarRow>
                  <SearchField
                    data-testid="input-search-tasks"
                    placeholder="Buscar pedidos…"
                    aria-label="Buscar pedidos"
                    wrapperClassName="flex-1 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </AdminToolbarRow>
                <AdminFilters>
                  <FilterSelect data-testid="select-task-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">Estado: Todos</option>
                    <option value="active">Disponibles</option>
                    <option value="in_progress">En progreso</option>
                    <option value="completed">Completados</option>
                    <option value="expired">Expirados</option>
                  </FilterSelect>
                  <FilterSelect data-testid="select-task-service-filter" value={taskServiceFilter} onChange={(e) => setTaskServiceFilter(e.target.value)}>
                    <option value="all">Servicio: Todos</option>
                    {Array.from(new Set(tasks?.map(t => t.service).filter(Boolean))).sort().map(s => (
                      <option key={s} value={s!}>{s}</option>
                    ))}
                  </FilterSelect>
                  {(searchTerm || statusFilter !== 'all' || taskServiceFilter !== 'all') && (
                    <Button variant="outline"
                      onClick={() => { setSearchTerm(''); setStatusFilter('all'); setTaskServiceFilter('all'); }}>
                      Limpiar filtros
                    </Button>
                  )}
                </AdminFilters>
              </AdminToolbar>

              <AdminTableCard fill>
                
                  <AdminTable minWidth={1100} data-testid="table-tasks">
                    <AdminTableHead>
                      <tr>
                        <AdminTh>Nº</AdminTh>
                        <AdminTh>Creado</AdminTh>
                        <AdminTh>Título</AdminTh>
                        <AdminTh>Estado</AdminTh>
                        <AdminTh>Alumno / Tutor</AdminTh>
                        <AdminTh align="center">Vistas</AdminTh>
                        <AdminTh align="center">Candidatos</AdminTh>
                        <AdminTh>Precio</AdminTh>
                        <AdminTh>Fecha límite</AdminTh>
                        <AdminTh>Entregada</AdminTh>
                        <AdminActionsTh />
                      </tr>
                    </AdminTableHead>
                    <AdminTableBody>
                      {isLoadingTasks ? (
                        <AdminTableSkeletonRows columns={11} />
                      ) : (() => {
                        const tasksWithPhoneAlerts = new Set(
                          (alerts || [])
                            .filter(a => a.type === 'personal_contact' && a.status === 'pending' && !a.messageId)
                            .map(a => a.taskId)
                            .filter(Boolean)
                        );
                        return tasksPage.items.map((t) => {
                        const publisher = users?.find(u => u.id === t.userId);
                        // assignedTutorId is the user.id of the tutor, not the tutor profile id
                        const assignedTutor = t.assignedTutorId ? tutors?.find(tu => tu.user?.id === t.assignedTutorId) : null;
                        const hasPhoneAlert = tasksWithPhoneAlerts.has(t.id);
                        return (
                          <AdminTr key={t.id} data-testid={`row-task-${t.id}`}>
                            <AdminTd className="text-body text-gray-700 whitespace-nowrap" data-testid={`text-task-number-${t.id}`}>
                              <TaskNumber taskId={String(t.id)} taskNumber={t.taskNumber} />
                            </AdminTd>
                            <AdminTd className="text-body text-gray-900 whitespace-nowrap">
                              {t.createdAt ? (
                                <div className="flex flex-col">
                                  <span>{fmtDateShort(new Date(t.createdAt), LIMA_TZ)}</span>
                                  <span className="text-caption text-gray-700">{fmtTime12(new Date(t.createdAt), LIMA_TZ)}</span>
                                </div>
                              ) : <span className="text-gray-700">-</span>}
                            </AdminTd>
                            <AdminTd>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="touch"
                                  className="-ml-3 justify-start text-gray-900 hover:text-green-600"
                                  data-testid={`text-task-title-${t.id}`}
                                  onClick={() => setViewingTask(t)}
                                  title={t.title}
                                >
                                  <span className="text-body font-medium">{t.title.length > 40 ? t.title.slice(0, 40) + '…' : t.title}</span>
                                </Button>
                                {hasPhoneAlert && (
                                  <UiTooltip>
                                    <TooltipTrigger asChild>
                                      <button aria-label="Número de teléfono detectado — clic para editar"
                                        onClick={() => {
                                          setViewingTask(t);
                                          setTaskEditForm({
                                            title: t.title || '',
                                            description: (t as any).description || '',
                                            comment: (t as any).comment || '',
                                          });
                                          setIsEditingTaskContent(true);
                                        }}
                                        data-testid={`badge-phone-alert-${t.id}`}
                                        className="flex-shrink-0 text-gray-700 transition-colors"
                                      >
                                        <Phone className="size-icon-md" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Número de teléfono detectado — clic para editar</TooltipContent>
                                  </UiTooltip>
                                )}
                              </div>
                            </AdminTd>
                            <AdminTd className="whitespace-nowrap">
                              <Select
                                value={t.status}
                                disabled={!isAdmin || (updateTaskStatusMutation.isPending && updateTaskStatusMutation.variables?.id === t.id)}
                                onValueChange={(newStatus) => {
                                  if (newStatus === 'active' && new Date(t.deadline).getTime() <= Date.now()) {
                                    setDeadlineWarning({ taskId: t.id, title: t.title, deadline: t.deadline });
                                    return;
                                  }
                                  updateTaskStatusMutation.mutate({ id: t.id, status: newStatus });
                                }}
                              >
                                <SelectTrigger
                                  className="h-auto w-auto border-0 bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:hidden"
                                  data-testid={`select-status-task-${t.id}`}
                                >
                                  <SelectValue>
                                    <AdminStatusBadge status={t.status} testId={`status-task-${t.id}`} />
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {TASK_STATUS_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </AdminTd>
                            <AdminTd className="text-body text-gray-900 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                {publisher ? (
                                  <div className="flex items-center gap-2">
                                    <UserAvatar
                                      name={publisher.name}
                                      avatar={publisher.avatar ? getFileUrl(publisher.avatar) : undefined}
                                      size="2xs"
                                    />
                                    <span className="truncate max-w-truncate-xs">{publisher.name}</span>
                                  </div>
                                ) : <span className="text-gray-700">-</span>}
                                {assignedTutor?.user && (
                                  <div className="flex items-center gap-2">
                                    <UserAvatar
                                      name={assignedTutor.user.name}
                                      avatar={assignedTutor.user.avatar ? getFileUrl(assignedTutor.user.avatar) : undefined}
                                      size="2xs"
                                    />
                                    <span className="truncate max-w-truncate-xs">{assignedTutor.user.name}</span>
                                  </div>
                                )}
                              </div>
                            </AdminTd>
                            <AdminTd align="center" className="whitespace-nowrap">
                              {(() => {
                                const count = taskViewerCounts?.find(c => c.taskId === t.id)?.count ?? 0;
                                return (
                                  <UiTooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="touch"
                                        data-testid={`button-task-views-${t.id}`}
                                        onClick={() => setTaskViewersDialog({ taskId: t.id, title: t.title })}
                                        className="text-gray-900 hover:bg-transparent hover:text-gray-900"
                                      >
                                        <span className="text-body">{count}</span>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Ver quiénes vieron este pedido</TooltipContent>
                                  </UiTooltip>
                                );
                              })()}
                            </AdminTd>
                            <AdminTd align="center" className="whitespace-nowrap">
                              {(() => {
                                const count = t.candidates?.length ?? 0;
                                const canSeeCandidates = isAdmin || agentPerms.includes('manage_candidates');
                                if (!canSeeCandidates) {
                                  return <span className="text-body text-gray-700">{count}</span>;
                                }
                                return (
                                  <UiTooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="touch"
                                        data-testid={`button-task-candidates-${t.id}`}
                                        onClick={() => setTaskCandidatesDialog({
                                          taskId: t.id,
                                          title: t.title,
                                          currency: t.currency || 'PEN',
                                          candidates: (t.candidates || []).map((c: Candidate & { tutor: UserType | null }) => ({
                                            tutorId: c.tutorId,
                                            tutor: c.tutor ? { name: c.tutor.name, avatar: c.tutor.avatar ?? null } : null,
                                            proposedPrice: c.proposedPrice ?? null,
                                            createdAt: c.createdAt ? String(c.createdAt) : null,
                                          }))
                                        })}
                                        className="text-gray-900 hover:bg-transparent hover:text-gray-900"
                                      >
                                        <span className="text-body">{count}</span>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Ver postulantes y precios</TooltipContent>
                                  </UiTooltip>
                                );
                              })()}
                            </AdminTd>
                            <AdminTd className="text-body text-gray-900 whitespace-nowrap">
                              <div className="flex flex-col gap-0.5">
                                <span data-testid={`text-task-budget-${t.id}`}>
                                  {formatPrice(t.budget, t.currency)}
                                  {calcUsdEquivalent(t.budget, t.currency, exchangeRates?.rates) && (
                                    <span className="text-caption text-gray-700 ml-1">≈ {calcUsdEquivalent(t.budget, t.currency, exchangeRates?.rates)} USD</span>
                                  )}
                                </span>
                                {(t as any).currentPrice && (
                                  <span data-testid={`text-task-agreed-price-${t.id}`}>
                                    {formatPrice((t as any).currentPrice, t.currency)}
                                    {calcUsdEquivalent((t as any).currentPrice, t.currency, exchangeRates?.rates) && (
                                      <span className="text-caption text-gray-700 ml-1">≈ {calcUsdEquivalent((t as any).currentPrice, t.currency, exchangeRates?.rates)} USD</span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </AdminTd>
                            <AdminTd className="text-body text-gray-900 whitespace-nowrap">
                              {t.deadline ? (
                                <div>
                                  <span>{fmtDate(new Date(t.deadline), LIMA_TZ)}</span>
                                  {t.status !== 'completed' && t.status !== 'cancelled' && (() => {
                                    const remaining = getTimeRemaining(t.deadline);
                                    if (remaining.isExpired) {
                                      return <span className="block text-caption text-error-fg">Vencido</span>;
                                    }
                                    return <span className="block text-caption text-green-600">{remaining.text}</span>;
                                  })()}
                                </div>
                              ) : '-'}
                            </AdminTd>
                            <AdminTd className="text-body text-gray-900 whitespace-nowrap">
                              {(t as any).deliveredAt ? (
                                <div className="flex flex-col">
                                  <span>{fmtDateShort(new Date((t as any).deliveredAt), LIMA_TZ)}</span>
                                  <span className="text-caption text-gray-700">{fmtTime12(new Date((t as any).deliveredAt), LIMA_TZ)}</span>
                                </div>
                              ) : <span className="text-gray-700">-</span>}
                            </AdminTd>
                            <AdminActionsTd>
                                {(isAdmin || agentPerms.includes('view_tasks')) && (
                                  <AdminRowAction icon={MessageSquare} label="Ver chat"
                                        onClick={() => setTaskChatDialog({ taskId: t.id, title: t.title, studentId: t.userId })}
                                  />
                                )}
                                {t.status === 'expired' && (isAdmin || agentPerms.includes('republish_tasks')) && (
                                  <AdminRowAction icon={RefreshCw} label="Republicar pedido"
                                        onClick={() => { setRepublishDialog({ taskId: t.id, title: t.title }); setRepublishDeadline(''); }}
                                  />
                                )}
                                {isAdmin && (
                                  <AdminDeleteButton aria-label="Eliminar pedido"
                                    data-testid={`button-delete-task-${t.id}`}
                                    onClick={() => setDeleteConfirm({ type: 'task', id: t.id, name: t.title })}
                                  />
                                )}
                            </AdminActionsTd>
                          </AdminTr>
                        );
                        });
                      })()}
                    </AdminTableBody>
                  </AdminTable>
                
                {!isLoadingTasks && (!tasks || tasks.length === 0) && (
                  <EmptyState title="No hay pedidos registrados" />
                )}
              </AdminTableCard>
              <AdminPagination {...tasksPage} onPageChange={(p) => setPages((prev) => ({ ...prev, tasks: p }))} />
            </AdminSection>
          )}

          {/* Tutors Section */}
          {activeSection === 'tutors' && (
            <AdminSection fill testId="section-tutors">
              <AdminToolbar>
                <AdminToolbarRow>
                  <SearchField
                    data-testid="input-search-tutors"
                    placeholder="Buscar tutores…"
                    aria-label="Buscar tutores"
                    wrapperClassName="flex-1 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {(isAdmin || agentPerms.includes('add_tutors')) && (
                    <AdminCreateButton onClick={() => setShowCreateTutorModal(true)}>Nuevo tutor</AdminCreateButton>
                  )}
                </AdminToolbarRow>
                <AdminFilters>
                  <FilterSelect
                    data-testid="select-tutor-status-filter"
                    
                    value={tutorStatusFilter}
                    onChange={(e) => setTutorStatusFilter(e.target.value)}
                  >
                    <option value="all">Estado: Todos</option>
                    <option value="active">Activos</option>
                    <option value="paused">Inactivos</option>
                    <option value="suspended">Suspendidos</option>
                  </FilterSelect>
                  <FilterSelect
                    data-testid="select-tutor-profession-filter"
                    className="max-w-truncate-lg"
                    value={tutorProfessionFilter}
                    onChange={(e) => setTutorProfessionFilter(e.target.value)}
                  >
                    <option value="all">Profesión: Todas</option>
                    {Array.from(new Set(tutors?.map(t => t.profession).filter(Boolean))).sort().map(p => (
                      <option key={p} value={p!}>{p}</option>
                    ))}
                  </FilterSelect>
                  <FilterSelect
                    data-testid="select-tutor-country-filter"
                    
                    value={tutorCountryFilter}
                    onChange={(e) => setTutorCountryFilter(e.target.value)}
                  >
                    <option value="all">País: Todos</option>
                    {Array.from(new Set(tutors?.map(t => t.user?.country).filter(Boolean))).sort().map(c => (
                      <option key={c} value={c!}>{c}</option>
                    ))}
                  </FilterSelect>
                  <FilterSelect
                    
                    value={tutorVerifiedFilter}
                    onChange={(e) => setTutorVerifiedFilter(e.target.value)}
                  >
                    <option value="all">Verificado: Todos</option>
                    <option value="yes">Verificados</option>
                    <option value="no">No verificados</option>
                  </FilterSelect>
                  <FilterSelect
                    
                    value={tutorAccessFilter}
                    onChange={(e) => setTutorAccessFilter(e.target.value)}
                  >
                    <option value="all">Acceso: Todos</option>
                    <option value="general">Acceso general</option>
                    <option value="course">Por curso</option>
                  </FilterSelect>
                  <FilterSelect
                    
                    value={tutorDateFilter}
                    onChange={(e) => setTutorDateFilter(e.target.value)}
                  >
                    <option value="all">Creado: Siempre</option>
                    <option value="7d">Últimos 7 días</option>
                    <option value="30d">Últimos 30 días</option>
                    <option value="90d">Últimos 3 meses</option>
                    <option value="1y">Último año</option>
                  </FilterSelect>
                  <FilterSelect
                    
                    value={tutorSortOrder}
                    onChange={(e) => setTutorSortOrder(e.target.value)}
                  >
                    <option value="newest">Más recientes</option>
                    <option value="oldest">Más antiguos</option>
                    <option value="name_asc">Nombre A-Z</option>
                    <option value="name_desc">Nombre Z-A</option>
                    <option value="last_seen">Última conexión</option>
                  </FilterSelect>
                  {(searchTerm || tutorStatusFilter !== 'all' || tutorProfessionFilter !== 'all' || tutorCountryFilter !== 'all' || tutorVerifiedFilter !== 'all' || tutorAccessFilter !== 'all' || tutorDateFilter !== 'all' || tutorSortOrder !== 'newest') && (
                    <Button variant="outline"
                      onClick={() => { setSearchTerm(''); setTutorStatusFilter('all'); setTutorProfessionFilter('all'); setTutorCountryFilter('all'); setTutorVerifiedFilter('all'); setTutorAccessFilter('all'); setTutorDateFilter('all'); setTutorSortOrder('newest'); }}>
                    Limpiar filtros
                  </Button>
                  )}
                </AdminFilters>
              </AdminToolbar>

              {/* Orphaned Tutors Panel */}
              {orphanedTutors && orphanedTutors.length > 0 && (
                <div className="bg-white rounded-lg border border-field p-6 flex-shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="size-icon-md text-gray-700" />
                    <h3 className="text-subheading font-semibold text-gray-900">
                      Tutores con vínculo roto ({orphanedTutors.length})
                    </h3>
                    <span className="text-caption text-gray-700">— El user_id no coincide con ningún usuario registrado</span>
                  </div>
                  <div className="space-y-2">
                    {orphanedTutors.map((ot) => (
                      <div key={ot.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-md text-body flex-wrap">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-gray-700 text-caption">ID tutor: {ot.id}</span>
                          {ot.profession && (
                            <Badge variant="outline" className="ml-2">{ot.profession}</Badge>
                          )}
                          <span className="ml-2 text-caption text-gray-700">user_id: {ot.user_id}</span>
                        </div>
                        {repairedTutorIds.has(ot.id) ? (
                          <Badge variant="success" className="gap-1">
                            <Check className="size-icon-sm" /> Reparado
                          </Badge>
                        ) : repairTutorId === ot.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="email"
                              placeholder="Correo del usuario…"
                              value={repairEmail}
                              onChange={(e) => setRepairEmail(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && repairEmail.trim()) {
                                  repairTutorMutation.mutate({ tutorId: ot.id, email: repairEmail.trim() });
                                }
                                if (e.key === 'Escape') { setRepairTutorId(null); setRepairEmail(''); }
                              }}
                              className="w-56"
                              autoFocus
                            />
                            <Button
                              size="xs"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              disabled={!repairEmail.trim() || repairTutorMutation.isPending}
                              onClick={() => repairTutorMutation.mutate({ tutorId: ot.id, email: repairEmail.trim() })}
                            >
                              {repairTutorMutation.isPending ? <RefreshCw className="size-icon-sm animate-spin" /> : 'Vincular'}
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              className="text-gray-700"
                              onClick={() => { setRepairTutorId(null); setRepairEmail(''); }}
                            >
                              <X className="size-icon-sm" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="xs"
                            variant="ghost"
                            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
                            onClick={() => { setRepairTutorId(ot.id); setRepairEmail(''); }}
                          >
                            Reparar
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tutors Table */}
              <AdminTableCard fill>
                
                  <AdminTable minWidth={1600}>
                    <AdminTableHead>
                      <tr>
                        <AdminTh>Foto</AdminTh>
                        <AdminTh>Nombre</AdminTh>
                        <AdminTh>Correo</AdminTh>
                        <AdminTh>Teléfono</AdminTh>
                        <AdminTh>País</AdminTh>
                        <AdminTh>Hora local</AdminTh>
                        <AdminTh>Áreas</AdminTh>
                        <AdminTh>Última conexión</AdminTh>
                        <AdminTh>Entregas</AdminTh>
                        <AdminTh>Vistas del perfil (30 d)</AdminTh>
                        <AdminTh>Creado</AdminTh>
                        <AdminTh>Estado</AdminTh>
                        <AdminActionsTh />
                      </tr>
                    </AdminTableHead>
                    <AdminTableBody>
                      {isLoadingTutors ? (
                        <AdminTableSkeletonRows columns={13} />
                      ) : tutorsPage.items.map((tutor) => (
                        <AdminTr key={tutor.id} data-testid={`row-tutor-${tutor.id}`}>
                          <AdminTd>
                            <UserAvatar 
                              name={tutor.user?.name || 'Tutor'} 
                              avatar={tutor.user?.avatar ? getFileUrl(tutor.user.avatar) : undefined}
                              size="sm" 
                            />
                          </AdminTd>
                          <AdminTd>
                            <span className="font-medium text-gray-900">{tutor.user?.name}</span>
                          </AdminTd>
                          <AdminTd variant="secondary">{tutor.user?.email}</AdminTd>
                          <AdminTd variant="secondary">
                            {tutor.user?.whatsapp && <span className="whitespace-nowrap">{tutor.user.whatsapp}</span>}
                          </AdminTd>
                          <AdminCountryTd country={tutor.user?.country} />
                          <AdminTd variant="secondary"><LocalTime country={tutor.user?.country} /></AdminTd>
                          <AdminTd>
                            {tutor.profession ? (
                              <Badge variant="outline" className="whitespace-nowrap">
                                {tutor.profession}
                              </Badge>
                            ) : (
                              <span className="text-caption text-gray-700">-</span>
                            )}
                          </AdminTd>
                          <AdminTd variant="secondary">
                            {(() => {
                              const isOnline = presenceData?.onlineUsers?.includes(tutor.user?.id || '');
                              if (isOnline) {
                                return <span className="text-success-fg font-medium">En línea</span>;
                              }
                              if (!tutor.user?.lastSeen) return <span className="text-gray-700">-</span>;
                              return (
                                <span title={fmtDateTime(tutor.user.lastSeen)}>
                                  {fmtRelative(new Date(tutor.user.lastSeen))}
                                </span>
                              );
                            })()}
                          </AdminTd>
                          <AdminTd variant="secondary">
                            {(() => {
                              const s = tutor.user?.id ? deliveryByTutor.get(tutor.user.id) : undefined;
                              if (!s) return <span className="text-gray-700">-</span>;
                              return (
                                <div className="flex flex-col whitespace-nowrap" title={`${s.late} con atraso · mediana ${s.medianHours} h`}>
                                  <span className="font-medium text-gray-900">{s.delivered} · {s.onTimePct}% a tiempo</span>
                                  <span className="text-caption text-gray-700">{s.avgHours} h en promedio</span>
                                </div>
                              );
                            })()}
                          </AdminTd>
                          <AdminTd variant="secondary">
                            {(() => {
                              const v = profileViewsByTutor.get(tutor.id);
                              if (!v) return <span className="text-gray-700">-</span>;
                              return (
                                <div className="flex flex-col whitespace-nowrap">
                                  <span className="font-medium text-gray-900">{v.views} {pluralizeEs(v.views, "vista")}</span>
                                  <span className="text-caption text-gray-700">{v.viewers} {pluralizeEs(v.viewers, "persona")}</span>
                                </div>
                              );
                            })()}
                          </AdminTd>
                          <AdminTd className="text-body text-gray-700">
                            {tutor.user?.createdAt ? (
                              <div className="flex flex-col">
                                <span>{fmtDate(tutor.user.createdAt, LIMA_TZ)}</span>
                                <span className="text-caption text-gray-700">{fmtTime12(new Date(tutor.user.createdAt), LIMA_TZ)}</span>
                              </div>
                            ) : '-'}
                          </AdminTd>
                          <AdminTd>
                            <AdminStatusBadge account status={tutor.user?.status || 'paused'} />
                          </AdminTd>
                          <AdminActionsTd>
                              {isAdmin && (
                                <>
                              {(tutor as AdminTutor).activationPending && (
                                <AdminRowAction icon={Mail} label="Reenviar invitación" tooltip="Reenviar invitación (pendiente de activación)"
                                      disabled={resendActivation.isPending}
                                      onClick={() => resendActivation.mutate(tutor.id)}
                                />
                              )}
                              {isSuperAdmin(currentUser?.email) && tutor.user?.id && (
                                <AdminRowAction icon={Eye} label={`Ver como ${tutor.user.name || 'tutor'}`} tooltip="Ver como este tutor"
                                      data-testid={`button-impersonate-tutor-${tutor.id}`}
                                      onClick={() => setImpersonateTarget({ id: tutor.user!.id, name: tutor.user!.name || 'este tutor' })}
                                />
                              )}
                              <AdminRowAction icon={Key} label="Cambiar contraseña"
                                    onClick={() => {
                                      if (tutor.user?.id) {
                                        setChangePasswordUser({ id: tutor.user.id, name: tutor.user.name || 'Tutor' });
                                        setNewPassword('');
                                      }
                                    }}
                              />
                              {(isAdmin || agentPerms.includes('edit_tutors')) && (
                                <AdminRowAction icon={Pencil} label="Editar tutor"
                                      onClick={() => setEditingTutor(tutor)}
                                />
                              )}
                              <AdminDeleteButton aria-label="Eliminar tutor"
                                onClick={() => setDeleteConfirm({ type: 'tutor', id: tutor.id, name: tutor.user?.name || 'Tutor' })}
                              />
                                </>
                              )}
                          </AdminActionsTd>
                        </AdminTr>
                      ))}
                    </AdminTableBody>
                  </AdminTable>
                
                {!isLoadingTutors && (!tutors || tutors.length === 0) && (
                  <EmptyState title="No hay tutores registrados" />
                )}
              </AdminTableCard>
              <AdminPagination {...tutorsPage} onPageChange={(p) => setPages((prev) => ({ ...prev, tutors: p }))} />
            </AdminSection>
          )}

          {/* Students Section - Table layout */}
          {activeSection === 'users' && (
            <AdminSection fill testId="section-users">
              <AdminToolbar>
                <AdminToolbarRow>
                  <SearchField
                    data-testid="input-search-users"
                    placeholder="Buscar por nombre o email…"
                    aria-label="Buscar por nombre o email"
                    wrapperClassName="flex-1 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <AdminCreateButton data-testid="button-create-student" onClick={() => setShowCreateStudentModal(true)}>Nuevo estudiante</AdminCreateButton>
                </AdminToolbarRow>
                <AdminFilters>
                  <FilterSelect
                    data-testid="select-user-status-filter"
                    
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">Estado: Todos</option>
                    <option value="active">Activos</option>
                    <option value="paused">Inactivos</option>
                    <option value="suspended">Suspendidos</option>
                  </FilterSelect>
                  <FilterSelect
                    
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                  >
                    <option value="all">País: Todos</option>
                    {(() => {
                      const studentUsers = users?.filter(u => !tutors?.some(t => t.user_id === u.id)) || [];
                      const countries = Array.from(new Set(studentUsers.map(u => u.country).filter(Boolean))).sort();
                      return countries.map(c => <option key={c} value={c!}>{c}</option>);
                    })()}
                  </FilterSelect>
                  <FilterSelect
                    
                    value={deviceFilter}
                    onChange={(e) => setDeviceFilter(e.target.value)}
                  >
                    <option value="all">Dispositivo: Todos</option>
                    <option value="mobile">Mobile</option>
                    <option value="desktop">Desktop</option>
                    <option value="tablet">Tablet</option>
                  </FilterSelect>
                  <FilterSelect
                    
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                  >
                    <option value="newest">Más recientes</option>
                    <option value="oldest">Más antiguos</option>
                    <option value="name_asc">Nombre A-Z</option>
                    <option value="name_desc">Nombre Z-A</option>
                    <option value="last_seen">Última conexión</option>
                  </FilterSelect>
                </AdminFilters>
              </AdminToolbar>

              <AdminTableCard fill>
                
                <AdminTable minWidth={1200} data-testid="table-users">
                  <AdminTableHead>
                    <tr>
                      <AdminTh>Estudiante</AdminTh>
                      <AdminTh>Alias (Tutores)</AdminTh>
                      <AdminTh>Email</AdminTh>
                      <AdminTh>País</AdminTh>
                      <AdminTh>Dispositivo</AdminTh>
                      <AdminTh>Ubicación</AdminTh>
                      <AdminTh>Contacto</AdminTh>
                      <AdminTh>Última conexión</AdminTh>
                      <AdminTh>Creado</AdminTh>
                      <AdminTh>Estado</AdminTh>
                      <AdminActionsTh />
                    </tr>
                  </AdminTableHead>
                  <AdminTableBody>
                    {isLoadingUsers ? (
                      <AdminTableSkeletonRows columns={11} />
                    ) : usersPage.items.map((user) => {
                      const isOnline = presenceData?.onlineUsers?.includes(user.id);
                      return (
                        <AdminTr key={user.id} data-testid={`row-user-${user.id}`}>
                          <AdminTd>
                            <div className="flex items-center gap-3">
                              <UserAvatar 
                                name={user.name} 
                                avatar={user.avatar ? getFileUrl(user.avatar) : undefined}
                                size="sm" 
                              />
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-gray-900 text-body" data-testid={`text-user-name-${user.id}`}>{user.name}</span>
                                {(user as any).role === 'agent' && (
                                  <Badge variant="neutral">Agente</Badge>
                                )}
                              </div>
                            </div>
                          </AdminTd>
                          <AdminTd variant="secondary">
                            {generateStudentAlias(user.id)}
                          </AdminTd>
                          <AdminTd variant="secondary">{user.email}</AdminTd>
                          <AdminCountryTd country={user.country} />
                          <AdminTd variant="secondary">
                            {(user as any).registrationDevice ? (
                              <div className="flex flex-col">
                                <span className="capitalize">{(user as any).registrationDevice}</span>
                                <span className="text-caption text-gray-700">
                                  {(user as any).registrationOS || ''} {(user as any).registrationBrowser ? `· ${(user as any).registrationBrowser}` : ''}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-700">-</span>
                            )}
                          </AdminTd>
                          <AdminTd variant="secondary">
                            {(user as any).registrationCity || (user as any).registrationCountry ? (
                              <div className="flex flex-col">
                                <span>{(user as any).registrationCity || '-'}</span>
                                <span className="text-caption text-gray-700">{(user as any).registrationCountry || ''}</span>
                              </div>
                            ) : (
                              <span className="text-gray-700">-</span>
                            )}
                          </AdminTd>
                          <AdminTd variant="secondary">
                            {user.whatsapp || <span className="text-gray-700">-</span>}
                          </AdminTd>
                          <AdminTd variant="secondary">
                            {isOnline ? (
                              <span className="text-success-fg font-medium">En línea</span>
                            ) : user.lastSeen ? (
                              <span title={fmtDateTime(user.lastSeen)}>
                                {fmtRelative(new Date(user.lastSeen))}
                              </span>
                            ) : (
                              <span className="text-gray-700">-</span>
                            )}
                          </AdminTd>
                          <AdminTd variant="secondary">
                            {user.createdAt ? (
                              <div className="flex flex-col">
                                <span>{fmtDate(user.createdAt)}</span>
                                <span className="text-caption text-gray-700">{fmtTime12(new Date(user.createdAt), LIMA_TZ)}</span>
                              </div>
                            ) : (
                              <span className="text-gray-700">-</span>
                            )}
                          </AdminTd>
                          <AdminTd>
                            <AdminStatusBadge account status={user.status || 'paused'} />
                          </AdminTd>
                          <AdminActionsTd>
                              {isSuperAdmin(currentUser?.email) && user.email !== currentUser?.email && (
                                <AdminRowAction icon={Eye} label={`Ver como ${user.name}`} tooltip="Ver como este usuario"
                                      data-testid={`button-impersonate-user-${user.id}`}
                                      onClick={() => setImpersonateTarget({ id: user.id, name: user.name })}
                                />
                              )}
                              <AdminRowAction icon={Activity} label="Historial de actividad"
                                    onClick={() => setActivityLogUser({ id: user.id, name: user.name })}
                              />
                              <AdminRowAction icon={Key} label="Cambiar contraseña"
                                    data-testid={`button-password-user-${user.id}`}
                                    onClick={() => {
                                      setChangePasswordUser({ id: user.id, name: user.name });
                                      setNewPassword('');
                                    }}
                              />
                              <AdminRowAction icon={Pencil} label="Editar usuario"
                                data-testid={`button-edit-user-${user.id}`}
                                onClick={() => setEditingUser(user)}
                              />
                              <AdminDeleteButton aria-label="Eliminar usuario"
                                data-testid={`button-delete-user-${user.id}`}
                                onClick={() => setDeleteConfirm({ type: 'user', id: user.id, name: user.name })}
                              />
                          </AdminActionsTd>
                        </AdminTr>
                      );
                    })}
                  </AdminTableBody>
                </AdminTable>
                
                {!isLoadingUsers && (!users || users.length === 0) && (
                  <EmptyState title="No hay usuarios registrados" />
                )}
              </AdminTableCard>
              <AdminPagination {...usersPage} onPageChange={(p) => setPages((prev) => ({ ...prev, users: p }))} />
            </AdminSection>
          )}

          {/* Agents Section */}
          {activeSection === 'agents' && (
            <AdminSection fill testId="section-agents">
              <AdminSectionHeader
                description="Gestiona los agentes y sus permisos de acceso al dashboard."
                action={<AdminCreateButton onClick={() => setShowCreateAgentModal(true)}>Nuevo agente</AdminCreateButton>}
              />
              <AdminTableCard>
                  <AdminTable>
                    <AdminTableHead>
                      <tr>
                        <AdminTh>Agente</AdminTh>
                        <AdminTh>Correo</AdminTh>
                        <AdminTh>Estado</AdminTh>
                        <AdminTh>Permisos</AdminTh>
                        <AdminActionsTh />
                      </tr>
                    </AdminTableHead>
                    <AdminTableBody>
                      {isLoadingUsers ? (
                        <AdminTableSkeletonRows columns={5} />
                      ) : users?.filter((u: any) => u.role === 'agent').map((agent: any) => {
                        const perms: string[] = agent.agentPermissions || [];
                        const permLabels: Record<string, string> = {
                          view_tasks: 'Ver Pedidos',
                          view_tutors: 'Ver Tutores',
                          add_tutors: 'Agregar Tutores',
                          edit_tutors: 'Editar Tutores',
                        };
                        const activePerms = Object.keys(permLabels).filter(p => perms.includes(p));
                        const isActive = (agent.status || 'active') === 'active';
                        return (
                          <AdminTr key={agent.id}>
                            <AdminTd>
                              <div className="flex items-center gap-2">
                                <UserAvatar name={agent.name} avatar={agent.avatar ? getFileUrl(agent.avatar) : undefined} size="sm" />
                                <span className="text-body font-medium text-gray-900 whitespace-nowrap">{agent.name}</span>
                              </div>
                            </AdminTd>
                            <AdminTd className="text-body text-gray-700">{agent.email}</AdminTd>
                            <AdminTd>
                              <AdminStatusBadge account status={isActive ? 'active' : 'paused'} />
                            </AdminTd>
                            <AdminTd>
                              <div className="flex flex-wrap gap-1">
                                {activePerms.length > 0 ? activePerms.map(p => (
                                  <Badge key={p} variant="outline" className="whitespace-nowrap">{permLabels[p]}</Badge>
                                )) : (
                                  <span className="text-caption text-gray-700">Sin permisos</span>
                                )}
                              </div>
                            </AdminTd>
                            <AdminActionsTd>
                                <AdminRowAction icon={Pencil} label="Editar agente"
                                      onClick={() => {
                                        setEditingAgent(agent);
                                      }}
                                />
                                <AdminDeleteButton aria-label="Eliminar agente"
                                      onClick={() => setDeleteConfirm({ type: 'agent', id: agent.id, name: agent.name })}
                                    />
                            </AdminActionsTd>
                          </AdminTr>
                        );
                      })}
                    </AdminTableBody>
                  </AdminTable>
                </AdminTableCard>
            </AdminSection>
          )}

          {/* Services Section */}
          {activeSection === 'services' && (
            <AdminSection testId="section-services">
              <AdminSectionHeader
                description="Gestiona los servicios disponibles en el formulario de publicación"
                action={<AdminCreateButton onClick={() => setShowCreateServiceModal(true)}>Nuevo servicio</AdminCreateButton>}
              />
              <AdminTableCard>
                  <AdminTable>
                    <AdminTableHead>
                      <tr>
                        <AdminTh>Nombre</AdminTh>
                        <AdminActionsTh />
                      </tr>
                    </AdminTableHead>
                    <AdminTableBody>
                      {isLoadingServices ? (
                        <AdminTableSkeletonRows columns={2} />
                      ) : services?.map((s) => (
                        <AdminTr key={s.id}>
                          <AdminTd variant="primary">{s.label}</AdminTd>
                          <AdminActionsTd>
                            <RowActions entity="servicio" onEdit={() => setEditingService({ id: s.id, name: s.label })} onDelete={() => deleteServiceMutation.mutate(s.id)} deleteDisabled={deleteServiceMutation.isPending} />
                          </AdminActionsTd>
                        </AdminTr>
                      ))}
                    </AdminTableBody>
                  </AdminTable>
                </AdminTableCard>
            </AdminSection>
          )}

          {/* Courses Section */}
          {activeSection === 'courses' && (
            <AdminSection testId="section-courses">
              <AdminSectionHeader
                description="Gestiona los cursos y materias disponibles para los pedidos"
                action={<AdminCreateButton onClick={() => setShowCreateCourseModal(true)}>Nuevo curso</AdminCreateButton>}
              />
              <AdminTableCard>
                  <AdminTable>
                    <AdminTableHead>
                      <tr>
                        <AdminTh>Nombre</AdminTh>
                        <AdminActionsTh />
                      </tr>
                    </AdminTableHead>
                    <AdminTableBody>
                      {isLoadingProfesiones ? (
                        <AdminTableSkeletonRows columns={2} />
                      ) : profesiones?.map((c) => (
                        <AdminTr key={c.id}>
                          <AdminTd variant="primary">{c.label}</AdminTd>
                          <AdminActionsTd>
                            <RowActions entity="curso" onEdit={() => setEditingCourse({ id: c.id, name: c.label })} onDelete={() => deleteCourseMutation.mutate(c.id)} deleteDisabled={deleteCourseMutation.isPending} />
                          </AdminActionsTd>
                        </AdminTr>
                      ))}
                    </AdminTableBody>
                  </AdminTable>
                </AdminTableCard>
            </AdminSection>
          )}

          {/* Areas Section (Carreras profesionales de tutores) */}
          {activeSection === 'areas' && (
            <AdminSection testId="section-areas">
              <AdminSectionHeader
                description="Gestiona las carreras profesionales disponibles para los tutores"
                action={<AdminCreateButton onClick={() => setShowCreateAreaModal(true)}>Nueva carrera</AdminCreateButton>}
              />
              <AdminTableCard>
                  <AdminTable>
                    <AdminTableHead>
                      <tr>
                        <AdminTh>Nombre</AdminTh>
                        <AdminTh align="center">Tutores</AdminTh>
                        <AdminActionsTh />
                      </tr>
                    </AdminTableHead>
                    <AdminTableBody>
                      {isLoadingSpecialties ? (
                        <AdminTableSkeletonRows columns={3} />
                      ) : specialties?.filter(c => c.isActive).map((career) => (
                        <AdminTr key={career.id}>
                          <AdminTd variant="primary">{career.name}</AdminTd>
                          <AdminTd align="center" variant="secondary">{career.tutorCount ?? 0}</AdminTd>
                          <AdminActionsTd>
                            <RowActions entity="área" onEdit={() => setEditingArea({ id: career.id, name: career.name, category: career.category || '' })} onDelete={() => deleteAreaMutation.mutate(career.id)} deleteDisabled={deleteAreaMutation.isPending} />
                          </AdminActionsTd>
                        </AdminTr>
                      ))}
                    </AdminTableBody>
                  </AdminTable>
                </AdminTableCard>
            </AdminSection>
          )}

          {/* Countries Section */}
          {activeSection === 'countries' && (
            <AdminSection testId="section-countries">
              <AdminSectionHeader
                description="Gestiona los países disponibles en la plataforma"
                action={<AdminCreateButton onClick={() => setShowCreateCountryModal(true)}>Nuevo país</AdminCreateButton>}
              />
              <AdminTableCard>
                <AdminTable>
                  <AdminTableHead>
                    <tr>
                      <AdminTh>País</AdminTh>
                      <AdminTh>Código ISO de país</AdminTh>
                      <AdminTh>Prefijo telefónico</AdminTh>
                      <AdminActionsTh />
                    </tr>
                  </AdminTableHead>
                  <AdminTableBody>
                    {isLoadingCountries ? (
                      <AdminTableSkeletonRows columns={4} />
                    ) : countriesList?.map((c) => (
                      <AdminTr key={c.id}>
                        <AdminCountryTd country={c.name} />
                        <AdminTd variant="secondary">{c.code}</AdminTd>
                        <AdminTd variant="secondary">{c.phoneCode || '-'}</AdminTd>
                        <AdminActionsTd>
                          <RowActions entity="país" onEdit={() => setEditingCountry({ id: c.id, code: c.code, name: c.name, phoneCode: c.phoneCode || '' })} onDelete={() => deleteCountryMutation.mutate(c.id)} deleteDisabled={deleteCountryMutation.isPending} />
                        </AdminActionsTd>
                      </AdminTr>
                    ))}
                  </AdminTableBody>
                </AdminTable>
                {!isLoadingCountries && (!countriesList || countriesList.length === 0) && (
                  <EmptyState title="No hay países registrados" />
                )}
                </AdminTableCard>
            </AdminSection>
          )}

          {/* Bank Accounts Section */}
          {activeSection === 'bank_accounts' && (
            <AdminSection testId="section-bank-accounts">
              <AdminSectionHeader
                description="Gestiona las cuentas bancarias por país para recibir pagos"
                action={<AdminCreateButton onClick={() => setShowCreateBankAccountModal(true)}>Nueva cuenta</AdminCreateButton>}
              />
              <AdminTableCard>
                <AdminTable>
                  <AdminTableHead>
                    <tr>
                      <AdminTh>País</AdminTh>
                      <AdminTh>Banco</AdminTh>
                      <AdminTh>Titular</AdminTh>
                      <AdminTh>Número</AdminTh>
                      <AdminTh>Tipo</AdminTh>
                      <AdminTh>Código ISO de divisa</AdminTh>
                      <AdminTh>Estado</AdminTh>
                      <AdminActionsTh />
                    </tr>
                  </AdminTableHead>
                  <AdminTableBody>
                    {isLoadingBankAccounts ? (
                      <AdminTableSkeletonRows columns={8} />
                    ) : bankAccountsList?.map((account) => {
                      return (
                        <AdminTr key={account.id}>
                          <AdminCountryTd country={account.countryCode} />
                          <AdminTd variant="primary">{account.bankName}</AdminTd>
                          <AdminTd variant="secondary">{account.accountHolder}</AdminTd>
                          <AdminTd variant="secondary">{account.accountNumber}</AdminTd>
                          <AdminTd className="text-body text-gray-700 capitalize">{account.accountType}</AdminTd>
                          <AdminTd variant="secondary">{account.currency}</AdminTd>
                          <AdminTd>
                            <ToggleSwitch
                              checked={account.isActive ?? false}
                              onChange={() => toggleBankAccountMutation.mutate({ id: account.id, isActive: !(account.isActive ?? false) })}
                            />
                          </AdminTd>
                          <AdminActionsTd>
                            <RowActions entity="cuenta bancaria" onEdit={() => setEditingBankAccount(account)} onDelete={() => deleteBankAccountMutation.mutate(account.id)} deleteDisabled={deleteBankAccountMutation.isPending} />
                          </AdminActionsTd>
                        </AdminTr>
                      );
                    })}
                  </AdminTableBody>
                </AdminTable>
                {!isLoadingBankAccounts && (!bankAccountsList || bankAccountsList.length === 0) && (
                  <EmptyState title="No hay cuentas bancarias registradas" />
                )}
                </AdminTableCard>
            </AdminSection>
          )}

          {/* Min Budgets Section */}
          {activeSection === 'min_budgets' && (
            <AdminSection testId="section-min-budgets">
              <AdminSectionHeader
                description="Configura el presupuesto mínimo por país para publicar pedidos"
                action={
                  <AdminCreateButton
                    onClick={() => {
                    setNewCountrySettingForm({ countryCode: '', countryName: '', flag: '', currency: '', minBudget: '10' });
                    setShowCreateCountrySettingModal(true);
                  }}
                  >
                    Nuevo país
                  </AdminCreateButton>
                }
              />
              <AdminTableCard>
                <AdminTable>
                  <AdminTableHead>
                    <tr>
                      <AdminTh>País</AdminTh>
                      <AdminTh>Código ISO de país</AdminTh>
                      <AdminTh>Código ISO de divisa</AdminTh>
                      <AdminTh>Presupuesto Mínimo</AdminTh>
                      <AdminActionsTh />
                    </tr>
                  </AdminTableHead>
                  <AdminTableBody>
                    {isLoadingCountrySettings ? (
                      <AdminTableSkeletonRows columns={5} />
                    ) : countrySettingsList?.map((setting) => (
                      <AdminTr key={setting.id}>
                        <AdminCountryTd country={setting.countryName} />
                        <AdminTd variant="secondary">{setting.countryCode}</AdminTd>
                        <AdminTd variant="secondary">{setting.currency}</AdminTd>
                        <AdminTd variant="secondary">{setting.currency} {setting.minBudget}</AdminTd>
                        <AdminActionsTd>
                          <RowActions entity="presupuesto mínimo" onEdit={() => setEditingCountrySetting(setting)} onDelete={() => deleteCountrySettingMutation.mutate(setting.id)} deleteDisabled={deleteCountrySettingMutation.isPending} />
                        </AdminActionsTd>
                      </AdminTr>
                    ))}
                  </AdminTableBody>
                </AdminTable>
                {!isLoadingCountrySettings && (!countrySettingsList || countrySettingsList.length === 0) && (
                  <EmptyState title="No hay configuraciones de países registradas" />
                )}
                </AdminTableCard>
            </AdminSection>
          )}

          {/* Alerts Section */}
          {activeSection === 'alerts' && (
            <div className="space-y-section-gap flex-1 overflow-y-auto pb-6" data-testid="section-alerts">
              {/* Tab bar */}
              <Tabs value={alertsTab} onValueChange={(v) => setAlertsTab(v as AlertTab)}>
                <TabsList className="h-auto w-full justify-start gap-1 rounded-xl bg-white p-1">
                  {ALERT_TABS.map(tab => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="relative flex-1 rounded-md py-2 text-body text-gray-700 data-[state=active]:bg-gray-100 data-[state=active]:text-gray-900 data-[state=active]:shadow-none"
                    >
                      {tab.label}
                      {tab.value === 'contact' && <UnreadBadge count={metrics.pendingAlerts} size="icon" />}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {/* ── Contacto privado tab ── */}
              {alertsTab === 'contact' && (() => {
                const contactAlerts = (alerts as EnrichedAlert[] | undefined)?.filter(a => a.type === 'personal_contact') ?? [];
                const pending = contactAlerts.filter(a => a.status === 'pending');
                const reviewed = contactAlerts.filter(a => a.status !== 'pending');
                const card = (a: EnrichedAlert) => (
                  <AlertCard
                    key={a.id}
                    alert={a}
                    disabled={patchAlertMutation.isPending || hideAlertMessageMutation.isPending || warnAlertUserMutation.isPending || suspendAlertUserMutation.isPending}
                    onReview={(id) => patchAlertMutation.mutate({ id, status: 'reviewed' })}
                    onDismiss={(id) => patchAlertMutation.mutate({ id, status: 'dismissed' })}
                    onHideMessage={(al) => hideAlertMessageMutation.mutate(al.id)}
                    onWarn={(al) => warnAlertUserMutation.mutate(al.id)}
                    onSuspend={(al) => al.offenderId && suspendAlertUserMutation.mutate({ alertId: al.id, userId: al.offenderId })}
                  />
                );
                return (
                  <div className="space-y-card-gap">
                    <ScanRow
                      title="Escanear pedidos existentes"
                      description="Analiza todos los pedidos activos y genera alertas retroactivas si contienen contacto privado."
                      noun="pedidos"
                      result={scanResult}
                      isPending={scanExistingTasksMutation.isPending}
                      buttonLabel="Escanear pedidos"
                      onScan={() => scanExistingTasksMutation.mutate()}
                    />
                    <ScanRow
                      title="Reescanear mensajes de chat"
                      description="Revisa mensajes ya enviados con las reglas actuales (útil tras agregar una regla nueva)."
                      noun="mensajes"
                      result={messageScanResult}
                      isPending={scanExistingMessagesMutation.isPending}
                      buttonLabel="Reescanear mensajes"
                      onScan={() => scanExistingMessagesMutation.mutate()}
                    >
                      <EnumSelect options={ALERT_SCAN_RANGES} value={messageScanDays} onValueChange={setMessageScanDays} className="sm:w-control-sm" />
                    </ScanRow>
                    {pending.length > 0 && (
                      <>
                        <AdminEyebrowLabel className="px-1">Pendientes ({pending.length})</AdminEyebrowLabel>
                        {pending.map(card)}
                      </>
                    )}
                    {reviewed.length > 0 && (
                      <>
                        <AdminEyebrowLabel className="px-1 mt-section-gap">Revisadas ({reviewed.length})</AdminEyebrowLabel>
                        {reviewed.map(card)}
                      </>
                    )}
                    {contactAlerts.length === 0 && (
                      <div className="bg-white rounded-lg border border-field"><EmptyState title="No hay alertas de contacto privado" /></div>
                    )}
                  </div>
                );
              })()}

              {/* ── Generales tab ── */}
              {alertsTab === 'general' && (() => {
                const general = (alerts as EnrichedAlert[] | undefined)?.filter(a => a.type !== 'personal_contact') ?? [];
                return (
                  <div className="space-y-card-gap">
                    {general.map(a => <GeneralAlertCard key={a.id} alert={a} />)}
                    {general.length === 0 && (
                      <div className="bg-white rounded-lg border border-field"><EmptyState title="No hay alertas generales" /></div>
                    )}
                  </div>
                );
              })()}

              {/* ── Filtros tab ── */}
              {alertsTab === 'filters' && (
                <div className="space-y-section-gap">
                  {/* Add new rule */}
                  <div className="bg-white rounded-lg border border-field p-6">
                    <h3 className="text-subheading font-semibold text-gray-900 mb-3">Agregar regla</h3>
                    <div className="flex gap-2 items-end flex-wrap">
                      <div className="flex-1 min-w-control-sm">
                        <OutlinedControl htmlFor="filter-rule-value" label="Palabra o número">
                          <Input id="filter-rule-value"
                            placeholder="ej: wsp, 987654321"
                            value={newFilterValue}
                            onChange={e => setNewFilterValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && newFilterValue.trim()) {
                                addFilterRuleMutation.mutate({ type: newFilterType, value: newFilterValue.trim() });
                              }
                            }}
                          />
                        </OutlinedControl>
                      </div>
                      <div>
                        <OutlinedControl htmlFor="filter-rule-type" label="Tipo">
                          <EnumSelect id="filter-rule-type" options={FILTER_RULE_TYPES} value={newFilterType} onValueChange={(v) => setNewFilterType(v as 'blacklist' | 'whitelist')} className="w-control-sm" />
                        </OutlinedControl>
                      </div>
                      <Button
                        size="sm"
                        disabled={!newFilterValue.trim() || addFilterRuleMutation.isPending}
                        onClick={() => addFilterRuleMutation.mutate({ type: newFilterType, value: newFilterValue.trim() })}
                      >
                        <Plus className="size-icon-md" /> Agregar
                      </Button>
                    </div>
                  </div>

                  {/* Blacklist */}
                  <div className="bg-white rounded-lg border border-field p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="size-icon-sm rounded-full bg-error" />
                      <h3 className="text-subheading font-semibold text-gray-900">Lista negra</h3>
                      <span className="text-caption text-gray-700">(disparan alerta)</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {filterRules?.filter(r => r.type === 'blacklist').map(rule => (
                        <Badge key={rule.id} variant="outline" className="gap-1 border-error text-error-fg">
                          {rule.value}
                          <Button variant="ghost" size="icon-sm"
                            aria-label={`Quitar ${rule.value}`}
                            className="-my-2 -mr-2"
                            onClick={() => deleteFilterRuleMutation.mutate(rule.id)}
                            disabled={deleteFilterRuleMutation.isPending}
                          >
                            <X className="size-icon-sm" />
                          </Button>
                        </Badge>
                      ))}
                      {(!filterRules || filterRules.filter(r => r.type === 'blacklist').length === 0) && (
                        <p className="text-body text-gray-700">Sin reglas en lista negra</p>
                      )}
                    </div>
                  </div>

                  {/* Whitelist */}
                  <div className="bg-white rounded-lg border border-field p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="size-icon-sm rounded-full bg-green-600" />
                      <h3 className="text-subheading font-semibold text-gray-900">Lista blanca</h3>
                      <span className="text-caption text-gray-700">(nunca generan alerta)</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {filterRules?.filter(r => r.type === 'whitelist').map(rule => (
                        <Badge key={rule.id} variant="outline" className="gap-1 border-green-600 text-green-700">
                          {rule.value}
                          {rule.description && <span>({rule.description})</span>}
                          <Button variant="ghost" size="icon-sm"
                            aria-label={`Quitar ${rule.value}`}
                            className="-my-2 -mr-2"
                            onClick={() => deleteFilterRuleMutation.mutate(rule.id)}
                            disabled={deleteFilterRuleMutation.isPending}
                          >
                            <X className="size-icon-sm" />
                          </Button>
                        </Badge>
                      ))}
                      {(!filterRules || filterRules.filter(r => r.type === 'whitelist').length === 0) && (
                        <p className="text-body text-gray-700">Sin reglas en lista blanca</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Settings Section */}
          {activeSection === 'exchange_rates' && (
            <ExchangeRatesSection />
          )}

          {activeSection === 'settings' && (
            <div className="space-y-4" data-testid="section-settings">
              {/* System Settings */}
              <div className="bg-white rounded-lg border border-field p-6">
                <h3 className="text-subheading font-semibold text-gray-900 mb-4">Configuración del sistema</h3>
                <p className="text-gray-700">Próximamente: Configuración de cuentas bancarias, comisiones y más.</p>
              </div>

              {/* Logout Button */}
              <div className="bg-white rounded-lg border border-field p-6">
                <h3 className="text-subheading font-semibold text-gray-900 mb-4">Sesión</h3>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="w-full justify-start text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                >
                  <LogOut className="size-icon-md mr-2" />
                  Cerrar sesión
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Payment Detail Modal */}
      <Dialog open={!!selectedPayment} onOpenChange={handleClosePaymentModal}>
        <DialogContent data-testid="modal-payment-detail">
          <DialogHeader>
            <DialogTitle>Detalle de Pago</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-5 pt-2">
                <OutlinedField label="Pedido">
                  <p className="text-caption text-gray-700 truncate" title={(selectedPayment as any).taskTitle}>
                    <span className="font-medium text-gray-900" data-testid="modal-payment-id">Nº{(selectedPayment as any).taskNumber || selectedPayment.id.slice(-6)}</span>
                    {" "}{(selectedPayment as any).taskTitle || '-'}
                  </p>
                </OutlinedField>
                <OutlinedField label="Monto">
                  <p className="font-medium" data-testid="modal-payment-amount">{formatPrice(selectedPayment.amount, (selectedPayment as any).taskCurrency)}</p>
                </OutlinedField>
                <OutlinedField label="Alumno → Tutor">
                  <p className="text-body font-medium">{(selectedPayment as any).studentName} → {(selectedPayment as any).tutorName}</p>
                </OutlinedField>
                <OutlinedField label="Método">
                  <p className="font-medium capitalize">{selectedPayment.paymentMethod}</p>
                </OutlinedField>
                <OutlinedField label="Estado">
                  <div><AdminStatusBadge status={selectedPayment.status} testId="modal-payment-status" /></div>
                </OutlinedField>
                <OutlinedField label="Fecha">
                  <p className="text-body">{selectedPayment.createdAt ? fmtDate(new Date(selectedPayment.createdAt), LIMA_TZ) : '-'}</p>
                </OutlinedField>
              </div>

              {selectedPayment.receiptUrl && (
                <OutlinedField label="Comprobante" className="text-center">
                    <img 
                      src={getFileUrl(selectedPayment.receiptUrl)}
                      alt="Comprobante"
                      className="max-w-full max-h-64 mx-auto rounded cursor-pointer"
                      data-testid="img-receipt"
                      onClick={() => window.open(getFileUrl(selectedPayment.receiptUrl), '_blank')}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'block';
                      }}
                    />
                    <a 
                      href={getFileUrl(selectedPayment.receiptUrl)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-body text-green-600 hover:underline hidden"
                    >
                      Ver comprobante
                    </a>
                </OutlinedField>
              )}

              <div className="flex gap-2 pt-4 flex-wrap">
                {selectedPayment.status === 'pending' && (
                  <>
                    <Button
                      className="flex-1 min-w-btn-sm bg-green-600 hover:bg-green-700"
                      data-testid="button-modal-approve"
                      disabled={updateVerificationMutation.isPending}
                      onClick={() => {
                        updateVerificationMutation.mutate({ id: selectedPayment.id, status: 'approved' });
                        handleClosePaymentModal();
                      }}
                    >
                      <CheckCircle className="size-icon-md mr-2" />
                      Aprobar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1 min-w-btn-sm"
                      data-testid="button-modal-reject"
                      disabled={updateVerificationMutation.isPending}
                      onClick={() => {
                        updateVerificationMutation.mutate({ id: selectedPayment.id, status: 'rejected' });
                        handleClosePaymentModal();
                      }}
                    >
                      <XCircle className="size-icon-md mr-2" />
                      Rechazar
                    </Button>
                  </>
                )}
                <DeleteButton
                  className="flex-1 min-w-btn-sm"
                  data-testid="button-modal-delete"
                  onClick={() => {
                    setDeleteConfirm({ type: 'payment', id: selectedPayment.id, name: `Pago #${selectedPayment.id.slice(-6)}` });
                    handleClosePaymentModal();
                  }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Editar usuario / Nuevo estudiante: un solo componente */}
      <UserFormDialog
        open={!!editingUser}
        onOpenChange={(open) => { if (!open) setEditingUser(null); }}
        mode="edit"
        user={editingUser}
        countries={countriesList}
      />
      <UserFormDialog
        open={showCreateStudentModal}
        onOpenChange={setShowCreateStudentModal}
        mode="create"
        countries={countriesList}
      />

      {/* Nuevo tutor / Editar tutor: un solo componente */}
      <TutorFormDialog
        open={showCreateTutorModal}
        onOpenChange={setShowCreateTutorModal}
        mode="create"
        countries={countriesList}
        careers={specialties}
        courses={profesiones}
      />
      <TutorFormDialog
        open={!!editingTutor}
        onOpenChange={(open) => { if (!open) setEditingTutor(null); }}
        mode="edit"
        tutor={editingTutor}
        countries={countriesList}
        careers={specialties}
        courses={profesiones}
      />

      {/* Change Password Modal */}
      {changePasswordUser && (
        <FormDialog
          open={!!changePasswordUser}
          onOpenChange={() => setChangePasswordUser(null)}
          title="Cambiar Contraseña"
          testId="modal-change-password"
          onCancel={() => setChangePasswordUser(null)}
          cancelTestId="button-cancel-password"
          onSubmit={async () => {
            try {
              const res = await fetch(`/api/admin/users/${changePasswordUser.id}/password`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword })
              });
              if (!res.ok) throw new Error('Error al cambiar contraseña');
              toast({ title: "Contraseña actualizada", description: `La contraseña de ${changePasswordUser.name} fue cambiada exitosamente` });
              setChangePasswordUser(null);
              setNewPassword('');
            } catch (error) {
              toast({ title: "Error", description: "No se pudo cambiar la contraseña", variant: "destructive" });
            }
          }}
          submitLabel="Guardar"
          submitDisabled={newPassword.length < 4}
          submitTestId="button-save-password"
        >
          <p className="text-body text-gray-700">
            Cambiar contraseña de <strong>{changePasswordUser.name}</strong>
          </p>
          <div>
            <OutlinedControl htmlFor="admin-new-password" label="Nueva contraseña">
              <Input
                id="admin-new-password"
                data-testid="input-new-password"
                type="text"
                placeholder="Mínimo 4 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </OutlinedControl>
          </div>
        </FormDialog>
      )}

      {/* Activity Log Modal */}
      <Dialog open={!!activityLogUser} onOpenChange={() => setActivityLogUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="size-icon-lg" />
              Historial de {activityLogUser?.name}
            </DialogTitle>
          </DialogHeader>
          {activityLogUser && <ActivityLogContent userId={activityLogUser.id} />}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <FormDialog
          open={!!deleteConfirm}
          onOpenChange={() => setDeleteConfirm(null)}
          title="Confirmar eliminación"
          testId="modal-delete-confirm"
          onCancel={() => setDeleteConfirm(null)}
          cancelTestId="button-cancel-delete"
          onSubmit={() => {
            if (deleteConfirm.type === 'user') {
              deleteUserMutation.mutate(deleteConfirm.id);
            } else if (deleteConfirm.type === 'task') {
              deleteTaskMutation.mutate(deleteConfirm.id);
            } else if (deleteConfirm.type === 'tutor') {
              deleteTutorMutation.mutate(deleteConfirm.id);
            } else if (deleteConfirm.type === 'payment') {
              deletePaymentMutation.mutate(deleteConfirm.id);
            } else if (deleteConfirm.type === 'agent') {
              deleteUserMutation.mutate(deleteConfirm.id);
            }
          }}
          submitLabel="Eliminar"
          submitDisabled={deleteUserMutation.isPending || deleteTaskMutation.isPending || deleteTutorMutation.isPending || deletePaymentMutation.isPending}
          submitVariant="destructive"
          submitTestId="button-confirm-delete"
        >
          <p className="text-body text-gray-700">
            ¿Estás seguro que deseas eliminar {deleteConfirm.type === 'user' ? 'al usuario' : deleteConfirm.type === 'tutor' ? 'al tutor' : deleteConfirm.type === 'agent' ? 'al agente' : deleteConfirm.type === 'payment' ? 'el pago' : 'el pedido'}{' '}
            <strong>"{deleteConfirm.name}"</strong>?
          </p>
          <p className="text-caption text-gray-700">Esta acción no se puede deshacer.</p>
        </FormDialog>
      )}

      {/* Create Manual Payment Modal */}
      <Dialog open={showCreatePayment} onOpenChange={setShowCreatePayment}>
        <DialogContent data-testid="modal-create-payment">
          <DialogHeader>
            <DialogTitle>Registrar pago manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-field-gap">
            <div>
              <OutlinedControl label="Pedido">
                <Combobox
                  options={(tasks || []).map(t => ({
                    value: t.id,
                    label: `Nº${t.taskNumber} — ${t.title}`,
                  }))}
                  value={createPaymentForm.taskId}
                  onValueChange={(taskId) => {
                    const task = (tasks || []).find(t => t.id === taskId);
                    setCreatePaymentForm(f => ({ ...f, taskId, studentId: task?.userId || '' }));
                  }}
                  placeholder="Seleccionar pedido…"
                  searchPlaceholder="Buscar pedido por número o título…"
                  emptyMessage="No se encontraron pedidos."
                />
              </OutlinedControl>
            </div>
            {createPaymentForm.studentId && (
              <div>
                <OutlinedControl htmlFor="create-payment-student" label="Alumno">
                  <Input id="create-payment-student"
                    data-testid="input-create-student-id"
                    readOnly
                    value={(users || []).find(u => u.id === createPaymentForm.studentId)?.name || createPaymentForm.studentId}
                    className="bg-gray-50 text-gray-700"
                  />
                </OutlinedControl>
              </div>
            )}
            <div>
              <OutlinedControl htmlFor="create-payment-tutor" label="Tutor">
                <Select value={createPaymentForm.tutorId} onValueChange={(v) => setCreatePaymentForm(f => ({ ...f, tutorId: v }))}>
                  <SelectTrigger id="create-payment-tutor" data-testid="input-create-tutor-id">
                    <SelectValue placeholder="Seleccionar tutor…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(tutors || []).map(t => (
                      <SelectItem key={t.user.id} value={t.user.id}>
                        {t.user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </OutlinedControl>
            </div>
            <div>
              <OutlinedControl htmlFor="create-payment-amount" label="Monto">
                <Input id="create-payment-amount"
                  type="number"
                  step="0.01"
                  data-testid="input-create-amount"
                  placeholder="0.00"
                  value={createPaymentForm.amount}
                  onChange={(e) => setCreatePaymentForm(f => ({ ...f, amount: e.target.value }))}
                />
              </OutlinedControl>
            </div>
            <div>
              <OutlinedControl htmlFor="create-payment-method" label="Método de pago">
                <EnumSelect id="create-payment-method" options={PAYMENT_METHODS} value={createPaymentForm.paymentMethod} onValueChange={(v) => setCreatePaymentForm(f => ({ ...f, paymentMethod: v }))} data-testid="select-create-method" />
              </OutlinedControl>
            </div>
            <div>
              <OutlinedControl htmlFor="create-payment-notes" label="Notas">
                <Textarea id="create-payment-notes"
                  data-testid="textarea-create-notes"
                  placeholder="Notas opcionales…"
                  value={createPaymentForm.notes}
                  onChange={(e) => setCreatePaymentForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                />
              </OutlinedControl>
            </div>
            <p className="text-caption text-gray-700">El pago se registrará como <strong>pendiente</strong> para revisión.</p>
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowCreatePayment(false)}>Cancelar</Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                data-testid="button-confirm-create-payment"
                disabled={createManualPaymentMutation.isPending || !createPaymentForm.taskId || !createPaymentForm.amount || !createPaymentForm.tutorId || !createPaymentForm.studentId}
                onClick={() => createManualPaymentMutation.mutate(createPaymentForm)}
              >
                Registrar pago
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Create Agent Modal */}
      {/* Nuevo agente / Editar agente: un solo componente */}
      <AgentFormDialog open={showCreateAgentModal} onOpenChange={setShowCreateAgentModal} mode="create" />
      <AgentFormDialog
        open={!!editingAgent}
        onOpenChange={(open) => { if (!open) setEditingAgent(null); }}
        mode="edit"
        agent={editingAgent ? users?.find((u: any) => u.id === editingAgent.id) || editingAgent : null}
      />

      {/* Create Course Modal */}
      <FormDialog
        open={showCreateCourseModal}
        onOpenChange={setShowCreateCourseModal}
        title="Nuevo curso o materia"
        testId="modal-create-course"
        onCancel={() => setShowCreateCourseModal(false)}
        onSubmit={() => createCourseMutation.mutate(newCourseForm)}
        submitLabel={<>{createCourseMutation.isPending ? 'Creando…' : 'Crear curso'}</>}
        submitDisabled={createCourseMutation.isPending || !newCourseForm.name}
        submitClassName="bg-green-600 hover:bg-green-700 text-white"
      >
        <OutlinedControl htmlFor="course-name" label={<>Nombre <span aria-hidden className="text-error-fg">*</span></>}>
          <Input
            aria-required id="course-name"
            value={newCourseForm.name}
            onChange={(e) => setNewCourseForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Física 1, Cálculo 2, Derecho Civil, etc."
          />
        </OutlinedControl>
      </FormDialog>

      {/* Edit Course Modal */}
      {editingCourse && (
        <FormDialog
          open={!!editingCourse}
          onOpenChange={() => setEditingCourse(null)}
          title="Editar curso"
          testId="modal-edit-course"
          onCancel={() => setEditingCourse(null)}
          onSubmit={() => updateCourseMutation.mutate({ id: editingCourse.id, name: editingCourse.name })}
          submitLabel={<>{updateCourseMutation.isPending ? 'Guardando…' : 'Guardar'}</>}
          submitDisabled={updateCourseMutation.isPending || !editingCourse.name}
          submitClassName="bg-green-600 hover:bg-green-700 text-white"
        >
          <OutlinedControl htmlFor="edit-course-name" label={<>Nombre <span aria-hidden className="text-error-fg">*</span></>}>
            <Input
              aria-required id="edit-course-name"
              value={editingCourse.name}
              onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })}
              placeholder="Física 1, Cálculo 2, Derecho Civil, etc."
            />
          </OutlinedControl>
        </FormDialog>
      )}

      {/* Create Area Modal */}
      {(() => {
        const normStr = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const isDuplicateArea = !!newAreaForm.name.trim() && !!(specialties?.some(c => normStr(c.name) === normStr(newAreaForm.name)));
        return (
          <FormDialog
            open={showCreateAreaModal}
            onOpenChange={setShowCreateAreaModal}
            title="Nueva carrera profesional"
            testId="modal-create-area"
            onCancel={() => setShowCreateAreaModal(false)}
            onSubmit={() => createAreaMutation.mutate({ ...newAreaForm, category: newAreaForm.category || 'General' })}
            submitLabel={<>{createAreaMutation.isPending ? 'Creando…' : 'Crear carrera'}</>}
            submitDisabled={createAreaMutation.isPending || !newAreaForm.name.trim() || isDuplicateArea}
            submitClassName="bg-green-600 hover:bg-green-700 text-white"
          >
            <OutlinedControl htmlFor="area-name" label={<>Nombre <span aria-hidden className="text-error-fg">*</span></>}>
              <Input
                aria-required id="area-name"
                value={newAreaForm.name}
                onChange={(e) => setNewAreaForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ingeniería, Derecho, Medicina, etc."
                className={isDuplicateArea ? 'border-gray-400 focus-visible:ring-gray-400' : ''}
              />
              {isDuplicateArea && (
                <p className="text-caption text-gray-700 mt-1 flex items-center gap-1">
                  <AlertTriangle className="size-icon-sm flex-shrink-0" />
                  Ya existe una carrera con ese nombre.
                </p>
              )}
            </OutlinedControl>
          </FormDialog>
        );
      })()}

      {/* Edit Service Modal */}
      {editingService && (
        <FormDialog
          open={!!editingService}
          onOpenChange={() => setEditingService(null)}
          title="Editar servicio"
          testId="modal-edit-service"
          onCancel={() => setEditingService(null)}
          onSubmit={() => updateServiceMutation.mutate({ id: editingService.id, name: editingService.name })}
          submitLabel={<>{updateServiceMutation.isPending ? 'Guardando…' : 'Guardar'}</>}
          submitDisabled={updateServiceMutation.isPending || !editingService.name}
          submitClassName="bg-green-600 hover:bg-green-700 text-white"
        >
          <OutlinedControl htmlFor="edit-service-name" label={<>Nombre <span aria-hidden className="text-error-fg">*</span></>}>
            <Input
              aria-required id="edit-service-name"
              value={editingService.name}
              onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
              placeholder="Ej: Tesis, Monografía, Ensayo…"
            />
          </OutlinedControl>
        </FormDialog>
      )}

      {/* Edit Area Modal */}
      {editingArea && (
        <FormDialog
          open={!!editingArea}
          onOpenChange={() => setEditingArea(null)}
          title="Editar carrera profesional"
          testId="modal-edit-area"
          onCancel={() => setEditingArea(null)}
          onSubmit={() => updateAreaMutation.mutate({ id: editingArea.id, name: editingArea.name, category: editingArea.category })}
          submitLabel={<>{updateAreaMutation.isPending ? 'Guardando…' : 'Guardar'}</>}
          submitDisabled={updateAreaMutation.isPending || !editingArea.name}
          submitClassName="bg-green-600 hover:bg-green-700 text-white"
        >
          <OutlinedControl htmlFor="edit-area-name" label={<>Nombre <span aria-hidden className="text-error-fg">*</span></>}>
            <Input
              aria-required id="edit-area-name"
              value={editingArea.name}
              onChange={(e) => setEditingArea({ ...editingArea, name: e.target.value })}
              placeholder="Ej: Ingeniería, Derecho, Medicina…"
            />
          </OutlinedControl>
          <OutlinedControl htmlFor="edit-area-category" label="Categoría">
            <Input
              id="edit-area-category"
              value={editingArea.category}
              onChange={(e) => setEditingArea({ ...editingArea, category: e.target.value })}
              placeholder="Ej: Ciencias, Humanidades, Tecnología…"
            />
          </OutlinedControl>
        </FormDialog>
      )}

      {/* Create Service Modal */}
      <FormDialog
        open={showCreateServiceModal}
        onOpenChange={setShowCreateServiceModal}
        title="Nuevo servicio"
        testId="modal-create-service"
        onCancel={() => setShowCreateServiceModal(false)}
        onSubmit={() => createServiceMutation.mutate(newServiceForm)}
        submitLabel={<>{createServiceMutation.isPending ? 'Creando…' : 'Crear servicio'}</>}
        submitDisabled={createServiceMutation.isPending || !newServiceForm.name}
        submitClassName="bg-green-600 hover:bg-green-700 text-white"
      >
        <OutlinedControl htmlFor="service-name" label={<>Nombre <span aria-hidden className="text-error-fg">*</span></>}>
          <Input
            aria-required id="service-name"
            value={newServiceForm.name}
            onChange={(e) => setNewServiceForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Ensayo, Monografía, Tesis, etc."
          />
        </OutlinedControl>
      </FormDialog>

      {/* Create Country Modal */}
      <FormDialog
        open={showCreateCountryModal}
        onOpenChange={setShowCreateCountryModal}
        title="Nuevo país"
        testId="modal-create-country"
        onCancel={() => setShowCreateCountryModal(false)}
        onSubmit={() => createCountryMutation.mutate(newCountryForm)}
        submitLabel={<>{createCountryMutation.isPending ? 'Creando…' : 'Crear país'}</>}
        submitDisabled={createCountryMutation.isPending || !newCountryForm.code || !newCountryForm.name}
        submitClassName="bg-green-600 hover:bg-green-700 text-white"
      >
        <OutlinedControl htmlFor="country-code" label={<>Código ISO de país <span aria-hidden className="text-error-fg">*</span></>}>
          <Input
            aria-required id="country-code"
            value={newCountryForm.code}
            onChange={(e) => setNewCountryForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
            placeholder="PE, MX, CO"
            maxLength={3}
          />
        </OutlinedControl>
        <OutlinedControl htmlFor="country-name" label={<>Nombre <span aria-hidden className="text-error-fg">*</span></>}>
          <Input
            aria-required id="country-name"
            value={newCountryForm.name}
            onChange={(e) => setNewCountryForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Perú, México, Colombia"
          />
        </OutlinedControl>
        <OutlinedControl htmlFor="country-phone-code" label="Prefijo telefónico">
          <Input
            id="country-phone-code"
            value={newCountryForm.phoneCode}
            onChange={(e) => setNewCountryForm(prev => ({ ...prev, phoneCode: e.target.value }))}
            placeholder="+51, +52, +1"
          />
        </OutlinedControl>
      </FormDialog>

      {/* Create Bank Account Modal */}
      <FormDialog
        open={showCreateBankAccountModal}
        onOpenChange={setShowCreateBankAccountModal}
        title="Nueva cuenta bancaria"
        testId="modal-create-bank-account"
        onCancel={() => setShowCreateBankAccountModal(false)}
        onSubmit={() => createBankAccountMutation.mutate(newBankAccountForm)}
        submitLabel={<>{createBankAccountMutation.isPending ? 'Creando…' : 'Crear cuenta'}</>}
        submitDisabled={createBankAccountMutation.isPending || !newBankAccountForm.bankName || !newBankAccountForm.accountHolder || !newBankAccountForm.accountNumber}
        submitClassName="bg-green-600 hover:bg-green-700 text-white"
      >
        <OutlinedControl htmlFor="bank-country" label={<>País <span aria-hidden className="text-error-fg">*</span></>}>
          <CountrySelect
            id="bank-country"
            aria-required
            value={newBankAccountForm.countryCode}
            onValueChange={(value) => setNewBankAccountForm(prev => ({ ...prev, countryCode: value }))}
            countries={countriesList ?? []}
            placeholder="Selecciona un país"
          />
        </OutlinedControl>
        <OutlinedControl htmlFor="bank-name" label={<>Banco <span aria-hidden className="text-error-fg">*</span></>}>
          <Input
            aria-required id="bank-name"
            value={newBankAccountForm.bankName}
            onChange={(e) => setNewBankAccountForm(prev => ({ ...prev, bankName: e.target.value }))}
            placeholder="BCP, Interbank, BBVA…"
          />
        </OutlinedControl>
        <OutlinedControl htmlFor="bank-holder" label={<>Titular <span aria-hidden className="text-error-fg">*</span></>}>
          <Input
            aria-required id="bank-holder"
            value={newBankAccountForm.accountHolder}
            onChange={(e) => setNewBankAccountForm(prev => ({ ...prev, accountHolder: e.target.value }))}
            placeholder="Nombre del titular"
          />
        </OutlinedControl>
        <OutlinedControl htmlFor="bank-number" label={<>Número de cuenta <span aria-hidden className="text-error-fg">*</span></>}>
          <Input
            aria-required id="bank-number"
            value={newBankAccountForm.accountNumber}
            onChange={(e) => setNewBankAccountForm(prev => ({ ...prev, accountNumber: e.target.value }))}
            placeholder="191-123456789-0-12"
          />
        </OutlinedControl>
        <div className="grid grid-cols-2 gap-4">
          <OutlinedControl htmlFor="bank-type" label="Tipo de cuenta">
            <EnumSelect id="bank-type" options={BANK_ACCOUNT_TYPES} value={newBankAccountForm.accountType} onValueChange={(value) => setNewBankAccountForm(prev => ({ ...prev, accountType: value }))} />
          </OutlinedControl>
          <OutlinedControl htmlFor="bank-currency" label="Código ISO de divisa">
            <EnumSelect id="bank-currency" options={BANK_CURRENCIES} value={newBankAccountForm.currency} onValueChange={(value) => setNewBankAccountForm(prev => ({ ...prev, currency: value }))} />
          </OutlinedControl>
        </div>
      </FormDialog>

      {/* Create Country Setting Modal */}
      <FormDialog
        open={showCreateCountrySettingModal}
        onOpenChange={setShowCreateCountrySettingModal}
        title="Nuevo País - Presupuesto Mínimo"
        testId="modal-create-country-setting"
        onCancel={() => setShowCreateCountrySettingModal(false)}
        onSubmit={() => createCountrySettingMutation.mutate(newCountrySettingForm)}
        submitLabel={<>{createCountrySettingMutation.isPending ? 'Creando…' : 'Crear configuración'}</>}
        submitDisabled={createCountrySettingMutation.isPending || !newCountrySettingForm.countryCode || !newCountrySettingForm.countryName || !newCountrySettingForm.currency}
        submitClassName="bg-green-600 hover:bg-green-700 text-white"
      >
        <div className="grid grid-cols-2 gap-4">
          <OutlinedControl htmlFor="cs-code" label="Código ISO de país">
            <Input
              id="cs-code"
              placeholder="PE"
              value={newCountrySettingForm.countryCode}
              onChange={(e) => setNewCountrySettingForm(prev => ({ ...prev, countryCode: e.target.value.toUpperCase() }))}
            />
          </OutlinedControl>
          <OutlinedControl htmlFor="cs-name" label="Nombre del país">
            <Input
              id="cs-name"
              placeholder="Perú"
              value={newCountrySettingForm.countryName}
              onChange={(e) => setNewCountrySettingForm(prev => ({ ...prev, countryName: e.target.value }))}
            />
          </OutlinedControl>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <OutlinedControl htmlFor="cs-currency" label="Código ISO de divisa">
            <Input
              id="cs-currency"
              placeholder="PEN"
              value={newCountrySettingForm.currency}
              onChange={(e) => setNewCountrySettingForm(prev => ({ ...prev, currency: e.target.value }))}
            />
          </OutlinedControl>
          <OutlinedControl htmlFor="cs-min-budget" label="Presupuesto mínimo">
            <Input
              id="cs-min-budget"
              type="number"
              min="1"
              step="0.01"
              placeholder="10"
              value={newCountrySettingForm.minBudget}
              onChange={(e) => setNewCountrySettingForm(prev => ({ ...prev, minBudget: e.target.value }))}
            />
          </OutlinedControl>
        </div>
      </FormDialog>

      {/* Edit Country Setting Modal */}
      {editingCountrySetting && (
        <FormDialog
          open={!!editingCountrySetting}
          onOpenChange={(open) => !open && setEditingCountrySetting(null)}
          title="Editar Presupuesto Mínimo"
          testId="modal-edit-country-setting"
          onCancel={() => setEditingCountrySetting(null)}
          onSubmit={() => {
            updateCountrySettingMutation.mutate({
              id: editingCountrySetting.id,
              countryCode: editingCountrySetting.countryCode,
              countryName: editingCountrySetting.countryName,
              flag: editingCountrySetting.flag,
              currency: editingCountrySetting.currency,
              minBudget: editingCountrySetting.minBudget
            });
          }}
          submitLabel={<>{updateCountrySettingMutation.isPending ? 'Guardando…' : 'Guardar cambios'}</>}
          submitDisabled={updateCountrySettingMutation.isPending}
          submitClassName="bg-green-600 hover:bg-green-700 text-white"
        >
          <div className="grid grid-cols-2 gap-4">
            <OutlinedControl htmlFor="edit-cs-code" label="Código ISO de país">
              <Input
                id="edit-cs-code"
                placeholder="PE"
                value={editingCountrySetting.countryCode}
                onChange={(e) => setEditingCountrySetting({ ...editingCountrySetting, countryCode: e.target.value.toUpperCase() })}
              />
            </OutlinedControl>
            <OutlinedControl htmlFor="edit-cs-name" label="Nombre del país">
              <Input
                id="edit-cs-name"
                placeholder="Perú"
                value={editingCountrySetting.countryName}
                onChange={(e) => setEditingCountrySetting({ ...editingCountrySetting, countryName: e.target.value })}
              />
            </OutlinedControl>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <OutlinedControl htmlFor="edit-cs-currency" label="Código ISO de divisa">
              <Input
                id="edit-cs-currency"
                placeholder="PEN"
                value={editingCountrySetting.currency}
                onChange={(e) => setEditingCountrySetting({ ...editingCountrySetting, currency: e.target.value })}
              />
            </OutlinedControl>
            <OutlinedControl htmlFor="edit-cs-min-budget" label="Presupuesto mínimo">
              <Input
                id="edit-cs-min-budget"
                type="number"
                min="1"
                step="0.01"
                placeholder="10"
                value={editingCountrySetting.minBudget}
                onChange={(e) => setEditingCountrySetting({ ...editingCountrySetting, minBudget: e.target.value })}
              />
            </OutlinedControl>
          </div>
        </FormDialog>
      )}

      {/* Edit Country Modal */}
      {editingCountry && (
        <FormDialog
          open={!!editingCountry}
          onOpenChange={(open) => !open && setEditingCountry(null)}
          title="Editar país"
          testId="modal-edit-country"
          onCancel={() => setEditingCountry(null)}
          onSubmit={() => updateCountryMutation.mutate({ id: editingCountry.id, code: editingCountry.code, name: editingCountry.name, phoneCode: editingCountry.phoneCode })}
          submitLabel={<>{updateCountryMutation.isPending ? 'Guardando…' : 'Guardar'}</>}
          submitDisabled={updateCountryMutation.isPending || !editingCountry.code || !editingCountry.name}
          submitClassName="bg-green-600 hover:bg-green-700 text-white"
        >
          <OutlinedControl htmlFor="edit-country-code" label={<>Código ISO de país <span aria-hidden className="text-error-fg">*</span></>}>
            <Input
              aria-required id="edit-country-code"
              value={editingCountry.code}
              onChange={(e) => setEditingCountry({ ...editingCountry, code: e.target.value.toUpperCase() })}
              placeholder="PE, MX, CO"
              maxLength={3}
            />
          </OutlinedControl>
          <OutlinedControl htmlFor="edit-country-name" label={<>Nombre <span aria-hidden className="text-error-fg">*</span></>}>
            <Input
              aria-required id="edit-country-name"
              value={editingCountry.name}
              onChange={(e) => setEditingCountry({ ...editingCountry, name: e.target.value })}
              placeholder="Perú, México, Colombia"
            />
          </OutlinedControl>
          <OutlinedControl htmlFor="edit-country-phone-code" label="Prefijo telefónico">
            <Input
              id="edit-country-phone-code"
              value={editingCountry.phoneCode}
              onChange={(e) => setEditingCountry({ ...editingCountry, phoneCode: e.target.value })}
              placeholder="+51, +52, +1"
            />
          </OutlinedControl>
        </FormDialog>
      )}

      {/* Edit Bank Account Modal */}
      {editingBankAccount && (
        <FormDialog
          open={!!editingBankAccount}
          onOpenChange={(open) => !open && setEditingBankAccount(null)}
          title="Editar cuenta bancaria"
          testId="modal-edit-bank-account"
          onCancel={() => setEditingBankAccount(null)}
          onSubmit={() => updateBankAccountMutation.mutate({
            id: editingBankAccount.id,
            bankName: editingBankAccount.bankName,
            accountHolder: editingBankAccount.accountHolder,
            accountNumber: editingBankAccount.accountNumber,
            accountType: editingBankAccount.accountType,
            currency: editingBankAccount.currency
          })}
          submitLabel={<>{updateBankAccountMutation.isPending ? 'Guardando…' : 'Guardar'}</>}
          submitDisabled={updateBankAccountMutation.isPending || !editingBankAccount.bankName || !editingBankAccount.accountHolder || !editingBankAccount.accountNumber}
          submitClassName="bg-green-600 hover:bg-green-700 text-white"
        >
          <OutlinedControl htmlFor="edit-bank-name" label={<>Banco <span aria-hidden className="text-error-fg">*</span></>}>
            <Input
              aria-required id="edit-bank-name"
              value={editingBankAccount.bankName}
              onChange={(e) => setEditingBankAccount({ ...editingBankAccount, bankName: e.target.value })}
              placeholder="BCP, Interbank, BBVA…"
            />
          </OutlinedControl>
          <OutlinedControl htmlFor="edit-bank-holder" label={<>Titular <span aria-hidden className="text-error-fg">*</span></>}>
            <Input
              aria-required id="edit-bank-holder"
              value={editingBankAccount.accountHolder}
              onChange={(e) => setEditingBankAccount({ ...editingBankAccount, accountHolder: e.target.value })}
              placeholder="Nombre del titular"
            />
          </OutlinedControl>
          <OutlinedControl htmlFor="edit-bank-number" label={<>Número de cuenta <span aria-hidden className="text-error-fg">*</span></>}>
            <Input
              aria-required id="edit-bank-number"
              value={editingBankAccount.accountNumber}
              onChange={(e) => setEditingBankAccount({ ...editingBankAccount, accountNumber: e.target.value })}
              placeholder="191-123456789-0-12"
            />
          </OutlinedControl>
          <div className="grid grid-cols-2 gap-4">
            <OutlinedControl htmlFor="edit-bank-type" label="Tipo de cuenta">
              <EnumSelect id="edit-bank-type" options={BANK_ACCOUNT_TYPES} value={editingBankAccount.accountType} onValueChange={(value) => setEditingBankAccount({ ...editingBankAccount, accountType: value })} />
            </OutlinedControl>
            <OutlinedControl htmlFor="edit-bank-currency" label="Código ISO de divisa">
              <EnumSelect id="edit-bank-currency" options={BANK_CURRENCIES} value={editingBankAccount.currency} onValueChange={(value) => setEditingBankAccount({ ...editingBankAccount, currency: value })} />
            </OutlinedControl>
          </div>
        </FormDialog>
      )}


      <TaskQuickViewDialog
        task={viewingTask}
        onClose={() => { setViewingTask(null); setIsEditingTaskContent(false); }}
        showUsdEquivalent
        showAdminFields
        beforeContent={viewingTask ? (() => {
          const phoneAlerts = (alerts || []).filter(
            a => a.taskId === viewingTask.id && a.type === 'personal_contact' && a.status === 'pending' && !a.messageId
          );
          if (phoneAlerts.length === 0) return null;
          return (
            <div className="flex items-start gap-2 bg-card rounded-lg border border-border p-card-pad">
              <Phone className="size-icon-md text-gray-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-caption font-semibold text-gray-700">Número de teléfono detectado</p>
                {phoneAlerts.map(a => (
                  <p key={a.id} className="text-caption text-gray-700 mt-0.5 break-all">{a.detectedContent}</p>
                ))}
                <p className="text-caption text-gray-700 mt-1">Edita la descripción para eliminar esta alerta.</p>
              </div>
            </div>
          );
        })() : null}
        renderEditContent={(task) => isEditingTaskContent ? (
          <div className="space-y-3 bg-card rounded-lg border border-border p-card-pad">
            <div>
              <OutlinedControl htmlFor="task-edit-title" label="Título">
                <Input
                  id="task-edit-title"
                  value={taskEditForm.title}
                  onChange={(e) => setTaskEditForm((f) => ({ ...f, title: e.target.value }))}
                />
              </OutlinedControl>
            </div>
            <div>
              <OutlinedControl htmlFor="task-edit-description" label="Descripción">
                <Textarea
                  id="task-edit-description"
                  value={taskEditForm.description}
                  onChange={(e) => setTaskEditForm((f) => ({ ...f, description: e.target.value }))}
                  rows={4}
                />
              </OutlinedControl>
            </div>
            <div>
              <OutlinedControl htmlFor="task-edit-comment" label="Comentario">
                <Textarea
                  id="task-edit-comment"
                  value={taskEditForm.comment}
                  onChange={(e) => setTaskEditForm((f) => ({ ...f, comment: e.target.value }))}
                  rows={3}
                />
              </OutlinedControl>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => updateTaskContentMutation.mutate({
                  id: task.id,
                  data: taskEditForm,
                })}
                disabled={updateTaskContentMutation.isPending || !taskEditForm.title.trim()}
              >
                {updateTaskContentMutation.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditingTaskContent(false)}
                disabled={updateTaskContentMutation.isPending}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
        afterContent={
          <>
            {taskAuditLogs && taskAuditLogs.length > 0 && (
              <div className="pt-3">
                <p className="text-caption text-gray-700 block mb-2">Historial de ediciones</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {taskAuditLogs.map((entry) => (
                    <div key={entry.id} className="text-caption bg-card border border-border rounded-md p-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700 capitalize">{entry.field}</span>
                        <span className="text-gray-700">
                          {entry.createdAt
                            ? fmtDateTime(entry.createdAt)
                            : ''}
                        </span>
                      </div>
                      {entry.adminName && (
                        <p className="text-gray-700">Por: {entry.adminName}</p>
                      )}
                      {entry.oldValue !== null && entry.oldValue !== undefined && (
                        <p className="text-gray-700 line-clamp-2">
                          <span className="font-medium">Antes:</span> {entry.oldValue || <em>vacío</em>}
                        </p>
                      )}
                      <p className="text-gray-700 line-clamp-2">
                        <span className="font-medium">Después:</span> {entry.newValue || <em>vacío</em>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="pt-4">
              <Button
                variant="destructive"
                onClick={() => { setViewingTask(null); setIsEditingTaskContent(false); }}
                className="w-full"
              >
                Cerrar
              </Button>
            </div>
          </>
        }
      />

      {/* Task Viewers Dialog */}
      <Dialog open={!!taskViewersDialog} onOpenChange={() => setTaskViewersDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Vistas: {taskViewersDialog?.title ?? "Pedido"}
            </DialogTitle>
          </DialogHeader>
          {taskViewersDialog && (
            <TaskViewersContent taskId={taskViewersDialog.taskId} />
          )}
        </DialogContent>
      </Dialog>

      {/* Task Candidates Dialog */}
      <Dialog open={!!taskCandidatesDialog} onOpenChange={() => setTaskCandidatesDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Postulantes: {taskCandidatesDialog?.title ?? "Pedido"}
            </DialogTitle>
          </DialogHeader>
          {taskCandidatesDialog && (
            <TaskCandidatesContent
              taskId={taskCandidatesDialog.taskId}
              candidates={taskCandidatesDialog.candidates}
              currency={taskCandidatesDialog.currency}
              canSelect={isAdmin || agentPerms.includes('manage_candidates')}
              onSelect={(tutorId) => selectTutorMutation.mutate({ taskId: taskCandidatesDialog.taskId, tutorId })}
              onReject={(tutorId) => rejectCandidateMutation.mutate({ taskId: taskCandidatesDialog.taskId, tutorId })}
              isActing={selectTutorMutation.isPending || rejectCandidateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Task Chat Dialog (read-only) */}
      <Dialog open={!!taskChatDialog} onOpenChange={() => setTaskChatDialog(null)}>
        <DialogContent className=" w-full overflow-hidden grid-cols-fit">
          <DialogHeader className="min-w-0">
            <DialogTitle className="min-w-0 line-clamp-2 pr-8">
              Chat: {taskChatDialog?.title ?? "Pedido"}
            </DialogTitle>
          </DialogHeader>
          {taskChatDialog && (
            <TaskChatContent taskId={taskChatDialog.taskId} studentId={taskChatDialog.studentId} />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!impersonateTarget}
        onOpenChange={(open) => { if (!open) setImpersonateTarget(null); }}
        title={`¿Ver la cuenta de ${impersonateTarget?.name ?? ''}?`}
        description="Es solo lectura y dura como máximo 30 minutos. Podrás ver sus datos privados, y el acceso queda registrado."
        confirmLabel="Ver cuenta"
        onConfirm={() => {
          if (impersonateTarget) startImpersonation(impersonateTarget.id).catch((e) => toast({ variant: "destructive", title: e.message }));
        }}
      />

      {/* Aviso: fecha límite vencida al poner Disponible */}
      <ConfirmDialog
        open={!!deadlineWarning}
        onOpenChange={(open) => { if (!open) setDeadlineWarning(null); }}
        title="La fecha límite ya venció"
        description={deadlineWarning ? `"${deadlineWarning.title}" venció el ${fmtDateTimeShort(deadlineWarning.deadline)}. Si lo pones Disponible, el sistema lo volverá a marcar Expirado solo y los tutores no lo verán. Para reabrirlo hay que republicarlo con una fecha nueva.` : undefined}
        confirmLabel="Republicar con nueva fecha"
        cancelLabel="Cancelar"
        onConfirm={() => {
          if (deadlineWarning) { setRepublishDialog({ taskId: deadlineWarning.taskId, title: deadlineWarning.title }); setRepublishDeadline(''); }
          setDeadlineWarning(null);
        }}
      />

      {/* Republish Task Dialog */}
      <Dialog open={!!republishDialog} onOpenChange={(open) => { if (!open) { setRepublishDialog(null); setRepublishDeadline(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Republicar pedido
            </DialogTitle>
          </DialogHeader>
          {republishDialog && (
            <div className="space-y-4">
              <p className="text-body text-gray-700 truncate">"{republishDialog.title}"</p>
              <div>
                <p className="text-body font-medium text-gray-700 block mb-1">Nueva fecha límite <span aria-hidden className="text-error-fg">*</span></p>
                <DateTimeField
                  value={republishDeadline}
                  onChange={setRepublishDeadline}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => { setRepublishDialog(null); setRepublishDeadline(''); }}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={!republishDeadline || republishTaskMutation.isPending}
                  onClick={() => republishTaskMutation.mutate({ taskId: republishDialog.taskId, deadline: republishDeadline })}
                >
                  {republishTaskMutation.isPending ? 'Republicando…' : 'Republicar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskViewersContent({ taskId }: { taskId: string }) {
  const { data: viewers, isLoading } = useQuery<{ tutorId: string; name: string; avatar: string | null; viewedAt: string | null }[]>({
    queryKey: ["/api/tasks", taskId, "views"],
    queryFn: () => fetch(`/api/tasks/${taskId}/views`).then(r => { if (!r.ok) throw new Error("Failed to fetch viewers"); return r.json(); }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-icon-xl rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (!viewers || viewers.length === 0) {
    return <EmptyState title="Sin vistas todavía" />;
  }

  return (
    <div className="space-y-3 max-h-sheet-sm overflow-y-auto">
      {viewers.map((v) => (
        <div key={v.tutorId} className="flex items-center gap-3">
          <UserAvatar
            name={v.name}
            avatar={v.avatar ? getFileUrl(v.avatar) : undefined}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-body text-gray-900 truncate">{v.name}</p>
            {v.viewedAt && (
              <p className="text-caption text-gray-700">
                {fmtDateTime(v.viewedAt)}
                {" · "}
                {fmtRelative(new Date(v.viewedAt))}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskCandidatesContent({
  taskId,
  candidates,
  currency,
  canSelect,
  onSelect,
  onReject,
  isActing,
}: {
  taskId: string;
  candidates: Array<{ tutorId: string; tutor: { name: string; avatar: string | null } | null; proposedPrice: string | null; createdAt: string | null }>;
  currency: string;
  canSelect?: boolean;
  onSelect?: (tutorId: string) => void;
  onReject?: (tutorId: string) => void;
  isActing?: boolean;
}) {
  const { data: exchangeRates } = useExchangeRates();

  if (!candidates || candidates.length === 0) {
    return <EmptyState title="Sin postulantes aún" />;
  }

  return (
    <div className="space-y-2 max-h-sheet-sm overflow-y-auto">
      {candidates.map((c) => {
        const usd = c.proposedPrice ? calcUsdEquivalent(c.proposedPrice, currency, exchangeRates?.rates) : null;
        return (
          <div key={c.tutorId} className="flex items-center gap-3 py-2">
            <UserAvatar
              name={c.tutor?.name ?? "?"}
              avatar={c.tutor?.avatar ? getFileUrl(c.tutor.avatar) : undefined}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-body text-gray-900 truncate">{c.tutor?.name ?? "Tutor"}</p>
              <p className="text-caption text-green-700">
                {c.proposedPrice
                  ? formatPriceGrouped(parseFloat(c.proposedPrice), currency)
                  : "Sin precio"}
                {usd && <span className="text-gray-700 ml-1">≈ {usd} USD</span>}
              </p>
              {c.createdAt && (
                <p className="text-caption text-gray-700" title={fmtRelative(new Date(c.createdAt))}>
                  {fmtDateTime(c.createdAt)}
                </p>
              )}
            </div>
            {canSelect && (
              <div className="flex flex-col gap-1">
                {onSelect && (
                  <Button size="sm" variant="secondary" disabled={isActing} onClick={() => onSelect(c.tutorId)}>
                      Elegir
                    </Button>
                )}
                {onReject && (
                  <Button size="sm" variant="outline" disabled={isActing} onClick={() => onReject(c.tutorId)}>
                      Rechazar
                    </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TaskChatContent({ taskId, studentId }: { taskId: string; studentId: string }) {
  // Visores y fallos de imagen: mismos componentes que el chat (solo lectura, sin responder ni menu).
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState<ChatAttachment | null>(null);
  const [pdfViewer, setPdfViewer] = useState<ChatAttachment | null>(null);
  const [activeTutorId, setActiveTutorId] = useState<string | null>(null);
  const { data: messages, isLoading, error } = useQuery<any[]>({
    queryKey: ["/api/admin/tasks", taskId, "chat"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/tasks/${taskId}/chat`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Error ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  if (isLoading) return (
    <div className="space-y-2 px-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
          <Skeleton className={`h-8 rounded-xl ${i % 2 === 0 ? 'w-1/2' : 'w-2/5'}`} />
        </div>
      ))}
    </div>
  );
  if (error) return <div className="py-8 text-center text-error-fg text-body">{(error as Error).message}</div>;
  if (!messages || messages.length === 0) return <EmptyState title="Sin mensajes en este chat" />;

  // Un pedido tiene una conversacion por cada tutor que postula: se separan por tutor.
  const names: Record<string, string> = {};
  messages.forEach((m: any) => { names[m.senderId] = m.senderName; });
  const threads = new Map<string, any[]>();
  let lastTutorId = "";
  messages.forEach((m: any) => {
    const other = m.senderId === studentId ? m.receiverId : m.senderId === "admin-001" ? (m.receiverId !== studentId ? m.receiverId : lastTutorId) : m.senderId;
    if (!other) return;
    lastTutorId = other;
    if (!threads.has(other)) threads.set(other, []);
    threads.get(other)!.push(m);
  });
  const tutorIds = Array.from(threads.keys());
  // "all" = todas las conversaciones seguidas (separadas por tutor); si no, una sola.
  const currentTutorId = activeTutorId === "all" || (activeTutorId && threads.has(activeTutorId))
    ? activeTutorId
    : tutorIds.length > 1 ? "all" : tutorIds[0];
  const showAll = currentTutorId === "all";
  const visibleIds = showAll ? tutorIds : [currentTutorId];

  return (
    <div className="flex flex-col gap-0 min-w-0">
      {tutorIds.length > 1 && (
        <Tabs value={currentTutorId} onValueChange={setActiveTutorId} className="mb-3 min-w-0">
          <TabsList className="h-auto w-full min-w-0 flex-wrap justify-start gap-1">
            <TabsTrigger value="all" className="gap-1.5 text-body">
              Todos
              <span className="text-caption text-gray-700">{messages.length}</span>
            </TabsTrigger>
            {tutorIds.map((id) => (
              <TabsTrigger key={id} value={id} className="gap-1.5 text-body">
                <span className="truncate max-w-truncate-xs">{names[id] ?? "Tutor"}</span>
                <span className="text-caption text-gray-700">{threads.get(id)!.length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Messages: un bloque por tutor (tutor izquierda, alumno derecha) */}
      <div className="flex flex-col gap-4 max-h-sheet-sm overflow-y-auto overflow-x-hidden">
        {visibleIds.map((tutorId) => {
          const thread = threads.get(tutorId) ?? [];
          return (
            <div key={tutorId} className="flex flex-col gap-1 bg-card rounded-lg border border-border p-card-pad min-w-0">
              {thread.map((m: any, idx: number) => {
          const isStudent = m.senderId === studentId;
          const isAdmin = m.senderId === 'admin-001';
          const prevSender = idx > 0 ? thread[idx - 1].senderId : null;
          const nextSender = idx < thread.length - 1 ? thread[idx + 1].senderId : null;
          const isFirstInGroup = m.senderId !== prevSender;
          const isLastInGroup = m.senderId !== nextSender;

          if (isAdmin) {
            return (
              <div key={m.id} className="flex justify-center my-1">
                <div className={`${SYSTEM_MESSAGE_CLASS} min-w-0 text-center break-words whitespace-pre-wrap`}>
                  Admin: {m.message}
                </div>
              </div>
            );
          }

          return (
            <div key={m.id} className={`flex flex-col ${isStudent ? 'items-end' : 'items-start'} ${isFirstInGroup ? 'mt-2' : 'mt-0.5'}`}>
              {/* Name label — solo en primer mensaje del grupo */}
              {isFirstInGroup && (
                <span className="text-caption text-gray-700 mb-0.5 px-1">
                  {m.senderName}
                </span>
              )}
              {/* Bubble */}
              <div className={`${bubbleTextClass(isStudent)} relative max-w-bubble whitespace-pre-wrap`}>
                {m.message}
                {m.attachments && m.attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {buildChatAttachments(m, failedImages).map((att, i) => (
                      <MessageAttachment
                        key={`${m.id}-${i}-${att.path}`}
                        attachment={att}
                        isCurrentUser={isStudent}
                        isSending={false}
                        onOpenImage={setSelectedImage}
                        onOpenPdf={setPdfViewer}
                        onOpenOther={(a) => downloadFile(a.path, a.name)}
                        onDownload={(a) => downloadFile(a.path, a.name)}
                        onImageError={(a) => setFailedImages((prev) => new Set(prev).add(a.path))}
                      />
                    ))}
                  </div>
                )}
              </div>
              {/* Timestamp — solo en último mensaje del grupo */}
              {isLastInGroup && m.createdAt && (
                <span className={`${BUBBLE_TIME_CLASS} mt-0.5 px-1`}>
                  {fmtDateTimeShort(m.createdAt)}
                </span>
              )}
            </div>
          );
        })}
            </div>
          );
        })}
      </div>
      <ImagePreviewModal
        src={selectedImage?.url ?? null}
        title={selectedImage?.originalName}
        onClose={() => setSelectedImage(null)}
        onDownload={selectedImage ? () => downloadFile(selectedImage.path, selectedImage.name) : undefined}
      />
      <DocumentViewerModal
        url={pdfViewer?.url ?? null}
        name={pdfViewer?.name}
        onClose={() => setPdfViewer(null)}
        onDownload={pdfViewer ? () => downloadFile(pdfViewer.path, pdfViewer.name) : undefined}
      />
    </div>
  );
}

function ExchangeRatesSection() {
  const { data, isLoading, refetch, isFetching } = useExchangeRates();

  const currencies = [
    { code: "PEN", name: "Sol peruano",      country: "Perú" },
    { code: "COP", name: "Peso colombiano",  country: "Colombia" },
    { code: "MXN", name: "Peso mexicano",    country: "México" },
    { code: "ARS", name: "Peso argentino",   country: "Argentina" },
    { code: "CLP", name: "Peso chileno",     country: "Chile" },
    { code: "EUR", name: "Euro",             country: "España" },
    { code: "USD", name: "Dólar americano",  country: "Ecuador / Ref." },
  ];

  return (
    <div className="space-y-4" data-testid="section-exchange-rates">
      <div className="bg-white rounded-lg border border-field p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-subheading font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="size-icon-lg text-gray-700" />
            Tasas de cambio vs USD
          </h3>
          <Button variant="outline" size="touch"
            onClick={() => refetch()}
            disabled={isFetching}>
            <TrendingUp className={`size-icon-md ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Actualizando…" : "Actualizar ahora"}
          </Button>
        </div>
        {data?.lastUpdated && (
          <p className="text-caption text-gray-700 mb-2">
            Última actualización: {fmtDateTime(data.lastUpdated)}
            {data.cached && <span className="ml-2 text-gray-700">(caché)</span>}
          </p>
        )}
        <p className="text-caption text-gray-700 mb-4">
          Las tasas se actualizan automáticamente una vez por día desde open.er-api.com.
          El equivalente en USD (ej. <span>≈ 3 USD</span>) se muestra automáticamente en las tarjetas de pedidos para los tutores.
        </p>

        {!isLoading && !data?.rates ? (
          <EmptyState title="No se pudieron obtener las tasas de cambio." />
        ) : (
          <div className="overflow-x-auto">
            <AdminTable>
              <AdminTableHead>
                <tr>
                  <AdminTh>Código ISO de divisa</AdminTh>
                  <AdminTh>País</AdminTh>
                  <AdminTh align="right">1 USD equivale a</AdminTh>
                  <AdminTh align="right">1 unidad equivale a</AdminTh>
                </tr>
              </AdminTableHead>
              <AdminTableBody>
                {isLoading || !data?.rates ? (
                  <AdminTableSkeletonRows columns={4} rows={currencies.length} />
                ) : currencies.map((c) => {
                  const rate = data.rates[c.code];
                  if (!rate) return null;
                  const unitInUsd = 1 / rate;
                  return (
                    <AdminTr key={c.code}>
                      <AdminTd>
                        <p className="text-body font-medium text-gray-900">{c.code}</p>
                        <p className="text-caption text-gray-700">{c.name}</p>
                      </AdminTd>
                      <AdminCountryTd country={c.country} />
                      <AdminTd align="right" variant="primary">
                        {c.code === "USD"
                          ? "1.00 USD"
                          : formatPriceGrouped(rate, c.code)}
                      </AdminTd>
                      <AdminTd align="right" variant="muted">
                        {c.code === "USD"
                          ? "—"
                          : `≈ ${unitInUsd < 0.001 ? unitInUsd.toFixed(6) : unitInUsd < 0.01 ? unitInUsd.toFixed(5) : unitInUsd.toFixed(4)} USD`}
                      </AdminTd>
                    </AdminTr>
                  );
                })}
              </AdminTableBody>
            </AdminTable>
          </div>
        )}
      </div>
    </div>
  );
}
