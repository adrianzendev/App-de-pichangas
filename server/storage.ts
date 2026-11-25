import { hashPassword, isHashed } from "./password";
import {
  users, tasks, candidates, tutors, favorites, reviews, chatMessages, chatRooms, chatThreads,
  paymentVerifications, userPaymentHistory, adminAlerts, systemIds,
  studyAreas, requestTypes, countries, bankAccounts, countrySettings,
  careers, tutorCareers, tutorCertifications, taskDeliveries, tutorViewedTasks, universities,
  pushSubscriptions, nativePushTokens, userBlocks, tutorCourses, contactFilterRules,
  type User, type Task, type Candidate, type Tutor, type Favorite, type Review, 
  type TaskWithCandidates, type TutorWithUser, type ReviewWithStudent, type TutorProfileViewStats, type University, type UniversityWithUsage,
  type ChatMessage, type ChatThread, type PaymentVerification, type AdminAlert, type SystemId,
  type StudyArea, type RequestType, type Country, type BankAccount, type CountrySettings,
  type Career, type TutorCareer, type TutorCertification, type TutorWithSpecialties,
  type TaskDelivery, type PushSubscription,
  type InsertUser, type InsertTask, type InsertCandidate, type InsertTutor, 
  type InsertFavorite, type InsertReview, type InsertChatMessage,
  type InsertPaymentVerification, type InsertAdminAlert, type InsertUserPaymentHistory, type InsertSystemId,
  type InsertStudyArea, type InsertRequestType, type InsertCountry, type InsertBankAccount,
  type InsertCareer, type InsertTutorCareer, type InsertTutorCertification, type InsertTaskDelivery,
  type InsertPushSubscription, type InsertCountrySettings, type NativePushToken, type InsertNativePushToken,
  activityLogs, type ActivityLog, type InsertActivityLog,
  taskAuditLogs, type TaskAuditLog, type InsertTaskAuditLog,
  type ContactFilterRule, type InsertContactFilterRule,
  errorLogs, type ErrorLog, type InsertErrorLog, type ErrorLogWithUser
} from "@shared/schema";
import { db } from "./db";
import type { DeliveryRow } from "./delivery-stats";
import { chatPreviewText, type ReplyPreview } from "@shared/chat-preview";
import { severityFor, type AlertSeverity } from "@shared/alert-severity";
import { HIDDEN_MESSAGE_TEXT } from "@shared/contact-filter";

/** Alerta del admin con los datos de su mensaje, remitente y pedido, mas gravedad y reincidencia. */
export type EnrichedAdminAlert = AdminAlert & {
  chatMessage: string | null;
  senderName: string | null;
  senderRole: 'Alumno' | 'Tutor' | null;
  taskTitle: string | null;
  severity: AlertSeverity;
  /** Quien envio el mensaje reportado (o el alumno del pedido si la alerta no viene de un mensaje). */
  offenderId: string;
  /** 'masked' (censurado al enviar), 'hidden' (oculto por el admin) o null. */
  moderationStatus: string | null;
  /** Alertas de contacto anteriores (no descartadas) del mismo infractor. */
  priorAlerts: number;
};
import { eq, ne, and, or, desc, sql, inArray, isNull, gte, lte, gt, lt } from "drizzle-orm";
import { slugBase, uniqueSlug } from "./tutor-slug";

// db o la tx de db.transaction: ambos exponen las mismas operaciones de consulta.
type DbExecutor = Pick<typeof db, 'select' | 'selectDistinct' | 'update' | 'delete'>;

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  /** Guarda el hash del token de activacion de la cuenta (sustituye al anterior: un solo enlace vigente). */
  setActivationToken(userId: string, tokenHash: string, expires: Date): Promise<void>;
  /** Canjea un token vigente: fija la contrasena y lo borra en UN solo UPDATE (un token no se usa dos veces). */
  consumeActivationToken(tokenHash: string, newPassword: string): Promise<{ id: string; email: string } | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  updateUserStatus(id: string, status: 'active' | 'paused'): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  
  // Tasks
  getTasks(): Promise<TaskWithCandidates[]>;
  getTask(id: string): Promise<TaskWithCandidates | undefined>;
  createTask(userId: string, insertTask: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined>;
  updateTaskStatus(taskId: string, status: string): Promise<Task | undefined>;
  updateExpiredTasks(): Promise<number>; // Returns count of updated tasks
  claimDueDeadlineReminders(): Promise<Array<{ id: string; title: string; userId: string; assignedTutorId: string | null; status: string; deadline: Date }>>;
  deleteTask(id: string): Promise<boolean>;
  reopenTask(taskId: string, newDeadline: Date): Promise<Task | undefined>; // Republish: update deadline, reset status, clear candidates
  getTasksByUserId(userId: string): Promise<TaskWithCandidates[]>;
  
  // UNIFIED PRICE SYSTEM - Single source of truth
  getTaskCurrentPrice(taskId: string): Promise<{ currentPrice: string; lastUpdated: Date } | null>;
  updateTaskCurrentPrice(taskId: string, newPrice: string): Promise<{ currentPrice: string; lastUpdated: Date }>;
  markProposalsViewed(taskId: string): Promise<void>;
  
  // Candidates
  createCandidate(insertCandidate: InsertCandidate): Promise<Candidate>;
  getCandidatesByTask(taskId: string): Promise<Candidate[]>;
  rejectCandidate(taskId: string, tutorId: string): Promise<boolean>;
  updateCandidateProposedPrice(taskId: string, tutorId: string, price: string): Promise<Candidate | undefined>;
  
  // Tutors
  getTutors(): Promise<TutorWithUser[]>;
  getActiveTasksForTutor(tutorUserId: string): Promise<{ id: string; taskNumber: number | null; title: string; status: string }[]>;
  searchTutors(query: string, activeOnly?: boolean): Promise<{ value: string; label: string; rating: string | null; profession: string | null }[]>;
  createTutor(insertTutor: InsertTutor): Promise<Tutor>;
  getTutorById(id: string): Promise<TutorWithUser | undefined>;
  /** Perfil por id (enlaces antiguos) o por slug (/tutor/olga-perez). */
  getTutorByIdOrSlug(key: string): Promise<TutorWithUser | undefined>;
  getTutorByUserId(userId: string): Promise<TutorWithUser | undefined>;
  getTutorByEmail(email: string): Promise<TutorWithUser | undefined>;
  updateTutor(id: string, updates: Partial<Tutor>): Promise<TutorWithUser | undefined>;
  updateTutorProfile(id: string, updates: Partial<Tutor>): Promise<TutorWithUser | undefined>;
  getTutorReviews(tutorId: string): Promise<ReviewWithStudent[]>;
  getReviewByTaskAndStudent(taskId: string, studentId: string): Promise<Review | undefined>;
  createReview(insertReview: InsertReview): Promise<Review>;
  updateReview(id: string, updates: Partial<Review>): Promise<Review | undefined>;
  publishDueReviews(): Promise<number>;
  getTutorsWithSpecialties(): Promise<TutorWithSpecialties[]>;
  deleteTutor(id: string): Promise<boolean>;
  
  // Specialties (Areas)
  getCareers(): Promise<Career[]>;
  createCareer(insertCareer: InsertCareer): Promise<Career>;
  updateCareer(id: string, updates: Partial<Career>): Promise<Career | undefined>;
  deleteCareer(id: string): Promise<boolean>;
  
  // Countries
  getCountries(): Promise<Country[]>;
  createCountry(insertCountry: InsertCountry): Promise<Country>;
  updateCountry(id: string, updates: Partial<Country>): Promise<Country | undefined>;
  deleteCountry(id: string): Promise<boolean>;
  
  // Bank Accounts
  getBankAccounts(): Promise<BankAccount[]>;
  getBankAccountsByCountry(countryCode: string): Promise<BankAccount[]>;
  createBankAccount(insertBankAccount: InsertBankAccount): Promise<BankAccount>;
  updateBankAccount(id: string, updates: Partial<BankAccount>): Promise<BankAccount | undefined>;
  deleteBankAccount(id: string): Promise<boolean>;
  
  // Country Settings (min budget per country)
  getCountrySettings(): Promise<CountrySettings[]>;
  getCountrySettingByCode(countryCode: string): Promise<CountrySettings | undefined>;
  createCountrySetting(insertSetting: InsertCountrySettings): Promise<CountrySettings>;
  updateCountrySetting(id: string, updates: Partial<CountrySettings>): Promise<CountrySettings | undefined>;
  deleteCountrySetting(id: string): Promise<boolean>;
  
  // Tutor Careers
  addTutorCareer(insertTutorCareer: InsertTutorCareer): Promise<TutorCareer>;
  removeTutorCareer(tutorId: string, specialtyId: string): Promise<boolean>;
  getTutorCareers(tutorId: string): Promise<(TutorCareer & { career: Career })[]>;
  
  // Tutor Certifications
  addTutorCertification(insertCertification: InsertTutorCertification): Promise<TutorCertification>;
  getTutorCertifications(tutorId: string): Promise<TutorCertification[]>;
  verifyCertification(id: string, verifiedBy: string): Promise<TutorCertification | undefined>;
  
  // Tutor Courses (admin-assigned course access)
  getTutorCourses(tutorId: string): Promise<StudyArea[]>;
  setTutorCourses(tutorId: string, courseIds: string[]): Promise<void>;
  updateTutorGeneralAccess(tutorId: string, hasGeneralAccess: boolean): Promise<Tutor | undefined>;
  getAvailableTasksForTutor(tutorId: string, opts?: { since?: Date; tutorUserId?: string; tutor?: TutorWithUser }): Promise<TaskWithCandidates[]>;
  
  // Favorites
  toggleFavorite(userId: string, tutorId: string): Promise<{ isFavorite: boolean }>;
  getUserFavorites(userId: string): Promise<any[]>;
  getFavoriteTutorIds(userId: string): Promise<string[]>;
  getCompletedTaskCountPerTutor(): Promise<Map<string, number>>;

  // Chat
  createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage>;
  resolveChatRoles(senderId: string, receiverId: string, task?: Task): Promise<{ studentId: string; tutorId: string }>;
  getChatMessages(taskId: string, userId1: string, userId2: string, limit?: number, before?: string): Promise<Array<ChatMessage & { replyTo?: ReplyPreview | null }>>;
  getAllChatMessagesByTask(taskId: string): Promise<ChatMessage[]>;
  getChatMessagesSince(since: Date): Promise<Array<{ id: string; taskId: string | null; senderId: string; receiverId: string; message: string; createdAt: Date | null; taskOwnerId: string | null }>>;
  markMessagesAsRead(taskId: string, userId: string, otherUserId: string): Promise<string[]>;
  markMessagesAsDelivered(userId: string): Promise<number>; // Mark all pending messages to this user as delivered
  markFileDownloaded(messageId: string, userId: string): Promise<ChatMessage | undefined>;
  getLastMessagesForAllConversations(userId: string): Promise<Map<string, { message: string; timestamp: Date; fromCurrentUser: boolean; unreadCount: number; isDelivered: boolean; isReadByRecipient: boolean }>>;

  // Chat threads (user-centric: un hilo continuo por par estudiante-tutor)
  threadExists(userIdA: string, userIdB: string): Promise<boolean>;
  findThreadByPair(userIdA: string, userIdB: string): Promise<ChatThread | undefined>;
  getOrCreateThread(studentId: string, tutorId: string): Promise<ChatThread>;
  getThreadById(threadId: string): Promise<ChatThread | undefined>;
  getThreadsForUser(userId: string): Promise<Array<ChatThread & { unreadCount: number }>>;
  getMessagesByThread(threadId: string, userId: string, limit?: number, before?: string): Promise<Array<ChatMessage & { replyTo?: ReplyPreview | null }>>;
  withReplyPreviews<T extends ChatMessage>(messages: T[]): Promise<Array<T & { replyTo?: ReplyPreview | null }>>;
  getChatMessageById(id: string): Promise<ChatMessage | undefined>;
  markMessagesAsReadByThread(threadId: string, userId: string): Promise<string[]>;
  getSendableTaskForThread(threadId: string): Promise<Task | undefined>;
  getTasksByIds(ids: string[]): Promise<Task[]>;
  deleteChatMessagesByTask(taskId: string, exec?: DbExecutor): Promise<void>;
  getLastMessagesForThreads(threadIds: string[]): Promise<Map<string, ChatMessage>>;

  // Payment Verification
  createPaymentVerification(insertPayment: InsertPaymentVerification): Promise<PaymentVerification>;
  getPaymentVerifications(): Promise<PaymentVerification[]>;
  getPaymentVerification(id: string): Promise<PaymentVerification | undefined>;
  updatePaymentVerification(id: string, status: string, notes?: string, extraFields?: { amount?: string; paymentMethod?: string }, previousStatus?: string): Promise<PaymentVerification | undefined>;
  deletePaymentVerification(id: string): Promise<boolean>;
  getPaymentVerificationByTaskAndTutor(taskId: string, userId: string, tutorId: string): Promise<PaymentVerification | undefined>;
  
  // Admin Alerts
  getAdminAlerts(): Promise<AdminAlert[]>;
  getAdminAlertsEnriched(): Promise<EnrichedAdminAlert[]>;
  getAdminAlertById(id: string): Promise<AdminAlert | undefined>;
  setAdminAlertOriginalIfMissing(id: string, originalMessage: string): Promise<void>;
  hideChatMessage(messageId: string): Promise<ChatMessage | undefined>;
  createAdminAlert(insertAlert: InsertAdminAlert): Promise<AdminAlert>;
  // Registro de errores del servidor (panel de admin > Errores)
  createErrorLog(log: InsertErrorLog): Promise<ErrorLog>;
  getDeliveryRows(): Promise<DeliveryRow[]>;
  recordTutorProfileView(tutorId: string, viewerId: string): Promise<void>;
  getTutorProfileViewStats(days: number): Promise<TutorProfileViewStats[]>;
  countTutorFavorites(tutorId: string): Promise<number>;
  listUniversities(): Promise<UniversityWithUsage[]>;
  createUniversity(data: { name: string; country?: string | null; acronym?: string | null; status?: "approved" | "pending"; suggestedBy?: string | null }): Promise<University>;
  updateUniversity(id: string, data: { name?: string; country?: string | null; acronym?: string | null; status?: "approved" | "pending" }): Promise<University | undefined>;
  deleteUniversity(id: string): Promise<boolean>;
  universityExists(name: string): Promise<boolean>;
  getTutorProfileViewsDaily(tutorId: string, days: number): Promise<{ day: string; views: number }[]>;
  getErrorLogs(opts: { status?: string; level?: string; page: number; pageSize: number }): Promise<{ items: ErrorLogWithUser[]; total: number }>;
  updateErrorLogStatus(id: string, status: string, resolvedBy: string): Promise<ErrorLog | undefined>;
  updateAdminAlertStatus(id: string, status: string, reviewedBy: string, actionTaken?: string): Promise<AdminAlert | undefined>;

  // Contact Filter Rules
  getFilterRules(type?: 'blacklist' | 'whitelist'): Promise<ContactFilterRule[]>;
  createFilterRule(rule: InsertContactFilterRule): Promise<ContactFilterRule>;
  deleteFilterRule(id: string): Promise<boolean>;
  seedFilterRulesIfEmpty(): Promise<void>;
  
  // System IDs Management
  createSystemId(insertSystemId: InsertSystemId): Promise<SystemId>;
  getSystemIds(): Promise<SystemId[]>;
  getSystemIdByEntity(entityType: string, entityId: string): Promise<SystemId | undefined>;
  generateSystemCode(entityType: string): Promise<string>;
  
  // Task Deliveries
  createTaskDelivery(insertDelivery: InsertTaskDelivery): Promise<TaskDelivery>;
  getTaskDelivery(taskId: string): Promise<TaskDelivery | undefined>;
  updateTaskDelivery(taskId: string, updates: Partial<TaskDelivery>): Promise<TaskDelivery | undefined>;
  confirmTaskDelivery(taskId: string, studentId: string): Promise<TaskDelivery | undefined>;
  disputeTaskDelivery(taskId: string, studentId: string, reason: string): Promise<TaskDelivery | undefined>;
  
  // Tutor Viewed Tasks (notification system)
  markTaskAsViewed(tutorId: string, taskId: string): Promise<void>;
  getViewedTaskIds(tutorId: string): Promise<string[]>;
  getUnviewedTaskCount(tutorId: string, availableTaskIds: string[]): Promise<number>;
  getTaskViewers(taskId: string): Promise<{ tutorId: string; name: string; avatar: string | null; viewedAt: Date | null }[]>;
  getTaskViewerCounts(): Promise<{ taskId: string; count: number }[]>;
  
  // User Statistics - Calculate from actual data
  getUserStats(userId: string): Promise<{
    tasksPublished: number;
    tasksCompleted: number;
    rating: string;
  }>;

  // Additional methods
  getTasksWithCandidates(): Promise<TaskWithCandidates[]>;
  getUsers(): Promise<User[]>;
  addFavorite(favorite: { userId: string; tutorId: string }): Promise<Favorite>;
  removeFavorite(userId: string, tutorId: string): Promise<boolean>;
  getUserPaymentHistory(userId: string): Promise<any[]>;
  sendMessage(message: InsertChatMessage, knownTask?: Task, knownThread?: ChatThread): Promise<ChatMessage>;
  
  // Study Areas and Request Types
  getStudyAreas(): Promise<StudyArea[]>;
  searchStudyAreas(query: string): Promise<StudyArea[]>;
  createStudyArea(data: { name: string }): Promise<StudyArea>;
  updateStudyArea(id: string, name: string): Promise<void>;
  deleteStudyArea(id: string): Promise<void>;
  getRequestTypes(): Promise<RequestType[]>;
  searchRequestTypes(query: string): Promise<RequestType[]>;
  createRequestType(data: { name: string }): Promise<RequestType>;
  deleteRequestType(id: string): Promise<void>;
  updateRequestType(id: string, name: string): Promise<void>;
  seedStudyAreasAndRequestTypes(): Promise<void>;
  
  // Push Subscriptions
  savePushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription>;
  getPushSubscriptions(userId: string): Promise<PushSubscription[]>;
  deletePushSubscription(userId: string, endpoint: string): Promise<boolean>;
  getAllPushSubscriptionsForUser(userId: string): Promise<PushSubscription[]>;
  blockUser(blockerId: string, blockedId: string): Promise<void>;
  unblockUser(blockerId: string, blockedId: string): Promise<boolean>;
  getBlockedUsers(blockerId: string): Promise<{ userId: string; name: string; avatar: string | null }[]>;
  isBlockedBetween(userA: string, userB: string): Promise<boolean>;
  countOpenTasksForUser(userId: string): Promise<number>;
  anonymizeUser(userId: string): Promise<void>;
  saveNativePushToken(token: InsertNativePushToken): Promise<NativePushToken>;
  getNativePushTokens(userId: string): Promise<NativePushToken[]>;
  deleteNativePushToken(userId: string, token: string): Promise<boolean>;
  deleteNativePushTokenByValue(token: string): Promise<boolean>;

  // Activity Logs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(userId: string, limit?: number): Promise<ActivityLog[]>;
  getAllActivityLogs(limit?: number): Promise<(ActivityLog & { userName?: string | null })[]>;
  getConnectionStats(startDate: Date, endDate: Date): Promise<{ date: string; students: number; tutors: number }[]>;

  // Task Audit Logs
  createTaskAuditLog(log: InsertTaskAuditLog): Promise<TaskAuditLog>;
  getTaskAuditLogs(taskId: string): Promise<(TaskAuditLog & { adminName?: string | null })[]>;
  updateTaskWithAuditLogs(
    id: string,
    updates: Partial<Task>,
    adminId: string,
    auditFields: readonly ('title' | 'description' | 'comment' | 'status')[],
  ): Promise<Task | undefined>;

  // Orphaned Tutor Management
  getOrphanedTutors(): Promise<{ id: string; profession: string | null; user_id: string }[]>;
  repairOrphanedTutor(tutorId: string, email: string): Promise<{ success: boolean; message: string }>;
}

export class DatabaseStorage implements IStorage {
  // Helper method to generate unique system codes
  async generateSystemCode(entityType: string): Promise<string> {
    const prefix = {
      'user': 'USR',
      'task': 'TSK', 
      'tutor': 'TUT',
      'candidate': 'CND'
    }[entityType] || 'ENT';

    // Get the highest existing code for this type
    const [lastCode] = await db
      .select({ systemCode: systemIds.systemCode })
      .from(systemIds)
      .where(eq(systemIds.entityType, entityType))
      .orderBy(desc(systemIds.systemCode))
      .limit(1);

    let nextNumber = 1;
    if (lastCode?.systemCode) {
      const match = lastCode.systemCode.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    return `${prefix}-${nextNumber.toString().padStart(4, '0')}`;
  }

  // System IDs Management
  async createSystemId(insertSystemId: InsertSystemId): Promise<SystemId> {
    const [systemId] = await db
      .insert(systemIds)
      .values(insertSystemId)
      .returning();
    return systemId;
  }

  async getSystemIds(): Promise<SystemId[]> {
    try {
      return await db.select().from(systemIds).orderBy(desc(systemIds.createdAt));
    } catch (error) {
      console.error("Error in getSystemIds:", error);
      return [];
    }
  }

  async getSystemIdByEntity(entityType: string, entityId: string): Promise<SystemId | undefined> {
    const [systemId] = await db
      .select()
      .from(systemIds)
      .where(and(
        eq(systemIds.entityType, entityType),
        eq(systemIds.entityId, entityId)
      ));
    return systemId;
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.getUser(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(sql`LOWER(TRIM(${users.email})) = LOWER(TRIM(${email}))`);
    return user;
  }

  async setActivationToken(userId: string, tokenHash: string, expires: Date): Promise<void> {
    await db.update(users).set({ activationTokenHash: tokenHash, activationTokenExpires: expires }).where(eq(users.id, userId));
  }

  async consumeActivationToken(tokenHash: string, newPassword: string): Promise<{ id: string; email: string } | undefined> {
    const [row] = await db
      .update(users)
      .set({ password: hashPassword(newPassword), activationTokenHash: null, activationTokenExpires: null })
      .where(and(eq(users.activationTokenHash, tokenHash), gt(users.activationTokenExpires, new Date())))
      .returning({ id: users.id, email: users.email });
    return row;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Sin password explicito la cuenta queda SIN contrasena local (NULL), igual que las de Google: la define con un enlace de
    // activacion por correo. Antes se asignaba el hash de "123456" a toda cuenta creada sin clave.
    const password = insertUser.password === undefined ? null : insertUser.password && !isHashed(insertUser.password) ? hashPassword(insertUser.password) : insertUser.password;
    const [user] = await db.insert(users).values({ ...insertUser, password }).returning();

    // Create system ID for tracking
    const systemCode = await this.generateSystemCode('user');
    await this.createSystemId({
      entityType: 'user',
      entityId: user.id,
      systemCode,
      displayName: user.name,
      status: 'active'
    });
    
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    if (updates.password && !isHashed(updates.password)) updates = { ...updates, password: hashPassword(updates.password) };
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserStatus(id: string, status: 'active' | 'paused'): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ status })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      // Una sola transaccion: si un borrado falla, no queda el usuario a medias.
      return await db.transaction(async (tx) => {
      await tx.delete(activityLogs).where(eq(activityLogs.userId, id));
      await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, id));

      await tx.delete(adminAlerts).where(
        or(eq(adminAlerts.tutorId, id), eq(adminAlerts.studentId, id), eq(adminAlerts.reviewedBy, id))
      );

      await tx.delete(favorites).where(eq(favorites.userId, id));
      await tx.delete(reviews).where(eq(reviews.studentId, id));
      await tx.delete(systemIds).where(eq(systemIds.entityId, id));

      await tx.delete(chatMessages).where(or(eq(chatMessages.senderId, id), eq(chatMessages.receiverId, id)));
      await tx.delete(chatRooms).where(or(eq(chatRooms.studentId, id), eq(chatRooms.tutorId, id)));
      await tx.delete(chatThreads).where(or(eq(chatThreads.studentId, id), eq(chatThreads.tutorId, id)));

      await tx.delete(taskDeliveries).where(or(eq(taskDeliveries.tutorId, id), eq(taskDeliveries.studentId, id)));
      await tx.update(taskDeliveries).set({ resolvedBy: null }).where(eq(taskDeliveries.resolvedBy, id));

      await tx.delete(paymentVerifications).where(or(eq(paymentVerifications.studentId, id), eq(paymentVerifications.tutorId, id)));
      await tx.update(paymentVerifications).set({ verifiedBy: null }).where(eq(paymentVerifications.verifiedBy, id));

      await tx.delete(userPaymentHistory).where(eq(userPaymentHistory.userId, id));

      const userTasks = await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.userId, id));
      const taskIds = userTasks.map(t => t.id);
      if (taskIds.length > 0) {
        for (const taskId of taskIds) {
          await this.deleteChatMessagesByTask(taskId, tx);
          await tx.delete(chatRooms).where(eq(chatRooms.taskId, taskId));
          await tx.delete(taskDeliveries).where(eq(taskDeliveries.taskId, taskId));
          await tx.delete(candidates).where(eq(candidates.taskId, taskId));
          await tx.delete(tutorViewedTasks).where(eq(tutorViewedTasks.taskId, taskId));
          await tx.delete(paymentVerifications).where(eq(paymentVerifications.taskId, taskId));
          await tx.delete(userPaymentHistory).where(eq(userPaymentHistory.taskId, taskId));
          await tx.delete(reviews).where(eq(reviews.taskId, taskId));
        }
        await tx.delete(tasks).where(eq(tasks.userId, id));
      }

      await tx.update(tasks).set({ assignedTutorId: null }).where(eq(tasks.assignedTutorId, id));
      await tx.update(tasks).set({ invitedTutorId: null }).where(eq(tasks.invitedTutorId, id));

      await tx.delete(candidates).where(eq(candidates.tutorId, id));
      await tx.delete(tutorViewedTasks).where(eq(tutorViewedTasks.tutorId, id));

      const [tutor] = await tx.select().from(tutors).where(eq(tutors.user_id, id));
      if (tutor) {
        await tx.delete(reviews).where(eq(reviews.tutorId, tutor.id));
        await tx.delete(favorites).where(eq(favorites.tutorId, tutor.id));
        await tx.delete(tutorCareers).where(eq(tutorCareers.tutorId, tutor.id));
        await tx.delete(tutorCertifications).where(eq(tutorCertifications.tutorId, tutor.id));
        await tx.delete(tutorCourses).where(eq(tutorCourses.tutorId, tutor.id));
        await tx.delete(tutors).where(eq(tutors.user_id, id));
      }

      await tx.update(tutorCertifications).set({ verifiedBy: null }).where(eq(tutorCertifications.verifiedBy, id));

      const result = await tx.delete(users).where(eq(users.id, id));
      return result.rowCount !== null && result.rowCount > 0;
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserLastSeen(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastSeen: new Date() })
      .where(eq(users.id, id));
  }

  // Tasks - OPTIMIZED: Uses batch queries instead of N+1
  async getTasks(): Promise<TaskWithCandidates[]> {
    try {
      // 1. Get all tasks in one query
      const allTasks = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
      if (allTasks.length === 0) return [];
      
      // 2+3. Duenos de las tareas y candidatos activos (inactive = rejected): independientes, en paralelo
      const userIds = Array.from(new Set(allTasks.map(t => t.userId)));
      const taskIds = allTasks.map(t => t.id);
      const [allUsers, allCandidates] = await Promise.all([
        db.select().from(users).where(inArray(users.id, userIds)),
        db.select().from(candidates).where(
          and(inArray(candidates.taskId, taskIds), eq(candidates.isActive, true))
        ),
      ]);
      const usersMap = new Map(allUsers.map(u => [u.id, u]));
      
      // 4. Get all tutor users in one query
      const tutorIds = Array.from(new Set(allCandidates.map(c => c.tutorId)));
      const tutorUsers = tutorIds.length > 0 
        ? await db.select().from(users).where(inArray(users.id, tutorIds))
        : [];
      const tutorsMap = new Map(tutorUsers.map(t => [t.id, t]));
      
      // 5. Build result efficiently - explicitly include isActive and proposedPrice for frontend
      const candidatesByTask = new Map<string, any[]>();
      for (const candidate of allCandidates) {
        const list = candidatesByTask.get(candidate.taskId) || [];
        list.push({
          id: candidate.id,
          taskId: candidate.taskId,
          tutorId: candidate.tutorId,
          isActive: candidate.isActive,
          proposedPrice: candidate.proposedPrice,
          message: candidate.message,
          createdAt: candidate.createdAt,
          tutor: tutorsMap.get(candidate.tutorId) || null
        });
        candidatesByTask.set(candidate.taskId, list);
      }
      
      // Cast: usersMap/tutorsMap.get() puede devolver undefined si el
      // usuario/tutor fue borrado (huerfano, ver herramental de repair
      // mas abajo) — el `|| null` ya maneja ese caso en runtime, el
      // cast solo evita ensanchar TaskWithCandidates.user a nullable
      // (eso disparaba un ripple de ~30 sitios en 9 archivos cliente
      // que leen .user sin guard, fuera de alcance de este fix).
      return allTasks.map(task => ({
        ...task,
        user: usersMap.get(task.userId) || null,
        candidates: candidatesByTask.get(task.id) || []
      })) as TaskWithCandidates[];
    } catch (error) {
      console.error("Error in getTasks:", error);
      return [];
    }
  }

  // Get tasks filtered by specific user ID - OPTIMIZED
  async getTasksByUserId(userId: string): Promise<TaskWithCandidates[]> {
    try {
      // 1. Get user's tasks
      const userTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.userId, userId))
        .orderBy(desc(tasks.createdAt));
      
      if (userTasks.length === 0) return [];
      
      // 2+3. El usuario y los candidatos de sus tareas son independientes: en paralelo
      const taskIds = userTasks.map(t => t.id);
      const [[taskUser], allCandidates] = await Promise.all([
        db.select().from(users).where(eq(users.id, userId)),
        db.select().from(candidates).where(inArray(candidates.taskId, taskIds)),
      ]);
      
      // 4. Get all tutor users in one query
      const tutorIds = Array.from(new Set(allCandidates.map(c => c.tutorId)));
      const tutorUsers = tutorIds.length > 0 
        ? await db.select().from(users).where(inArray(users.id, tutorIds))
        : [];
      const tutorsMap = new Map(tutorUsers.map(t => [t.id, t]));
      
      // 5. Build result efficiently - explicitly include isActive and proposedPrice for frontend
      const candidatesByTask = new Map<string, any[]>();
      for (const candidate of allCandidates) {
        const list = candidatesByTask.get(candidate.taskId) || [];
        list.push({
          id: candidate.id,
          taskId: candidate.taskId,
          tutorId: candidate.tutorId,
          isActive: candidate.isActive,
          proposedPrice: candidate.proposedPrice,
          message: candidate.message,
          createdAt: candidate.createdAt,
          tutor: tutorsMap.get(candidate.tutorId) || null
        });
        candidatesByTask.set(candidate.taskId, list);
      }
      
      return userTasks.map(task => ({
        ...task,
        user: taskUser || null,
        candidates: candidatesByTask.get(task.id) || []
      }));
    } catch (error) {
      console.error("Error in getTasksByUserId:", error);
      return [];
    }
  }

  // OPTIMIZED: Direct query instead of loading ALL tasks
  async getTask(id: string): Promise<TaskWithCandidates | undefined> {
    try {
      const [task] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);
      
      if (!task) return undefined;

      // Get user info
      const [taskUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, task.userId))
        .limit(1);

      // Get candidates with tutor info
      const taskCandidates = await db
        .select()
        .from(candidates)
        .where(eq(candidates.taskId, task.id));

      const candidatesWithTutors = await Promise.all(
        taskCandidates.map(async (candidate) => {
          const [tutor] = await db
            .select()
            .from(users)
            .where(eq(users.id, candidate.tutorId))
            .limit(1);
          return { ...candidate, tutor: tutor || null };
        })
      );

      return {
        ...task,
        user: taskUser || null,
        candidates: candidatesWithTutors
      };
    } catch (error) {
      console.error("Error in getTask:", error);
      return undefined;
    }
  }

  // FAST: Lightweight task lookup for chat validation (no candidates/user data)
  async getTaskBasic(id: string): Promise<Task | undefined> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);
    return task;
  }

  async createTask(userId: string, insertTask: InsertTask): Promise<Task> {
    // Get the next sequential task number
    const [lastTask] = await db
      .select({ taskNumber: tasks.taskNumber })
      .from(tasks)
      .orderBy(desc(tasks.taskNumber))
      .limit(1);
    
    const nextTaskNumber = (lastTask?.taskNumber || 0) + 1;

    const [task] = await db
      .insert(tasks)
      .values({ 
        ...insertTask, 
        userId: userId,
        taskNumber: nextTaskNumber, // Assign sequential number
        budget: String(insertTask.budget) // Convert to string for database
      })
      .returning();
    
    // Create system ID for tracking
    const systemCode = await this.generateSystemCode('task');
    await this.createSystemId({
      entityType: 'task',
      entityId: task.id,
      systemCode,
      displayName: task.title,
      status: 'active'
    });
    
    return task;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined> {
    // Plazo nuevo = el aviso de vencimiento vuelve a ser posible.
    if (updates.deadline) updates = { ...updates, deadlineReminderSentAt: null };
    const [task] = await db
      .update(tasks)
      .set(updates)
      .where(eq(tasks.id, id))
      .returning();
    return task;
  }

  async updateTaskStatus(taskId: string, status: string): Promise<Task | undefined> {
    const [updatedTask] = await db
      .update(tasks)
      .set({ status })
      .where(eq(tasks.id, taskId))
      .returning();
    return updatedTask;
  }

  async updateExpiredTasks(): Promise<number> {
    const now = new Date();
    const result = await db
      .update(tasks)
      .set({ status: 'expired' })
      .where(and(
        eq(tasks.status, 'active'),
        sql`${tasks.deadline} < ${now}`
      ))
      .returning({ id: tasks.id });
    
    const count = result.length;
    if (count > 0) {
      console.log(`[TASK_EXPIRATION] ⏰ Updated ${count} expired tasks to 'expired' status`);
    }
    return count;
  }

  // Pedidos que ya entraron en la ventana de aviso: faltan <= min(24 h, 50% del plazo total).
  // Marca y devuelve en un solo UPDATE (reclamo atomico): dos corridas o instancias nunca
  // avisan dos veces. LEAST ignora NULL, asi un created_at vacio cae en la regla de 24 h.
  async claimDueDeadlineReminders() {
    const res = await db.execute(sql`
      UPDATE tasks SET deadline_reminder_sent_at = now()
      WHERE id IN (
        SELECT id FROM tasks
        WHERE deadline_reminder_sent_at IS NULL
          AND status IN ('active', 'in_progress')
          AND delivered_at IS NULL
          AND deadline > now()
          AND deadline - LEAST(interval '24 hours', (deadline - created_at) / 2) <= now()
        LIMIT 200
      )
      RETURNING id, title, user_id, assigned_tutor_id, status, deadline
    `);
    return (res.rows as any[]).map(r => ({
      id: r.id, title: r.title, userId: r.user_id, assignedTutorId: r.assigned_tutor_id,
      status: r.status, deadline: new Date(r.deadline),
    }));
  }

  async deleteTask(id: string): Promise<boolean> {
    // admin_alerts.message_id -> chat_messages.id (sin onDelete cascade):
    // borrar adminAlerts ANTES de chatMessages, si no viola FK.
    await db.delete(adminAlerts).where(eq(adminAlerts.taskId, id));
    await this.deleteChatMessagesByTask(id);
    await db.delete(chatRooms).where(eq(chatRooms.taskId, id));
    await db.delete(candidates).where(eq(candidates.taskId, id));
    await db.delete(paymentVerifications).where(eq(paymentVerifications.taskId, id));
    await db.delete(taskDeliveries).where(eq(taskDeliveries.taskId, id));
    await db.delete(tutorViewedTasks).where(eq(tutorViewedTasks.taskId, id));
    await db.delete(userPaymentHistory).where(eq(userPaymentHistory.taskId, id));
    await db.delete(reviews).where(eq(reviews.taskId, id));
    await db.delete(systemIds).where(eq(systemIds.entityId, id));
    // schema.ts declara onDelete:'cascade' pero la DB real no lo tiene
    // aplicado (constraint sin cascade) — borrar explicito, no confiar en DB.
    await db.delete(taskAuditLogs).where(eq(taskAuditLogs.taskId, id));

    const result = await db.delete(tasks).where(eq(tasks.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async reopenTask(taskId: string, newDeadline: Date): Promise<Task | undefined> {
    try {
      // 1. Get the task owner to use as sender for system message
      const [taskData] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      if (!taskData) {
        console.error("[REPUBLISH] Task not found:", taskId);
        return undefined;
      }
      
      // 2. Get all current candidates (tutors) to send them system notification
      const existingCandidates = await db
        .select({ tutorId: candidates.tutorId })
        .from(candidates)
        .where(eq(candidates.taskId, taskId));
      
      // 3. Clear all candidates — republishing starts fresh applications
      await db
        .delete(candidates)
        .where(eq(candidates.taskId, taskId));
      console.log(`[REPUBLISH] Cleared ${existingCandidates.length} candidates for task ${taskId}`);
      
      // 4. Send system notification message to each tutor (from task owner)
      for (const candidate of existingCandidates) {
        await db.insert(chatMessages).values({
          taskId: taskId,
          senderId: taskData.userId, // Use task owner as sender
          receiverId: candidate.tutorId,
          message: "📢 La tarea se ha republicado.",
          attachments: [],
          readBy: [],
        });
      }
      console.log(`[REPUBLISH] Sent system notifications to ${existingCandidates.length} tutors`);
      
      // 5. Update the task: new deadline, reset status to active, clear assignment
      const [updatedTask] = await db
        .update(tasks)
        .set({
          status: 'active',
          deadline: newDeadline,
          deadlineReminderSentAt: null, // Plazo nuevo: el aviso de vencimiento vuelve a aplicar
          assignedTutorId: null,    // Clear any previous assignment
          currentPrice: null,        // Reset price (will use budget as default)
          priceLastUpdated: null     // Clear price timestamp
        })
        .where(eq(tasks.id, taskId))
        .returning();
      
      console.log(`[REPUBLISH] ✅ Task ${taskId} reopened with new deadline: ${newDeadline}`);
      return updatedTask;
    } catch (error) {
      console.error("[REPUBLISH] Error reopening task:", error);
      return undefined;
    }
  }

  // Candidates
  async createCandidate(insertCandidate: InsertCandidate): Promise<Candidate> {
    // Check if this tutor already applied to this task
    const existingCandidate = await db
      .select()
      .from(candidates)
      .where(and(
        eq(candidates.taskId, insertCandidate.taskId),
        eq(candidates.tutorId, insertCandidate.tutorId)
      ))
      .limit(1);
    
    if (existingCandidate.length > 0) {
      // Update existing candidate with new price and message
      const [updated] = await db
        .update(candidates)
        .set({
          proposedPrice: insertCandidate.proposedPrice,
          message: insertCandidate.message
        })
        .where(eq(candidates.id, existingCandidate[0].id))
        .returning();
      
      console.log(`[CANDIDATE] Updated existing candidate for tutor ${insertCandidate.tutorId} on task ${insertCandidate.taskId}`);
      return updated;
    }
    
    // Create new candidate
    const [candidate] = await db
      .insert(candidates)
      .values(insertCandidate)
      .returning();
    
    // Create system ID for tracking
    const systemCode = await this.generateSystemCode('candidate');
    await this.createSystemId({
      entityType: 'candidate',
      entityId: candidate.id,
      systemCode,
      displayName: `Candidato para ${insertCandidate.taskId}`,
      status: 'active'
    });
    
    return candidate;
  }

  async getCandidatesByTask(taskId: string): Promise<Candidate[]> {
    return await db.select().from(candidates).where(
      and(eq(candidates.taskId, taskId), eq(candidates.isActive, true))
    );
  }

  async rejectCandidate(taskId: string, tutorId: string): Promise<boolean> {
    const result = await db
      .update(candidates)
      .set({ isActive: false })
      .where(and(eq(candidates.taskId, taskId), eq(candidates.tutorId, tutorId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Mantiene candidates.proposedPrice al dia cuando el tutor manda "Nueva
  // cotizacion" por chat — antes ese mensaje solo quedaba como texto y la
  // lista de candidatos del estudiante seguia mostrando el precio original
  // de la postulacion (o, peor, un precio cacheado de OTRO candidato).
  async updateCandidateProposedPrice(taskId: string, tutorId: string, price: string): Promise<Candidate | undefined> {
    const [updated] = await db
      .update(candidates)
      .set({ proposedPrice: price })
      .where(and(eq(candidates.taskId, taskId), eq(candidates.tutorId, tutorId)))
      .returning();
    return updated || undefined;
  }

  // Tutors
  async getTutors(): Promise<TutorWithUser[]> {
    // 1 round trip (leftJoin): conserva tutores huerfanos (user undefined) como antes.
    // Cast: ver comentario de getTasks() mas arriba sobre huerfanos y
    // por que no se ensancha TutorWithUser.user a nullable.
    const rows = await db.select({ tutor: tutors, user: users }).from(tutors).leftJoin(users, eq(tutors.user_id, users.id));
    return rows.map(r => ({ ...r.tutor, user: r.user ?? undefined })) as TutorWithUser[];
  }

  async getCompletedTaskCountPerTutor(): Promise<Map<string, number>> {
    const counts = await db
      .select({ userId: tasks.assignedTutorId, count: sql<number>`count(*)` })
      .from(tasks)
      .where(and(eq(tasks.status, 'completed'), sql`${tasks.assignedTutorId} IS NOT NULL`))
      .groupBy(tasks.assignedTutorId);
    return new Map(counts.map(r => [r.userId!, Number(r.count)]));
  }

  // Pedidos con este tutor asignado que siguen en curso (contratado y pendiente de pago, o en ejecucion)
  async getActiveTasksForTutor(tutorUserId: string): Promise<{ id: string; taskNumber: number | null; title: string; status: string }[]> {
    return await db
      .select({ id: tasks.id, taskNumber: tasks.taskNumber, title: tasks.title, status: tasks.status })
      .from(tasks)
      .where(and(eq(tasks.assignedTutorId, tutorUserId), inArray(tasks.status, ['payment_pending', 'in_progress'])));
  }

  async searchTutors(query: string, activeOnly = false): Promise<{ value: string; label: string; rating: string | null; profession: string | null }[]> {
    const searchTerm = `%${query}%`;
    const results = await db
      .select({
        userId: tutors.user_id,
        name: users.name,
        rating: tutors.rating,
        profession: tutors.profession,
      })
      .from(tutors)
      .innerJoin(users, eq(tutors.user_id, users.id))
      .where(
        and(
          or(
            sql`${users.name} ILIKE ${searchTerm}`,
            sql`${tutors.profession} ILIKE ${searchTerm}`
          ),
          // Cuentas pausadas o suspendidas no se ofrecen (status vacio cuenta como activa)
          activeOnly ? or(sql`${users.status} IS NULL`, eq(users.status, 'active')) : undefined
        )
      );
    return results.map(r => ({
      value: r.userId,
      label: r.name || 'Tutor',
      rating: r.rating,
      profession: r.profession,
    }));
  }

  async getTutorsWithSpecialties(): Promise<TutorWithSpecialties[]> {
    const allTutors = await db.select().from(tutors);
    const results = await Promise.all(
      allTutors.map(async (tutor) => {
        const [user] = await db.select().from(users).where(eq(users.id, tutor.user_id));
        
        // Get careers
        const careersList = await db
          .select()
          .from(tutorCareers)
          .where(eq(tutorCareers.tutorId, tutor.id));
        
        const careersWithNames = await Promise.all(
          careersList.map(async (tc) => {
            const [career] = await db
              .select()
              .from(careers)
              .where(eq(careers.id, tc.specialtyId));
            return { ...tc, specialty: career };
          })
        );

        // Get certifications
        const certifications = await db
          .select()
          .from(tutorCertifications)
          .where(eq(tutorCertifications.tutorId, tutor.id));

        return { ...tutor, user, specialties: careersWithNames, certifications };
      })
    );
    return results;
  }

  async deleteTutor(id: string): Promise<boolean> {
    try {
      const [tutor] = await db.select().from(tutors).where(eq(tutors.id, id));
      if (!tutor) return false;

      const userId = tutor.user_id;

      await db.delete(tutorCareers).where(eq(tutorCareers.tutorId, id));
      await db.delete(tutorCertifications).where(eq(tutorCertifications.tutorId, id));
      await db.delete(tutorCourses).where(eq(tutorCourses.tutorId, id));
      await db.delete(reviews).where(eq(reviews.tutorId, id));
      await db.delete(favorites).where(or(eq(favorites.tutorId, id), eq(favorites.userId, userId)));
      await db.delete(systemIds).where(or(eq(systemIds.entityId, id), eq(systemIds.entityId, userId)));

      await db.delete(tutors).where(eq(tutors.id, id));

      await db.delete(activityLogs).where(eq(activityLogs.userId, userId));
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
      await db.delete(adminAlerts).where(
        or(eq(adminAlerts.tutorId, userId), eq(adminAlerts.studentId, userId), eq(adminAlerts.reviewedBy, userId))
      );
      await db.delete(chatMessages).where(or(eq(chatMessages.senderId, userId), eq(chatMessages.receiverId, userId)));
      await db.delete(chatRooms).where(or(eq(chatRooms.studentId, userId), eq(chatRooms.tutorId, userId)));
      await db.delete(taskDeliveries).where(or(eq(taskDeliveries.tutorId, userId), eq(taskDeliveries.studentId, userId)));
      await db.update(taskDeliveries).set({ resolvedBy: null }).where(eq(taskDeliveries.resolvedBy, userId));
      await db.delete(paymentVerifications).where(or(eq(paymentVerifications.studentId, userId), eq(paymentVerifications.tutorId, userId)));
      await db.update(paymentVerifications).set({ verifiedBy: null }).where(eq(paymentVerifications.verifiedBy, userId));
      await db.delete(userPaymentHistory).where(eq(userPaymentHistory.userId, userId));
      await db.delete(candidates).where(eq(candidates.tutorId, userId));
      await db.delete(tutorViewedTasks).where(eq(tutorViewedTasks.tutorId, userId));

      const userTasks = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.userId, userId));
      for (const t of userTasks) {
        await this.deleteChatMessagesByTask(t.id);
        await db.delete(chatRooms).where(eq(chatRooms.taskId, t.id));
        await db.delete(taskDeliveries).where(eq(taskDeliveries.taskId, t.id));
        await db.delete(candidates).where(eq(candidates.taskId, t.id));
        await db.delete(tutorViewedTasks).where(eq(tutorViewedTasks.taskId, t.id));
        await db.delete(paymentVerifications).where(eq(paymentVerifications.taskId, t.id));
        await db.delete(userPaymentHistory).where(eq(userPaymentHistory.taskId, t.id));
        await db.delete(reviews).where(eq(reviews.taskId, t.id));
        await db.delete(adminAlerts).where(eq(adminAlerts.taskId, t.id));
      }
      await db.delete(tasks).where(eq(tasks.userId, userId));

      await db.update(tasks).set({ assignedTutorId: null }).where(eq(tasks.assignedTutorId, userId));
      await db.update(tasks).set({ invitedTutorId: null }).where(eq(tasks.invitedTutorId, userId));
      await db.update(tutorCertifications).set({ verifiedBy: null }).where(eq(tutorCertifications.verifiedBy, userId));

      await db.delete(users).where(eq(users.id, userId));
      
      return true;
    } catch (error) {
      console.error("Error deleting tutor:", error);
      return false;
    }
  }

  async createTutor(insertTutor: InsertTutor): Promise<Tutor> {
    const [tutor] = await db.insert(tutors).values({ ...insertTutor, slug: insertTutor.slug ?? await this.newTutorSlug(insertTutor.user_id) }).returning();
    
    // Create system ID for tracking
    const systemCode = await this.generateSystemCode('tutor');
    await this.createSystemId({
      entityType: 'tutor',
      entityId: tutor.id,
      systemCode,
      displayName: `Tutor ${tutor.user_id}`,
      status: 'active'
    });
    
    return tutor;
  }

  async getTutorById(id: string): Promise<TutorWithUser | undefined> {
    const [tutor] = await db.select().from(tutors).where(eq(tutors.id, id));
    if (!tutor) return undefined;
    const [user] = await db.select().from(users).where(eq(users.id, tutor.user_id));
    return { ...tutor, user };
  }

  async getTutorByIdOrSlug(key: string): Promise<TutorWithUser | undefined> {
    const [row] = await db
      .select({ tutor: tutors, user: users })
      .from(tutors)
      .leftJoin(users, eq(tutors.user_id, users.id))
      .where(or(eq(tutors.id, key), eq(tutors.slug, key.toLowerCase())));
    if (!row) return undefined;
    return { ...row.tutor, user: row.user ?? undefined } as TutorWithUser;
  }

  // Slug libre para el tutor de este usuario ("olga-perez", "olga-perez-2"...). El indice unico de tutors.slug
  // cubre la carrera de dos altas simultaneas con el mismo nombre (la segunda falla y se reintenta desde fuera).
  private async newTutorSlug(userId: string): Promise<string> {
    const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
    const base = slugBase(user?.name);
    const rows = await db.select({ slug: tutors.slug }).from(tutors).where(sql`${tutors.slug} LIKE ${base + "%"}`);
    return uniqueSlug(base, new Set(rows.map((r) => r.slug!)));
  }

  async getTutorByUserId(userId: string): Promise<TutorWithUser | undefined> {
    const [row] = await db.select({ tutor: tutors, user: users }).from(tutors).leftJoin(users, eq(tutors.user_id, users.id)).where(eq(tutors.user_id, userId));
    if (!row) return undefined;
    return { ...row.tutor, user: row.user ?? undefined } as TutorWithUser;
  }

  async getTutorByEmail(email: string): Promise<TutorWithUser | undefined> {
    const normalizedEmail = email.toLowerCase().trim();
    const [row] = await db
      .select({ tutor: tutors, user: users })
      .from(tutors)
      .innerJoin(users, eq(tutors.user_id, users.id))
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1);
    if (!row) return undefined;
    return { ...row.tutor, user: row.user };
  }

  async updateTutor(id: string, updates: Partial<Tutor>): Promise<TutorWithUser | undefined> {
    const [tutor] = await db
      .update(tutors)
      .set(updates)
      .where(eq(tutors.id, id))
      .returning();
    if (!tutor) return undefined;
    const [user] = await db.select().from(users).where(eq(users.id, tutor.user_id));
    return { ...tutor, user };
  }

  async updateTutorProfile(tutorId: string, updates: Partial<Tutor>): Promise<TutorWithUser | undefined> {
    const [tutor] = await db
      .update(tutors)
      .set(updates)
      .where(eq(tutors.id, tutorId))
      .returning();
    if (!tutor) return undefined;
    const [user] = await db.select().from(users).where(eq(users.id, tutor.user_id));
    return { ...tutor, user };
  }

  async getTutorReviews(tutorId: string): Promise<ReviewWithStudent[]> {
    const allReviews = await db.select().from(reviews).where(
      and(eq(reviews.tutorId, tutorId), eq(reviews.published, true))
    );
    const results = await Promise.all(
      allReviews.map(async (review) => {
        const [student] = await db.select().from(users).where(eq(users.id, review.studentId));
        const [task] = await db.select().from(tasks).where(eq(tasks.id, review.taskId));
        return { ...review, student, task };
      })
    );
    return results;
  }

  async getReviewByTaskAndStudent(taskId: string, studentId: string): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(
      and(eq(reviews.taskId, taskId), eq(reviews.studentId, studentId))
    );
    return review;
  }

  async createReview(insertReview: InsertReview): Promise<Review> {
    const [review] = await db.insert(reviews).values({
      ...insertReview,
      published: false,
    }).returning();
    return review;
  }

  async updateReview(id: string, updates: Partial<Review>): Promise<Review | undefined> {
    const [review] = await db.update(reviews).set({
      ...updates,
      updatedAt: new Date(),
    }).where(eq(reviews.id, id)).returning();
    return review;
  }

  async publishDueReviews(): Promise<number> {
    const allUnpublished = await db.select({
      review: reviews,
      delivery: taskDeliveries,
    }).from(reviews)
      .leftJoin(taskDeliveries, eq(reviews.taskId, taskDeliveries.taskId))
      .where(eq(reviews.published, false));

    let publishedCount = 0;
    const now = new Date();
    const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

    for (const { review, delivery } of allUnpublished) {
      // Use delivery date if available, otherwise fall back to review creation date
      const referenceDate = delivery?.createdAt
        ? new Date(delivery.createdAt)
        : review.createdAt
          ? new Date(review.createdAt)
          : null;
      if (referenceDate && (now.getTime() - referenceDate.getTime()) >= GRACE_PERIOD_MS) {
        await db.update(reviews).set({
          published: true,
          publishedAt: now,
        }).where(eq(reviews.id, review.id));

        const tutorReviews = await db.select().from(reviews).where(
          and(eq(reviews.tutorId, review.tutorId), eq(reviews.published, true))
        );
        const allRatings = tutorReviews.map(r => r.rating);
        const avgRating = allRatings.length > 0
          ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(2)
          : review.rating.toFixed(2);
        await db.update(tutors).set({ rating: avgRating }).where(eq(tutors.id, review.tutorId));

        publishedCount++;
      }
    }
    return publishedCount;
  }

  // Specialties
  async getCareers(): Promise<Career[]> {
    return await db.select().from(careers).where(eq(careers.isActive, true));
  }

  async createCareer(insertCareer: InsertCareer): Promise<Career> {
    const [career] = await db.insert(careers).values(insertCareer).returning();
    return career;
  }

  async updateCareer(id: string, updates: Partial<Career>): Promise<Career | undefined> {
    const [career] = await db
      .update(careers)
      .set(updates)
      .where(eq(careers.id, id))
      .returning();
    return career;
  }

  async deleteCareer(id: string): Promise<boolean> {
    const result = await db.update(careers).set({ isActive: false }).where(eq(careers.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Countries
  async getCountries(): Promise<Country[]> {
    return await db.select().from(countries).where(eq(countries.isActive, true));
  }

  async createCountry(insertCountry: InsertCountry): Promise<Country> {
    const [country] = await db.insert(countries).values(insertCountry).returning();
    return country;
  }

  async updateCountry(id: string, updates: Partial<Country>): Promise<Country | undefined> {
    const [country] = await db
      .update(countries)
      .set(updates)
      .where(eq(countries.id, id))
      .returning();
    return country;
  }

  async deleteCountry(id: string): Promise<boolean> {
    const result = await db.update(countries).set({ isActive: false }).where(eq(countries.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Bank Accounts
  async getBankAccounts(): Promise<BankAccount[]> {
    return await db.select().from(bankAccounts);
  }

  async getBankAccountsByCountry(countryCode: string): Promise<BankAccount[]> {
    return await db.select().from(bankAccounts).where(eq(bankAccounts.countryCode, countryCode));
  }

  async createBankAccount(insertBankAccount: InsertBankAccount): Promise<BankAccount> {
    const [account] = await db.insert(bankAccounts).values(insertBankAccount).returning();
    return account;
  }

  async updateBankAccount(id: string, updates: Partial<BankAccount>): Promise<BankAccount | undefined> {
    const [account] = await db
      .update(bankAccounts)
      .set(updates)
      .where(eq(bankAccounts.id, id))
      .returning();
    return account;
  }

  async deleteBankAccount(id: string): Promise<boolean> {
    const result = await db.delete(bankAccounts).where(eq(bankAccounts.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Country Settings (min budget per country)
  async getCountrySettings(): Promise<CountrySettings[]> {
    return await db.select().from(countrySettings).orderBy(countrySettings.countryName);
  }

  async getCountrySettingByCode(countryCode: string): Promise<CountrySettings | undefined> {
    const [setting] = await db.select().from(countrySettings).where(eq(countrySettings.countryCode, countryCode));
    return setting;
  }

  async createCountrySetting(insertSetting: InsertCountrySettings): Promise<CountrySettings> {
    const [setting] = await db.insert(countrySettings).values(insertSetting).returning();
    return setting;
  }

  async updateCountrySetting(id: string, updates: Partial<CountrySettings>): Promise<CountrySettings | undefined> {
    const [setting] = await db.update(countrySettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(countrySettings.id, id))
      .returning();
    return setting;
  }

  async deleteCountrySetting(id: string): Promise<boolean> {
    const result = await db.delete(countrySettings).where(eq(countrySettings.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Tutor Careers
  async addTutorCareer(insertTutorCareer: InsertTutorCareer): Promise<TutorCareer> {
    const [tc] = await db.insert(tutorCareers).values(insertTutorCareer).returning();
    return tc;
  }

  async removeTutorCareer(tutorId: string, specialtyId: string): Promise<boolean> {
    const result = await db.delete(tutorCareers).where(and(
      eq(tutorCareers.tutorId, tutorId),
      eq(tutorCareers.specialtyId, specialtyId)
    ));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getTutorCareers(tutorId: string): Promise<(TutorCareer & { career: Career })[]> {
    const list = await db.select().from(tutorCareers).where(eq(tutorCareers.tutorId, tutorId));
    return await Promise.all(
      list.map(async (tc) => {
        const [career] = await db.select().from(careers).where(eq(careers.id, tc.specialtyId));
        return { ...tc, career };
      })
    );
  }

  // Tutor Certifications
  async addTutorCertification(insertCertification: InsertTutorCertification): Promise<TutorCertification> {
    const [cert] = await db.insert(tutorCertifications).values(insertCertification).returning();
    return cert;
  }

  async getTutorCertifications(tutorId: string): Promise<TutorCertification[]> {
    return await db.select().from(tutorCertifications).where(eq(tutorCertifications.tutorId, tutorId));
  }

  async verifyCertification(id: string, verifiedBy: string): Promise<TutorCertification | undefined> {
    const [cert] = await db
      .update(tutorCertifications)
      .set({ isVerified: true, verifiedBy, verifiedAt: new Date() })
      .where(eq(tutorCertifications.id, id))
      .returning();
    return cert;
  }

  // Tutor Courses (admin-assigned course access)
  async getTutorCourses(tutorId: string): Promise<StudyArea[]> {
    const results = await db
      .select({ course: studyAreas })
      .from(tutorCourses)
      .innerJoin(studyAreas, eq(tutorCourses.courseId, studyAreas.id))
      .where(eq(tutorCourses.tutorId, tutorId));
    return results.map(r => r.course);
  }

  async setTutorCourses(tutorId: string, courseIds: string[]): Promise<void> {
    // Delete existing course assignments
    await db.delete(tutorCourses).where(eq(tutorCourses.tutorId, tutorId));
    
    // Insert new course assignments
    if (courseIds.length > 0) {
      const insertValues = courseIds.map(courseId => ({
        tutorId,
        courseId,
      }));
      await db.insert(tutorCourses).values(insertValues);
    }
  }

  async updateTutorGeneralAccess(tutorId: string, hasGeneralAccess: boolean): Promise<Tutor | undefined> {
    const [updated] = await db
      .update(tutors)
      .set({ hasGeneralAccess })
      .where(eq(tutors.id, tutorId))
      .returning();
    return updated;
  }

  async getAvailableTasksForTutor(
    tutorId: string,
    opts?: { since?: Date; tutorUserId?: string; tutor?: TutorWithUser }
  ): Promise<TaskWithCandidates[]> {
    // Reusa el tutor ya resuelto por el caller cuando esta disponible —
    // evita pedirlo 2 veces (route handler + aca) en la misma request.
    const tutor = opts?.tutor ?? await this.getTutorById(tutorId);
    if (!tutor) return [];

    const validStatuses = ['active', 'available', 'completed', 'cancelled', 'in_progress', 'in_review', 'payment_pending', 'expired'];
    const statusCond = inArray(tasks.status, validStatuses);
    const sinceCond = opts?.since ? gt(tasks.createdAt, opts.since) : undefined;
    // Tope a la carga inicial (sin `since`): sin esto se trae TODO el
    // historial de la plataforma que matchea el curso/status, sin limite.
    // Las pestañas "En progreso"/"Historial" siguen andando igual (filtran
    // este mismo array), solo se acota a lo mas reciente.
    const INITIAL_LOAD_LIMIT = 200;

    // Build course-filtered task list
    let filteredTasks: Task[];
    if (tutor.hasGeneralAccess) {
      const cond = sinceCond ? and(statusCond, sinceCond) : statusCond;
      const query = db.select().from(tasks).where(cond).orderBy(desc(tasks.createdAt));
      filteredTasks = sinceCond ? await query : await query.limit(INITIAL_LOAD_LIMIT);
    } else {
      const tutorCoursesList = await this.getTutorCourses(tutorId);
      const assignedCourseValues = tutorCoursesList.map(c => c.value);

      if (assignedCourseValues.length > 0) {
        const courseCond = or(
          inArray(tasks.studyArea, assignedCourseValues),
          inArray(tasks.subject, assignedCourseValues)
        );
        const cond = sinceCond
          ? and(statusCond, sinceCond, courseCond)
          : and(statusCond, courseCond);
        const query = db.select().from(tasks).where(cond).orderBy(desc(tasks.createdAt));
        filteredTasks = sinceCond ? await query : await query.limit(INITIAL_LOAD_LIMIT);
      } else {
        filteredTasks = [];
      }
    }

    // If tutorUserId provided, always include tasks where the tutor has a candidacy
    // (regardless of `since` or course filters — these must stay fresh)
    let applicationTasks: Task[] = [];
    if (opts?.tutorUserId) {
      const tutorCandidacies = await db
        .select({ taskId: candidates.taskId })
        .from(candidates)
        .where(eq(candidates.tutorId, opts.tutorUserId));

      if (tutorCandidacies.length > 0) {
        const filteredIds = new Set(filteredTasks.map(t => t.id));
        const extraIds = tutorCandidacies
          .map(c => c.taskId)
          .filter(id => !filteredIds.has(id));

        if (extraIds.length > 0) {
          applicationTasks = await db.select().from(tasks)
            .where(and(
              inArray(tasks.id, extraIds),
              statusCond
            ))
            .orderBy(desc(tasks.createdAt));
        }
      }
    }

    const allFilteredTasks = [...filteredTasks, ...applicationTasks];
    if (allFilteredTasks.length === 0) return [];

    // Hydrate with users and candidates in batch queries
    const taskIds = allFilteredTasks.map(t => t.id);
    const userIds = Array.from(new Set(allFilteredTasks.map(t => t.userId)));

    const [taskUsers, allCandidatesRows] = await Promise.all([
      db.select().from(users).where(inArray(users.id, userIds)),
      db.select().from(candidates).where(inArray(candidates.taskId, taskIds)),
    ]);

    const usersMap = new Map(taskUsers.map(u => [u.id, u]));
    const tutorUserIds = Array.from(new Set(allCandidatesRows.map(c => c.tutorId)));
    const tutorUsers = tutorUserIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, tutorUserIds))
      : [];
    const tutorsMap = new Map(tutorUsers.map(t => [t.id, t]));

    const candidatesByTask = new Map<string, any[]>();
    for (const candidate of allCandidatesRows) {
      const list = candidatesByTask.get(candidate.taskId) || [];
      list.push({ ...candidate, tutor: tutorsMap.get(candidate.tutorId) || null });
      candidatesByTask.set(candidate.taskId, list);
    }

    // Cast: ver comentario de getTasks() sobre huerfanos.
    return allFilteredTasks.map(task => ({
      ...task,
      user: usersMap.get(task.userId) || null,
      candidates: candidatesByTask.get(task.id) || [],
    })) as TaskWithCandidates[];
  }

  // Favorites
  async toggleFavorite(userId: string, tutorId: string): Promise<{ isFavorite: boolean }> {
    const existing = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.tutorId, tutorId)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(favorites).where(eq(favorites.id, existing[0].id));
      return { isFavorite: false };
    } else {
      await db.insert(favorites).values({ userId, tutorId });
      return { isFavorite: true };
    }
  }

  // Solo los ids (1 query). getUserFavorites hace N+1 hidratando cada tutor.
  async getFavoriteTutorIds(userId: string): Promise<string[]> {
    const rows = await db.select({ tutorId: favorites.tutorId }).from(favorites).where(eq(favorites.userId, userId));
    return rows.map(r => r.tutorId);
  }

  async getUserFavorites(userId: string): Promise<any[]> {
    const favs = await db.select().from(favorites).where(eq(favorites.userId, userId));
    return await Promise.all(
      favs.map(async (fav) => {
        const tutor = await this.getTutorById(fav.tutorId);
        return { ...fav, tutor };
      })
    );
  }

  // Chat
  async createChatMessage(insertMessage: InsertChatMessage, knownTask?: Task, knownThread?: ChatThread): Promise<ChatMessage> {
    // Determine student/tutor - we need to check user types or infer from task.
    // knownTask: el caller (routes.ts) ya trajo el task para validar el
    // request, se reusa para no repetir la query. Si no llega, getTaskBasic
    // (1 query) — nunca getTask (task+user+candidates+N tutores por
    // candidato), aqui solo se usan columnas planas (userId/assignedTutorId).
    const task = knownTask ?? (insertMessage.taskId ? await this.getTaskBasic(insertMessage.taskId) : undefined);
    let studentId: string;
    let tutorId: string;

    const ADMIN_ID = 'admin-001';
    if (insertMessage.senderId === ADMIN_ID || insertMessage.receiverId === ADMIN_ID) {
      // Admin notification: task.userId is always the real student; the
      // non-admin party is either that same student (admin->student) or
      // the real tutor (admin->tutor). Never use 'admin-001' as a thread
      // participant id — falls back to task.assignedTutorId when the
      // other party IS the student, so student+tutor keep one real thread.
      const otherParty = insertMessage.senderId === ADMIN_ID ? insertMessage.receiverId : insertMessage.senderId;
      studentId = task?.userId ?? otherParty;
      tutorId = otherParty !== studentId ? otherParty : ((task as any)?.assignedTutorId ?? otherParty);
    } else {
      ({ studentId, tutorId } = await this.resolveChatRoles(insertMessage.senderId, insertMessage.receiverId, task));
    }

    // User-centric: cada mensaje nuevo (aunque llegue por el flujo viejo
    // task-scoped) queda enganchado a un hilo continuo por par estudiante-tutor.
    const thread = knownThread ?? (tutorId ? await this.getOrCreateThread(studentId, tutorId) : undefined);

    // insert del mensaje + preview del hilo en paralelo (1 viaje menos); el
    // update no depende del id del mensaje.
    const [[msg]] = await Promise.all([
      db.insert(chatMessages).values({ ...insertMessage, threadId: thread?.id }).returning(),
      thread
        ? db
            .update(chatThreads)
            .set({ lastMessage: chatPreviewText(insertMessage.message, insertMessage.attachments, insertMessage.attachmentNames), lastMessageAt: new Date() })
            .where(eq(chatThreads.id, thread.id))
        : Promise.resolve(),
    ]);

    // (chatRooms ya no se lee en ningun endpoint — superado por chatThreads,
    // ver comentario arriba. Se dejo de escribir aqui: eran 2 round-trips
    // seriales por mensaje sin ningun lector.)

    return msg;
  }

  // Deriva alumno/tutor para un mensaje sin depender de un task: si hay
  // task se usa su dueno (comportamiento original), si no hay task (DM
  // directo) se resuelve por perfil de tutor real — evita asumir
  // "sender = alumno" cuando el tutor es quien inicia el chat. Compartido
  // entre createChatMessage y el escaneo de contacto (rutas de chat).
  async resolveChatRoles(senderId: string, receiverId: string, task?: Task): Promise<{ studentId: string; tutorId: string }> {
    if (task && task.userId === senderId) return { studentId: senderId, tutorId: receiverId };
    if (task && task.userId === receiverId) return { studentId: receiverId, tutorId: senderId };
    const senderIsTutor = !!(await this.getTutorByUserId(senderId));
    return senderIsTutor
      ? { studentId: receiverId, tutorId: senderId }
      : { studentId: senderId, tutorId: receiverId };
  }

  private pairKey(userIdA: string, userIdB: string): string {
    return [userIdA, userIdB].sort().join('_');
  }

  async threadExists(userIdA: string, userIdB: string): Promise<boolean> {
    const pairKey = this.pairKey(userIdA, userIdB);
    const [existing] = await db.select({ id: chatThreads.id }).from(chatThreads).where(eq(chatThreads.pairKey, pairKey)).limit(1);
    return !!existing;
  }

  // Solo-lectura: no crea fila. Usado por el check del boton "Chatear"
  // (no debe crear un thread vacio antes del primer mensaje real, ver
  // getOrCreateThread mas abajo que si crea, para el camino de envio).
  async findThreadByPair(userIdA: string, userIdB: string): Promise<ChatThread | undefined> {
    const pairKey = this.pairKey(userIdA, userIdB);
    const [existing] = await db.select().from(chatThreads).where(eq(chatThreads.pairKey, pairKey)).limit(1);
    return existing;
  }

  async getOrCreateThread(studentId: string, tutorId: string): Promise<ChatThread> {
    const existing = await this.findThreadByPair(studentId, tutorId);
    if (existing) return existing;

    const pairKey = this.pairKey(studentId, tutorId);
    const [created] = await db
      .insert(chatThreads)
      .values({ studentId, tutorId, pairKey })
      .onConflictDoNothing({ target: chatThreads.pairKey })
      .returning();
    if (created) return created;

    // Otra request gano la carrera de insercion; leer la fila ya creada.
    const [row] = await db.select().from(chatThreads).where(eq(chatThreads.pairKey, pairKey)).limit(1);
    return row;
  }

  async getThreadById(threadId: string): Promise<ChatThread | undefined> {
    const [thread] = await db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).limit(1);
    return thread || undefined;
  }

  async getThreadsForUser(userId: string): Promise<Array<ChatThread & { unreadCount: number }>> {
    // EXISTS (no NOT IN: chat_messages.thread_id es nullable, NOT IN con
    // NULL en la subconsulta rompe) — nunca devolver hilos sin ningun
    // mensaje real. Usa chat_messages_thread_id_created_at_idx
    // (thread_id primera columna), sin costo extra relevante.
    const threads = await db
      .select()
      .from(chatThreads)
      .where(and(
        or(eq(chatThreads.studentId, userId), eq(chatThreads.tutorId, userId)),
        sql`EXISTS (SELECT 1 FROM chat_messages cm WHERE cm.thread_id = ${chatThreads.id})`
      ))
      .orderBy(desc(chatThreads.lastMessageAt));

    if (threads.length === 0) return [];

    const unread = await db
      .select({ threadId: chatMessages.threadId, count: sql<number>`COUNT(*)::int` })
      .from(chatMessages)
      .where(and(
        eq(chatMessages.receiverId, userId),
        sql`${chatMessages.readAt} IS NULL`,
        inArray(chatMessages.threadId, threads.map(t => t.id))
      ))
      .groupBy(chatMessages.threadId);

    const unreadByThread = new Map(unread.map(u => [u.threadId as string, Number(u.count)]));
    return threads.map(t => ({ ...t, unreadCount: unreadByThread.get(t.id) || 0 }));
  }

  async getMessagesByThread(threadId: string, userId: string, limit = 50, before?: string): Promise<Array<ChatMessage & { replyTo?: ReplyPreview | null }>> {
    const rows = await db
      .select()
      .from(chatMessages)
      .where(and(
        eq(chatMessages.threadId, threadId),
        // Admin notifications are 1:1 (studentMessage vs graceMessage vs
        // tutor-targeted), never broadcast — only the intended receiver
        // sees them, same rule as the taskId-scoped getChatMessages.
        or(
          ne(chatMessages.senderId, 'admin-001'),
          eq(chatMessages.receiverId, userId)
        ),
        before ? lt(chatMessages.createdAt, new Date(before)) : undefined
      ))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    return this.withReplyPreviews(rows.reverse());
  }

  async getChatMessageById(id: string): Promise<ChatMessage | undefined> {
    const [row] = await db.select().from(chatMessages).where(eq(chatMessages.id, id)).limit(1);
    return row;
  }

  // Adjunta a cada respuesta los datos reducidos del mensaje citado (UNA consulta
  // para toda la pagina), asi la burbuja pinta la cita sin pedir nada mas.
  async withReplyPreviews<T extends ChatMessage>(messages: T[]): Promise<Array<T & { replyTo?: ReplyPreview | null }>> {
    const ids = Array.from(new Set(messages.map(m => m.replyToId).filter((id): id is string => !!id)));
    if (ids.length === 0) return messages;
    const rows = await db
      .select({
        id: chatMessages.id,
        message: chatMessages.message,
        senderId: chatMessages.senderId,
        senderName: users.name,
        attachments: chatMessages.attachments,
        attachmentNames: chatMessages.attachmentNames,
      })
      .from(chatMessages)
      .leftJoin(users, eq(users.id, chatMessages.senderId))
      .where(inArray(chatMessages.id, ids));
    const byId = new Map(rows.map(r => [r.id, { ...r, senderName: r.senderName ?? "Usuario" } as ReplyPreview]));
    return messages.map(m => (m.replyToId ? { ...m, replyTo: byId.get(m.replyToId) ?? null } : m));
  }

  // Pedido ancla tecnico para un mensaje nuevo en un hilo continuo. Bajo el
  // modelo user-centric ningun pedido puntual bloquea o cierra el hilo, asi
  // que esto ya no filtra por estado — es el pedido mas reciente del par,
  // sin importar si esta activo, completado, cancelado o expirado; task_id
  // sigue siendo obligatorio en chat_messages, esto solo resuelve a cual.
  async getSendableTaskForThread(threadId: string): Promise<Task | undefined> {
    const thread = await this.getThreadById(threadId);
    if (!thread) return undefined;

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.userId, thread.studentId),
        or(
          eq(tasks.assignedTutorId, thread.tutorId),
          sql`EXISTS (SELECT 1 FROM candidates c WHERE c.task_id = ${tasks.id} AND c.tutor_id = ${thread.tutorId})`
        )
      ))
      .orderBy(desc(tasks.createdAt))
      .limit(1);

    return task || undefined;
  }

  // Version por lote de getSendableTaskForThread: una sola consulta para N hilos.
  async getSendableTasksForThreads(threadIds: string[]): Promise<Map<string, Task>> {
    if (threadIds.length === 0) return new Map();
    const rows = await db
      .selectDistinctOn([chatThreads.id], { threadId: chatThreads.id, task: tasks })
      .from(chatThreads)
      .innerJoin(tasks, and(
        eq(tasks.userId, chatThreads.studentId),
        or(
          eq(tasks.assignedTutorId, chatThreads.tutorId),
          sql`EXISTS (SELECT 1 FROM candidates c WHERE c.task_id = ${tasks.id} AND c.tutor_id = ${chatThreads.tutorId})`
        )
      ))
      .where(inArray(chatThreads.id, threadIds))
      .orderBy(chatThreads.id, desc(tasks.createdAt));
    return new Map(rows.map(r => [r.threadId, r.task]));
  }

  async getUsersByIds(ids: string[]): Promise<Map<string, User>> {
    if (ids.length === 0) return new Map();
    const rows = await db.select().from(users).where(inArray(users.id, ids));
    return new Map(rows.map(u => [u.id, u]));
  }

  // Borrar mensajes de un pedido deja el hilo con last_message/last_message_at
  // apuntando a un mensaje que ya no existe (fantasma en la lista de /mensajes).
  // Se recalcula desde el ultimo mensaje que quede; sin mensajes, se deja como esta.
  // Ultimo mensaje real de cada hilo (para el preview con adjuntos).
  async getLastMessagesForThreads(threadIds: string[]): Promise<Map<string, ChatMessage>> {
    if (threadIds.length === 0) return new Map();
    const rows = await db
      .selectDistinctOn([chatMessages.threadId])
      .from(chatMessages)
      .where(inArray(chatMessages.threadId, threadIds))
      .orderBy(chatMessages.threadId, desc(chatMessages.createdAt));
    return new Map(rows.map(r => [r.threadId!, r]));
  }

  async deleteChatMessagesByTask(taskId: string, exec: DbExecutor = db): Promise<void> {
    const affected = await exec
      .selectDistinct({ threadId: chatMessages.threadId })
      .from(chatMessages)
      .where(eq(chatMessages.taskId, taskId));
    await exec.delete(chatMessages).where(eq(chatMessages.taskId, taskId));
    for (const { threadId } of affected) {
      if (!threadId) continue;
      const [last] = await exec
        .select({ message: chatMessages.message, attachments: chatMessages.attachments, attachmentNames: chatMessages.attachmentNames, createdAt: chatMessages.createdAt })
        .from(chatMessages)
        .where(eq(chatMessages.threadId, threadId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(1);
      if (last) {
        await exec.update(chatThreads).set({ lastMessage: chatPreviewText(last.message, last.attachments, last.attachmentNames), lastMessageAt: last.createdAt }).where(eq(chatThreads.id, threadId));
      }
    }
  }

  async getTasksByIds(ids: string[]): Promise<Task[]> {
    if (ids.length === 0) return [];
    return db.select().from(tasks).where(inArray(tasks.id, ids));
  }

  async markMessagesAsReadByThread(threadId: string, userId: string): Promise<string[]> {
    const now = new Date();
    const result = await db
      .update(chatMessages)
      .set({
        readAt: now,
        readBy: sql`array_append(read_by, ${userId})`
      })
      .where(and(
        eq(chatMessages.threadId, threadId),
        eq(chatMessages.receiverId, userId),
        sql`NOT (${userId} = ANY(read_by))`
      ))
      .returning({ id: chatMessages.id });

    return result.map(r => r.id);
  }

  async getAllChatMessagesByTask(taskId: string): Promise<ChatMessage[]> {
    // Vista admin de "todo el chat de este pedido" — sin paginacion real
    // (no hay UI de "cargar mas" del lado admin), pero un tope evita que
    // una conversacion patologicamente larga traiga miles de filas con
    // texto/adjuntos completos en una sola respuesta. 500 cubre cualquier
    // conversacion real; si se trunca, se descartan las MAS VIEJAS, no
    // las recientes (fetch descendente + reverse, mismo patron que
    // getChatMessages).
    const rows = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.taskId, taskId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(500);
    return rows.reverse();
  }

  async getChatMessagesSince(since: Date): Promise<Array<{ id: string; taskId: string | null; senderId: string; receiverId: string; message: string; createdAt: Date | null; taskOwnerId: string | null }>> {
    // leftJoin (no innerJoin): mensajes sin task_id (chat directo, sin
    // pedido en comun) no deben quedar afuera del escaneo de contacto.
    return await db
      .select({
        id: chatMessages.id,
        taskId: chatMessages.taskId,
        senderId: chatMessages.senderId,
        receiverId: chatMessages.receiverId,
        message: chatMessages.message,
        createdAt: chatMessages.createdAt,
        taskOwnerId: tasks.userId,
      })
      .from(chatMessages)
      .leftJoin(tasks, eq(chatMessages.taskId, tasks.id))
      .where(gte(chatMessages.createdAt, since));
  }

  async getChatMessages(taskId: string, userId1: string, userId2: string, limit = 50, before?: string): Promise<Array<ChatMessage & { replyTo?: ReplyPreview | null }>> {
    // Include messages between the two users AND admin notifications for the current user (userId1)
    const baseCondition = and(
      eq(chatMessages.taskId, taskId),
      or(
        and(eq(chatMessages.senderId, userId1), eq(chatMessages.receiverId, userId2)),
        and(eq(chatMessages.senderId, userId2), eq(chatMessages.receiverId, userId1)),
        and(eq(chatMessages.senderId, 'admin-001'), eq(chatMessages.receiverId, userId1))
      ),
      before ? lt(chatMessages.createdAt, new Date(before)) : undefined
    );

    // Fetch newest-first so LIMIT cuts off old messages, then reverse for chronological display
    const rows = await db
      .select()
      .from(chatMessages)
      .where(baseCondition)
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    return this.withReplyPreviews(rows.reverse());
  }

  async markMessagesAsRead(taskId: string, userId: string, otherUserId: string): Promise<string[]> {
    const now = new Date();
    const result = await db
      .update(chatMessages)
      .set({ 
        readAt: now,
        readBy: sql`array_append(read_by, ${userId})`
      })
      .where(and(
        eq(chatMessages.taskId, taskId),
        eq(chatMessages.senderId, otherUserId),
        eq(chatMessages.receiverId, userId),
        sql`NOT (${userId} = ANY(read_by))`
      ))
      .returning({ id: chatMessages.id });
    
    return result.map(r => r.id);
  }

  async markMessagesAsDelivered(userId: string): Promise<number> {
    const now = new Date();
    const result = await db
      .update(chatMessages)
      .set({ deliveredAt: now })
      .where(and(
        eq(chatMessages.receiverId, userId),
        sql`delivered_at IS NULL`
      ))
      .returning({ id: chatMessages.id });
    
    return result.length;
  }

  async markFileDownloaded(messageId: string, userId: string): Promise<ChatMessage | undefined> {
    const [updated] = await db
      .update(chatMessages)
      .set({
        fileDownloadedAt: new Date(),
        fileDownloadedBy: userId,
      })
      .where(and(
        eq(chatMessages.id, messageId),
        eq(chatMessages.receiverId, userId),
        sql`file_downloaded_at IS NULL`,
        sql`attachments IS NOT NULL AND array_length(attachments, 1) > 0`
      ))
      .returning();
    return updated || undefined;
  }

  async getLastMessagesForAllConversations(userId: string): Promise<Map<string, { message: string; timestamp: Date; fromCurrentUser: boolean; unreadCount: number; isDelivered: boolean; isReadByRecipient: boolean }>> {
    const result = new Map<string, { message: string; timestamp: Date; fromCurrentUser: boolean; unreadCount: number; isDelivered: boolean; isReadByRecipient: boolean }>();
    
    // Restricciones de acceso del tutor y la consulta principal son independientes: en paralelo.
    const resolveAllowedTaskIds = async (): Promise<string[] | null> => {
    const tutor = await this.getTutorByUserId(userId);
    let allowedTaskIds: string[] | null = null; // null means no restriction (student or general access tutor)
    
    if (tutor && !tutor.hasGeneralAccess) {
      // Tutor with restricted access - get allowed tasks based on assigned courses
      const tutorCoursesList = await this.getTutorCourses(tutor.id);
      const assignedCourseValues = tutorCoursesList.map(c => c.value);
      
      if (assignedCourseValues.length === 0) {
        // No courses assigned = no access to any conversations
        allowedTaskIds = [];
      } else {
        // Get tasks matching assigned courses only
        const matchingTasks = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(inArray(tasks.studyArea, assignedCourseValues));
        
        allowedTaskIds = matchingTasks.map(t => t.id);
      }
    }
    return allowedTaskIds;
    };

    // Optimized single query: get last messages with unread counts using window functions
    const [allowedTaskIds, lastMessages] = await Promise.all([resolveAllowedTaskIds(), db.execute(sql`
      WITH ranked_messages AS (
        SELECT 
          m.*,
          -- Get the other participant (not current user)
          CASE WHEN m.sender_id = ${userId} THEN m.receiver_id ELSE m.sender_id END as other_user_id,
          ROW_NUMBER() OVER (
            PARTITION BY m.task_id, 
              CASE WHEN m.sender_id < m.receiver_id THEN m.sender_id ELSE m.receiver_id END,
              CASE WHEN m.sender_id < m.receiver_id THEN m.receiver_id ELSE m.sender_id END
            ORDER BY m.created_at DESC
          ) as rn
        FROM chat_messages m
        WHERE m.sender_id = ${userId} OR m.receiver_id = ${userId}
      ),
      unread_counts AS (
        SELECT 
          task_id,
          sender_id as other_user,
          COUNT(*) as unread_count
        FROM chat_messages
        WHERE receiver_id = ${userId} AND read_at IS NULL
        GROUP BY task_id, sender_id
      )
      SELECT 
        rm.task_id,
        rm.sender_id,
        rm.receiver_id,
        rm.other_user_id,
        rm.message,
        rm.created_at,
        rm.delivered_at,
        rm.read_at,
        COALESCE(uc.unread_count, 0) as unread_count
      FROM ranked_messages rm
      LEFT JOIN unread_counts uc ON
        rm.task_id IS NOT DISTINCT FROM uc.task_id AND
        rm.other_user_id = uc.other_user
      WHERE rm.rn = 1
    `)]);
    
    for (const row of lastMessages.rows as any[]) {
      // Filter by allowed tasks for restricted tutors
      if (allowedTaskIds !== null && !allowedTaskIds.includes(row.task_id)) {
        continue; // Skip conversations for tasks the tutor doesn't have access to
      }
      
      const otherUserId = row.sender_id === userId ? row.receiver_id : row.sender_id;
      const participants = [userId, otherUserId].sort();
      const conversationKey = `${row.task_id}-${participants[0]}-${participants[1]}`;
      
      result.set(conversationKey, {
        message: row.message,
        timestamp: new Date(row.created_at),
        fromCurrentUser: row.sender_id === userId,
        unreadCount: Number(row.unread_count || 0),
        isDelivered: !!row.delivered_at,
        isReadByRecipient: !!row.read_at
      });
    }
    
    return result;
  }

  // Payment Verification
  async createPaymentVerification(insertPayment: InsertPaymentVerification): Promise<PaymentVerification> {
    const [payment] = await db.insert(paymentVerifications).values(insertPayment).returning();
    return payment;
  }

  async getPaymentVerifications(): Promise<PaymentVerification[]> {
    return await db.select().from(paymentVerifications).orderBy(desc(paymentVerifications.createdAt));
  }

  async getPaymentVerification(id: string): Promise<PaymentVerification | undefined> {
    const [payment] = await db
      .select()
      .from(paymentVerifications)
      .where(eq(paymentVerifications.id, id));
    return payment;
  }

  async updatePaymentVerification(id: string, status: string, notes?: string, extraFields?: { amount?: string; paymentMethod?: string }, previousStatus?: string): Promise<PaymentVerification | undefined> {
    const isStatusTransition = previousStatus !== undefined && previousStatus !== status && (status === 'approved' || status === 'rejected');
    const updateData: {
      status: string;
      verifiedAt?: Date;
      adminNotes?: string | null;
      amount?: string;
      paymentMethod?: string;
    } = { status };
    if (isStatusTransition) updateData.verifiedAt = new Date();
    if (notes !== undefined) updateData.adminNotes = notes;
    if (extraFields?.amount !== undefined) updateData.amount = extraFields.amount;
    if (extraFields?.paymentMethod !== undefined) updateData.paymentMethod = extraFields.paymentMethod;

    // Guard atomico: si es una transicion de estado (aprobar/rechazar), el
    // UPDATE solo aplica si el estado en la base sigue siendo el que el
    // caller creia (previousStatus). Cierra la condicion de carrera de dos
    // requests concurrentes (doble click) que leen 'pending' antes de que
    // ninguno haya escrito — sin esto, ambos pasaban y mandaban la
    // notificacion de pago verificado dos veces.
    const whereClause = isStatusTransition
      ? and(eq(paymentVerifications.id, id), eq(paymentVerifications.status, previousStatus!))
      : eq(paymentVerifications.id, id);

    const [payment] = await db
      .update(paymentVerifications)
      .set(updateData)
      .where(whereClause)
      .returning();
    return payment;
  }

  async deletePaymentVerification(id: string): Promise<boolean> {
    const result = await db.delete(paymentVerifications).where(eq(paymentVerifications.id, id)).returning();
    return result.length > 0;
  }

  async getPaymentVerificationByTaskAndTutor(taskId: string, userId: string, tutorId: string): Promise<PaymentVerification | undefined> {
    const [payment] = await db
      .select()
      .from(paymentVerifications)
      .where(and(
        eq(paymentVerifications.taskId, taskId),
        eq(paymentVerifications.studentId, userId),
        eq(paymentVerifications.tutorId, tutorId)
      ))
      .limit(1);
    return payment;
  }

  // Admin Alerts
  async getAdminAlerts(): Promise<AdminAlert[]> {
    return await db.select().from(adminAlerts).orderBy(desc(adminAlerts.createdAt));
  }

  async getAdminAlertsEnriched(): Promise<EnrichedAdminAlert[]> {
    const rows = await db.execute(sql`
      SELECT
        aa.id,
        aa.type,
        aa.message_id      AS "messageId",
        aa.task_id         AS "taskId",
        aa.student_id      AS "studentId",
        aa.tutor_id        AS "tutorId",
        aa.detected_content AS "detectedContent",
        aa.status,
        aa.severity        AS "storedSeverity",
        aa.action_taken    AS "actionTaken",
        aa.reviewed_by     AS "reviewedBy",
        aa.reviewed_at     AS "reviewedAt",
        aa.created_at      AS "createdAt",
        cm.message         AS "chatMessage",
        cm.sender_id       AS "senderId",
        cm.moderation_status AS "moderationStatus",
        aa.original_message  AS "originalMessage",
        COALESCE(su.name, stu.name) AS "senderName",
        CASE
          WHEN aa.message_id IS NULL THEN 'Alumno'
          WHEN cm.sender_id = aa.student_id THEN 'Alumno'
          ELSE 'Tutor'
        END                AS "senderRole",
        t.title            AS "taskTitle"
      FROM admin_alerts aa
      LEFT JOIN chat_messages cm ON cm.id = aa.message_id
      LEFT JOIN users su         ON su.id = cm.sender_id
      LEFT JOIN users stu        ON stu.id = aa.student_id
      LEFT JOIN tasks t          ON t.id  = aa.task_id
      ORDER BY aa.created_at DESC
    `);
    const list = rows.rows.map((r: Record<string, unknown>) => {
      const senderId = (r.senderId ?? null) as string | null;
      return {
        id: r.id as string,
        type: r.type as string,
        messageId: (r.messageId ?? null) as string | null,
        taskId: (r.taskId ?? null) as string | null,
        studentId: r.studentId as string,
        tutorId: (r.tutorId ?? null) as string | null,
        detectedContent: r.detectedContent as string,
        status: r.status as string,
        severity: ((r.storedSeverity as string | null) ?? severityFor(r.detectedContent as string)) as AlertSeverity,
        actionTaken: (r.actionTaken ?? null) as string | null,
        reviewedBy: (r.reviewedBy ?? null) as string | null,
        reviewedAt: (r.reviewedAt ?? null) as Date | null,
        createdAt: (r.createdAt ?? null) as Date | null,
        chatMessage: (r.chatMessage ?? null) as string | null,
        senderName: (r.senderName ?? null) as string | null,
        senderRole: (r.senderRole ?? null) as 'Alumno' | 'Tutor' | null,
        taskTitle: (r.taskTitle ?? null) as string | null,
        offenderId: senderId ?? (r.studentId as string),
        moderationStatus: (r.moderationStatus ?? null) as string | null,
        originalMessage: (r.originalMessage ?? null) as string | null,
        priorAlerts: 0,
      };
    });
    // Reincidencia: alertas de contacto anteriores (no descartadas) del mismo infractor. La lista llega ordenada
    // de la mas reciente a la mas antigua, asi que se cuenta hacia atras.
    const seen = new Map<string, number>();
    for (let i = list.length - 1; i >= 0; i--) {
      const alert = list[i];
      if (alert.type !== 'personal_contact') continue;
      alert.priorAlerts = seen.get(alert.offenderId) ?? 0;
      if (alert.status !== 'dismissed') seen.set(alert.offenderId, alert.priorAlerts + 1);
    }
    return list;
  }

  async setAdminAlertOriginalIfMissing(id: string, originalMessage: string): Promise<void> {
    await db.update(adminAlerts).set({ originalMessage }).where(and(eq(adminAlerts.id, id), isNull(adminAlerts.originalMessage)));
  }

  async getAdminAlertById(id: string): Promise<AdminAlert | undefined> {
    const [alert] = await db.select().from(adminAlerts).where(eq(adminAlerts.id, id)).limit(1);
    return alert;
  }

  // Oculta un mensaje por moderacion: el texto pasa a un aviso fijo y se vacian los adjuntos (el original lo guarda la
  // alerta del admin, ver setAdminAlertOriginalIfMissing). Si era el ultimo del hilo, la vista previa de la lista de chats tambien se actualiza.
  async hideChatMessage(messageId: string): Promise<ChatMessage | undefined> {
    const current = await this.getChatMessageById(messageId);
    if (!current) return undefined;
    const [updated] = await db
      .update(chatMessages)
      .set({
        message: HIDDEN_MESSAGE_TEXT,
        moderationStatus: 'hidden',
        attachments: [],
        attachmentNames: [],
        attachmentSizes: [],
        attachmentDims: null,
      })
      .where(eq(chatMessages.id, messageId))
      .returning();
    if (current.threadId) {
      const [last] = await db
        .select({ id: chatMessages.id })
        .from(chatMessages)
        .where(eq(chatMessages.threadId, current.threadId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(1);
      if (last?.id === messageId) {
        await db.update(chatThreads).set({ lastMessage: HIDDEN_MESSAGE_TEXT }).where(eq(chatThreads.id, current.threadId));
      }
    }
    return updated;
  }

  async createAdminAlert(insertAlert: InsertAdminAlert): Promise<AdminAlert> {
    const [alert] = await db.insert(adminAlerts).values(insertAlert).returning();
    return alert;
  }

  async createErrorLog(log: InsertErrorLog): Promise<ErrorLog> {
    const [row] = await db.insert(errorLogs).values(log).returning();
    return row;
  }

  // Registra que `viewerId` abrio el perfil del tutor `tutorId` (id de la tabla tutors). Una sola vez cada 6 h por persona y tutor.
  async recordTutorProfileView(tutorId: string, viewerId: string): Promise<void> {
    await db.execute(sql`
      INSERT INTO tutor_profile_views (tutor_id, viewer_id)
      SELECT ${tutorId}, ${viewerId}
      WHERE NOT EXISTS (
        SELECT 1 FROM tutor_profile_views
        WHERE tutor_id = ${tutorId} AND viewer_id = ${viewerId} AND viewed_at > now() - interval '6 hours'
      )
    `);
  }

  // Vistas por dia (hora de Lima) de los ultimos `days` dias; los dias sin vistas salen con 0.
  async getTutorProfileViewsDaily(tutorId: string, days: number): Promise<{ day: string; views: number }[]> {
    const res = await db.execute(sql`
      WITH today AS (SELECT ((now() AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')::date AS d)
      SELECT to_char(g.d, 'YYYY-MM-DD') AS day, COALESCE(c.n, 0)::int AS views
      FROM today, generate_series(today.d - (${days}::int - 1), today.d, interval '1 day') AS g(d)
      LEFT JOIN (
        SELECT ((viewed_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Lima')::date AS day, count(*) AS n
        FROM tutor_profile_views WHERE tutor_id = ${tutorId} GROUP BY 1
      ) c ON c.day = g.d::date
      ORDER BY g.d
    `);
    return (res.rows as any[]).map((r) => ({ day: String(r.day), views: Number(r.views) }));
  }

  // Catalogo de universidades (orden alfabetico) con cuantas cuentas tienen cada una elegida.
  async listUniversities(): Promise<UniversityWithUsage[]> {
    const res = await db.execute(sql`
      SELECT u.id, u.name, u.country, u.acronym, u.status, u.suggested_by, u.created_at,
        (SELECT count(*) FROM users WHERE users.university = u.name)::int AS user_count
      FROM universities u
      ORDER BY (u.status = 'pending') DESC, lower(u.name)
    `);
    return (res.rows as any[]).map((r) => ({
      id: String(r.id), name: String(r.name), country: r.country ?? null, acronym: r.acronym ?? null,
      status: String(r.status ?? "approved"), suggestedBy: r.suggested_by ?? null,
      createdAt: new Date(r.created_at), userCount: Number(r.user_count),
    }));
  }

  async createUniversity(data: { name: string; country?: string | null; acronym?: string | null; status?: "approved" | "pending"; suggestedBy?: string | null }): Promise<University> {
    const [row] = await db.insert(universities).values({ name: data.name, country: data.country ?? null, acronym: data.acronym ?? null, status: data.status ?? "approved", suggestedBy: data.suggestedBy ?? null }).returning();
    return row;
  }

  // Al renombrar, las cuentas que la tenian elegida pasan al nombre nuevo (users.university guarda el nombre).
  async updateUniversity(id: string, data: { name?: string; country?: string | null; acronym?: string | null; status?: "approved" | "pending" }): Promise<University | undefined> {
    return await db.transaction(async (tx) => {
      const [current] = await tx.select().from(universities).where(eq(universities.id, id));
      if (!current) return undefined;
      const [row] = await tx.update(universities).set(data).where(eq(universities.id, id)).returning();
      if (data.name && data.name !== current.name) {
        await tx.update(users).set({ university: data.name }).where(eq(users.university, current.name));
      }
      return row;
    });
  }

  async deleteUniversity(id: string): Promise<boolean> {
    const rows = await db.delete(universities).where(eq(universities.id, id)).returning({ id: universities.id });
    return rows.length > 0;
  }

  async universityExists(name: string): Promise<boolean> {
    const res = await db.execute(sql`SELECT 1 FROM universities WHERE lower(name) = lower(${name}) LIMIT 1`);
    return res.rows.length > 0;
  }

  // Cuantas personas guardaron al tutor (id de la tabla tutors) en favoritos.
  async countTutorFavorites(tutorId: string): Promise<number> {
    const res = await db.execute(sql`SELECT count(*)::int AS n FROM favorites WHERE tutor_id = ${tutorId}`);
    return Number((res.rows as any[])[0]?.n ?? 0);
  }

  // Vistas por tutor (id de la tabla tutors) en los ultimos `days` dias: total y personas distintas.
  async getTutorProfileViewStats(days: number): Promise<TutorProfileViewStats[]> {
    const res = await db.execute(sql`
      SELECT tutor_id, count(*)::int AS views, count(DISTINCT viewer_id)::int AS viewers
      FROM tutor_profile_views
      WHERE viewed_at > now() - make_interval(days => ${days})
      GROUP BY tutor_id
    `);
    return (res.rows as any[]).map((r) => ({ tutorId: String(r.tutor_id), views: Number(r.views), viewers: Number(r.viewers) }));
  }

  // Una fila por pedido entregado (para las estadisticas de entrega por tutor). `tutorId` es el id de USUARIO del tutor.
  async getDeliveryRows(): Promise<DeliveryRow[]> {
    const res = await db.execute(sql`
      SELECT d.tutor_id, t.deadline, d.created_at AS delivered_at,
        COALESCE(
          (SELECT MIN(pv.verified_at) FROM payment_verifications pv WHERE pv.task_id = t.id AND pv.status = 'approved'),
          t.created_at
        ) AS assigned_at
      FROM task_deliveries d
      JOIN tasks t ON t.id = d.task_id
      WHERE d.created_at IS NOT NULL
    `);
    return (res.rows as any[]).map((r) => ({
      tutorId: String(r.tutor_id),
      deadline: new Date(r.deadline),
      assignedAt: new Date(r.assigned_at),
      deliveredAt: new Date(r.delivered_at),
    }));
  }

  async getErrorLogs({ status, level, page, pageSize }: { status?: string; level?: string; page: number; pageSize: number }): Promise<{ items: ErrorLogWithUser[]; total: number }> {
    const where = and(status ? eq(errorLogs.status, status) : undefined, level ? eq(errorLogs.level, level) : undefined);
    const [rows, [{ total }]] = await Promise.all([
      db
        .select({ log: errorLogs, userName: users.name, userEmail: users.email })
        .from(errorLogs)
        .leftJoin(users, eq(users.id, errorLogs.userId))
        .where(where)
        .orderBy(desc(errorLogs.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ total: sql<number>`count(*)::int` }).from(errorLogs).where(where),
    ]);
    const items = rows.map((r) => ({ ...r.log, userName: r.userName ?? null, userEmail: r.userEmail ?? null }));
    return { items, total };
  }

  async updateErrorLogStatus(id: string, status: string, resolvedBy: string): Promise<ErrorLog | undefined> {
    const resolved = status === "resolved";
    const [row] = await db
      .update(errorLogs)
      .set({ status, resolvedAt: resolved ? new Date() : null, resolvedBy: resolved ? resolvedBy : null })
      .where(eq(errorLogs.id, id))
      .returning();
    return row;
  }

  async updateAdminAlertStatus(id: string, status: string, reviewedBy: string, actionTaken?: string): Promise<AdminAlert | undefined> {
    const [alert] = await db
      .update(adminAlerts)
      .set({ status, reviewedBy, reviewedAt: new Date(), ...(actionTaken ? { actionTaken } : {}) })
      .where(eq(adminAlerts.id, id))
      .returning();
    return alert;
  }

  // Contact Filter Rules
  async getFilterRules(type?: 'blacklist' | 'whitelist'): Promise<ContactFilterRule[]> {
    if (type) {
      return await db
        .select()
        .from(contactFilterRules)
        .where(and(eq(contactFilterRules.type, type), eq(contactFilterRules.isActive, true)))
        .orderBy(contactFilterRules.value);
    }
    return await db
      .select()
      .from(contactFilterRules)
      .where(eq(contactFilterRules.isActive, true))
      .orderBy(contactFilterRules.type, contactFilterRules.value);
  }

  async createFilterRule(rule: InsertContactFilterRule): Promise<ContactFilterRule> {
    const [created] = await db.insert(contactFilterRules).values(rule).returning();
    return created;
  }

  async deleteFilterRule(id: string): Promise<boolean> {
    const result = await db.delete(contactFilterRules).where(eq(contactFilterRules.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async seedFilterRulesIfEmpty(): Promise<void> {
    const existing = await db.select({ id: contactFilterRules.id }).from(contactFilterRules).limit(1);
    if (existing.length > 0) return;

    const blacklistTerms = [
      'wsp', 'whatsapp', 'wasap', 'whats',
      'celular', 'mi número', 'mi numero', 'mi cel',
      'instagram', 'telegram', 'tiktok',
      'escríbeme por fuera', 'escribeme por fuera',
      'por fuera', 'fuera del chat',
      'número personal', 'numero personal',
      'wa.me', 'instagram.com', 't.me',
    ];

    const whitelistTerms = [
      '935436864',
      '+51935436864',
      '51935436864',
    ];

    for (const value of blacklistTerms) {
      await db.insert(contactFilterRules).values({ type: 'blacklist', value, isActive: true });
    }
    for (const value of whitelistTerms) {
      await db.insert(contactFilterRules).values({ type: 'whitelist', value, description: 'Número Yape admin', isActive: true });
    }
  }

  // Task Deliveries
  async createTaskDelivery(insertDelivery: InsertTaskDelivery): Promise<TaskDelivery> {
    const [delivery] = await db.insert(taskDeliveries).values(insertDelivery).returning();
    return delivery;
  }

  async getTaskDelivery(taskId: string): Promise<TaskDelivery | undefined> {
    const [delivery] = await db.select().from(taskDeliveries).where(eq(taskDeliveries.taskId, taskId));
    return delivery;
  }

  async updateTaskDelivery(taskId: string, updates: Partial<TaskDelivery>): Promise<TaskDelivery | undefined> {
    const [delivery] = await db.update(taskDeliveries)
      .set(updates)
      .where(eq(taskDeliveries.taskId, taskId))
      .returning();
    return delivery;
  }

  async confirmTaskDelivery(taskId: string, studentId: string): Promise<TaskDelivery | undefined> {
    const [delivery] = await db
      .update(taskDeliveries)
      .set({ status: 'confirmed', studentConfirmedAt: new Date() })
      .where(and(eq(taskDeliveries.taskId, taskId), eq(taskDeliveries.studentId, studentId)))
      .returning();
    return delivery;
  }

  async disputeTaskDelivery(taskId: string, studentId: string, reason: string): Promise<TaskDelivery | undefined> {
    const [delivery] = await db
      .update(taskDeliveries)
      .set({ status: 'disputed', disputeReason: reason })
      .where(and(eq(taskDeliveries.taskId, taskId), eq(taskDeliveries.studentId, studentId)))
      .returning();
    return delivery;
  }

  // Tutor Viewed Tasks
  async markTaskAsViewed(tutorId: string, taskId: string): Promise<void> {
    const existing = await db
      .select()
      .from(tutorViewedTasks)
      .where(and(eq(tutorViewedTasks.tutorId, tutorId), eq(tutorViewedTasks.taskId, taskId)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(tutorViewedTasks).values({ tutorId, taskId });
    }
  }

  async getViewedTaskIds(tutorId: string): Promise<string[]> {
    const views = await db.select({ taskId: tutorViewedTasks.taskId }).from(tutorViewedTasks).where(eq(tutorViewedTasks.tutorId, tutorId));
    return views.map(v => v.taskId);
  }

  async getUnviewedTaskCount(tutorId: string, availableTaskIds: string[]): Promise<number> {
    if (availableTaskIds.length === 0) return 0;
    
    const viewedIds = await this.getViewedTaskIds(tutorId);
    const unviewed = availableTaskIds.filter(id => !viewedIds.includes(id));
    return unviewed.length;
  }

  async getTaskViewers(taskId: string): Promise<{ tutorId: string; name: string; avatar: string | null; viewedAt: Date | null }[]> {
    const rows = await db
      .select({
        tutorId: tutorViewedTasks.tutorId,
        name: users.name,
        avatar: users.avatar,
        viewedAt: tutorViewedTasks.viewedAt,
      })
      .from(tutorViewedTasks)
      .innerJoin(users, eq(users.id, tutorViewedTasks.tutorId))
      .where(eq(tutorViewedTasks.taskId, taskId))
      .orderBy(desc(tutorViewedTasks.viewedAt));
    return rows;
  }

  async getTaskViewerCounts(): Promise<{ taskId: string; count: number }[]> {
    const rows = await db
      .select({
        taskId: tutorViewedTasks.taskId,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(tutorViewedTasks)
      .groupBy(tutorViewedTasks.taskId);
    return rows;
  }

  // Statistics
  async getUserStats(userId: string): Promise<{ tasksPublished: number; tasksCompleted: number; rating: string }> {
    const published = await db.select().from(tasks).where(eq(tasks.userId, userId));
    const completed = await db.select().from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.status, 'completed')));
    
    // Average rating from reviews
    const userReviews = await db.select().from(reviews).where(eq(reviews.studentId, userId));
    const avgRating = userReviews.length > 0 
      ? (userReviews.reduce((acc, curr) => acc + curr.rating, 0) / userReviews.length).toFixed(2)
      : "0.00";

    return {
      tasksPublished: published.length,
      tasksCompleted: completed.length,
      rating: avgRating
    };
  }

  // Additional methods
  async getTasksWithCandidates(): Promise<TaskWithCandidates[]> {
    return this.getTasks();
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async addFavorite(favorite: { userId: string; tutorId: string }): Promise<Favorite> {
    const [fav] = await db.insert(favorites).values(favorite).returning();
    return fav;
  }

  async removeFavorite(userId: string, tutorId: string): Promise<boolean> {
    const result = await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.tutorId, tutorId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getUserPaymentHistory(userId: string): Promise<any[]> {
    return await db.select().from(userPaymentHistory).where(eq(userPaymentHistory.userId, userId)).orderBy(desc(userPaymentHistory.createdAt));
  }

  async sendMessage(message: InsertChatMessage, knownTask?: Task, knownThread?: ChatThread): Promise<ChatMessage> {
    return this.createChatMessage(message, knownTask, knownThread);
  }

  // UNIFIED PRICE SYSTEM
  async getTaskCurrentPrice(taskId: string): Promise<{ currentPrice: string; lastUpdated: Date } | null> {
    const [task] = await db
      .select({ 
        currentPrice: tasks.currentPrice,
        budget: tasks.budget,
        priceLastUpdated: tasks.priceLastUpdated,
        createdAt: tasks.createdAt
      })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);
    
    if (!task) return null;
    
    return {
      currentPrice: task.currentPrice || task.budget,
      lastUpdated: task.priceLastUpdated || task.createdAt || new Date()
    };
  }

  async updateTaskCurrentPrice(taskId: string, newPrice: string): Promise<{ currentPrice: string; lastUpdated: Date }> {
    const now = new Date();
    const [updated] = await db
      .update(tasks)
      .set({ 
        currentPrice: newPrice,
        priceLastUpdated: now
      })
      .where(eq(tasks.id, taskId))
      .returning({
        currentPrice: tasks.currentPrice,
        priceLastUpdated: tasks.priceLastUpdated
      });
    
    return {
      currentPrice: updated.currentPrice || newPrice,
      lastUpdated: updated.priceLastUpdated || now
    };
  }

  async markProposalsViewed(taskId: string): Promise<void> {
    // Only set if not already set (preserve first view time)
    await db
      .update(tasks)
      .set({ proposalsViewedAt: new Date() })
      .where(and(eq(tasks.id, taskId), sql`${tasks.proposalsViewedAt} IS NULL`));
  }

  // Study Areas and Request Types
  async getStudyAreas(): Promise<StudyArea[]> {
    return await db.select().from(studyAreas).where(eq(studyAreas.isActive, true)).orderBy(studyAreas.label);
  }

  async searchStudyAreas(query: string): Promise<StudyArea[]> {
    const lowerQuery = query.toLowerCase();
    return await db
      .select()
      .from(studyAreas)
      .where(and(
        eq(studyAreas.isActive, true),
        sql`unaccent(LOWER(${studyAreas.label})) LIKE unaccent(${'%' + lowerQuery + '%'})`
      ))
      .orderBy(
        sql`CASE WHEN unaccent(LOWER(${studyAreas.label})) LIKE unaccent(${lowerQuery + '%'}) THEN 0 ELSE 1 END`,
        studyAreas.label
      )
      .limit(10);
  }

  async createStudyArea(data: { name: string }): Promise<StudyArea> {
    const value = data.name.toLowerCase().replace(/\s+/g, '-').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const [studyArea] = await db
      .insert(studyAreas)
      .values({
        value,
        label: data.name,
        isActive: true,
      })
      .returning();
    return studyArea;
  }

  async updateStudyArea(id: string, name: string): Promise<void> {
    await db.update(studyAreas)
      .set({ value: name.toLowerCase().replace(/\s+/g, '_'), label: name })
      .where(eq(studyAreas.id, id));
  }

  async deleteStudyArea(id: string): Promise<void> {
    await db.delete(studyAreas).where(eq(studyAreas.id, id));
  }

  async getRequestTypes(): Promise<RequestType[]> {
    return await db.select().from(requestTypes).where(eq(requestTypes.isActive, true)).orderBy(requestTypes.label);
  }

  async searchRequestTypes(query: string): Promise<RequestType[]> {
    const lowerQuery = query.toLowerCase();
    return await db
      .select()
      .from(requestTypes)
      .where(and(
        eq(requestTypes.isActive, true),
        sql`unaccent(LOWER(${requestTypes.label})) LIKE unaccent(${'%' + lowerQuery + '%'})`
      ))
      .orderBy(
        sql`CASE WHEN unaccent(LOWER(${requestTypes.label})) LIKE unaccent(${lowerQuery + '%'}) THEN 0 ELSE 1 END`,
        requestTypes.label
      )
      .limit(10);
  }

  async createRequestType(data: { name: string }): Promise<RequestType> {
    const value = data.name.toLowerCase().replace(/\s+/g, '-').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const [requestType] = await db
      .insert(requestTypes)
      .values({
        value,
        label: data.name,
        isActive: true,
      })
      .returning();
    return requestType;
  }

  async deleteRequestType(id: string): Promise<void> {
    await db.delete(requestTypes).where(eq(requestTypes.id, id));
  }

  async updateRequestType(id: string, name: string): Promise<void> {
    await db.update(requestTypes)
      .set({ value: name.toLowerCase().replace(/\s+/g, '_'), label: name })
      .where(eq(requestTypes.id, id));
  }

  async seedStudyAreasAndRequestTypes(): Promise<void> {
    // ─── Carreras universitarias → tabla careers ──────────────────────────────
    const careerList = [
      // Ingeniería y Tecnología
      { name: 'Ingeniería Civil', category: 'Ingeniería y Tecnología' },
      { name: 'Ingeniería de Sistemas / Informática', category: 'Ingeniería y Tecnología' },
      { name: 'Ingeniería Industrial', category: 'Ingeniería y Tecnología' },
      { name: 'Ingeniería Mecánica', category: 'Ingeniería y Tecnología' },
      { name: 'Ingeniería Eléctrica', category: 'Ingeniería y Tecnología' },
      { name: 'Ingeniería Electrónica', category: 'Ingeniería y Tecnología' },
      { name: 'Ingeniería Química', category: 'Ingeniería y Tecnología' },
      { name: 'Ingeniería de Minas', category: 'Ingeniería y Tecnología' },
      { name: 'Ingeniería Ambiental', category: 'Ingeniería y Tecnología' },
      { name: 'Ingeniería Biomédica', category: 'Ingeniería y Tecnología' },
      { name: 'Ingeniería de Telecomunicaciones', category: 'Ingeniería y Tecnología' },
      { name: 'Ingeniería Agronómica', category: 'Ingeniería y Tecnología' },
      { name: 'Ingeniería de Alimentos', category: 'Ingeniería y Tecnología' },
      { name: 'Ingeniería Naval', category: 'Ingeniería y Tecnología' },
      { name: 'Ciencias de la Computación', category: 'Ingeniería y Tecnología' },
      // Ciencias de la Salud
      { name: 'Medicina Humana', category: 'Ciencias de la Salud' },
      { name: 'Enfermería', category: 'Ciencias de la Salud' },
      { name: 'Odontología', category: 'Ciencias de la Salud' },
      { name: 'Farmacia y Bioquímica', category: 'Ciencias de la Salud' },
      { name: 'Nutrición y Dietética', category: 'Ciencias de la Salud' },
      { name: 'Obstetricia', category: 'Ciencias de la Salud' },
      { name: 'Tecnología Médica', category: 'Ciencias de la Salud' },
      { name: 'Veterinaria y Zootecnia', category: 'Ciencias de la Salud' },
      // Ciencias Económicas y Empresariales
      { name: 'Administración de Empresas', category: 'Ciencias Económicas y Empresariales' },
      { name: 'Contaduría Pública / Contabilidad', category: 'Ciencias Económicas y Empresariales' },
      { name: 'Economía', category: 'Ciencias Económicas y Empresariales' },
      { name: 'Finanzas', category: 'Ciencias Económicas y Empresariales' },
      { name: 'Marketing / Mercadotecnia', category: 'Ciencias Económicas y Empresariales' },
      { name: 'Negocios Internacionales / Comercio Exterior', category: 'Ciencias Económicas y Empresariales' },
      { name: 'Gestión Pública', category: 'Ciencias Económicas y Empresariales' },
      { name: 'Turismo y Hotelería', category: 'Ciencias Económicas y Empresariales' },
      { name: 'Gastronomía', category: 'Ciencias Económicas y Empresariales' },
      // Ciencias Sociales y Humanidades
      { name: 'Derecho y Ciencias Políticas', category: 'Ciencias Sociales y Humanidades' },
      { name: 'Psicología', category: 'Ciencias Sociales y Humanidades' },
      { name: 'Sociología', category: 'Ciencias Sociales y Humanidades' },
      { name: 'Trabajo Social', category: 'Ciencias Sociales y Humanidades' },
      { name: 'Historia', category: 'Ciencias Sociales y Humanidades' },
      { name: 'Filosofía', category: 'Ciencias Sociales y Humanidades' },
      { name: 'Antropología', category: 'Ciencias Sociales y Humanidades' },
      { name: 'Ciencias de la Comunicación / Periodismo', category: 'Ciencias Sociales y Humanidades' },
      { name: 'Literatura y Lingüística', category: 'Ciencias Sociales y Humanidades' },
      { name: 'Idiomas / Traducción e Interpretación', category: 'Ciencias Sociales y Humanidades' },
      // Ciencias Exactas y Naturales
      { name: 'Matemáticas', category: 'Ciencias Exactas y Naturales' },
      { name: 'Estadística', category: 'Ciencias Exactas y Naturales' },
      { name: 'Física', category: 'Ciencias Exactas y Naturales' },
      { name: 'Química', category: 'Ciencias Exactas y Naturales' },
      { name: 'Biología', category: 'Ciencias Exactas y Naturales' },
      { name: 'Biotecnología', category: 'Ciencias Exactas y Naturales' },
      // Arte, Diseño y Educación
      { name: 'Arquitectura', category: 'Arte, Diseño y Educación' },
      { name: 'Diseño Gráfico', category: 'Arte, Diseño y Educación' },
      { name: 'Diseño Industrial', category: 'Arte, Diseño y Educación' },
      { name: 'Bellas Artes / Artes Visuales', category: 'Arte, Diseño y Educación' },
      { name: 'Educación / Pedagogía', category: 'Arte, Diseño y Educación' },
      { name: 'Educación Física', category: 'Arte, Diseño y Educación' },
    ];

    // 1 lectura + 1 insert por lote (antes 1 SELECT + INSERT por carrera: ~55 viajes a Neon en cada arranque)
    const existingCareers = new Set((await db.select({ name: careers.name }).from(careers)).map(r => r.name));
    const newCareers = careerList.filter(c => !existingCareers.has(c.name)).map(c => ({ name: c.name, category: c.category }));
    if (newCareers.length > 0) await db.insert(careers).values(newCareers);

    // ─── Materias/cursos universitarios → tabla study_areas ──────────────────
    const areas = [
      // Matemáticas
      { value: 'calculo_i', label: 'Cálculo I' },
      { value: 'calculo_ii', label: 'Cálculo II' },
      { value: 'calculo_iii', label: 'Cálculo III (Multivariable)' },
      { value: 'algebra_lineal', label: 'Álgebra Lineal' },
      { value: 'algebra', label: 'Álgebra' },
      { value: 'geometria_analitica', label: 'Geometría Analítica' },
      { value: 'ecuaciones_diferenciales', label: 'Ecuaciones Diferenciales' },
      { value: 'matematicas_discretas', label: 'Matemáticas Discretas' },
      { value: 'calculo_numerico', label: 'Cálculo Numérico' },
      { value: 'probabilidad_estadistica', label: 'Probabilidad y Estadística' },
      { value: 'estadistica_i', label: 'Estadística I' },
      { value: 'estadistica_ii', label: 'Estadística II (Inferencial)' },
      { value: 'estadistica_aplicada', label: 'Estadística Aplicada' },
      { value: 'analisis_matematico', label: 'Análisis Matemático' },
      { value: 'matematica_financiera', label: 'Matemática Financiera' },
      // Física
      { value: 'fisica_i', label: 'Física I (Mecánica)' },
      { value: 'fisica_ii', label: 'Física II (Electricidad y Magnetismo)' },
      { value: 'fisica_iii', label: 'Física III (Óptica y Ondas)' },
      { value: 'termodinamica', label: 'Termodinámica' },
      { value: 'mecanica_clasica', label: 'Mecánica Clásica' },
      { value: 'optica', label: 'Óptica' },
      { value: 'fisica_moderna', label: 'Física Moderna / Cuántica' },
      // Química
      { value: 'quimica_general', label: 'Química General' },
      { value: 'quimica_organica', label: 'Química Orgánica' },
      { value: 'quimica_analitica', label: 'Química Analítica' },
      { value: 'quimica_inorganica', label: 'Química Inorgánica' },
      { value: 'bioquimica', label: 'Bioquímica' },
      { value: 'fisicoquimica', label: 'Fisicoquímica' },
      { value: 'quimica_ambiental', label: 'Química Ambiental' },
      // Biología
      { value: 'biologia_general', label: 'Biología General' },
      { value: 'biologia_celular', label: 'Biología Celular y Molecular' },
      { value: 'genetica', label: 'Genética' },
      { value: 'microbiologia', label: 'Microbiología' },
      { value: 'ecologia', label: 'Ecología' },
      { value: 'botanica', label: 'Botánica' },
      { value: 'zoologia', label: 'Zoología' },
      { value: 'biotecnologia', label: 'Biotecnología' },
      // Ingeniería Civil y Mecánica
      { value: 'resistencia_materiales', label: 'Resistencia de Materiales' },
      { value: 'mecanica_fluidos', label: 'Mecánica de Fluidos' },
      { value: 'estructuras_i', label: 'Estructuras I' },
      { value: 'estructuras_ii', label: 'Estructuras II' },
      { value: 'topografia', label: 'Topografía' },
      { value: 'hidraulica', label: 'Hidráulica' },
      { value: 'geotecnia', label: 'Geotecnia / Mecánica de Suelos' },
      { value: 'concreto_armado', label: 'Diseño en Concreto Armado' },
      { value: 'dibujo_tecnico', label: 'Dibujo Técnico' },
      { value: 'autocad', label: 'AutoCAD' },
      { value: 'diseño_maquinas', label: 'Diseño de Máquinas' },
      { value: 'manufactura', label: 'Procesos de Manufactura' },
      // Ingeniería Eléctrica / Electrónica
      { value: 'circuitos_electricos_i', label: 'Circuitos Eléctricos I' },
      { value: 'circuitos_electricos_ii', label: 'Circuitos Eléctricos II' },
      { value: 'electronica_i', label: 'Electrónica I' },
      { value: 'electronica_ii', label: 'Electrónica II' },
      { value: 'maquinas_electricas', label: 'Máquinas Eléctricas' },
      { value: 'control_automatico', label: 'Control Automático' },
      { value: 'telecomunicaciones', label: 'Telecomunicaciones' },
      { value: 'procesamiento_senales', label: 'Procesamiento de Señales' },
      // Computación / Sistemas
      { value: 'programacion_i', label: 'Programación I' },
      { value: 'programacion_ii', label: 'Programación II' },
      { value: 'programacion_oo', label: 'Programación Orientada a Objetos' },
      { value: 'estructuras_datos', label: 'Estructuras de Datos' },
      { value: 'algoritmos', label: 'Algoritmos y Complejidad' },
      { value: 'base_datos_i', label: 'Base de Datos I' },
      { value: 'base_datos_ii', label: 'Base de Datos II' },
      { value: 'sistemas_operativos', label: 'Sistemas Operativos' },
      { value: 'redes_computadoras', label: 'Redes de Computadoras' },
      { value: 'ingenieria_software', label: 'Ingeniería de Software' },
      { value: 'inteligencia_artificial', label: 'Inteligencia Artificial' },
      { value: 'aprendizaje_automatico', label: 'Aprendizaje Automático (ML)' },
      { value: 'desarrollo_web', label: 'Desarrollo Web' },
      { value: 'ciberseguridad', label: 'Ciberseguridad' },
      { value: 'arquitectura_computadoras', label: 'Arquitectura de Computadoras' },
      { value: 'compiladores', label: 'Diseño de Compiladores' },
      // Ciencias de la Salud
      { value: 'anatomia_humana', label: 'Anatomía Humana' },
      { value: 'fisiologia_humana', label: 'Fisiología Humana' },
      { value: 'histologia', label: 'Histología y Embriología' },
      { value: 'parasitologia', label: 'Parasitología' },
      { value: 'patologia', label: 'Patología General' },
      { value: 'farmacologia', label: 'Farmacología' },
      { value: 'semiologia', label: 'Semiología Médica' },
      { value: 'medicina_interna', label: 'Medicina Interna' },
      { value: 'cirugia_general', label: 'Cirugía General' },
      { value: 'pediatria', label: 'Pediatría' },
      { value: 'ginecologia', label: 'Ginecología y Obstetricia' },
      { value: 'psiquiatria', label: 'Psiquiatría' },
      { value: 'salud_publica', label: 'Salud Pública y Epidemiología' },
      { value: 'enfermeria_basica', label: 'Enfermería Básica' },
      { value: 'nutricion_basica', label: 'Nutrición Básica' },
      // Derecho
      { value: 'intro_derecho', label: 'Introducción al Derecho' },
      { value: 'derecho_civil', label: 'Derecho Civil' },
      { value: 'derecho_penal', label: 'Derecho Penal' },
      { value: 'derecho_constitucional', label: 'Derecho Constitucional' },
      { value: 'derecho_laboral', label: 'Derecho Laboral' },
      { value: 'derecho_comercial', label: 'Derecho Comercial / Mercantil' },
      { value: 'derecho_internacional', label: 'Derecho Internacional' },
      { value: 'derecho_tributario', label: 'Derecho Tributario / Fiscal' },
      { value: 'derecho_administrativo', label: 'Derecho Administrativo' },
      { value: 'derecho_procesal', label: 'Derecho Procesal' },
      // Psicología y Ciencias Sociales
      { value: 'psicologia_general', label: 'Psicología General' },
      { value: 'psicologia_social', label: 'Psicología Social' },
      { value: 'psicologia_clinica', label: 'Psicología Clínica' },
      { value: 'psicologia_organizacional', label: 'Psicología Organizacional' },
      { value: 'psicologia_educativa', label: 'Psicología Educativa' },
      { value: 'psicologia_desarrollo', label: 'Psicología del Desarrollo' },
      { value: 'sociologia_general', label: 'Sociología General' },
      { value: 'metodos_investigacion', label: 'Métodos de Investigación' },
      { value: 'trabajo_social_basico', label: 'Trabajo Social Básico' },
      // Contabilidad y Finanzas
      { value: 'contabilidad_general', label: 'Contabilidad General' },
      { value: 'contabilidad_costos', label: 'Contabilidad de Costos' },
      { value: 'contabilidad_financiera', label: 'Contabilidad Financiera' },
      { value: 'auditoria', label: 'Auditoría' },
      { value: 'finanzas_i', label: 'Finanzas I' },
      { value: 'finanzas_ii', label: 'Finanzas II (Corporativas)' },
      { value: 'tributacion', label: 'Tributación / Impuestos' },
      { value: 'analisis_financiero', label: 'Análisis Financiero' },
      { value: 'contabilidad_gerencial', label: 'Contabilidad Gerencial' },
      { value: 'niif', label: 'Normas NIIF / IFRS' },
      // Economía y Administración
      { value: 'microeconomia', label: 'Microeconomía' },
      { value: 'macroeconomia', label: 'Macroeconomía' },
      { value: 'economia_internacional', label: 'Economía Internacional' },
      { value: 'economia_publica', label: 'Economía Pública' },
      { value: 'administracion_general', label: 'Administración General' },
      { value: 'gestion_empresarial', label: 'Gestión Empresarial' },
      { value: 'recursos_humanos', label: 'Recursos Humanos' },
      { value: 'marketing_i', label: 'Marketing I' },
      { value: 'marketing_digital', label: 'Marketing Digital' },
      { value: 'logistica', label: 'Logística y Cadena de Suministro' },
      { value: 'comercio_internacional', label: 'Comercio Internacional' },
      { value: 'emprendimiento', label: 'Emprendimiento e Innovación' },
      { value: 'plan_negocios', label: 'Plan de Negocios' },
      { value: 'investigacion_mercados', label: 'Investigación de Mercados' },
      { value: 'gestion_proyectos', label: 'Gestión de Proyectos' },
      // Investigación y metodología
      { value: 'metodologia_investigacion', label: 'Metodología de la Investigación' },
      { value: 'redaccion_academica', label: 'Redacción Académica' },
      { value: 'seminario_tesis', label: 'Seminario de Tesis' },
      { value: 'investigacion_operaciones', label: 'Investigación de Operaciones' },
      { value: 'simulacion_sistemas', label: 'Simulación de Sistemas' },
      // Idiomas
      { value: 'ingles_i', label: 'Inglés I' },
      { value: 'ingles_ii', label: 'Inglés II' },
      { value: 'ingles_iii', label: 'Inglés III' },
      { value: 'ingles_tecnico', label: 'Inglés Técnico' },
      { value: 'frances_i', label: 'Francés I' },
      { value: 'portugues_i', label: 'Portugués I' },
      { value: 'traduccion_tecnica', label: 'Traducción Técnica' },
      // Humanidades
      { value: 'historia_universal', label: 'Historia Universal' },
      { value: 'historia_america', label: 'Historia de América' },
      { value: 'filosofia', label: 'Filosofía' },
      { value: 'etica_profesional', label: 'Ética Profesional' },
      { value: 'literatura', label: 'Literatura' },
      { value: 'linguistica', label: 'Lingüística' },
      { value: 'comunicacion_oral', label: 'Comunicación Oral y Escrita' },
      // Arquitectura y Diseño
      { value: 'diseno_arquitectonico', label: 'Diseño Arquitectónico' },
      { value: 'urbanismo', label: 'Urbanismo y Planificación' },
      { value: 'diseno_grafico', label: 'Diseño Gráfico' },
      { value: 'diseno_web', label: 'Diseño Web / UX-UI' },
      { value: 'ilustracion_digital', label: 'Ilustración Digital' },
      { value: 'fotografia', label: 'Fotografía' },
      { value: 'historia_arte', label: 'Historia del Arte' },
      // Educación
      { value: 'didactica_general', label: 'Didáctica General' },
      { value: 'pedagogia', label: 'Pedagogía' },
      { value: 'curriculum', label: 'Currículum y Planificación Educativa' },
      { value: 'educacion_especial', label: 'Educación Especial' },
    ];

    const types = [
      { value: 'ensayo', label: 'Ensayo' },
      { value: 'ensayo_argumentativo', label: 'Ensayo argumentativo' },
      { value: 'ensayo_critico', label: 'Ensayo crítico' },
      { value: 'ensayo_descriptivo', label: 'Ensayo descriptivo' },
      { value: 'ensayo_expositivo', label: 'Ensayo expositivo' },
      { value: 'ensayo_narrativo', label: 'Ensayo narrativo' },
      { value: 'tesis', label: 'Tesis' },
      { value: 'anteproyecto', label: 'Anteproyecto de tesis' },
      { value: 'protocolo_investigacion', label: 'Protocolo de investigación' },
      { value: 'examen', label: 'Examen' },
      { value: 'examen_parcial', label: 'Examen parcial' },
      { value: 'examen_final', label: 'Examen final' },
      { value: 'cuestionario', label: 'Cuestionario' },
      { value: 'investigacion', label: 'Investigación' },
      { value: 'revision_literatura', label: 'Revisión de literatura' },
      { value: 'revision_bibliografica', label: 'Revisión bibliográfica' },
      { value: 'articulo_cientifico', label: 'Artículo científico' },
      { value: 'reporte', label: 'Reporte' },
      { value: 'reporte_tecnico', label: 'Reporte técnico' },
      { value: 'informe_laboratorio', label: 'Informe de laboratorio' },
      { value: 'practica_laboratorio', label: 'Práctica de laboratorio' },
      { value: 'caso_estudio', label: 'Caso de estudio' },
      { value: 'monografia', label: 'Monografía' },
      { value: 'presentacion', label: 'Presentación' },
      { value: 'diapositivas', label: 'Diapositivas (PowerPoint / Canva)' },
      { value: 'video_explicativo', label: 'Video explicativo' },
      { value: 'podcast_academico', label: 'Podcast académico' },
      { value: 'ejercicios', label: 'Ejercicios' },
      { value: 'ejercicios_resueltos', label: 'Ejercicios con solución' },
      { value: 'problema_resuelto', label: 'Problema resuelto' },
      { value: 'tutoria', label: 'Tutoría' },
      { value: 'tarea', label: 'Tarea' },
      { value: 'trabajo_practico', label: 'Trabajo práctico' },
      { value: 'proyecto_final', label: 'Proyecto final' },
      { value: 'propuesta_proyecto', label: 'Propuesta de proyecto' },
      { value: 'evaluacion_proyecto', label: 'Evaluación de proyecto' },
      { value: 'resumen', label: 'Resumen' },
      { value: 'resumen_ejecutivo', label: 'Resumen ejecutivo / Abstract' },
      { value: 'resumen_clase', label: 'Resumen de clase' },
      { value: 'apuntes', label: 'Apuntes organizados' },
      { value: 'analisis', label: 'Análisis' },
      { value: 'analisis_texto', label: 'Análisis de texto' },
      { value: 'analisis_datos', label: 'Análisis de datos' },
      { value: 'analisis_financiero', label: 'Análisis financiero' },
      { value: 'analisis_foda', label: 'Análisis FODA / DAFO' },
      { value: 'estadisticas', label: 'Estadísticas' },
      { value: 'encuesta', label: 'Encuesta' },
      { value: 'entrevista_estructurada', label: 'Entrevista estructurada' },
      { value: 'diseno_experimental', label: 'Diseño experimental' },
      { value: 'simulacion', label: 'Simulación' },
      { value: 'modelo_matematico', label: 'Modelo matemático' },
      { value: 'formulacion_hipotesis', label: 'Formulación de hipótesis' },
      { value: 'marco_teorico', label: 'Marco teórico' },
      { value: 'marco_metodologico', label: 'Marco metodológico' },
      { value: 'introduccion_academica', label: 'Introducción académica' },
      { value: 'conclusiones', label: 'Conclusiones' },
      { value: 'discusion_resultados', label: 'Discusión de resultados' },
      { value: 'mapa_conceptual', label: 'Mapa conceptual' },
      { value: 'mapa_mental', label: 'Mapa mental' },
      { value: 'cuadro_comparativo', label: 'Cuadro comparativo' },
      { value: 'linea_tiempo', label: 'Línea del tiempo' },
      { value: 'diagrama_flujo', label: 'Diagrama de flujo' },
      { value: 'diagrama_uml', label: 'Diagrama UML' },
      { value: 'base_datos', label: 'Base de datos' },
      { value: 'codigo_fuente', label: 'Código fuente / Programa' },
      { value: 'app', label: 'Aplicación (App)' },
      { value: 'pagina_web', label: 'Página web' },
      { value: 'plan_negocios', label: 'Plan de negocios' },
      { value: 'plan_marketing', label: 'Plan de marketing' },
      { value: 'estado_resultados', label: 'Estado de resultados' },
      { value: 'balance_general', label: 'Balance general' },
      { value: 'flujo_caja', label: 'Flujo de caja' },
      { value: 'traduccion', label: 'Traducción' },
      { value: 'correccion_estilo', label: 'Corrección de estilo' },
      { value: 'correccion_ortografica', label: 'Corrección ortográfica' },
      { value: 'formateo_apa', label: 'Formateo APA' },
      { value: 'formateo_mla', label: 'Formateo MLA' },
      { value: 'formateo_chicago', label: 'Formateo Chicago' },
      { value: 'citacion_bibliografia', label: 'Citación / Bibliografía' },
      { value: 'portafolio', label: 'Portafolio académico' },
      { value: 'diario_reflexivo', label: 'Diario reflexivo' },
      { value: 'reseña', label: 'Reseña' },
      { value: 'critica_literaria', label: 'Crítica literaria' },
      { value: 'comentario_texto', label: 'Comentario de texto' },
      { value: 'parafrasis', label: 'Paráfrasis' },
      { value: 'ficha_tecnica', label: 'Ficha técnica' },
      { value: 'ficha_bibliografica', label: 'Ficha bibliográfica' },
      { value: 'guia_estudio', label: 'Guía de estudio' },
      { value: 'plan_estudios', label: 'Plan de estudios' },
      { value: 'cronograma', label: 'Cronograma de actividades' },
      { value: 'acta_reunion', label: 'Acta de reunión' },
      { value: 'minuta', label: 'Minuta' },
      { value: 'debate', label: 'Debate' },
      { value: 'disertacion', label: 'Disertación oral' },
      { value: 'carta_presentacion', label: 'Carta de presentación' },
      { value: 'carta_motivacion', label: 'Carta de motivación' },
      { value: 'curriculum_vitae', label: 'Currículum Vitae (CV)' },
      { value: 'informe_pasantia', label: 'Informe de pasantía' },
      { value: 'informe_social', label: 'Informe social / comunitario' },
      { value: 'dictamen', label: 'Dictamen / Peritaje' },
      { value: 'contrato', label: 'Contrato (borrador académico)' },
      { value: 'demanda_juridica', label: 'Demanda jurídica (académica)' },
      { value: 'historia_clinica', label: 'Historia clínica (académica)' },
      { value: 'caso_clinico', label: 'Caso clínico' },
      { value: 'plan_tratamiento', label: 'Plan de tratamiento' },
      { value: 'plan_clase', label: 'Plan de clase / sesión' },
      { value: 'material_didactico', label: 'Material didáctico' },
      { value: 'rubrica_evaluacion', label: 'Rúbrica de evaluación' },
      { value: 'bitacora', label: 'Bitácora / Cuaderno de campo' },
      { value: 'otro', label: 'Otro' },
    ];

    const existingAreas = new Set((await db.select({ value: studyAreas.value }).from(studyAreas)).map(r => r.value));
    const newAreas = areas.filter(a => !existingAreas.has(a.value));
    if (newAreas.length > 0) await db.insert(studyAreas).values(newAreas);

    const existingTypes = new Set((await db.select({ value: requestTypes.value }).from(requestTypes)).map(r => r.value));
    const newTypes = types.filter(t => !existingTypes.has(t.value));
    if (newTypes.length > 0) await db.insert(requestTypes).values(newTypes);
  }

  // Push Subscriptions
  async savePushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription> {
    const [sub] = await db.insert(pushSubscriptions).values(subscription).returning();
    return sub;
  }

  async getPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    return await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  async deletePushSubscription(userId: string, endpoint: string): Promise<boolean> {
    const result = await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getAllPushSubscriptionsForUser(userId: string): Promise<PushSubscription[]> {
    return this.getPushSubscriptions(userId);
  }

  // Bloqueo entre usuarios
  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    await db.insert(userBlocks).values({ blockerId, blockedId }).onConflictDoNothing();
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
    const result = await db.delete(userBlocks).where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getBlockedUsers(blockerId: string) {
    const rows = await db
      .select({ userId: users.id, name: users.name, avatar: users.avatar })
      .from(userBlocks)
      .innerJoin(users, eq(users.id, userBlocks.blockedId))
      .where(eq(userBlocks.blockerId, blockerId));
    return rows;
  }

  // Bloqueo en cualquier direccion: quien bloquea y quien es bloqueado dejan de poder escribirse.
  async isBlockedBetween(userA: string, userB: string): Promise<boolean> {
    const [row] = await db
      .select({ id: userBlocks.id })
      .from(userBlocks)
      .where(or(
        and(eq(userBlocks.blockerId, userA), eq(userBlocks.blockedId, userB)),
        and(eq(userBlocks.blockerId, userB), eq(userBlocks.blockedId, userA)),
      ))
      .limit(1);
    return !!row;
  }

  // Pedidos con dinero o trabajo en curso: impiden eliminar la cuenta hasta que se cierren.
  async countOpenTasksForUser(userId: string): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(tasks)
      .where(and(
        or(eq(tasks.userId, userId), eq(tasks.assignedTutorId, userId)),
        inArray(tasks.status, ['payment_pending', 'in_progress']),
      ));
    return row?.n ?? 0;
  }

  // Eliminacion de cuenta pedida por el propio usuario: se anonimiza en vez de borrar, porque los pagos, pedidos y
  // mensajes tambien pertenecen a la otra parte (que no debe perder su historial). Se borra todo dato personal.
  async anonymizeUser(userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.update(users).set({
        name: 'Usuario eliminado',
        email: `deleted-${userId}@deleted.invalid`,
        password: null,
        university: null,
        avatar: null,
        whatsapp: null,
        status: 'deleted',
        supabaseUid: null,
        registrationIP: null,
        registrationCity: null,
        registrationCountry: null,
        registrationDevice: null,
        registrationBrowser: null,
        registrationOS: null,
      }).where(eq(users.id, userId));
      await tx.update(tutors).set({ bio: null, profession: null, specialties: [], isVerified: false }).where(eq(tutors.user_id, userId));
      await tx.update(tasks).set({ status: 'cancelled' }).where(and(eq(tasks.userId, userId), eq(tasks.status, 'active')));
      await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
      await tx.delete(nativePushTokens).where(eq(nativePushTokens.userId, userId));
      await tx.delete(favorites).where(eq(favorites.userId, userId));
      await tx.delete(userBlocks).where(or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)));
      await tx.delete(activityLogs).where(eq(activityLogs.userId, userId));
    });
  }

  // Push nativo (FCM/APNs). El token es unico: si otra cuenta lo registra en el mismo dispositivo, se reasigna.
  async saveNativePushToken(input: InsertNativePushToken): Promise<NativePushToken> {
    const [row] = await db.insert(nativePushTokens).values(input)
      .onConflictDoUpdate({
        target: nativePushTokens.token,
        set: { userId: input.userId, platform: input.platform, appVersion: input.appVersion ?? null, lastUsed: new Date() },
      })
      .returning();
    return row;
  }

  async getNativePushTokens(userId: string): Promise<NativePushToken[]> {
    return await db.select().from(nativePushTokens).where(eq(nativePushTokens.userId, userId));
  }

  // Solo borra si el token es de ese usuario: nadie puede quitar el token de otra cuenta.
  async deleteNativePushToken(userId: string, token: string): Promise<boolean> {
    const result = await db.delete(nativePushTokens).where(and(eq(nativePushTokens.userId, userId), eq(nativePushTokens.token, token)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Para limpiar tokens que FCM reporta como invalidos.
  async deleteNativePushTokenByValue(token: string): Promise<boolean> {
    const result = await db.delete(nativePushTokens).where(eq(nativePushTokens.token, token));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Activity Logs
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [result] = await db.insert(activityLogs).values(log).returning();
    return result;
  }

  async getActivityLogs(userId: string, limit: number = 100): Promise<ActivityLog[]> {
    return await db.select().from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  async getAllActivityLogs(limit: number = 200): Promise<(ActivityLog & { userName?: string | null })[]> {
    const results = await db.select({
      id: activityLogs.id,
      userId: activityLogs.userId,
      action: activityLogs.action,
      detail: activityLogs.detail,
      metadata: activityLogs.metadata,
      ipAddress: activityLogs.ipAddress,
      device: activityLogs.device,
      createdAt: activityLogs.createdAt,
      userName: users.name,
    }).from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
    return results;
  }

  async getConnectionStats(startDate: Date, endDate: Date): Promise<{ date: string; students: number; tutors: number }[]> {
    // Count UNIQUE active users per day (any activity), classified by role.
    // This reflects real usage: a user who stays logged in and uses the app
    // will be counted even if they didn't re-login that day.
    const rows = await db.select({
      day: sql<string>`TO_CHAR(${activityLogs.createdAt} AT TIME ZONE 'America/Lima', 'YYYY-MM-DD')`,
      isTutor: sql<boolean>`CASE WHEN ${tutors.id} IS NOT NULL THEN TRUE ELSE FALSE END`,
      uniqueUsers: sql<number>`COUNT(DISTINCT ${activityLogs.userId})`,
    })
      .from(activityLogs)
      .leftJoin(tutors, eq(tutors.user_id, activityLogs.userId))
      .where(
        and(
          sql`${activityLogs.userId} != 'admin-001'`,
          gte(activityLogs.createdAt, startDate),
          lte(activityLogs.createdAt, endDate)
        )
      )
      .groupBy(
        sql`TO_CHAR(${activityLogs.createdAt} AT TIME ZONE 'America/Lima', 'YYYY-MM-DD')`,
        tutors.id
      )
      .orderBy(sql`TO_CHAR(${activityLogs.createdAt} AT TIME ZONE 'America/Lima', 'YYYY-MM-DD')`);

    // Build a map with one entry per day covering the full date range
    const map = new Map<string, { students: number; tutors: number }>();
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, { students: 0, tutors: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const row of rows) {
      const key = row.day;
      if (!map.has(key)) map.set(key, { students: 0, tutors: 0 });
      const entry = map.get(key)!;
      if (row.isTutor) {
        entry.tutors += Number(row.uniqueUsers);
      } else {
        entry.students += Number(row.uniqueUsers);
      }
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));
  }

  async getVisitDetails(startDate: Date, endDate: Date): Promise<{
    id: number;
    userId: string;
    name: string;
    email: string;
    avatar: string | null;
    country: string | null;
    role: string;
    visitedAt: string;
    device: string | null;
  }[]> {
    const rows = await db.execute(sql`
      SELECT
        al.id,
        u.id                                                                        AS "userId",
        u.name,
        u.email,
        u.avatar,
        u.country,
        CASE WHEN t.id IS NOT NULL THEN 'tutor' WHEN u.role = 'agent' THEN 'agent' ELSE 'student' END AS role,
        TO_CHAR(al.created_at, 'YYYY-MM-DD"T"HH24:MI:SS') || 'Z'                  AS "visitedAt",
        al.device
      FROM activity_logs al
      JOIN users u ON u.id = al.user_id
      LEFT JOIN tutors t ON t.user_id = al.user_id
      WHERE al.user_id != 'admin-001'
        AND al.action = 'visit'
        AND al.created_at >= ${startDate}
        AND al.created_at <= ${endDate}
      ORDER BY al.created_at DESC
    `);

    return (rows.rows as any[]).map(r => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      email: r.email,
      avatar: r.avatar,
      country: r.country,
      role: r.role,
      visitedAt: r.visitedAt,
      device: r.device,
    }));
  }

  // Task Audit Logs
  async createTaskAuditLog(log: InsertTaskAuditLog): Promise<TaskAuditLog> {
    const [result] = await db.insert(taskAuditLogs).values(log).returning();
    return result;
  }

  async updateTaskWithAuditLogs(
    id: string,
    updates: Partial<Task>,
    adminId: string,
    auditFields: readonly ('title' | 'description' | 'comment' | 'status')[],
  ): Promise<Task | undefined> {
    return db.transaction(async (tx) => {
      // Read current values inside the transaction to avoid race conditions
      const [current] = await tx
        .select({ title: tasks.title, description: tasks.description, comment: tasks.comment, status: tasks.status })
        .from(tasks)
        .where(eq(tasks.id, id));
      if (!current) return undefined;

      // Apply update
      const [task] = await tx
        .update(tasks)
        .set(updates)
        .where(eq(tasks.id, id))
        .returning();
      if (!task) return undefined;

      // Build and insert audit entries for changed fields
      const entries: InsertTaskAuditLog[] = [];
      for (const field of auditFields) {
        if (field in updates) {
          const oldValue = current[field] ?? null;
          const newValue = (updates as Record<string, unknown>)[field] ?? null;
          if (String(oldValue ?? '') !== String(newValue ?? '')) {
            entries.push({
              taskId: id,
              adminId,
              field,
              oldValue: oldValue != null ? String(oldValue) : null,
              newValue: newValue != null ? String(newValue) : null,
            });
          }
        }
      }
      if (entries.length > 0) {
        await tx.insert(taskAuditLogs).values(entries);
      }
      return task;
    });
  }

  async getTaskAuditLogs(taskId: string): Promise<(TaskAuditLog & { adminName?: string | null })[]> {
    const results = await db
      .select({
        id: taskAuditLogs.id,
        taskId: taskAuditLogs.taskId,
        adminId: taskAuditLogs.adminId,
        field: taskAuditLogs.field,
        oldValue: taskAuditLogs.oldValue,
        newValue: taskAuditLogs.newValue,
        createdAt: taskAuditLogs.createdAt,
        adminName: users.name,
      })
      .from(taskAuditLogs)
      .leftJoin(users, eq(taskAuditLogs.adminId, users.id))
      .where(eq(taskAuditLogs.taskId, taskId))
      .orderBy(desc(taskAuditLogs.createdAt));
    return results;
  }

  async getOrphanedTutors(): Promise<{ id: string; profession: string | null; user_id: string }[]> {
    const results = await db
      .select({
        id: tutors.id,
        profession: tutors.profession,
        user_id: tutors.user_id,
      })
      .from(tutors)
      .leftJoin(users, eq(tutors.user_id, users.id))
      .where(sql`${users.id} IS NULL`);
    return results;
  }

  async repairOrphanedTutor(tutorId: string, email: string): Promise<{ success: boolean; message: string }> {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.email}) = LOWER(${email})`);
    if (!user) {
      return { success: false, message: "No se encontró usuario con ese correo" };
    }
    const existingTutor = await db.select().from(tutors).where(eq(tutors.user_id, user.id));
    if (existingTutor.length > 0 && existingTutor[0].id !== tutorId) {
      return { success: false, message: "Ese usuario ya tiene un perfil de tutor vinculado" };
    }
    const [updated] = await db
      .update(tutors)
      .set({ user_id: user.id })
      .where(eq(tutors.id, tutorId))
      .returning();
    if (!updated) {
      return { success: false, message: "Tutor no encontrado" };
    }
    return { success: true, message: "Tutor vinculado correctamente" };
  }
}

export const storage = new DatabaseStorage();
