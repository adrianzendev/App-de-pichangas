import type { Express, Request, Response } from "express";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { venues, matches, matchPlayers, users, playerProfiles, insertMatchSchema, insertVenueSchema } from "@shared/schema";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import sharp from "sharp";
import { ObjectStorageService } from "./object_storage";

// Portadas de partido: se reciben en memoria (max 8 MB), se recortan a 16:9 y se guardan en el almacenamiento de objetos
// cuando esta configurado (R2/GCS, produccion); sin el (desarrollo local) se escriben en uploads/pichangas/.
const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
});
const hasObjectStorage = () => !!(process.env.R2_ACCESS_KEY_ID || process.env.PRIVATE_OBJECT_DIR);

// Igual que el esquema publico, pero al editar la fecha puede ser pasada (corregir un partido ya jugado); al crear se exige futura aparte.
const adminMatchSchema = insertMatchSchema.extend({ startsAt: z.coerce.date() });

// Panel de administracion de Pichangas. Todo cuelga de /api/admin/*: el RBAC central de routes.ts ya responde 401/403 a quien
// no es administrador; aqui se vuelve a comprobar por si el orden de registro cambia.
export function requireAdmin(req: Request, res: Response): boolean {
  const user = (req as any).session?.user;
  if (!user) { res.status(401).json({ message: "Inicia sesión para continuar" }); return false; }
  if (user.userType !== "admin") { res.status(403).json({ message: "Acceso restringido al administrador" }); return false; }
  return true;
}

export function registerAdminPichangas(app: Express) {
  // Sube UNA portada y devuelve su URL; el formulario la agrega a la lista de portadas del partido.
  app.post("/api/admin/pichangas/matches/cover", async (req, res) => {
    // Admin o host: quien puede crear partidos puede subir sus portadas.
    const sessionUser = (req as any).session?.user;
    if (!sessionUser) return res.status(401).json({ message: "Inicia sesión para continuar" });
    if (sessionUser.userType !== "admin") {
      const [profile] = await db.select({ isHost: playerProfiles.isHost }).from(playerProfiles).where(eq(playerProfiles.userId, sessionUser.id));
      if (!profile?.isHost) return res.status(403).json({ message: "Solo el administrador y los hosts suben portadas" });
    }
    coverUpload.single("cover")(req, res, async (uploadError) => {
      try {
        if (uploadError) return res.status(400).json({ message: "La imagen pesa más de 8 MB o no es válida" });
        if (!req.file) return res.status(400).json({ message: "Sube una imagen JPG, PNG o WebP" });
        const buffer = await sharp(req.file.buffer).rotate().resize(1600, 900, { fit: "cover", position: "center" }).jpeg({ quality: 82 }).toBuffer();
        if (hasObjectStorage()) {
          const url = await new ObjectStorageService().uploadObjectEntity(buffer, "image/jpeg");
          return res.json({ url });
        }
        if (process.env.VERCEL) return res.status(503).json({ message: "Falta configurar el almacenamiento de objetos (R2) para subir portadas" });
        const dir = path.join(process.cwd(), "uploads", "pichangas");
        fs.mkdirSync(dir, { recursive: true });
        const name = `${randomUUID()}.jpg`;
        fs.writeFileSync(path.join(dir, name), buffer);
        res.json({ url: `/uploads/pichangas/${name}` });
      } catch (error) {
        console.error("[POST /api/admin/pichangas/matches/cover] error:", error);
        res.status(500).json({ message: "No se pudo subir la portada" });
      }
    });
  });

  // Resumen: cifras clave y partidos por ciudad.
  app.get("/api/admin/pichangas/overview", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const now = new Date();
      const [players] = await db.select({ n: sql<number>`count(*)::int` }).from(users).where(sql`${users.email} <> 'admin@miltareas.com'`);
      const [venueStats] = await db
        .select({ active: sql<number>`count(*) filter (where ${venues.isActive})::int`, pending: sql<number>`count(*) filter (where not ${venues.isActive})::int` })
        .from(venues);

      // Por partido: cupos confirmados (para ocupacion e ingreso estimado).
      const rows = await db
        .select({
          id: matches.id, city: venues.city, status: matches.status, startsAt: matches.startsAt,
          maxPlayers: matches.maxPlayers, price: matches.pricePerPlayer,
          confirmed: sql<number>`count(${matchPlayers.id}) filter (where ${matchPlayers.status} = 'confirmed')::int`,
          waitlist: sql<number>`count(${matchPlayers.id}) filter (where ${matchPlayers.status} = 'waitlist' and ${matchPlayers.userId} <> ${matches.organizerId})::int`,
        })
        .from(matches)
        .innerJoin(venues, eq(matches.venueId, venues.id))
        .leftJoin(matchPlayers, eq(matchPlayers.matchId, matches.id))
        .groupBy(matches.id, venues.city);

      const live = rows.filter((r) => r.status !== "cancelled");
      const upcoming = live.filter((r) => r.startsAt.getTime() >= now.getTime() && r.status !== "finished");
      const spots = upcoming.reduce((a, r) => a + r.maxPlayers, 0);
      const filled = upcoming.reduce((a, r) => a + Math.min(r.confirmed, r.maxPlayers), 0);
      const revenue = live.reduce((a, r) => a + Math.min(r.confirmed, r.maxPlayers) * Number(r.price), 0);

      const byCity = new Map<string, { city: string; matches: number; players: number }>();
      for (const r of live) {
        const c = byCity.get(r.city) ?? { city: r.city, matches: 0, players: 0 };
        c.matches += 1;
        c.players += Math.min(r.confirmed, r.maxPlayers);
        byCity.set(r.city, c);
      }

      res.json({
        players: players.n,
        activeVenues: venueStats.active,
        pendingVenues: venueStats.pending,
        upcomingMatches: upcoming.length,
        totalMatches: rows.length,
        cancelledMatches: rows.length - live.length,
        occupancy: spots > 0 ? Math.round((filled / spots) * 100) : 0,
        waitlistTotal: upcoming.reduce((a, r) => a + r.waitlist, 0),
        estimatedRevenue: Math.round(revenue),
        byCity: Array.from(byCity.values()).sort((a, b) => b.matches - a.matches),
      });
    } catch (error) {
      console.error("[GET /api/admin/pichangas/overview] error:", error);
      res.status(500).json({ message: "No se pudo cargar el resumen" });
    }
  });

  // Todos los partidos (cualquier estado), los proximos primero.
  app.get("/api/admin/pichangas/matches", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const rows = await db
        .select({
          match: matches, venue: venues, organizerName: users.name,
          confirmedCount: sql<number>`coalesce(sum(1 + ${matchPlayers.guests}) filter (where ${matchPlayers.status} = 'confirmed' and ${matchPlayers.userId} <> ${matches.organizerId}), 0)::int`,
          waitlistCount: sql<number>`count(${matchPlayers.id}) filter (where ${matchPlayers.status} = 'waitlist')::int`,
        })
        .from(matches)
        .innerJoin(venues, eq(matches.venueId, venues.id))
        .innerJoin(users, eq(matches.organizerId, users.id))
        .leftJoin(matchPlayers, eq(matchPlayers.matchId, matches.id))
        .groupBy(matches.id, venues.id, users.id)
        .orderBy(desc(matches.startsAt))
        .limit(300);
      res.json(rows.map((r) => ({ ...r.match, venue: r.venue, organizerName: r.organizerName, confirmedCount: r.confirmedCount, waitlistCount: r.waitlistCount })));
    } catch (error) {
      console.error("[GET /api/admin/pichangas/matches] error:", error);
      res.status(500).json({ message: "No se pudieron cargar los partidos" });
    }
  });

  // Crear (el admin queda como organizador; no ocupa cupo), editar y eliminar partidos.
  app.post("/api/admin/pichangas/matches", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const parsed = adminMatchSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Datos inválidos", issues: parsed.error.issues });
      if (parsed.data.startsAt.getTime() <= Date.now()) return res.status(400).json({ message: "La fecha debe ser futura" });
      const [venue] = await db.select({ id: venues.id }).from(venues).where(eq(venues.id, parsed.data.venueId));
      if (!venue) return res.status(400).json({ message: "La cancha no existe" });
      const [created] = await db.insert(matches).values({
        ...parsed.data,
        description: parsed.data.description ?? null,
        pricePerPlayer: String(parsed.data.pricePerPlayer),
        organizerId: (req as any).session.user.id,
      }).returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("[POST /api/admin/pichangas/matches] error:", error);
      res.status(500).json({ message: "No se pudo crear el partido" });
    }
  });

  app.patch("/api/admin/pichangas/matches/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const parsed = adminMatchSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Datos inválidos", issues: parsed.error.issues });
      const [venue] = await db.select({ id: venues.id }).from(venues).where(eq(venues.id, parsed.data.venueId));
      if (!venue) return res.status(400).json({ message: "La cancha no existe" });
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(matchPlayers)
        .where(and(eq(matchPlayers.matchId, req.params.id), eq(matchPlayers.status, "confirmed")));
      if (parsed.data.maxPlayers < n) return res.status(400).json({ message: `Ya hay ${n} jugadores confirmados: el cupo no puede ser menor` });
      const [updated] = await db
        .update(matches)
        .set({ ...parsed.data, description: parsed.data.description ?? null, pricePerPlayer: String(parsed.data.pricePerPlayer) })
        .where(eq(matches.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Partido no encontrado" });
      res.json(updated);
    } catch (error) {
      console.error("[PATCH /api/admin/pichangas/matches/:id] error:", error);
      res.status(500).json({ message: "No se pudo actualizar el partido" });
    }
  });

  // Eliminar es definitivo: borra tambien sus jugadores y mensajes (ON DELETE CASCADE).
  app.delete("/api/admin/pichangas/matches/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const [deleted] = await db.delete(matches).where(eq(matches.id, req.params.id)).returning({ id: matches.id });
      if (!deleted) return res.status(404).json({ message: "Partido no encontrado" });
      res.json({ ok: true });
    } catch (error) {
      console.error("[DELETE /api/admin/pichangas/matches/:id] error:", error);
      res.status(500).json({ message: "No se pudo eliminar el partido" });
    }
  });

  app.post("/api/admin/pichangas/matches/:id/cancel", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const [updated] = await db
        .update(matches)
        .set({ status: "cancelled" })
        .where(and(eq(matches.id, req.params.id), ne(matches.status, "finished")))
        .returning();
      if (!updated) return res.status(404).json({ message: "Partido no encontrado o ya terminado" });
      res.json(updated);
    } catch (error) {
      console.error("[POST /api/admin/pichangas/matches/:id/cancel] error:", error);
      res.status(500).json({ message: "No se pudo cancelar el partido" });
    }
  });

  // Canchas (activas y pendientes de revision) con su cantidad de partidos.
  app.get("/api/admin/pichangas/venues", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const rows = await db
        .select({ venue: venues, matchCount: sql<number>`count(${matches.id})::int`, creatorName: users.name })
        .from(venues)
        .leftJoin(matches, eq(matches.venueId, venues.id))
        .leftJoin(users, eq(venues.createdBy, users.id))
        .groupBy(venues.id, users.id)
        .orderBy(asc(venues.isActive), asc(venues.city), asc(venues.district), asc(venues.name));
      res.json(rows.map((r) => ({ ...r.venue, matchCount: r.matchCount, creatorName: r.creatorName })));
    } catch (error) {
      console.error("[GET /api/admin/pichangas/venues] error:", error);
      res.status(500).json({ message: "No se pudieron cargar las canchas" });
    }
  });

  // Crear, editar y eliminar canchas. El PATCH acepta solo { isActive } (aprobar/desactivar) o la cancha completa.
  app.post("/api/admin/pichangas/venues", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const parsed = insertVenueSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Datos inválidos", issues: parsed.error.issues });
    try {
      const [created] = await db.insert(venues).values({ ...parsed.data, isActive: true, createdBy: (req as any).session.user.id }).returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("[POST /api/admin/pichangas/venues] error:", error);
      res.status(500).json({ message: "No se pudo crear la cancha" });
    }
  });

  app.patch("/api/admin/pichangas/venues/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const onlyActive = z.object({ isActive: z.boolean() }).safeParse(req.body);
    const full = onlyActive.success ? null : insertVenueSchema.safeParse(req.body);
    if (!onlyActive.success && !full?.success) return res.status(400).json({ message: "Datos inválidos" });
    try {
      const changes = onlyActive.success ? { isActive: onlyActive.data.isActive } : full!.data!;
      const [updated] = await db.update(venues).set(changes).where(eq(venues.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ message: "Cancha no encontrada" });
      res.json(updated);
    } catch (error) {
      console.error("[PATCH /api/admin/pichangas/venues/:id] error:", error);
      res.status(500).json({ message: "No se pudo actualizar la cancha" });
    }
  });

  // Una cancha con partidos no se elimina (se desactiva): los partidos dependen de ella.
  app.delete("/api/admin/pichangas/venues/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(matches).where(eq(matches.venueId, req.params.id));
      if (n > 0) return res.status(409).json({ message: `Tiene ${n} partido(s). Elimínalos primero o desactiva la cancha.` });
      const [deleted] = await db.delete(venues).where(eq(venues.id, req.params.id)).returning({ id: venues.id });
      if (!deleted) return res.status(404).json({ message: "Cancha no encontrada" });
      res.json({ ok: true });
    } catch (error) {
      console.error("[DELETE /api/admin/pichangas/venues/:id] error:", error);
      res.status(500).json({ message: "No se pudo eliminar la cancha" });
    }
  });

  // Jugadores con su actividad.
  app.get("/api/admin/pichangas/players", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const rows = await db
        .select({
          id: users.id, name: users.name, email: users.email, whatsapp: users.whatsapp, status: users.status, lastSeen: users.lastSeen, createdAt: users.createdAt,
          joined: sql<number>`count(${matchPlayers.id})::int`,
          organized: sql<number>`(select count(*)::int from ${matches} m where m.organizer_id = ${users.id})`,
        })
        .from(users)
        .leftJoin(matchPlayers, eq(matchPlayers.userId, users.id))
        .where(sql`${users.email} <> 'admin@miltareas.com'`)
        .groupBy(users.id)
        .orderBy(desc(sql`count(${matchPlayers.id})`), asc(users.name))
        .limit(300);
      res.json(rows);
    } catch (error) {
      console.error("[GET /api/admin/pichangas/players] error:", error);
      res.status(500).json({ message: "No se pudieron cargar los jugadores" });
    }
  });

  app.patch("/api/admin/pichangas/players/:id/status", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const parsed = z.object({ status: z.enum(["active", "suspended"]) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Datos inválidos" });
    try {
      const [updated] = await db.update(users).set({ status: parsed.data.status }).where(eq(users.id, req.params.id)).returning({ id: users.id, status: users.status });
      if (!updated) return res.status(404).json({ message: "Jugador no encontrado" });
      res.json(updated);
    } catch (error) {
      console.error("[PATCH /api/admin/pichangas/players/:id/status] error:", error);
      res.status(500).json({ message: "No se pudo actualizar al jugador" });
    }
  });

  // Crear, editar y eliminar jugadores. Sin contrasena: la cuenta se activa despues por enlace.
  const playerSchema = z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email().max(120),
    whatsapp: z.string().trim().max(20).optional().nullable().transform((v) => v || null),
  });
  const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === "23505";

  app.post("/api/admin/pichangas/players", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const parsed = playerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Datos inválidos", issues: parsed.error.issues });
    try {
      const [created] = await db.insert(users).values({ ...parsed.data, status: "active" }).returning({ id: users.id });
      res.status(201).json(created);
    } catch (error) {
      if (isUniqueViolation(error)) return res.status(409).json({ message: "Ya existe una cuenta con ese correo" });
      console.error("[POST /api/admin/pichangas/players] error:", error);
      res.status(500).json({ message: "No se pudo crear al jugador" });
    }
  });

  app.patch("/api/admin/pichangas/players/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const parsed = playerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Datos inválidos", issues: parsed.error.issues });
    try {
      const [updated] = await db.update(users).set(parsed.data).where(eq(users.id, req.params.id)).returning({ id: users.id });
      if (!updated) return res.status(404).json({ message: "Jugador no encontrado" });
      res.json(updated);
    } catch (error) {
      if (isUniqueViolation(error)) return res.status(409).json({ message: "Ya existe una cuenta con ese correo" });
      console.error("[PATCH /api/admin/pichangas/players/:id] error:", error);
      res.status(500).json({ message: "No se pudo actualizar al jugador" });
    }
  });

  // Elimina la cuenta con sus inscripciones y partidos organizados (cascada). Si tiene datos de otras secciones de la app, la BD lo impide.
  app.delete("/api/admin/pichangas/players/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    if (req.params.id === (req as any).session.user.id) return res.status(400).json({ message: "No puedes eliminar tu propia cuenta" });
    try {
      const [target] = await db.select({ email: users.email }).from(users).where(eq(users.id, req.params.id));
      if (!target) return res.status(404).json({ message: "Jugador no encontrado" });
      if (target.email === "admin@miltareas.com") return res.status(400).json({ message: "No se puede eliminar al administrador" });
      await db.delete(users).where(eq(users.id, req.params.id));
      res.json({ ok: true });
    } catch (error) {
      if ((error as { code?: string })?.code === "23503") return res.status(409).json({ message: "Esta cuenta tiene datos asociados. Suspéndela en su lugar." });
      console.error("[DELETE /api/admin/pichangas/players/:id] error:", error);
      res.status(500).json({ message: "No se pudo eliminar al jugador" });
    }
  });
}
