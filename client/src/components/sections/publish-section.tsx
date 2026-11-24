import { AttachField } from "@/components/ui/attach-field";
import { cn } from "@/lib/utils";
import { OUTLINED_LABEL } from "@/components/ui/outlined-field";
import { RatingStars } from "@/components/ui/rating-stars";
import { ROUTES } from "@/lib/routes";
import { EmptyState } from "@/components/ui/empty-state";
import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { ThreeColumnLayout } from "@/components/layout/three-column-layout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useQuery, useQueryClient
} from "@tanstack/react-query";
import {
  X, Check, Plus, AlertCircle, Calendar, BookOpen, GraduationCap, UserPlus
} from "lucide-react";
import { TutorIdentity } from "@/components/ui/tutor-identity";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DeleteIconButton } from "@/components/ui/delete-button";
import { PageBannerSheet } from "@/components/ui/page-banner-sheet";
import { deriveTitle } from "@/lib/derive-title";
import { Chip, COMPACT_CHIP_ROW } from "@/components/ui/chip";
import { InlineDateTimePicker } from "@/components/publish/inline-date-time-picker";
import { createPublishFormSchema } from "@/components/publish/publish-form-schema";
import { FileThumb } from "@/components/publish/file-thumb";
import { useFileUploads } from "@/components/publish/use-file-uploads";
import { CampoFila } from "@/components/publish/campo-fila";
import { OrderSummary } from "@/components/ui/order-summary";
import { PublishSuccessDialog } from "@/components/publish/success-dialog";
import { FileSourceDialog } from "@/components/publish/file-source-dialog";
import { useFilePicker } from "@/hooks/use-file-picker";
import type { PickSource } from "@/lib/file-picker";
import { MONTHS_ES, roundUpToQuarterHour, DEADLINE_QUICK } from "@/components/publish/deadline-utils";
import { FIELD_COMPLETE, FIELD_ERROR, FIELD_ERROR_MESSAGE, FIELD_PLACEHOLDER, Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, OutlinedFormControl } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Container } from "@/components/ui/Container";
import { trackEvent } from "@/lib/pixel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { FormDialog } from "@/components/ui/form-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MQ } from "@/lib/breakpoints";
import { triggerPwaBanner } from "@/hooks/use-pwa-trigger";
import { pausePriceSync, resumePriceSync } from "@/lib/price-sync";
import { type UserWithType, type CountrySettings } from "@shared/schema";
import { getCountryByCode, getMinBudgetByCountry } from "@/lib/timezone-utils";
import { Spinner } from "@/components/ui/spinner";
import { fileMetaText } from "@/lib/file-url-utils";
import { fileExtension } from "@/components/chat/attachments";

// ponytail: false = oculta 'Tipo de servicio' y 'Materia' del form de estudiante.
// Restaurar: cambiar a true (vuelve a pedir ambos campos, sin defaults fijos).
const SHOW_SERVICE_AND_STUDY_AREA_FIELDS = false;

// ponytail: false = oculta fila 'Invitar tutor' del form de publicar.
// invitedTutorId ya es z.string().optional() y invitedTutorUserIds arranca
// en [] — ocultar la fila no rompe submit, solo deja de mostrarse la opcion.
// Restaurar: cambiar a true.
const SHOW_INVITE_TUTOR_FIELD = false;

// Texto de ayuda de los Sheets de campos ocultos por flag (servicio, materia, invitar tutor).
const STEP_HINT = "text-body text-gray-700 mb-4";

// Primera tarjeta de cada paso: sube 28px sobre el banner de tutores (hoja blanca, mismo patron que AuthShell).
// Movil: hoja a sangre bajo el banner (como AuthShell); desde lg, tarjeta redondeada.

const POPULAR_SERVICES = ["Examen", "Tarea", "Ejercicios", "Clases online", "Tesis", "Ensayo"];

type MyTutor = { id: string; user_id: string; name: string; avatar: string | null; profession: string | null; rating: string; };

/* ─── Main component ─── */
const SHOW_PUBLISH_SUMMARY = false;

// Montos rapidos del presupuesto; el chip "Otro" lleva al campo para escribir cualquier otro.
const BUDGET_QUICK = [20, 40, 80];

export default function PublishSection() {
  const [screen, setScreen] = useState<string | null>(null);
  // Escritorio (>=1024px): muestra la columna derecha (resumen del pedido).
  // Mismo breakpoint 1024px que ThreeColumnLayout breakpoint="lg" en esta
  // pantalla (no el hook useIsMobile, que es de 768px y esta huerfano).
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(MQ.lg).matches);
  useEffect(() => {
    const mql = window.matchMedia(MQ.lg);
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  const { uploadedFiles, setUploadedFiles, fileObjectsRef, processFiles, retryUpload, resetFiles } = useFileUploads();
  const { pick: pickFile } = useFilePicker(processFiles);
  // La galeria de Publicar admite tambien video.
  const handlePickSource = (source: PickSource) => pickFile(source, source === "gallery" ? { accept: "image/*,video/*" } : undefined);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Error del ultimo envio, fijo en el formulario (el toast desaparece en segundos).
  const [publishError, setPublishError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [fileMenuAnchor, setFileMenuAnchor] = useState<HTMLElement | null>(null);
  const openFileMenu = (e: React.MouseEvent<HTMLElement>) => { setFileMenuAnchor(e.currentTarget); setShowFileMenu(true); };
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Tras intentar publicar, los campos requeridos vacios se marcan en rojo.
  const [showErrors, setShowErrors] = useState(false);
  // Paso 1: que necesitas + archivos. Paso 2: entrega, presupuesto y notas.
  const [quickHours, setQuickHours] = useState<number | null>(null);
  // "Otro" en presupuesto: lleva al campo para escribir el monto.
  const [customBudget, setCustomBudget] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const budgetInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [invitedTutorUserIds, setInvitedTutorUserIds] = useState<string[]>([]);
  const [invitedTutorNames, setInvitedTutorNames] = useState<Record<string, string>>({});

  const { data: currentUser } = useQuery<UserWithType>({ queryKey: ["/api/user/current"] });

  const { data: myTutors = [] } = useQuery<MyTutor[]>({
    queryKey: ["/api/my-tutors"],
    enabled: !!currentUser,
  });
  const { data: countrySetting } = useQuery<CountrySettings>({
    queryKey: ["/api/country-settings", currentUser?.country],
    queryFn: async () => {
      const res = await fetch(`/api/country-settings/${currentUser?.country}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!currentUser?.country,
  });

  const minBudget = countrySetting ? Number(countrySetting.minBudget) : getMinBudgetByCountry(currentUser?.country || "PE");
  const currency = countrySetting?.currencyCode || countrySetting?.currency || "PEN";
  const countryName = countrySetting?.countryName || (currentUser?.country ? getCountryByCode(currentUser.country)?.name : undefined);
  const formSchema = React.useMemo(() => createPublishFormSchema(minBudget, currency, countryName), [minBudget, currency, countryName]);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      service: SHOW_SERVICE_AND_STUDY_AREA_FIELDS ? "" : "Tarea",
      studyArea: SHOW_SERVICE_AND_STUDY_AREA_FIELDS ? "" : "general",
      subject: "", title: "", description: "", budget: "", deadline: "", invitedTutorId: "", additionalComments: "",
    },
    mode: 'onChange',
  });
  const watchedValues = form.watch();

  // Pre-fill service from URL param + read invitetutor param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Texto escrito en la barra "¿Que necesitas?" del Inicio: llega precargado en el titulo.
    const titleParam = params.get('title');
    if (titleParam) {
      form.setValue('title', deriveTitle(titleParam), { shouldValidate: true });
      form.setValue('description', titleParam, { shouldValidate: true });
    }
    const serviceParam = params.get('service');
    if (serviceParam) {
      fetch('/api/request-types').then(r => r.json())
        .then((types: Array<{value: string; label: string}>) => {
          const match = types.find(t => t.value.toLowerCase() === serviceParam.toLowerCase());
          if (match) {
            form.setValue('service', match.label);
          } else {
            const label = serviceParam.charAt(0).toUpperCase() + serviceParam.slice(1);
            form.setValue('service', label);
          }
        }).catch(console.error);
    }
    // Pre-fill invited tutor from URL param
    const inviteTutorId = params.get('invitetutor');
    const inviteTutorName = params.get('invitetutorname');
    if (inviteTutorId) {
      setInvitedTutorUserIds([inviteTutorId]);
      setInvitedTutorNames({ [inviteTutorId]: inviteTutorName || '' });
    }
  }, []);

  // El primer campo ("¿Que necesitas?") entra con el foco: se llega aqui desde el compositor del Inicio.
  // Ref por callback: el campo monta cuando termina de cargar el chunk diferido de esta pagina, asi que
  // ni autoFocus ni un efecto con [] llegan a tiempo.
  const needFocusedRef = useRef(false);
  const needFieldRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || needFocusedRef.current) return;
    const el = node.querySelector('textarea');
    if (!el) return;
    needFocusedRef.current = true;
    // Tactil: el campo queda enfocado (borde verde) pero SIN abrir el teclado (inputMode="none"). Al tocarlo se
    // restablece el modo y se re-enfoca dentro del gesto, que es lo que abre el teclado.
    if (window.matchMedia("(hover: none)").matches) {
      el.inputMode = "none";
      el.addEventListener("click", () => {
        el.inputMode = "text";
        el.blur();
        el.focus();
      }, { once: true });
    }
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  // Field completion
  const getFieldStatusForProgress = (fieldName: string): 'complete' | 'pending' => {
    if (fieldName === 'files') {
      return (uploadedFiles.filter(f => f.status === 'done').length > 0 || uploadedFiles.filter(f => f.status === 'uploading').length > 0) ? 'complete' : 'pending';
    }
    const value = watchedValues[fieldName as keyof typeof watchedValues];
    if (!value || value.toString().trim() === '') return 'pending';
    if (fieldName === 'title' && value.toString().length < 10) return 'pending';
    if (fieldName === 'budget' && Number(value) < minBudget) return 'pending';
    return 'complete';
  };

  const requiredFields = [
    ...(SHOW_SERVICE_AND_STUDY_AREA_FIELDS ? ['service', 'studyArea'] : []),
    'title', 'description', 'budget', 'deadline', 'files',
  ];
  const completedRequiredCount = requiredFields.filter(f => getFieldStatusForProgress(f) === 'complete').length;

  // Auto-advance: after completing a screen, go to the next incomplete required field
  // Solo los campos que aun abren el Sheet (flags); el resto es inline.
  const SCREEN_ORDER = SHOW_SERVICE_AND_STUDY_AREA_FIELDS ? ['service', 'studyArea'] : [];
  const goToNextScreen = (currentScreenId: string | null) => {
    const currentIndex = currentScreenId ? SCREEN_ORDER.indexOf(currentScreenId) : -1;
    // Search forward from current position
    for (let i = currentIndex + 1; i < SCREEN_ORDER.length; i++) {
      if (getFieldStatusForProgress(SCREEN_ORDER[i]) !== 'complete') {
        setScreen(SCREEN_ORDER[i]); return;
      }
    }
    // Wrap around: check fields before current
    for (let i = 0; i < currentIndex; i++) {
      if (getFieldStatusForProgress(SCREEN_ORDER[i]) !== 'complete') {
        setScreen(SCREEN_ORDER[i]); return;
      }
    }
    // All required fields complete → back to summary
    setScreen(null);
  };

  const setQuickDeadline = (hours: number) => {
    const d = roundUpToQuarterHour(new Date(Date.now() + hours * 3600000));
    const pad = (n: number) => String(n).padStart(2, '0');
    form.setValue('deadline', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`, { shouldValidate: true });
    setQuickHours(hours);
  };

  const formatDeadline = (val: string): string => {
    if (!val) return '';
    const d = new Date(val);
    const h = d.getHours(); const h12 = h % 12 || 12; const p = h >= 12 ? 'PM' : 'AM';
    return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} · ${String(h12).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${p}`;
  };

  // Ref, no state: isSubmitting (state) tarda un render en reflejarse, y
  // dos clicks/taps rapidos en el boton pueden ambos leer el valor viejo
  // (false) antes de ese commit, disparando onSubmit dos veces y por
  // tanto Lead dos veces. El ref muta sincrono, cierra esa ventana.
  const submitLockRef = useRef(false);

  const onSubmit = async (data: any) => {
    if (submitLockRef.current) return;
    const doneFiles = uploadedFiles.filter(f => f.status === 'done');
    const uploadingFiles = uploadedFiles.filter(f => f.status === 'uploading');
    if (doneFiles.length === 0 && uploadingFiles.length === 0) {
      toast({ title: "Error", description: "Debes subir al menos un archivo", variant: "destructive" }); return;
    }
    if (uploadingFiles.length > 0) {
      toast({ title: "Espera un momento", description: "Algunos archivos aún se están subiendo…" }); return;
    }
    if (uploadedFiles.filter(f => f.status === 'error').length > 0 && doneFiles.length === 0) {
      toast({ title: "Error", description: "Todos los archivos fallaron. Reintenta o sube otros.", variant: "destructive" }); return;
    }
    submitLockRef.current = true;
    setPublishError(null);
    setIsSubmitting(true); pausePriceSync();

    const taskPayload = {
      ...data, subject: data.studyArea, comment: data.additionalComments,
      attachments: doneFiles.map(f => f.serverPath!),
      attachmentNames: doneFiles.map(f => f.name),
      attachmentSizes: doneFiles.map(f => f.size),
      budget: data.budget.toString(), deadline: new Date(data.deadline).toISOString(),
      invitedTutorIds: invitedTutorUserIds,
    };

    // Optimistic: la tarea aparece en /orders antes de la confirmacion del
    // server (mismo patron que el chat en chat-fullscreen.tsx). El modal de
    // exito sigue esperando la respuesta real — hay validacion de negocio
    // (presupuesto, tutor invitado) que puede rechazar el pedido — pero la
    // lista ya no espera ese round-trip.
    const tempId = `temp-${Date.now()}`;
    queryClient.setQueryData(
      ["/api/tasks"],
      (old: any[] | undefined) => [
        {
          ...taskPayload,
          id: tempId,
          userId: currentUser?.id,
          status: 'active',
          candidates: [],
          candidateCount: 0,
          createdAt: new Date().toISOString(),
        },
        ...(old || []),
      ]
    );

    try {
      const res = await apiRequest("POST", "/api/tasks", taskPayload);
      const created = await res.json();
      queryClient.setQueryData(
        ["/api/tasks"],
        (old: any[] | undefined) => (old || []).map(t => t.id === tempId ? created : t)
      );
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      if (currentUser?.userType === 'student') trackEvent('Lead');
      const failedFiles = uploadedFiles.filter(f => f.status === 'error').length;
      if (failedFiles > 0) toast({ title: `Pedido publicado sin ${failedFiles} archivo${failedFiles > 1 ? 's' : ''}`, description: "No se pudieron subir. Envíalos por el chat del pedido.", variant: "destructive" });
      setIsSubmitting(false); triggerPwaBanner(); setShowSuccessModal(true);
    } catch (e: any) {
      queryClient.setQueryData(
        ["/api/tasks"],
        (old: any[] | undefined) => (old || []).filter(t => t.id !== tempId)
      );
      const msg = e?.message || "Error desconocido";
      setPublishError(msg);
      toast({ title: "Error al publicar: " + msg, variant: "destructive" });
      setIsSubmitting(false); submitLockRef.current = false;
    } finally { resumePriceSync(); }
  };

  const handlePublish = () => {
    setShowErrors(true);
    form.handleSubmit(onSubmit, (errors) => {
      console.error("[PUBLISH] validation errors:", errors);
      toast({ title: "Por favor completa todos los campos requeridos", variant: "destructive" });
    })();
  };

  const resetAndClose = () => {
    submitLockRef.current = false; setShowErrors(false);
    setShowSuccessModal(false); form.reset(); resetFiles(); setScreen(null); setShowNotes(false); setCustomBudget(false);
    setInvitedTutorUserIds([]); setInvitedTutorNames({});
    setLocation(ROUTES.orders);
  };

  const doneFilesCount = uploadedFiles.filter(f => f.status === 'done').length;
  const uploadingFilesCount = uploadedFiles.filter(f => f.status === 'uploading').length;

  // ── Screen helpers ──
  const SCREEN_TITLES: Record<string, string> = {
    service: 'Tipo de servicio', studyArea: 'Materia', invitar: 'Invitar un tutor',
  };
  const screenDoneDisabled = !!screen && requiredFields.includes(screen) && getFieldStatusForProgress(screen) !== 'complete';
  // combobox screens auto-close on selection — no Listo button needed
  const screenHasDoneButton = screen && !['service', 'studyArea'].includes(screen);

  const budgetIsQuick = BUDGET_QUICK.some(n => watchedValues.budget === String(n));

  // Tarjeta de entrega + presupuesto: va en la columna izquierda, bajo los adjuntos.
  const deliveryCard = (
    <>
              {/* Tarjeta de entrega + presupuesto (una sola, como la propuesta A) */}
              <div className="flex flex-col gap-field-gap">
                <div className="space-y-2">
                <FormField control={form.control} name="deadline" render={({ fieldState }) => (
                  <FormItem>
                    <div className="relative">
                      <button type="button" onClick={() => setShowDatePicker(true)}
                      className={cn(`w-full h-field px-4 rounded-control flex items-center gap-3 text-left text-base transition-colors focus-visible:outline-none focus-visible:border-green-600 focus-visible:ring-2 focus-visible:ring-green-100 ${fieldState.error ? `border border-solid ${FIELD_ERROR} ${watchedValues.deadline ? 'text-gray-900 font-medium' : FIELD_PLACEHOLDER}` : watchedValues.deadline ? `border border-solid ${FIELD_COMPLETE} text-gray-900 font-medium` : showErrors ? `border border-solid ${FIELD_ERROR} ${FIELD_PLACEHOLDER}` : `border border-solid border-field ${FIELD_PLACEHOLDER} hover:bg-gray-50`}`)}>
                      <Calendar className="size-icon-lg shrink-0 text-gray-700" />
                      {watchedValues.deadline ? formatDeadline(watchedValues.deadline) : 'Elige un plazo o una fecha y hora'}
                                          </button>
                      <span className={OUTLINED_LABEL}>¿Para cuándo lo necesitas? <span aria-hidden="true" className="text-error-fg">*</span></span>
                    </div>
                    {fieldState.error && <p className={`${FIELD_ERROR_MESSAGE} mt-1`}>{fieldState.error.message}</p>}
                  </FormItem>
                )} />

                <div className={COMPACT_CHIP_ROW}>
                  {DEADLINE_QUICK.map(q => (
                    <Chip compact key={q.hours} active={quickHours === q.hours} onClick={() => setQuickDeadline(q.hours)}>{q.label}</Chip>
                  ))}
                  <Chip compact active={!!watchedValues.deadline && quickHours === null} onClick={() => setShowDatePicker(true)} data-testid="deadline-other">Otro</Chip>
                </div>
                </div>

                <FormField control={form.control} name="budget" render={({ field, fieldState }) => (
                  <FormItem className="gap-2">
                    <OutlinedFormControl label={<>Presupuesto <span aria-hidden="true" className="text-error-fg">*</span></>}>
                      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-base text-gray-700">{currency}</span>
                      <FormControl>
                        <Input ref={budgetInputRef} type="number" inputMode="decimal" step="0.01" min={String(minBudget)} aria-required="true"
                          value={field.value || ''} onChange={e => field.onChange(e.target.value)} onBlur={field.onBlur}
                          className={`pl-16 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${getFieldStatusForProgress('budget') === 'complete' ? FIELD_COMPLETE : (showErrors || fieldState.error) ? FIELD_ERROR : ''}`} />
                      </FormControl>
                    </OutlinedFormControl>
                    <div className={COMPACT_CHIP_ROW}>
                      {BUDGET_QUICK.map(n => (
                        <Chip compact key={n} active={watchedValues.budget === String(n)} onClick={() => { setCustomBudget(false); form.setValue('budget', String(n), { shouldValidate: true }); }}>
                          {n} {currency}
                        </Chip>
                      ))}
                      <Chip
                        compact
                        active={!budgetIsQuick && (customBudget || !!watchedValues.budget)}
                        onClick={() => {
                          setCustomBudget(true);
                          if (budgetIsQuick) form.setValue('budget', '');
                          budgetInputRef.current?.focus();
                        }}
                        data-testid="budget-other"
                      >
                        Otro
                      </Chip>
                    </div>
                    {fieldState.error && <p className={FIELD_ERROR_MESSAGE}>{fieldState.error.message}</p>}
                  </FormItem>
                )} />
              </div>

              {/* Selector de fecha y hora: se abre desde el boton punteado */}
              <Dialog open={showDatePicker} onOpenChange={setShowDatePicker}>
                <DialogContent className="z-modal bg-white">
                  <DialogHeader><DialogTitle>Fecha y hora de entrega</DialogTitle></DialogHeader>
                  <FormField control={form.control} name="deadline" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <InlineDateTimePicker value={field.value || ''} onChange={val => { setQuickHours(null); field.onChange(val); }} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <Button size="lg" type="button" onClick={() => setShowDatePicker(false)} disabled={!watchedValues.deadline}
                    className="w-full">
                    Listo
                  </Button>
                </DialogContent>
              </Dialog>

    </>
  );

  // Boton de publicar: al final de la columna izquierda.
  const publishBlock = (
    <>
              {/* Publish button */}
              <div className="space-y-2">
                {publishError && (
                  <p role="alert" className="text-body text-error-fg text-center">No se pudo publicar tu pedido: {publishError}. Reintenta.</p>
                )}
                <div className="flex gap-3">
                <Button type="button" size="xl"
                  onClick={handlePublish}
                  disabled={isSubmitting || uploadedFiles.some(f => f.status === 'uploading')}
                  className="w-full">
                  {isSubmitting ? 'Publicando…' : uploadedFiles.some(f => f.status === 'uploading') ? 'Subiendo archivos…' : 'Publicar pedido'}
                </Button>
                </div>
                {completedRequiredCount < requiredFields.length && (
                  <p className="text-caption text-gray-700 text-center">Completa los campos pendientes para publicar.</p>
                )}
              </div>
    </>
  );

  // Columna derecha (solo desktop, detalle de ThreeColumnLayout list-heavy): progreso + resumen del pedido.
  const summaryRows: { label: string; value: string }[] = [
    { label: 'Título', value: watchedValues.title?.trim() || '' },
    { label: 'Archivos', value: doneFilesCount + uploadingFilesCount > 0 ? `${doneFilesCount + uploadingFilesCount} archivo${doneFilesCount + uploadingFilesCount > 1 ? 's' : ''}` : '' },
    { label: 'Fecha límite', value: formatDeadline(watchedValues.deadline) },
    { label: 'Presupuesto', value: watchedValues.budget ? `${currency} ${watchedValues.budget}` : '' },
    { label: 'Notas', value: watchedValues.additionalComments?.trim() || '' },
  ];
  // Misma tarjeta que "Tutores destacados" del Inicio: arranca arriba, a la altura del banner.
  const rightCards = (
    <Container fullWidth className="py-page-top">
      <OrderSummary rows={summaryRows} />
    </Container>
  );

  /* ══════════════════════════════════════════════════════════
     RENDER
     Layout: normal page flow (no fixed/absolute for main UI).
     - Summary and detail screens use conditional rendering.
     - Mismo eje que /tutores: ThreeColumnLayout list-heavy (7/10 cols),
       sin mx-auto/max-w-content (ver CLAUDE.md "Regla de tercera columna").
     - pb-bottom-nav clears the app's bottom navigation bar.
  ══════════════════════════════════════════════════════════ */
  return (
    <Form {...form}>
      <ThreeColumnLayout
        preset="list-detail"
        breakpoint="lg"
        // SHOW_PUBLISH_SUMMARY = false: columna "Resumen del pedido" oculta; el codigo queda para volver a mostrarla.
        detail={SHOW_PUBLISH_SUMMARY && isDesktop ? rightCards : null}
        list={
      /* Page wrapper — normal document flow, no fixed positioning */
      <div className="bg-white lg:bg-transparent">
        <div className="w-full">

          {/* ── Hidden file inputs (always mounted) ── */}

          {/* ════════════════════════════════
              A) SUMMARY (Hub) — siempre montado. El editor de campo ya
              no reemplaza esta vista, se abre encima en un <Sheet>
              (ver mas abajo, hermano de ThreeColumnLayout) para que el
              Hub siga visible de fondo.
          ════════════════════════════════ */}
            <Container fullWidth className="pt-page-top space-y-section-gap pb-0 lg:pb-6">
              {/* Mismo componente que Pedidos y Tutores. En movil la imagen se corre a la derecha para no tapar el titulo. */}
              <PageBannerSheet title="Publicar un pedido" onBack={isDesktop ? undefined : () => setLocation(ROUTES.root)} noBanner>
              {/* Campos ocultos por flag (servicio, materia, invitar tutor):
                  siguen abriendose en el Sheet de abajo. */}
              {(SHOW_SERVICE_AND_STUDY_AREA_FIELDS || SHOW_INVITE_TUTOR_FIELD) && (
                <div className="bg-white rounded-sheet border border-field overflow-hidden">
                  {SHOW_SERVICE_AND_STUDY_AREA_FIELDS && (
                    <CampoFila icon={<GraduationCap className="size-icon-md" />} label="Tipo de servicio" required
                      value={watchedValues.service} placeholder="Examen, tarea, tesis…"
                      isComplete={getFieldStatusForProgress('service') === 'complete'} onClick={() => setScreen('service')} />
                  )}
                  {SHOW_SERVICE_AND_STUDY_AREA_FIELDS && (
                    <CampoFila icon={<BookOpen className="size-icon-md" />} label="Materia" required
                      value={watchedValues.studyArea} placeholder="Elige la materia"
                      isComplete={getFieldStatusForProgress('studyArea') === 'complete'} onClick={() => setScreen('studyArea')} />
                  )}
                  {SHOW_INVITE_TUTOR_FIELD && (
                    <CampoFila icon={<UserPlus className="size-icon-md" />} label="Invitar tutor"
                      value={invitedTutorUserIds.length > 0
                        ? invitedTutorUserIds.length === 1
                          ? (invitedTutorNames[invitedTutorUserIds[0]] || 'Tutor seleccionado')
                          : `${invitedTutorUserIds.length} tutores invitados`
                        : undefined}
                      placeholder="Invita a un tutor de confianza (opcional)"
                      isComplete={invitedTutorUserIds.length > 0} onClick={() => setScreen('invitar')} />
                  )}
                </div>
              )}

                <div className="flex flex-col gap-field-gap">
                {/* Titulo + descripcion + archivos */}
                {/* Un solo campo: el texto completo es la descripcion; el titulo se deriva de el (primeros 100 caracteres) */}
                <FormField control={form.control} name="description" render={({ field }) => {
                  const err = form.formState.errors.title?.message || form.formState.errors.description?.message;
                  return (
                    <FormItem ref={needFieldRef} className="space-y-2">
                      <OutlinedFormControl label={<>¿Qué necesitas? <span aria-hidden="true" className="text-error-fg">*</span></>}>
                        <FormControl>
                          <Textarea rows={5} value={field.value || ''}
                            onChange={e => { const t = e.target.value; field.onChange(t); form.setValue('title', deriveTitle(t), { shouldValidate: true }); }}
                            onBlur={field.onBlur}
                            placeholder="Ej. Resolver 10 ejercicios de derivadas de Cálculo I. Necesito el procedimiento paso a paso y la entrega en PDF."
                            aria-required="true" className={getFieldStatusForProgress("title") === "complete" ? FIELD_COMPLETE : (showErrors || err) ? FIELD_ERROR : ""} />
                        </FormControl>
                      </OutlinedFormControl>
                      {err && <p className={FIELD_ERROR_MESSAGE}>{err}</p>}
                    </FormItem>
                  );
                }} />
                {/* Archivos: mismo campo que titulo y descripcion */}
                <div className="space-y-2">
                <div className="relative">
                  <div
                    className={uploadedFiles.length === 0 ? 'rounded-control' : `rounded-control transition-colors ${getFieldStatusForProgress('files') === 'complete' ? `border border-solid ${FIELD_COMPLETE}` : isDragOver ? 'border border-dashed border-green-600 bg-gray-100' : showErrors ? `border border-solid ${FIELD_ERROR}` : 'border border-solid border-field'}`}
                    onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
                    onDrop={e => { e.preventDefault(); setIsDragOver(false); processFiles(Array.from(e.dataTransfer.files)); }}
                  >
                    {uploadedFiles.length === 0 ? (
                      <AttachField onClick={openFileMenu} className={isDragOver ? 'border-green-600 bg-gray-100' : showErrors ? `border-solid ${FIELD_ERROR}` : undefined}>
                        Arrastra o haz clic para adjuntar
                      </AttachField>
                    ) : (
                      <div className="p-2 space-y-1">
                        {uploadedFiles.map(file => (
                          <div key={file.id} className="flex items-center gap-3 p-2 rounded-row">
                            <div className="relative size-thumb shrink-0 rounded-thumb bg-white shadow-sm overflow-hidden">
                              <FileThumb file={file} source={fileObjectsRef.current.get(file.id)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-body text-gray-900 truncate">{file.name}</p>
                                </TooltipTrigger>
                                <TooltipContent>{file.name}</TooltipContent>
                              </Tooltip>
                              <p className="text-caption text-gray-700">
                                {fileMetaText(fileExtension(file.name), file.size)}
                                {file.status === 'uploading' && <span className="text-green-600 ml-1">Subiendo… {file.progress}%</span>}
                                {file.status === 'error' && (
                                  <>
                                    <span className="text-error-fg ml-1">{file.errorMessage || 'Error'}</span>
                                    {!file.rejected && (
                                    <button type="button" onClick={() => { const f = fileObjectsRef.current.get(file.id); if (f) retryUpload(file.id, f); }}
                                      className="ml-1 text-green-600 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Reintentar</button>
                                    )}
                                  </>
                                )}
                              </p>
                            </div>
                            {file.status === 'done' && <Check className="size-icon-md text-green-600 shrink-0" aria-label="Subido" />}
                            {file.status === 'uploading' && <Spinner size="sm" className="text-green-600 shrink-0" />}
                            {file.status === 'error' && <AlertCircle className="size-icon-md text-error-fg shrink-0" aria-label="Error" />}
                            <DeleteIconButton type="button" aria-label="Quitar archivo"
                              onClick={() => { setUploadedFiles(prev => prev.filter(f => f.id !== file.id)); fileObjectsRef.current.delete(file.id); }}
                              className="size-touch shrink-0" />
                          </div>
                        ))}
                        <button type="button" onClick={openFileMenu}
                          className="w-full flex items-center gap-3 p-2 rounded-row text-body font-medium text-green-600 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <span className="size-thumb shrink-0 rounded-thumb border border-dashed border-field flex items-center justify-center"><Plus className="size-icon-lg" /></span>
                          Añadir archivo
                        </button>
                      </div>
                    )}
                  </div>
                  <span className={OUTLINED_LABEL}>Archivos <span aria-hidden="true" className="text-error-fg">*</span></span>
                </div>
                {showErrors && getFieldStatusForProgress('files') !== 'complete' && <p className={FIELD_ERROR_MESSAGE}>Sube al menos un archivo</p>}
              </div>

                {deliveryCard}

                {/* Notas (opcional): plegadas hasta que se pidan; con texto (p. ej. borrador restaurado) quedan abiertas. */}
                <div>
                {showNotes || watchedValues.additionalComments?.trim() ? (
                <FormField control={form.control} name="additionalComments" render={({ field }) => (
                  <FormItem>
                    <OutlinedFormControl label={<>Notas adicionales <span className="text-gray-700 font-normal">(opcional)</span></>}>
                      <FormControl>
                        <Textarea rows={3} autoFocus={showNotes} value={field.value || ''} onChange={e => field.onChange(e.target.value)} onBlur={field.onBlur}
                          placeholder="Formato, normas APA, tono, referencias…"
                          className={watchedValues.additionalComments?.trim() ? FIELD_COMPLETE : ""} />
                      </FormControl>
                    </OutlinedFormControl>
                  </FormItem>
                )} />
                ) : (
                  <button type="button" onClick={() => setShowNotes(true)} data-testid="button-add-notes"
                    className={`flex h-field w-full items-center gap-3 rounded-control border border-solid border-field px-4 text-left ${FIELD_PLACEHOLDER} transition-colors hover:bg-gray-50 focus-visible:border-green-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100`}>
                    <Plus className="size-icon-lg shrink-0 text-gray-700" aria-hidden />
                    Notas adicionales (opcional)
                  </button>
                )}
              </div>

                {publishBlock}
                </div>
              </PageBannerSheet>
            </Container>

          {/* ════════════════════════════════
              B) FIELD DETAIL — mismo FormDialog que Pedidos; el Hub queda visible de fondo. ════════════════════════════════ */}
          <FormDialog
            open={!!screen}
            onOpenChange={(open) => { if (!open) setScreen(null); }}
            title={screen ? SCREEN_TITLES[screen] : ""}
            onCancel={() => setScreen(null)}
            cancelLabel={screenHasDoneButton ? "Cancelar" : "Cerrar"}
            onSubmit={screenHasDoneButton ? () => goToNextScreen(screen) : undefined}
            submitLabel={screen === 'files' && doneFilesCount > 0 ? `Listo · ${doneFilesCount} archivo${doneFilesCount > 1 ? 's' : ''}` : 'Listo'}
            submitDisabled={screenDoneDisabled}
          >
            {screen && (
              <>

                {/* ── Service ── */}
                {screen === 'service' && (
                  <>
                    <p className={STEP_HINT}>¿Qué tipo de trabajo es? Elige el que más se acerque.</p>
                    <FormField control={form.control} name="service" render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Combobox value={field.value} onValueChange={val => { field.onChange(val); goToNextScreen('service'); }}
                            searchEndpoint="/api/request-types" placeholder="Buscar servicio…"
                            autoFocus recentFieldId="service" dropdownClassName="max-h-dropdown"
                            onCreateOption={(inputValue) => { field.onChange(inputValue); goToNextScreen('service'); }}
                            createLabel="Usar" />
                        </FormControl>
                      </FormItem>
                    )} />
                    <div className="mt-5 space-y-3">
                      <p className="text-caption text-gray-700 font-medium uppercase tracking-wide">Populares</p>
                      <div className="grid grid-cols-2 gap-3">
                        {POPULAR_SERVICES.map(opt => (
                          <Chip key={opt} active={watchedValues.service === opt} className="w-full" onClick={() => { form.setValue('service', opt, { shouldValidate: true }); goToNextScreen('service'); }}>
                            {opt}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* ── Study area ── */}
                {screen === 'studyArea' && (
                  <>
                  <p className={STEP_HINT}>El curso o materia sobre la que necesitas ayuda.</p>
                  <FormField control={form.control} name="studyArea" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Combobox value={field.value} onValueChange={val => { field.onChange(val); goToNextScreen('studyArea'); }}
                          searchEndpoint="/api/study-areas" placeholder="Ej: Física 1, Cálculo, Derecho Civil…"
                          autoFocus recentFieldId="studyArea" dropdownClassName="max-h-dropdown"
                          onCreateOption={async (inputValue) => {
                            try {
                              const res = await fetch('/api/study-areas', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name: inputValue }),
                              });
                              if (res.ok) {
                                const created = await res.json();
                                field.onChange(created.value ?? created.id ?? inputValue);
                              } else {
                                field.onChange(inputValue);
                              }
                            } catch {
                              field.onChange(inputValue);
                            }
                            goToNextScreen('studyArea');
                          }}
                          createLabel="Agregar materia" />
                      </FormControl>
                    </FormItem>
                  )} />
                  </>
                )}

                {/* ── Invitar ── */}
                {screen === 'invitar' && (
                  <>
                    <p className={STEP_HINT}>Elige uno o más tutores de confianza para invitarlos. Ellos verán tu pedido primero.</p>
                    {/* Clear option */}
                    <button
                      type="button"
                      aria-pressed={invitedTutorUserIds.length === 0}
                      onClick={() => { setInvitedTutorUserIds([]); setInvitedTutorNames({}); setScreen(null); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-control mb-3 transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${invitedTutorUserIds.length === 0 ? 'border-green-600 bg-white text-gray-900' : 'border-field bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                      <div className="size-icon-circle rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                        <X className="size-icon-md text-gray-700" />
                      </div>
                      <span className="text-body font-semibold">Para todos</span>
                    </button>
                    {myTutors.length === 0 ? (
                      <EmptyState icon={UserPlus} title="Aún no tienes tutores guardados" description="Agrega tutores a favoritos para poder invitarlos." />
                    ) : (
                      <div className="space-y-2">
                        {myTutors.map(tutor => {
                          const isSelected = invitedTutorUserIds.includes(tutor.user_id);
                          return (
                            <button
                              key={tutor.user_id}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => {
                                if (isSelected) {
                                  setInvitedTutorUserIds(prev => prev.filter(id => id !== tutor.user_id));
                                  setInvitedTutorNames(prev => { const n = { ...prev }; delete n[tutor.user_id]; return n; });
                                } else {
                                  setInvitedTutorUserIds(prev => [...prev, tutor.user_id]);
                                  setInvitedTutorNames(prev => ({ ...prev, [tutor.user_id]: tutor.name }));
                                }
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-control transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${isSelected ? 'border-green-600 bg-white' : 'border-field bg-white hover:bg-gray-50'}`}
                            >
                              <TutorIdentity name={tutor.name} avatar={tutor.avatar} profession={tutor.profession} avatarSize="sm" />
                              <RatingStars compact value={parseFloat(tutor.rating || '0')} size="sm" className="shrink-0" />
                              {isSelected && (
                                <Check className="size-icon-md text-green-600 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

              </>
            )}
          </FormDialog>

        </div>
      </div>
        }
      />
      {/* end ThreeColumnLayout list (page wrapper) */}

      <PublishSuccessDialog open={showSuccessModal} onClose={resetAndClose} />

      <FileSourceDialog open={showFileMenu} onOpenChange={setShowFileMenu} anchor={fileMenuAnchor} align="start" onPick={handlePickSource} />
    </Form>
  );
}
