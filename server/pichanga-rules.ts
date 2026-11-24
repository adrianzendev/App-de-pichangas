import type { Express } from "express";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { pichangaRules, insertRuleSchema } from "@shared/schema";
import { requireAdmin } from "./admin-pichangas";

// Reglas del encuentro configurables. La tabla se crea sola (como la de auditoria) y arranca con las 3 reglas de siempre.
const RULES_TABLE_DDL = `CREATE TABLE IF NOT EXISTS pichanga_rules (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'shield',
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp DEFAULT now()
)`;

const DEFAULT_RULES = [
  { title: "Puntualidad de Oro", description: "El árbitro pita a las {hora} exacto. Quien llegue tarde cede su lugar sin reclamo.", icon: "clock" },
  { title: "Calzado Permitido", description: "Zapatillas multitacos o toperoles de goma. Prohibido pupos metálicos o de aluminio.", icon: "footwear" },
  { title: "Cero Faltas de Respeto", description: "Fútbol recreativo entre amigos. Agresiones conllevan baneo permanente de la red.", icon: "shield" },
];

async function ensureRulesTable() {
  try {
    await db.execute(sql.raw(RULES_TABLE_DDL));
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(pichangaRules);
    if (n === 0) await db.insert(pichangaRules).values(DEFAULT_RULES.map((r, i) => ({ ...r, position: i })));
  } catch (error) {
    console.error("[PichangaRules] no se pudo preparar la tabla:", error);
  }
}

export function registerPichangaRules(app: Express) {
  void ensureRulesTable();

  // Publico (jugadores): solo las activas, en orden.
  app.get("/api/pichanga-rules", async (_req, res) => {
    try {
      const rows = await db.select().from(pichangaRules).where(eq(pichangaRules.isActive, true)).orderBy(asc(pichangaRules.position), asc(pichangaRules.createdAt));
      res.json(rows.map(({ id, title, description, icon }) => ({ id, title, description, icon })));
    } catch (error) {
      console.error("[GET /api/pichanga-rules] error:", error);
      res.status(500).json({ message: "No se pudieron cargar las reglas" });
    }
  });

  app.get("/api/admin/pichangas/rules", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      res.json(await db.select().from(pichangaRules).orderBy(asc(pichangaRules.position), asc(pichangaRules.createdAt)));
    } catch (error) {
      console.error("[GET /api/admin/pichangas/rules] error:", error);
      res.status(500).json({ message: "No se pudieron cargar las reglas" });
    }
  });

  app.post("/api/admin/pichangas/rules", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const parsed = insertRuleSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Datos inválidos", issues: parsed.error.issues });
      const [{ next }] = await db.select({ next: sql<number>`coalesce(max(${pichangaRules.position}), -1) + 1` }).from(pichangaRules);
      const [created] = await db.insert(pichangaRules).values({ ...parsed.data, position: next }).returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("[POST /api/admin/pichangas/rules] error:", error);
      res.status(500).json({ message: "No se pudo crear la regla" });
    }
  });

  app.patch("/api/admin/pichangas/rules/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const parsed = insertRuleSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Datos inválidos", issues: parsed.error.issues });
      const [updated] = await db.update(pichangaRules).set(parsed.data).where(eq(pichangaRules.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ message: "Regla no encontrada" });
      res.json(updated);
    } catch (error) {
      console.error("[PATCH /api/admin/pichangas/rules/:id] error:", error);
      res.status(500).json({ message: "No se pudo actualizar la regla" });
    }
  });

  // Subir o bajar una posicion: intercambia el orden con la regla vecina.
  app.post("/api/admin/pichangas/rules/:id/move", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const parsed = z.object({ direction: z.enum(["up", "down"]) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Datos inválidos" });
      await db.transaction(async (tx) => {
        const all = await tx.select({ id: pichangaRules.id }).from(pichangaRules).orderBy(asc(pichangaRules.position), asc(pichangaRules.createdAt));
        const i = all.findIndex((r) => r.id === req.params.id);
        const j = parsed.data.direction === "up" ? i - 1 : i + 1;
        if (i < 0 || j < 0 || j >= all.length) return;
        [all[i], all[j]] = [all[j], all[i]];
        for (let p = 0; p < all.length; p++) await tx.update(pichangaRules).set({ position: p }).where(eq(pichangaRules.id, all[p].id));
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("[POST /api/admin/pichangas/rules/:id/move] error:", error);
      res.status(500).json({ message: "No se pudo reordenar la regla" });
    }
  });

  app.delete("/api/admin/pichangas/rules/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const [deleted] = await db.delete(pichangaRules).where(eq(pichangaRules.id, req.params.id)).returning({ id: pichangaRules.id });
      if (!deleted) return res.status(404).json({ message: "Regla no encontrada" });
      res.json({ ok: true });
    } catch (error) {
      console.error("[DELETE /api/admin/pichangas/rules/:id] error:", error);
      res.status(500).json({ message: "No se pudo eliminar la regla" });
    }
  });
}
