import type { Express, Request, Response } from "express";
import { and, asc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { IS_VERCEL, RUN_MIGRATIONS } from "./runtime";
import {
  venues, matches, matchPlayers, matchMessages, users, playerProfiles,
  PLAYER_POSITIONS, PLAYER_AGE_MIN, PLAYER_AGE_MAX,
  insertVenueSchema, insertMatchSchema,
  MATCH_FORMATS, MATCH_LEVELS, MATCH_GENDERS,
} from "@shared/schema";

function currentUserId(req: Request): string | null {
  return (req as any).session?.user?.id ?? null;
}

function requireUser(req: Request, res: Response): string | null {
  const id = currentUserId(req);
  if (!id) res.status(401).json({ message: "Inicia sesión para continuar" });
  return id;
}

/** Jugadores confirmados por partido (para cupos). */
async function confirmedCounts(matchIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (matchIds.length === 0) return map;
  const rows = await db
    .select({ matchId: matchPlayers.matchId, n: sql<number>`coalesce(sum(1 + ${matchPlayers.guests}), 0)::int` })
    .from(matchPlayers)
    // El organizador no ocupa cupo: su fila (da acceso al chat) no cuenta.
    .where(and(inArray(matchPlayers.matchId, matchIds), eq(matchPlayers.status, "confirmed"), sql`${matchPlayers.userId} <> (select ${matches.organizerId} from ${matches} where ${matches.id} = ${matchPlayers.matchId})`))
    .groupBy(matchPlayers.matchId);
  for (const r of rows) map.set(r.matchId, r.n);
  return map;
}

/** Solo el organizador y los anotados (confirmados o suplentes) ven y escriben en el chat del partido. */
async function isMatchMember(matchId: string, userId: string): Promise<boolean> {
  const [match] = await db.select({ organizerId: matches.organizerId }).from(matches).where(eq(matches.id, matchId));
  if (!match) return false;
  if (match.organizerId === userId) return true;
  const [player] = await db
    .select({ id: matchPlayers.id })
    .from(matchPlayers)
    .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.userId, userId)));
  return Boolean(player);
}

/** Agrega la columna de acompañantes si falta (mismo criterio que las demas migraciones de arranque). */
async function ensureGuestsColumn() {
  try {
    await db.execute(sql`ALTER TABLE match_players ADD COLUMN IF NOT EXISTS guests integer NOT NULL DEFAULT 0`);
  } catch (error) {
    console.error("[Pichangas] no se pudo agregar match_players.guests:", error);
  }
}

/** Crea la tabla del perfil de jugador si falta (aditivo e idempotente, como las demas migraciones de arranque). */
async function ensurePlayerProfilesTable() {
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS player_profiles (
      user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      age integer,
      position text,
      updated_at timestamp DEFAULT now()
    )`);
    await db.execute(sql`ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS is_host boolean NOT NULL DEFAULT false`);
  } catch (error) {
    console.error("[Pichangas] no se pudo crear player_profiles:", error);
  }
}

/** Portadas por partido (aditivo e idempotente). */
async function ensureMatchPhotosColumn() {
  try {
    await db.execute(sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}'::text[]`);
  } catch (error) {
    console.error("[Pichangas] no se pudo agregar matches.photos:", error);
  }
}

/** Minutos que se reserva un cupo sin pagar: pasado el plazo se libera y entra el siguiente de la lista de espera. */
export const HOLD_MINUTES = 10;
const HOLD_MS = HOLD_MINUTES * 60_000;

async function ensureConfirmedAtColumn() {
  try {
    await db.execute(sql`ALTER TABLE match_players ADD COLUMN IF NOT EXISTS confirmed_at timestamp`);
  } catch (error) {
    console.error("[Pichangas] no se pudo agregar match_players.confirmed_at:", error);
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Asciende suplentes en orden mientras sus cupos (1 + acompañantes) quepan; cada uno empieza su reserva de pago. */
async function promoteWaitlist(tx: Tx, match: typeof matches.$inferSelect) {
  const [{ n }] = await tx
    .select({ n: sql<number>`coalesce(sum(1 + ${matchPlayers.guests}), 0)::int` })
    .from(matchPlayers)
    .where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.status, "confirmed"), ne(matchPlayers.userId, match.organizerId)));
  let taken = n;
  const waiting = await tx
    .select()
    .from(matchPlayers)
    .where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.status, "waitlist")))
    .orderBy(asc(matchPlayers.joinedAt));
  for (const w of waiting) {
    if (taken + 1 + w.guests > match.maxPlayers) continue;
    await tx.update(matchPlayers).set({ status: "confirmed", confirmedAt: new Date() }).where(eq(matchPlayers.id, w.id));
    taken += 1 + w.guests;
  }
  await tx.update(matches).set({ status: taken >= match.maxPlayers ? "full" : "open" }).where(eq(matches.id, match.id));
}

let releasing = false;
/** Libera los cupos reservados que no se pagaron en HOLD_MINUTES y asciende a la lista de espera. Se llama en cada lectura y cada minuto. */
export async function releaseExpiredHolds() {
  if (releasing) return;
  releasing = true;
  try {
    const freed = await db
      .delete(matchPlayers)
      .where(and(
        eq(matchPlayers.status, "confirmed"),
        sql`${matchPlayers.paid} IS NOT TRUE`,
        // Una reserva sin pagar siempre vence: sin confirmed_at (filas viejas o de prueba) corre desde que se anoto.
        sql`coalesce(${matchPlayers.confirmedAt}, ${matchPlayers.joinedAt}) < now() - (${HOLD_MINUTES} * interval '1 minute')`,
        sql`${matchPlayers.userId} <> (select ${matches.organizerId} from ${matches} where ${matches.id} = ${matchPlayers.matchId})`,
        sql`(select ${matches.startsAt} from ${matches} where ${matches.id} = ${matchPlayers.matchId}) > now()`,
      ))
      .returning({ matchId: matchPlayers.matchId });
    for (const matchId of new Set(freed.map((f) => f.matchId))) {
      await db.transaction(async (tx) => {
        const [match] = await tx.select().from(matches).where(eq(matches.id, matchId)).for("update");
        if (match && match.status !== "cancelled" && match.status !== "finished") await promoteWaitlist(tx, match);
      });
    }
  } catch (error) {
    console.error("[Pichangas] no se pudieron liberar las reservas vencidas:", error);
  } finally {
    releasing = false;
  }
}

export function registerPichangas(app: Express) {
  if (RUN_MIGRATIONS) {
    void ensureGuestsColumn();
    void ensureConfirmedAtColumn();
    void ensurePlayerProfilesTable();
    void ensureMatchPhotosColumn();
  }
  // Las reservas vencidas tambien se liberan solas, sin esperar a que alguien abra la pantalla.
  // En Vercel no hay proceso vivo: releaseExpiredHolds ya se llama al leer partidos.
  if (!IS_VERCEL) setInterval(() => void releaseExpiredHolds(), 60_000).unref();

  // Perfil de jugador: edad y posicion (ambos opcionales). El nombre se edita con PUT /api/user/current.
  app.get("/api/player/profile", async (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    try {
      const [row] = await db.select({ age: playerProfiles.age, position: playerProfiles.position, isHost: playerProfiles.isHost }).from(playerProfiles).where(eq(playerProfiles.userId, userId));
      res.json({ age: row?.age ?? null, position: row?.position ?? null, isHost: row?.isHost ?? false });
    } catch (error) {
      console.error("[GET /api/player/profile] error:", error);
      res.status(500).json({ message: "No se pudo cargar tu perfil" });
    }
  });

  app.put("/api/player/profile", async (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    try {
      const parsed = z.object({
        age: z.number().int().min(PLAYER_AGE_MIN, `La edad mínima es ${PLAYER_AGE_MIN}`).max(PLAYER_AGE_MAX, `La edad máxima es ${PLAYER_AGE_MAX}`).nullable(),
        position: z.enum(PLAYER_POSITIONS).nullable(),
      }).safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos" });
      // isHost NO se acepta aqui: solo el administrador asigna el rol de host (un jugador no puede promoverse).
      const values = { age: parsed.data.age, position: parsed.data.position, updatedAt: new Date() };
      const [saved] = await db.insert(playerProfiles).values({ userId, ...values }).onConflictDoUpdate({ target: playerProfiles.userId, set: values }).returning({ isHost: playerProfiles.isHost });
      res.json({ age: values.age, position: values.position, isHost: saved?.isHost ?? false });
    } catch (error) {
      console.error("[PUT /api/player/profile] error:", error);
      res.status(500).json({ message: "No se pudo guardar tu perfil" });
    }
  });

  // URLs legibles: el cliente llama /api/matches/<id8>/... con los primeros 8 caracteres del id. Se reescribe a el id completo antes de enrutar.
  app.use("/api/matches", async (req, _res, next) => {
    try {
      const m = /^\/([0-9a-f]{8})(?=[/?]|$)/.exec(req.url);
      if (m) {
        const [row] = await db.select({ id: matches.id }).from(matches).where(sql`${matches.id} LIKE ${m[1] + "%"}`).limit(1);
        if (row) req.url = req.url.replace(m[1], row.id);
      }
    } catch (error) {
      console.error("[/api/matches] no se pudo resolver el id corto:", error);
    }
    next();
  });
  // ── Canchas ──
  app.get("/api/venues", async (req, res) => {
    try {
      const district = typeof req.query.district === "string" ? req.query.district.trim() : "";
      const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
      const conds = [eq(venues.isActive, true)];
      if (district) conds.push(eq(venues.district, district));
      if (city) conds.push(eq(venues.city, city));
      const rows = await db
        .select()
        .from(venues)
        .where(and(...conds))
        .orderBy(asc(venues.city), asc(venues.district), asc(venues.name));
      res.json(rows);
    } catch (error) {
      console.error("[GET /api/venues] error:", error);
      res.status(500).json({ message: "No se pudieron cargar las canchas" });
    }
  });

  app.post("/api/venues", async (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    try {
      const parsed = insertVenueSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Datos inválidos", issues: parsed.error.issues });
      const [venue] = await db.insert(venues).values({ ...parsed.data, createdBy: userId }).returning();
      res.status(201).json(venue);
    } catch (error) {
      console.error("[POST /api/venues] error:", error);
      res.status(500).json({ message: "No se pudo crear la cancha" });
    }
  });

  // ── Partidos ──
  app.get("/api/matches", async (req, res) => {
    try {
      await releaseExpiredHolds();
      const q = req.query;
      // "full" se lista igual: se puede entrar como suplente.
      const conds = [inArray(matches.status, ["open", "full"]), gte(matches.startsAt, new Date())];
      if (typeof q.format === "string" && (MATCH_FORMATS as readonly string[]).includes(q.format)) conds.push(eq(matches.format, q.format));
      if (typeof q.level === "string" && (MATCH_LEVELS as readonly string[]).includes(q.level)) conds.push(eq(matches.level, q.level));
      if (typeof q.gender === "string" && (MATCH_GENDERS as readonly string[]).includes(q.gender)) conds.push(eq(matches.gender, q.gender));
      if (typeof q.district === "string" && q.district.trim()) conds.push(eq(venues.district, q.district.trim()));
      if (typeof q.city === "string" && q.city.trim()) conds.push(eq(venues.city, q.city.trim()));

      const rows = await db
        .select({ match: matches, venue: venues, organizerName: users.name, organizerAvatar: users.avatar })
        .from(matches)
        .innerJoin(venues, eq(matches.venueId, venues.id))
        .innerJoin(users, eq(matches.organizerId, users.id))
        .where(and(...conds))
        .orderBy(asc(matches.startsAt))
        .limit(100);

      const counts = await confirmedCounts(rows.map((r) => r.match.id));
      res.json(rows.map((r) => ({ ...r.match, venue: r.venue, organizerName: r.organizerName, organizerAvatar: r.organizerAvatar, confirmedCount: counts.get(r.match.id) ?? 0 })));
    } catch (error) {
      console.error("[GET /api/matches] error:", error);
      res.status(500).json({ message: "No se pudieron cargar los partidos" });
    }
  });

  app.get("/api/matches/mine", async (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    try {
      const rows = await db
        .select({ match: matches, venue: venues, playerStatus: matchPlayers.status, playerPaid: matchPlayers.paid, playerGuests: matchPlayers.guests, organizerName: users.name, organizerAvatar: users.avatar })
        .from(matchPlayers)
        .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
        .innerJoin(venues, eq(matches.venueId, venues.id))
        .innerJoin(users, eq(matches.organizerId, users.id))
        .where(eq(matchPlayers.userId, userId))
        .orderBy(asc(matches.startsAt));
      const counts = await confirmedCounts(rows.map((r) => r.match.id));
      res.json(rows.map((r) => ({ ...r.match, venue: r.venue, organizerName: r.organizerName, organizerAvatar: r.organizerAvatar, playerStatus: r.playerStatus, playerPaid: !!r.playerPaid, playerGuests: r.playerGuests, confirmedCount: counts.get(r.match.id) ?? 0 })));
    } catch (error) {
      console.error("[GET /api/matches/mine] error:", error);
      res.status(500).json({ message: "No se pudieron cargar tus partidos" });
    }
  });

  app.get("/api/matches/:id", async (req, res) => {
    try {
      await releaseExpiredHolds();
      const [row] = await db
        .select({ match: matches, venue: venues, organizerName: users.name, organizerAvatar: users.avatar })
        .from(matches)
        .innerJoin(venues, eq(matches.venueId, venues.id))
        .innerJoin(users, eq(matches.organizerId, users.id))
        .where(eq(matches.id, req.params.id));
      if (!row) return res.status(404).json({ message: "Partido no encontrado" });

      const players = await db
        .select({ userId: matchPlayers.userId, name: users.name, avatar: users.avatar, status: matchPlayers.status, paid: matchPlayers.paid, guests: matchPlayers.guests, joinedAt: matchPlayers.joinedAt, confirmedAt: matchPlayers.confirmedAt })
        .from(matchPlayers)
        .innerJoin(users, eq(matchPlayers.userId, users.id))
        .where(eq(matchPlayers.matchId, row.match.id))
        .orderBy(asc(matchPlayers.joinedAt));
      res.json({
        ...row.match,
        venue: row.venue,
        organizerName: row.organizerName,
        organizerAvatar: row.organizerAvatar,
        // Cupo reservado sin pagar: hasta cuando se puede pagar antes de perderlo.
        players: players.map(({ confirmedAt, ...p }) => ({
          ...p,
          holdExpiresAt: p.status === "confirmed" && !p.paid && p.userId !== row.match.organizerId && (confirmedAt ?? p.joinedAt) ? new Date((confirmedAt ?? p.joinedAt)!.getTime() + HOLD_MS).toISOString() : null,
        })),
        confirmedCount: players.filter((p) => p.status === "confirmed" && p.userId !== row.match.organizerId).reduce((n, p) => n + 1 + p.guests, 0),
      });
    } catch (error) {
      console.error("[GET /api/matches/:id] error:", error);
      res.status(500).json({ message: "No se pudo cargar el partido" });
    }
  });

  app.post("/api/matches", async (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    try {
      // Solo los hosts crean partidos (se activa desde el perfil).
      const [profile] = await db.select({ isHost: playerProfiles.isHost }).from(playerProfiles).where(eq(playerProfiles.userId, userId));
      if (!profile?.isHost) return res.status(403).json({ message: "Activa tu perfil de host para crear partidos" });
      const parsed = insertMatchSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Datos inválidos", issues: parsed.error.issues });
      const [venue] = await db.select({ id: venues.id }).from(venues).where(and(eq(venues.id, parsed.data.venueId), eq(venues.isActive, true)));
      if (!venue) return res.status(400).json({ message: "La cancha no existe" });

      const created = await db.transaction(async (tx) => {
        const [match] = await tx.insert(matches).values({
          ...parsed.data,
          description: parsed.data.description ?? null,
          pricePerPlayer: String(parsed.data.pricePerPlayer),
          organizerId: userId,
        }).returning();
        // El organizador entra confirmado.
        await tx.insert(matchPlayers).values({ matchId: match.id, userId, status: "confirmed" });
        return match;
      });
      res.status(201).json(created);
    } catch (error) {
      console.error("[POST /api/matches] error:", error);
      res.status(500).json({ message: "No se pudo crear el partido" });
    }
  });

  // Anotarse: confirmado si hay cupo, si no, a suplentes. Bloquea la fila del partido para no sobrevender cupos.
  app.post("/api/matches/:id/join", async (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    try {
      await releaseExpiredHolds();
      const parsed = z.object({ paid: z.boolean().optional(), guests: z.number().int().min(0).max(5).optional() }).safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ message: "Datos inválidos" });
      const paidNow = parsed.data.paid ?? false;
      const guests = parsed.data.guests ?? 0;
      const seats = 1 + guests;
      const result = await db.transaction(async (tx) => {
        const [match] = await tx.select().from(matches).where(eq(matches.id, req.params.id)).for("update");
        if (!match) return { error: 404 as const, message: "Partido no encontrado" };
        if (match.status === "cancelled" || match.status === "finished" || match.startsAt.getTime() <= Date.now()) {
          return { error: 409 as const, message: "Este partido ya no admite jugadores" };
        }
        const [existing] = await tx.select().from(matchPlayers).where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.userId, userId)));
        if (existing) {
          // Primero se paga, luego esta el pase: quien ya estaba anotado sin pagar completa su pago aqui.
          if (paidNow && !existing.paid) {
            // Al pagar puede sumar acompañantes (cupos marcados en la plantilla): tienen que caber.
            const newGuests = Math.max(guests, existing.guests);
            if (existing.status === "confirmed" && newGuests > existing.guests) {
              const [{ taken }] = await tx
                .select({ taken: sql<number>`coalesce(sum(1 + ${matchPlayers.guests}), 0)::int` })
                .from(matchPlayers)
                .where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.status, "confirmed"), ne(matchPlayers.userId, match.organizerId)));
              const total = taken + (newGuests - existing.guests);
              if (total > match.maxPlayers) return { error: 409 as const, message: "No quedan cupos suficientes" };
              if (total >= match.maxPlayers) await tx.update(matches).set({ status: "full" }).where(eq(matches.id, match.id));
            }
            await tx.update(matchPlayers).set({ paid: true, guests: newGuests }).where(eq(matchPlayers.id, existing.id));
            return { status: existing.status };
          }
          // Reserva sin pagar: se puede cambiar la cantidad de cupos mientras dura (el plazo no se renueva).
          if (!paidNow && !existing.paid && existing.status === "confirmed" && guests !== existing.guests) {
            const [{ taken }] = await tx
              .select({ taken: sql<number>`coalesce(sum(1 + ${matchPlayers.guests}), 0)::int` })
              .from(matchPlayers)
              .where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.status, "confirmed"), ne(matchPlayers.userId, match.organizerId)));
            if (taken - existing.guests + guests > match.maxPlayers) return { error: 409 as const, message: "No quedan cupos suficientes" };
            await tx.update(matchPlayers).set({ guests }).where(eq(matchPlayers.id, existing.id));
            await tx.update(matches).set({ status: taken - existing.guests + guests >= match.maxPlayers ? "full" : "open" }).where(eq(matches.id, match.id));
            return { status: existing.status };
          }
          return { error: 409 as const, message: "Ya estás anotado en este partido" };
        }

        const [{ n }] = await tx
          .select({ n: sql<number>`coalesce(sum(1 + ${matchPlayers.guests}), 0)::int` })
          .from(matchPlayers)
          .where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.status, "confirmed"), ne(matchPlayers.userId, match.organizerId)));
        // Todos los cupos de la inscripcion tienen que caber; si no, entra de suplente.
        const status = n + seats <= match.maxPlayers ? "confirmed" : "waitlist";
        // Quien ya pago no puede quedar de suplente: si sus cupos ya no caben (otro se inscribio antes), no se cobra.
        if (status === "waitlist" && paidNow) {
          const free = Math.max(0, match.maxPlayers - n);
          return { error: 409 as const, message: free === 0 ? "Ya no quedan cupos" : `Ya no quedan cupos suficientes (quedan ${free})` };
        }
        await tx.insert(matchPlayers).values({ matchId: match.id, userId, status, paid: paidNow, guests, confirmedAt: status === "confirmed" ? new Date() : null });
        if (status === "confirmed" && n + seats >= match.maxPlayers) {
          await tx.update(matches).set({ status: "full" }).where(eq(matches.id, match.id));
        }
        return { status };
      });
      if ("error" in result && result.error !== undefined) return res.status(result.error).json({ message: result.message });
      res.json({ status: result.status, paid: paidNow });
    } catch (error) {
      console.error("[POST /api/matches/:id/join] error:", error);
      res.status(500).json({ message: "No se pudo anotar" });
    }
  });

  // Bajarse: libera el cupo y asciende al primer suplente.
  app.delete("/api/matches/:id/join", async (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    try {
      const result = await db.transaction(async (tx) => {
        const [match] = await tx.select().from(matches).where(eq(matches.id, req.params.id)).for("update");
        if (!match) return { error: 404 as const, message: "Partido no encontrado" };
        if (match.organizerId === userId) return { error: 409 as const, message: "El organizador debe cancelar el partido, no bajarse" };

        const deleted = await tx
          .delete(matchPlayers)
          .where(and(eq(matchPlayers.matchId, match.id), eq(matchPlayers.userId, userId)))
          .returning();
        if (deleted.length === 0) return { error: 404 as const, message: "No estabas anotado" };

        if (deleted[0].status === "confirmed") {
          await promoteWaitlist(tx, match);
        }
        return { ok: true as const };
      });
      if ("error" in result && result.error !== undefined) return res.status(result.error).json({ message: result.message });
      res.json({ ok: true });
    } catch (error) {
      console.error("[DELETE /api/matches/:id/join] error:", error);
      res.status(500).json({ message: "No se pudo bajar del partido" });
    }
  });

  // ── Chat del partido (Camerino & Coordinacion) ──
  app.get("/api/matches/:id/messages", async (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    try {
      if (!(await isMatchMember(req.params.id, userId))) return res.status(403).json({ message: "Solo los anotados ven este chat" });
      const rows = await db
        .select({
          id: matchMessages.id, userId: matchMessages.userId, body: matchMessages.body, createdAt: matchMessages.createdAt,
          name: users.name, avatar: users.avatar,
        })
        .from(matchMessages)
        .innerJoin(users, eq(matchMessages.userId, users.id))
        .where(eq(matchMessages.matchId, req.params.id))
        .orderBy(sql`${matchMessages.createdAt} desc`)
        .limit(200);
      res.json(rows.reverse());
    } catch (error) {
      console.error("[GET /api/matches/:id/messages] error:", error);
      res.status(500).json({ message: "No se pudo cargar el chat" });
    }
  });

  app.post("/api/matches/:id/messages", async (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    try {
      const parsed = z.object({ body: z.string().trim().min(1).max(500) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Escribe un mensaje de hasta 500 caracteres" });
      if (!(await isMatchMember(req.params.id, userId))) return res.status(403).json({ message: "Solo los anotados escriben en este chat" });

      const [user] = await db.select({ name: users.name, avatar: users.avatar }).from(users).where(eq(users.id, userId));
      const [message] = await db
        .insert(matchMessages)
        .values({ matchId: req.params.id, userId, body: parsed.data.body })
        .returning();
      res.status(201).json({ ...message, name: user?.name ?? "", avatar: user?.avatar ?? null });
    } catch (error) {
      console.error("[POST /api/matches/:id/messages] error:", error);
      res.status(500).json({ message: "No se pudo enviar el mensaje" });
    }
  });

  app.post("/api/matches/:id/cancel", async (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    try {
      const [updated] = await db
        .update(matches)
        .set({ status: "cancelled" })
        .where(and(eq(matches.id, req.params.id), eq(matches.organizerId, userId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Partido no encontrado o no eres el organizador" });
      res.json(updated);
    } catch (error) {
      console.error("[POST /api/matches/:id/cancel] error:", error);
      res.status(500).json({ message: "No se pudo cancelar el partido" });
    }
  });
}
