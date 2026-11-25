import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, numeric, integer, boolean, jsonb, uniqueIndex, index, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // Hash scrypt. NULL = sin contrasena local (cuenta de Google, o creada por el admin y aun sin activar). SIN valor por
  // defecto: antes era '123456' y 138 de 190 cuentas la tenian (migrations/024). Se define con un enlace de activacion.
  password: text("password"),
  university: text("university"),
  avatar: text("avatar"),
  rating: numeric("rating", { precision: 3, scale: 2 }).default("0.00"),
  tasksPublished: integer("tasks_published").default(0),
  tasksCompleted: integer("tasks_completed").default(0),
  whatsapp: text("whatsapp"),
  country: text("country").default("PE"), // Country code for currency detection
  currency: text("currency").default("PEN"), // ISO currency code derived from country
  lastSeen: timestamp("last_seen").defaultNow(), // Track user last activity
  status: text("status").default("active"), // active, paused, suspended
  role: text("role"), // null = normal user, 'agent' = tutor agent
  agentPermissions: text("agent_permissions").array().default([]), // permissions for agent role: 'view_tasks', 'view_tutors', 'add_tutors'
  createdAt: timestamp("created_at").defaultNow(),
  // Registration tracking
  registrationDevice: text("registration_device"), // mobile, desktop, tablet
  registrationBrowser: text("registration_browser"), // Chrome, Safari, Firefox, etc.
  registrationOS: text("registration_os"), // iOS, Android, Windows, macOS
  registrationIP: text("registration_ip"), // IP address at registration
  registrationCity: text("registration_city"), // City from IP geolocation
  registrationCountry: text("registration_country"), // Country from IP geolocation
  supabaseUid: text("supabase_uid"), // Supabase Auth UID for fast deletion
  // Token de activacion (definir o restablecer contrasena por correo): solo el SHA-256, de un solo uso, vence en 24 h.
  activationTokenHash: text("activation_token_hash"),
  activationTokenExpires: timestamp("activation_token_expires"),
});

// Extended User type with userType for frontend usage
export type UserWithType = typeof users.$inferSelect & {
  userType: "student" | "tutor" | "admin" | "agent";
};

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  subject: text("subject").notNull(),
  studyArea: text("study_area").notNull(), // Nuevo campo para área de estudio
  requestType: text("request_type").notNull().default("tarea"),
  assignmentType: text("assignment_type"),
  service: text("service"),
  academicLevel: text("academic_level"),
  budget: numeric("budget", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("PEN"), // ISO currency code: PEN, MXN, COP, USD, EUR
  currentPrice: numeric("current_price", { precision: 10, scale: 2 }), // UNIFIED PRICE - Single source of truth
  priceLastUpdated: timestamp("price_last_updated"), // Track when price was last changed
  deadline: timestamp("deadline").notNull(),
  attachments: text("attachments").array().default([]),
  // Nombre original de cada adjunto (mismo orden que `attachments`); vacio en pedidos antiguos.
  attachmentNames: text("attachment_names").array().default([]),
  // Peso en bytes de cada adjunto (mismo orden); vacio en pedidos antiguos.
  attachmentSizes: integer("attachment_sizes").array().default([]),
  status: text("status").notNull().default("active"), // active, payment_pending, payment_rejected, in_progress, completed, expired
  assignedTutorId: varchar("assigned_tutor_id").references(() => users.id, { onDelete: "set null" }), // Tutor assigned when contracted
  invitedTutorId: varchar("invited_tutor_id").references(() => users.id, { onDelete: "set null" }), // Tutor specifically invited (optional)
  invitedTutorIds: text("invited_tutor_ids").array().default([]), // Multiple tutors invited by student
  candidateCount: integer("candidate_count").default(0),
  taskNumber: integer("task_number"), // Sequential task number for display (e.g., 213)
  deliveredAt: timestamp("delivered_at"), // When task was marked as delivered by tutor
  comment: text("comment"), // Additional comment or notes from student
  proposalsViewedAt: timestamp("proposals_viewed_at"), // When student first viewed the proposals
  deadlineReminderSentAt: timestamp("deadline_reminder_sent_at"), // Aviso de vencimiento ya enviado (NULL = pendiente); se limpia si cambia el plazo
  createdAt: timestamp("created_at").defaultNow(),
});

export const candidates = pgTable("candidates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  tutorId: varchar("tutor_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  proposedPrice: numeric("proposed_price", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true), // false = tutor was from previous round (task republished)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  unqTaskTutor: uniqueIndex("candidates_task_tutor_unique").on(table.taskId, table.tutorId),
}));

export const tutors = pgTable("tutors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: varchar("user_id").notNull().references(() => users.id),
  specialties: text("specialties").array(),
  profession: text("profession"), // e.g. "Ingeniero Civil", "Psicólogo"
  bio: text("bio"),
  rating: numeric("rating", { precision: 3, scale: 2 }).default("0.00"),
  isVerified: boolean("is_verified").default(false),
  hasGeneralAccess: boolean("has_general_access").default(false), // If true, tutor sees ALL tasks
  soundEnabled: boolean("sound_enabled").default(true), // Notification sounds preference
  studyAreaIds: text("study_area_ids").array().default([]), // Academic areas (informational only, no access effect)
  // URL amigable del perfil (/tutor/olga-perez). Se genera al crear el tutor y no cambia si luego se edita el nombre
  // (los enlaces compartidos no se rompen). NULL = aun sin slug: el perfil sigue abriendo por id. Ver migrations/022.
  slug: varchar("slug").unique(),
  // Idioma principal (nativo): "Español", "Inglés"... Ver shared/tutor-language.ts y migrations/026. NULL = sin indicar.
  language: text("language"),
});

export const favorites = pgTable("favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id),
  studentId: varchar("student_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  published: boolean("published").default(false).notNull(),
  publishedAt: timestamp("published_at"),
  updatedAt: timestamp("updated_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Hilo continuo de chat por par estudiante-tutor, independiente del pedido.
// Ver migrations/009_add_chat_threads.sql. task_id en chat_messages se mantiene
// intacto durante toda la migracion (paso "expand"); no se borra en esta fase.
export const chatThreads = pgTable("chat_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => users.id),
  tutorId: varchar("tutor_id").notNull().references(() => users.id),
  pairKey: varchar("pair_key").notNull().unique(),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").references(() => tasks.id),
  threadId: varchar("thread_id").references(() => chatThreads.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  receiverId: varchar("receiver_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  attachments: text("attachments").array(),
  // Nombre original de cada adjunto (mismo orden que `attachments`); '' si no se conoce.
  attachmentNames: text("attachment_names").array(),
  // Peso en bytes de cada adjunto (mismo orden); 0 si no se conoce.
  attachmentSizes: integer("attachment_sizes").array(),
  // Dimensiones en px de cada adjunto (mismo orden); null si no es imagen o se desconoce.
  // Permite reservar la caja de la imagen en el chat antes de que cargue (sin salto de layout).
  attachmentDims: jsonb("attachment_dims").$type<Array<{ w: number; h: number } | null>>(),
  // Mensaje al que responde (cita estilo WhatsApp). SET NULL si el original se borra.
  replyToId: varchar("reply_to_id").references((): AnyPgColumn => chatMessages.id, { onDelete: "set null" }),
  readBy: text("read_by").array().default([]), // Array of user IDs who have read this message
  deliveredAt: timestamp("delivered_at"), // When message was delivered to recipient
  readAt: timestamp("read_at"), // When message was read by recipient
  fileDownloadedAt: timestamp("file_downloaded_at"), // When recipient downloaded file attachments
  fileDownloadedBy: varchar("file_downloaded_by"), // User ID who downloaded the file
  // Moderacion de contacto privado: 'masked' = el servidor sustituyo telefono/enlace/email por asteriscos antes de
  // guardar; 'hidden' = el admin oculto el mensaje. `message` ya trae el texto censurado. El texto original NO vive aqui
  // (estas filas viajan a los usuarios por API y WebSocket): se guarda en admin_alerts.original_message.
  moderationStatus: text("moderation_status"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatRooms = pgTable("chat_rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  studentId: varchar("student_id").notNull().references(() => users.id),
  tutorId: varchar("tutor_id").notNull().references(() => users.id),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  userId: true,
  candidateCount: true,
  createdAt: true,
  status: true,
}).extend({
  budget: z.union([z.string(), z.number()]).transform((val) => Number(val)),
  deadline: z.union([z.string(), z.date()]).transform((val) => typeof val === 'string' ? new Date(val) : val),
});

export const insertCandidateSchema = createInsertSchema(candidates).omit({
  id: true,
  createdAt: true,
}).extend({
  proposedPrice: z.union([z.string(), z.number()]).transform((val) => String(val)),
});

export const insertTutorSchema = createInsertSchema(tutors).omit({
  id: true,
});

export const insertFavoriteSchema = createInsertSchema(favorites).omit({
  id: true,
  createdAt: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertChatThreadSchema = createInsertSchema(chatThreads).omit({
  id: true,
  createdAt: true,
  lastMessage: true,
  lastMessageAt: true,
});

export const insertChatRoomSchema = createInsertSchema(chatRooms).omit({
  id: true,
  createdAt: true,
  lastMessageAt: true,
});

// Payment tracking for admin verification
export const paymentVerifications = pgTable("payment_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id),
  studentId: varchar("student_id").notNull().references(() => users.id),
  tutorId: varchar("tutor_id").notNull().references(() => users.id),
  paymentMethod: text("payment_method").notNull(), // transferencia, yape
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  receiptUrl: text("receipt_url").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by").references(() => users.id, { onDelete: "set null" }),
});

// User payment history for fraud detection
export const userPaymentHistory = pgTable("user_payment_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  taskId: varchar("task_id").notNull().references(() => tasks.id),
  action: text("action").notNull(), // payment_submitted, payment_approved, payment_rejected
  details: text("details"), // reason for rejection, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin alerts for monitoring inappropriate content
export const adminAlerts = pgTable("admin_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // "personal_contact", "inappropriate_content"
  messageId: varchar("message_id").references(() => chatMessages.id, { onDelete: "set null" }),
  taskId: varchar("task_id").references(() => tasks.id),
  tutorId: varchar("tutor_id").references(() => users.id),
  studentId: varchar("student_id").notNull().references(() => users.id),
  detectedContent: text("detected_content").notNull(), // The flagged content
  status: text("status").notNull().default("pending"), // pending, reviewed, dismissed
  // Gravedad calculada al crear la alerta ("high" | "medium"); null en alertas antiguas (se deduce con severityFor).
  severity: text("severity"),
  // Texto original del mensaje marcado, antes de censurarlo u ocultarlo. Solo lo ve el admin.
  originalMessage: text("original_message"),
  // Accion de moderacion tomada desde la tarjeta: "message_hidden" | "warned" | "suspended".
  actionTaken: text("action_taken"),
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPaymentVerificationSchema = createInsertSchema(paymentVerifications).omit({
  id: true,
  createdAt: true,
  verifiedAt: true,
});

export const insertUserPaymentHistorySchema = createInsertSchema(userPaymentHistory).omit({
  id: true,
  createdAt: true,
});

export const insertAdminAlertSchema = createInsertSchema(adminAlerts).omit({
  id: true,
  createdAt: true,
});

// Registro de errores del servidor (panel de admin > Errores). Lo llena server/middleware/error-logger.ts;
// la ruta se guarda SIN query string y el mensaje/stack pasan por redact() (correos, tokens, telefonos). Ver migrations/023.
export const ERROR_LOG_LEVELS = ["error", "warning", "critical"] as const;
export const ERROR_LOG_STATUSES = ["pending", "resolved"] as const;
export const errorLogs = pgTable("error_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  level: text("level").notNull().default("error"), // "error" | "warning" | "critical"
  message: text("message").notNull(),
  stack: text("stack"),
  route: varchar("route"),
  method: varchar("method"),
  status: text("status").notNull().default("pending"), // "pending" | "resolved"
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertErrorLogSchema = createInsertSchema(errorLogs).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
  resolvedBy: true,
});

// Auditoria del super admin y de la impersonacion (ver migrations/025 y server/superadmin.ts).
export const SUPERADMIN_AUDIT_ACTIONS = ["impersonate_start", "impersonate_end", "request", "read"] as const;
export type SuperadminAuditAction = (typeof SUPERADMIN_AUDIT_ACTIONS)[number];

export const superadminAuditLog = pgTable("superadmin_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(), // SUPERADMIN_AUDIT_ACTIONS
  targetUserId: varchar("target_user_id").references(() => users.id, { onDelete: "set null" }),
  detail: jsonb("detail"),
  ip: text("ip"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Tareas vistas por tutores (para sistema de notificaciones)
export const tutorViewedTasks = pgTable("tutor_viewed_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => users.id),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at").defaultNow(),
});

// Vistas del perfil de un tutor (ver migrations/027): una fila por persona y tutor cada 6 h.
export const tutorProfileViews = pgTable("tutor_profile_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: "cascade" }),
  viewerId: varchar("viewer_id").references(() => users.id, { onDelete: "set null" }),
  viewedAt: timestamp("viewed_at").notNull().defaultNow(),
});

/** Estadisticas del propio tutor (GET /api/tutor/stats): lo que ve en su perfil. */
export type TutorOwnStats = {
  days: number;
  views: number;
  viewers: number;
  completed: number;
  rating: number;
  reviews: number;
  favorites: number;
  /** Horas promedio desde que se aprueba el pago hasta que entrega; null si aun no tiene entregas. */
  avgDeliveryHours: number | null;
  /** Vistas por dia (hora de Lima) de los ultimos `days` dias, sin huecos: un elemento por dia. */
  daily: { day: string; views: number }[];
};

// Catalogo de universidades (ver migrations/028): el usuario elige de aqui, el admin la mantiene.
export const universities = pgTable("universities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  country: text("country"), // codigo de pais (PE, VE…); opcional
  acronym: text("acronym"), // siglas (PUCP, UNMSM…); opcional
  status: text("status").notNull().default("approved"), // 'approved' | 'pending' (sugerida por un usuario, espera al admin)
  suggestedBy: varchar("suggested_by"), // id del usuario que la sugirio (solo si estuvo pendiente)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type University = typeof universities.$inferSelect;
/** Fila del panel admin: la universidad + cuantas cuentas la tienen elegida. */
export type UniversityWithUsage = University & { userCount: number };

export type TutorProfileViewStats = { tutorId: string; views: number; viewers: number };

export const insertTutorViewedTaskSchema = createInsertSchema(tutorViewedTasks).omit({
  id: true,
  viewedAt: true,
});

// Sistema de control de IDs para administración
export const systemIds = pgTable("system_ids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(), // 'user', 'task', 'tutor', 'candidate'
  entityId: varchar("entity_id").notNull(),
  systemCode: text("system_code").notNull(), // Código único del sistema (USR-001, TSK-001, etc.)
  displayName: text("display_name"), // Nombre visible para admins
  status: text("status").default("active"), // active, deleted, archived
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSystemIdSchema = createInsertSchema(systemIds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Tabla de áreas de estudio (carreras/cursos/materias)
export const studyAreas = pgTable("study_areas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  value: text("value").notNull().unique(),
  label: text("label").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabla para asignar cursos/materias a tutores (admin asigna)
export const tutorCourses = pgTable("tutor_courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: "cascade" }),
  courseId: varchar("course_id").notNull().references(() => studyAreas.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabla de tipos de trabajo académico
export const requestTypes = pgTable("request_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  value: text("value").notNull().unique(),
  label: text("label").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStudyAreaSchema = createInsertSchema(studyAreas).omit({
  id: true,
  createdAt: true,
});

export const insertRequestTypeSchema = createInsertSchema(requestTypes).omit({
  id: true,
  createdAt: true,
});

export type StudyArea = typeof studyAreas.$inferSelect;
export type InsertStudyArea = z.infer<typeof insertStudyAreaSchema>;
export type RequestType = typeof requestTypes.$inferSelect;
export type InsertRequestType = z.infer<typeof insertRequestTypeSchema>;

// Tabla de especialidades de profesores
export const careers = pgTable("careers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  category: text("category").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  tutorCount: integer("tutor_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabla de países disponibles
export const countries = pgTable("countries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 3 }).notNull().unique(), // PE, MX, CO, etc.
  name: text("name").notNull(), // Perú, México, Colombia
  flag: text("flag"), // Emoji flag 🇵🇪
  phoneCode: text("phone_code"), // Country phone code: +51, +52, +1, etc.
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabla de relación entre tutores y carreras (many-to-many)
export const tutorCareers = pgTable("tutor_careers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: "cascade" }),
  specialtyId: varchar("specialty_id").notNull().references(() => careers.id),
  experienceLevel: text("experience_level").default("intermediate"),
  yearsExperience: integer("years_experience").default(0),
  certificationUrl: text("certification_url"),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabla de certificaciones de tutores
export const tutorCertifications = pgTable("tutor_certifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tutorId: varchar("tutor_id").notNull().references(() => tutors.id, { onDelete: "cascade" }),
  title: text("title").notNull(), // Título del certificado/diploma
  institution: text("institution").notNull(), // Institución que otorga
  issueDate: timestamp("issue_date").notNull(),
  expiryDate: timestamp("expiry_date"), // Para certificaciones que expiran
  credentialId: text("credential_id"), // ID del certificado
  verificationUrl: text("verification_url"), // URL para verificar
  documentUrl: text("document_url"), // URL del documento
  isVerified: boolean("is_verified").default(false),
  verifiedBy: varchar("verified_by").references(() => users.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sistema de entrega y confirmación de tareas
export const taskDeliveries = pgTable("task_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  tutorId: varchar("tutor_id").notNull().references(() => users.id),
  studentId: varchar("student_id").notNull().references(() => users.id),
  deliveryMessage: text("delivery_message").notNull(), // Mensaje del tutor con la entrega
  deliveryFiles: text("delivery_files").array().default([]), // Archivos adjuntos
  status: text("status").notNull().default("delivered"), // delivered, confirmed, disputed
  studentConfirmedAt: timestamp("student_confirmed_at"), // Cuándo el estudiante confirmó
  disputeReason: text("dispute_reason"), // Si hay disputa, razón
  adminNotes: text("admin_notes"), // Notas del admin si hay disputa
  resolvedAt: timestamp("resolved_at"), // Cuándo se resolvió la disputa
  resolvedBy: varchar("resolved_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCareerSchema = createInsertSchema(careers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  tutorCount: true,
});

export const insertCountrySchema = createInsertSchema(countries).omit({
  id: true,
  createdAt: true,
});

export const insertTutorCareerSchema = createInsertSchema(tutorCareers).omit({
  id: true,
  createdAt: true,
});

export const insertTutorCertificationSchema = createInsertSchema(tutorCertifications).omit({
  id: true,
  createdAt: true,
  verifiedAt: true,
});

export const insertTaskDeliverySchema = createInsertSchema(taskDeliveries).omit({
  id: true,
  createdAt: true,
  studentConfirmedAt: true,
  resolvedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Tutor = typeof tutors.$inferSelect;
export type InsertTutor = z.infer<typeof insertTutorSchema>;
export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatRoom = typeof chatRooms.$inferSelect;
export type InsertChatRoom = z.infer<typeof insertChatRoomSchema>;
export type ChatThread = typeof chatThreads.$inferSelect;
export type InsertChatThread = z.infer<typeof insertChatThreadSchema>;

export type ReviewWithStudent = Review & {
  student: User;
  task: Task;
};

export type TaskWithCandidates = Task & {
  candidates: (Candidate & { tutor: User & { profession?: string | null; isVerified?: boolean | null } })[];
  user: User;
};

export type TutorWithUser = Tutor & {
  user: User;
  isFavorite?: boolean;
};

// Lo que la API publica devuelve de un tutor (GET /api/tutors y /api/tutors/:key). NUNCA incluye datos de contacto ni
// internos del usuario (correo, WhatsApp, IP de registro, supabaseUid...): esos solo salen por /api/admin/tutors.
// Se construye en server/tutor-public.ts.
export type PublicTutor = {
  id: string;
  slug: string | null;
  user_id: string;
  profession: string | null;
  specialties: string[] | null;
  bio: string | null;
  rating: string | null;
  isVerified: boolean | null;
  user: { id: string; name: string; avatar: string | null; lastSeen: Date | string | null; status: string | null };
  isFavorite?: boolean;
  completedTasksCount?: number;
  language: string | null;
};

// Resena publicada, solo lo que pinta el perfil (sin el usuario ni el pedido completos).
export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  publishedAt: Date | string | null;
  /** Alias del cliente ("Cliente 31215"); nunca su nombre real ni su foto. */
  student: { name: string; avatar: string | null };
};

export type TutorProfile = PublicTutor & { reviews: PublicReview[] };

export type PaymentVerification = typeof paymentVerifications.$inferSelect;
export type InsertPaymentVerification = z.infer<typeof insertPaymentVerificationSchema>;
export type UserPaymentHistory = typeof userPaymentHistory.$inferSelect;
export type InsertUserPaymentHistory = z.infer<typeof insertUserPaymentHistorySchema>;
export type AdminAlert = typeof adminAlerts.$inferSelect;
export type InsertAdminAlert = z.infer<typeof insertAdminAlertSchema>;
export type ErrorLogLevel = (typeof ERROR_LOG_LEVELS)[number];
export type ErrorLogStatus = (typeof ERROR_LOG_STATUSES)[number];
export type ErrorLog = typeof errorLogs.$inferSelect;
/** Fila del panel Errores: el registro + nombre y correo del usuario que lo provoco (si habia sesion). */
export type ErrorLogWithUser = ErrorLog & { userName: string | null; userEmail: string | null };
export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;
export type SystemId = typeof systemIds.$inferSelect;
export type InsertSystemId = z.infer<typeof insertSystemIdSchema>;
export type Career = typeof careers.$inferSelect;
export type InsertCareer = z.infer<typeof insertCareerSchema>;
export type Country = typeof countries.$inferSelect;
export type InsertCountry = z.infer<typeof insertCountrySchema>;
export type TutorCareer = typeof tutorCareers.$inferSelect;
export type InsertTutorCareer = z.infer<typeof insertTutorCareerSchema>;
export type TutorCertification = typeof tutorCertifications.$inferSelect;
export type InsertTutorCertification = z.infer<typeof insertTutorCertificationSchema>;
export type TaskDelivery = typeof taskDeliveries.$inferSelect;
export type InsertTaskDelivery = z.infer<typeof insertTaskDeliverySchema>;
export type TutorViewedTask = typeof tutorViewedTasks.$inferSelect;
export type InsertTutorViewedTask = z.infer<typeof insertTutorViewedTaskSchema>;

// Push notification subscriptions
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(), // Public key for encryption
  auth: text("auth").notNull(), // Auth secret
  userAgent: text("user_agent"), // Device info
  createdAt: timestamp("created_at").defaultNow(),
  lastUsed: timestamp("last_used").defaultNow(),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
  lastUsed: true,
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;

// Tokens de push nativo (FCM / APNs) de la app Capacitor. Un token pertenece a un solo usuario (UNIQUE).
export const nativePushTokens = pgTable("native_push_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  platform: text("platform").notNull(), // 'ios' | 'android' (CHECK en la migracion 020)
  appVersion: text("app_version"),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsed: timestamp("last_used").defaultNow(),
}, (table) => ({
  tokenUnique: uniqueIndex("native_push_tokens_token_unique").on(table.token),
}));

export const insertNativePushTokenSchema = z.object({
  token: z.string().trim().min(1).max(4096),
  platform: z.enum(["ios", "android"]),
  appVersion: z.string().trim().max(32).optional(),
});

export type NativePushToken = typeof nativePushTokens.$inferSelect;
export type InsertNativePushToken = z.infer<typeof insertNativePushTokenSchema> & { userId: string };

// Bloqueo entre usuarios: mientras exista la fila no se pueden enviar mensajes en ninguna direccion.
export const userBlocks = pgTable("user_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blockerId: varchar("blocker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  blockedId: varchar("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  pairUnique: uniqueIndex("user_blocks_pair_unique").on(table.blockerId, table.blockedId),
}));

export type UserBlock = typeof userBlocks.$inferSelect;

// Motivos de un reporte de usuario (los guarda admin_alerts, type "user_report").
export const REPORT_REASONS = ["spam", "harassment", "inappropriate", "fraud", "other"] as const;
export const reportUserSchema = z.object({
  reportedUserId: z.string().trim().min(1).max(64),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(500).optional(),
  taskId: z.string().trim().max(64).optional(),
});

// Tipos extendidos con relaciones
export type TutorWithSpecialties = Omit<Tutor, 'specialties'> & {
  user: User;
  specialties: (TutorCareer & { specialty: Career })[];
  certifications: TutorCertification[];
  isFavorite?: boolean;
};

// Bank accounts per country for payment
export const bankAccounts = pgTable("bank_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countryCode: text("country_code").notNull(), // PE, MX, CO, etc.
  bankName: text("bank_name").notNull(), // e.g., "BCP", "Interbank", "BBVA"
  accountHolder: text("account_holder").notNull(), // Titular de la cuenta
  accountNumber: text("account_number").notNull(), // Número de cuenta
  accountType: text("account_type").notNull(), // "ahorro", "corriente", "cci"
  currency: text("currency").notNull().default("PEN"), // PEN, MXN, USD
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBankAccountSchema = createInsertSchema(bankAccounts).omit({
  id: true,
  createdAt: true,
});

export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;

// Country settings for minimum budget and other configurations
export const countrySettings = pgTable("country_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countryCode: text("country_code").notNull().unique(), // PE, MX, CO, etc.
  countryName: text("country_name").notNull(), // Perú, México, Colombia
  flag: text("flag").notNull(), // 🇵🇪, 🇲🇽, 🇨🇴
  currency: text("currency").notNull(), // S/., $, €
  currencyCode: text("currency_code").notNull().default("PEN"), // ISO: PEN, MXN, COP, USD, EUR, ARS, CLP
  minBudget: numeric("min_budget", { precision: 10, scale: 2 }).notNull().default("10.00"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCountrySettingsSchema = createInsertSchema(countrySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CountrySettings = typeof countrySettings.$inferSelect;
export type InsertCountrySettings = z.infer<typeof insertCountrySettingsSchema>;

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  action: text("action").notNull(),
  detail: text("detail"),
  metadata: text("metadata"),
  ipAddress: text("ip_address"),
  device: text("device"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

// Task audit log — records admin content edits (title, description, comment)
export const taskAuditLogs = pgTable("task_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  adminId: varchar("admin_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  field: text("field").notNull(), // "title" | "description" | "comment"
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTaskAuditLogSchema = createInsertSchema(taskAuditLogs).omit({
  id: true,
  createdAt: true,
});

export type TaskAuditLog = typeof taskAuditLogs.$inferSelect;
export type InsertTaskAuditLog = z.infer<typeof insertTaskAuditLogSchema>;

// Contact filter rules — blacklist (trigger alert) and whitelist (never alert)
export const contactFilterRules = pgTable("contact_filter_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // "blacklist" | "whitelist"
  value: text("value").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContactFilterRuleSchema = createInsertSchema(contactFilterRules).omit({
  id: true,
  createdAt: true,
});

export type ContactFilterRule = typeof contactFilterRules.$inferSelect;
export type InsertContactFilterRule = z.infer<typeof insertContactFilterRuleSchema>;

// ───────────────────────── Pichangas Perú ─────────────────────────

export const VENUE_SURFACES = ["grass_sintetico", "grass_natural", "loza", "futsal"] as const;
export const MATCH_FORMATS = ["futbol_5", "futbol_6", "futbol_7", "futbol_8", "futbol_11"] as const;
export const MATCH_LEVELS = ["recreativo", "intermedio", "competitivo"] as const;
export const PLAYER_POSITIONS = ["portero", "defensa", "mediocampista", "delantero"] as const;
export const PLAYER_AGE_MIN = 10;
export const PLAYER_AGE_MAX = 80;

// Perfil de jugador de pichangas (edad y posicion). Tabla propia: la de usuarios la comparten otras apps.
export const playerProfiles = pgTable("player_profiles", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  age: integer("age"),
  position: text("position"), // PLAYER_POSITIONS
  // Perfil de host: puede crear y organizar partidos.
  isHost: boolean("is_host").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const MATCH_GENDERS = ["mixto", "varones", "mujeres"] as const;
export const MATCH_STATUSES = ["open", "full", "cancelled", "finished"] as const;
export const PLAYER_STATUSES = ["confirmed", "waitlist"] as const;

// Cancha (local donde se juega).
export const venues = pgTable("venues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  district: text("district").notNull(), // Distrito (Miraflores, SJL, Surco...)
  city: text("city").notNull().default("Lima"),
  address: text("address"),
  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }),
  surface: text("surface").notNull().default("grass_sintetico"),
  pricePerHour: numeric("price_per_hour", { precision: 10, scale: 2 }), // S/ por hora de cancha completa
  phone: text("phone"),
  photos: text("photos").array().default([]),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pichanga (partido convocado por un organizador).
export const matches = pgTable("matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizerId: varchar("organizer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  venueId: varchar("venue_id").notNull().references(() => venues.id),
  title: text("title").notNull(),
  description: text("description"),
  startsAt: timestamp("starts_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  format: text("format").notNull().default("futbol_7"),
  level: text("level").notNull().default("recreativo"),
  gender: text("gender").notNull().default("mixto"),
  maxPlayers: integer("max_players").notNull(),
  pricePerPlayer: numeric("price_per_player", { precision: 10, scale: 2 }).notNull().default("0.00"),
  currency: text("currency").notNull().default("PEN"),
  status: text("status").notNull().default("open"),
  // Portadas del partido (URLs, la primera es la principal). Vacio = se usan las fotos de la cancha.
  photos: text("photos").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Jugadores anotados. Un usuario solo puede estar una vez por partido.
export const matchPlayers = pgTable("match_players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("confirmed"), // confirmed | waitlist
  paid: boolean("paid").default(false),
  guests: integer("guests").notNull().default(0), // acompañantes que esta persona inscribe (cada uno ocupa un cupo y paga cuota)
  joinedAt: timestamp("joined_at").defaultNow(),
  // Cuando el cupo paso a confirmado sin pagar: desde ahi corre la reserva de 10 min. NULL = fila anterior a las reservas (no vence).
  confirmedAt: timestamp("confirmed_at"),
}, (table) => ({
  unqMatchUser: uniqueIndex("match_players_match_user_unique").on(table.matchId, table.userId),
}));

// Chat de grupo de un partido ("Camerino & Coordinacion"): solo lo leen y escriben los anotados y el organizador.
export const matchMessages = pgTable("match_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  matchCreatedIdx: index("match_messages_match_created_idx").on(table.matchId, table.createdAt),
}));

export const insertVenueSchema = createInsertSchema(venues, {
  name: z.string().trim().min(3).max(120),
  district: z.string().trim().min(2).max(80),
  surface: z.enum(VENUE_SURFACES),
}).omit({ id: true, createdAt: true, createdBy: true, isActive: true }).extend({
  pricePerHour: z.coerce.number().min(0).max(5000).optional().nullable().transform((v) => (v == null ? null : String(v))),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable().transform((v) => (v == null ? null : String(v))),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable().transform((v) => (v == null ? null : String(v))),
});

// Reglas del encuentro (se muestran en el detalle y en el pase de todos los partidos). Las edita el admin.
// `description` admite el marcador {hora}: se reemplaza por la hora de inicio de cada partido.
export const RULE_ICONS = ["clock", "footwear", "shield", "info"] as const;
export const pichangaRules = pgTable("pichanga_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("shield"),
  position: integer("position").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertRuleSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().min(3).max(300),
  icon: z.enum(RULE_ICONS),
  isActive: z.boolean().default(true),
});

export const insertMatchSchema = z.object({
  venueId: z.string().min(1),
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  startsAt: z.coerce.date().refine((d) => d.getTime() > Date.now(), "La fecha debe ser futura"),
  durationMinutes: z.coerce.number().int().min(30).max(240).default(60),
  format: z.enum(MATCH_FORMATS),
  level: z.enum(MATCH_LEVELS),
  gender: z.enum(MATCH_GENDERS),
  maxPlayers: z.coerce.number().int().min(4).max(30),
  pricePerPlayer: z.coerce.number().min(0).max(500),
  // Portadas subidas desde el panel (rutas /uploads/... o /objects/...); maximo 6.
  photos: z.array(z.string().trim().max(300).regex(/^(\/uploads\/|\/objects\/|https:\/\/)/, "Foto no válida")).max(6).optional(),
});

export type Venue = typeof venues.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchPlayer = typeof matchPlayers.$inferSelect;
export type MatchMessage = typeof matchMessages.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
