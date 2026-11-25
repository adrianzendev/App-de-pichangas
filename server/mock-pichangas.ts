import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { users, venues, matches, matchPlayers } from "@shared/schema";
import { MOCK_HOST_EMAILS } from "@shared/mock-hosts";
import { MAIN_ADMIN_EMAIL } from "@shared/admin";

/**
 * Datos de prueba SOLO para desarrollo (se llama desde server/index.ts con NODE_ENV=development).
 * Usuarios sin contrasena: se entra con el acceso rapido de /login (POST /api/auth/dev-login).
 * Idempotente: no duplica usuarios (por correo), canchas (por nombre) ni partidos (por titulo).
 */
export const MOCK_EMAIL_DOMAIN = "@pichangas.test";

const MOCK_USERS = [
  { name: "Luis Quispe", email: `luis${MOCK_EMAIL_DOMAIN}` },
  { name: "Jorge Huamán", email: `jorge${MOCK_EMAIL_DOMAIN}` },
  { name: "Diego Ramírez", email: `diego${MOCK_EMAIL_DOMAIN}` },
  { name: "Miguel Torres", email: `miguel${MOCK_EMAIL_DOMAIN}` },
  { name: "Carlos Mendoza", email: `carlos${MOCK_EMAIL_DOMAIN}` },
  { name: "Andrea Flores", email: `andrea${MOCK_EMAIL_DOMAIN}` },
  { name: "Valeria Rojas", email: `valeria${MOCK_EMAIL_DOMAIN}` },
  { name: "Renzo Castillo", email: `renzo${MOCK_EMAIL_DOMAIN}` },
  { name: "Frank Salazar", email: `frank${MOCK_EMAIL_DOMAIN}` },
  { name: "Pedro Vargas", email: `pedro${MOCK_EMAIL_DOMAIN}` },
  // Cuenta suspendida de ejemplo para el panel de jugadores del admin.
  { name: "Kevin Díaz", email: `kevin${MOCK_EMAIL_DOMAIN}`, status: "suspended" },
];

// Fotos de perfil de ejemplo (client/public/avatars): retratos de randomuser.me (https://randomuser.me/api/portraits), bajados al repo.
// Solo se asignan a quien aun no tiene foto.
const MOCK_AVATARS: Record<string, string> = Object.fromEntries(
  ["luis", "jorge", "diego", "miguel", "carlos", "andrea", "valeria", "renzo", "frank", "pedro", "kevin"].map((n) => [`${n}${MOCK_EMAIL_DOMAIN}`, `/avatars/${n}.jpg`]),
);

const MOCK_VENUES = [
  { name: "Complejo Los Olivos", city: "Lima", district: "Los Olivos", address: "Av. Universitaria 1840", surface: "grass_sintetico", pricePerHour: "120.00" },
  { name: "Canchas La Molina Sport", city: "Lima", district: "La Molina", address: "Av. La Molina 2450", surface: "grass_sintetico", pricePerHour: "160.00" },
  { name: "Fútbol Miraflores Arena", city: "Lima", district: "Miraflores", address: "Av. Benavides 580", surface: "grass_sintetico", pricePerHour: "220.00" },
  { name: "Loza Deportiva San Juan de Lurigancho", city: "Lima", district: "San Juan de Lurigancho", address: "Av. Próceres de la Independencia 1200", surface: "loza", pricePerHour: "70.00" },
  { name: "Complejo Surco Fútbol 7", city: "Lima", district: "Santiago de Surco", address: "Av. Caminos del Inca 1100", surface: "grass_sintetico", pricePerHour: "180.00" },
  { name: "DeporPlaza San Borja", city: "Lima", district: "San Borja", address: "Av. Primavera 1420", surface: "grass_sintetico", pricePerHour: "200.00" },
  { name: "Canchas Villa El Salvador", city: "Lima", district: "Villa El Salvador", address: "Av. Revolución 640", surface: "grass_sintetico", pricePerHour: "90.00" },
  { name: "Complejo Cayma Fútbol", city: "Arequipa", district: "Cayma", address: "Av. Ramón Castilla 410", surface: "grass_sintetico", pricePerHour: "100.00" },
  { name: "Canchas Yanahuara Sport", city: "Arequipa", district: "Yanahuara", address: "Calle Jerusalén 1220", surface: "grass_sintetico", pricePerHour: "110.00" },
  { name: "Complejo Víctor Larco", city: "Trujillo", district: "Víctor Larco", address: "Av. Larco 1850", surface: "grass_sintetico", pricePerHour: "90.00" },
  { name: "Fulbito Wanchaq", city: "Cusco", district: "Wanchaq", address: "Av. Infancia 320", surface: "loza", pricePerHour: "60.00" },
  // Cusco: canchas en todos los distritos de la provincia (el filtro de distritos sale de aqui).
  { name: "Estadio Garcilaso", city: "Cusco", district: "Cusco", address: "Av. Inca Garcilaso de la Vega 1550", surface: "grass_natural", pricePerHour: "200.00" },
  { name: "Complejo Deportivo Ccorca", city: "Cusco", district: "Ccorca", address: "Camino a Ccorca s/n", surface: "loza", pricePerHour: "50.00" },
  { name: "Canchas Poroy", city: "Cusco", district: "Poroy", address: "Av. Poroy 210", surface: "grass_sintetico", pricePerHour: "60.00" },
  { name: "Polideportivo San Jerónimo", city: "Cusco", district: "San Jerónimo", address: "Av. General Ollanta 480", surface: "grass_sintetico", pricePerHour: "80.00" },
  { name: "Canchas San Sebastián", city: "Cusco", district: "San Sebastián", address: "Av. Velasco Astete 1450", surface: "grass_sintetico", pricePerHour: "90.00" },
  { name: "Complejo Santiago Fútbol", city: "Cusco", district: "Santiago", address: "Av. Santiago 620", surface: "grass_sintetico", pricePerHour: "85.00" },
  { name: "Loza Saylla", city: "Cusco", district: "Saylla", address: "Av. Cusco 145", surface: "loza", pricePerHour: "45.00" },
  { name: "Canchas Castilla Piura", city: "Piura", district: "Castilla", address: "Av. Sánchez Cerro 905", surface: "grass_sintetico", pricePerHour: "80.00" },
  // Pendiente de revision: el admin la aprueba desde su panel.
  { name: "Canchas Santa Anita", city: "Lima", district: "Santa Anita", address: "Av. Los Ruiseñores 310", surface: "grass_sintetico", pricePerHour: "85.00", isActive: false },
] as const;

// Fotos de ejemplo (client/public/venues). En produccion salen de venues.photos, subidas por la cancha.
const EXAMPLE_PHOTOS = ["/venues/cancha-techada.png", "/venues/cancha-malla.jpg", "/venues/cancha-reflectores.jpg", "/venues/cancha-noche.jpg"];
const VENUE_PHOTOS: Record<string, string[]> = {
  "Complejo Los Olivos": ["/venues/cancha-techada.png"],
  "Canchas La Molina Sport": ["/venues/cancha-malla.jpg"],
  "Fútbol Miraflores Arena": ["/venues/cancha-reflectores.jpg"],
  "Complejo Surco Fútbol 7": ["/venues/cancha-noche.jpg"],
  "DeporPlaza San Borja": ["/venues/cancha-noche.jpg"],
  "Canchas Villa El Salvador": ["/venues/cancha-malla.jpg"],
  "Complejo Cayma Fútbol": ["/venues/cancha-reflectores.jpg"],
  "Canchas Yanahuara Sport": ["/venues/cancha-malla.jpg"],
  "Complejo Víctor Larco": ["/venues/cancha-noche.jpg"],
  "Fulbito Wanchaq": ["/venues/cancha-techada.png"],
  "Estadio Garcilaso": ["/venues/cancha-reflectores.jpg"],
  "Complejo Deportivo Ccorca": ["/venues/cancha-malla.jpg"],
  "Canchas Poroy": ["/venues/cancha-noche.jpg"],
  "Polideportivo San Jerónimo": ["/venues/cancha-techada.png"],
  "Canchas San Sebastián": ["/venues/cancha-reflectores.jpg"],
  "Complejo Santiago Fútbol": ["/venues/cancha-malla.jpg"],
  "Loza Saylla": ["/venues/cancha-noche.jpg"],
  "Canchas Castilla Piura": ["/venues/cancha-reflectores.jpg"],
};

/** Hoy a la hora dada (hora local del servidor); si ya paso, manana. */
function todayAt(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

function inDays(days: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

export async function seedMockPichangas(): Promise<void> {
  // 1. Usuarios (sin contrasena). El admin principal se crea si falta para poder entrar al panel.
  const wanted = [...MOCK_USERS, { name: "admin", email: MAIN_ADMIN_EMAIL }];
  await db
    .insert(users)
    .values(wanted.map((u) => ({ ...u, country: "PE", currency: "PEN" })))
    .onConflictDoNothing({ target: users.email });

  for (const [email, avatar] of Object.entries(MOCK_AVATARS)) {
    await db.update(users).set({ avatar }).where(and(eq(users.email, email), sql`${users.avatar} is null`));
  }

  const mockRows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.email, MOCK_USERS.map((u) => u.email)));
  const byEmail = new Map(mockRows.map((r) => [r.email, r.id]));
  const uid = (name: string) => byEmail.get(`${name}${MOCK_EMAIL_DOMAIN}`)!;

  // Anfitriones de ejemplo: con el perfil de host pueden crear partidos desde /play/host. La tabla se crea aqui por si el seed
  // corre antes que el arranque de pichangas.ts (ahi tambien se crea, de forma idempotente).
  await db.execute(sql`CREATE TABLE IF NOT EXISTS player_profiles (user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, age integer, position text, updated_at timestamp DEFAULT now())`);
  await db.execute(sql`ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS is_host boolean NOT NULL DEFAULT false`);
  await db.execute(sql`INSERT INTO player_profiles (user_id, is_host) SELECT id, true FROM users WHERE email IN (${sql.join(MOCK_HOST_EMAILS.map((e) => sql`${e}`), sql`, `)}) ON CONFLICT (user_id) DO UPDATE SET is_host = true`);

  // 2. Canchas.
  const existingVenues = await db.select({ id: venues.id, name: venues.name }).from(venues);
  const known = new Set(existingVenues.map((v) => v.name));
  const toInsert = MOCK_VENUES.filter((v) => !known.has(v.name));
  if (toInsert.length > 0) await db.insert(venues).values(toInsert.map((v) => ({ ...v, })));
  // Cada cancha de ejemplo lleva 3 fotos (la suya + 2 mas) para el carrusel del detalle; se completa si tiene menos de 3.
  for (const [name, own] of Object.entries(VENUE_PHOTOS)) {
    const photos = [...own, ...EXAMPLE_PHOTOS.filter((x) => !own.includes(x))].slice(0, 3);
    await db.update(venues).set({ photos }).where(and(eq(venues.name, name), sql`coalesce(array_length(${venues.photos}, 1), 0) < 3`));
  }
  const venueRows = await db.select({ id: venues.id, name: venues.name }).from(venues);
  const venueId = (name: string) => venueRows.find((v) => v.name === name)!.id;

  // 3. Partidos de ejemplo (organizador + jugadores confirmados; el ultimo queda lleno con suplentes).
  const existingTitles = new Set((await db.select({ title: matches.title }).from(matches)).map((m) => m.title));

  const samples = [
    { title: "Pichangón F7 Nocturno", organizer: "miguel", venue: "DeporPlaza San Borja", startsAt: todayAt(20, 30), format: "futbol_7", level: "intermedio", gender: "mixto", maxPlayers: 11, price: "18.00", joined: ["jorge", "diego", "andrea", "carlos", "renzo", "frank", "pedro", "luis", "valeria"] },
    { title: "Pichanga de los jueves", organizer: "luis", venue: "Complejo Los Olivos", startsAt: inDays(1, 20), format: "futbol_7", level: "recreativo", gender: "mixto", maxPlayers: 14, price: "10.00", joined: ["jorge", "diego", "andrea"] },
    { title: "Fulbito en La Molina", organizer: "miguel", venue: "Canchas La Molina Sport", startsAt: inDays(2, 21), format: "futbol_5", level: "intermedio", gender: "varones", maxPlayers: 10, price: "15.00", joined: ["carlos", "renzo"] },
    { title: "Mixto en Miraflores", organizer: "valeria", venue: "Fútbol Miraflores Arena", startsAt: inDays(3, 19), format: "futbol_6", level: "recreativo", gender: "mixto", maxPlayers: 12, price: "20.00", joined: ["andrea", "frank"] },
    { title: "Loza SJL - sábado", organizer: "pedro", venue: "Loza Deportiva San Juan de Lurigancho", startsAt: inDays(4, 17), format: "futbol_7", level: "competitivo", gender: "varones", maxPlayers: 14, price: "8.00", joined: ["luis", "jorge"] },
    { title: "Pichanga llena (con suplentes)", organizer: "renzo", venue: "Complejo Surco Fútbol 7", startsAt: inDays(2, 20), format: "futbol_5", level: "intermedio", gender: "mixto", maxPlayers: 4, price: "12.00", joined: ["frank", "pedro", "luis", "jorge"] },
    { title: "Pichanga en Cayma", organizer: "diego", venue: "Complejo Cayma Fútbol", startsAt: inDays(1, 20), format: "futbol_7", level: "recreativo", gender: "mixto", maxPlayers: 14, price: "10.00", joined: ["andrea", "pedro"] },
    { title: "Fulbito en Yanahuara", organizer: "andrea", venue: "Canchas Yanahuara Sport", startsAt: inDays(3, 21), format: "futbol_5", level: "intermedio", gender: "mixto", maxPlayers: 10, price: "12.00", joined: ["diego"] },
    { title: "Pichanga en Víctor Larco", organizer: "frank", venue: "Complejo Víctor Larco", startsAt: inDays(2, 19), format: "futbol_7", level: "recreativo", gender: "varones", maxPlayers: 14, price: "8.00", joined: ["jorge", "luis", "carlos"] },
    { title: "Loza Wanchaq - tarde", organizer: "miguel", venue: "Fulbito Wanchaq", startsAt: inDays(4, 16), format: "futbol_6", level: "recreativo", gender: "mixto", maxPlayers: 12, price: "6.00", joined: ["valeria"] },
    { title: "Pichanga en Castilla", organizer: "renzo", venue: "Canchas Castilla Piura", startsAt: inDays(1, 21), format: "futbol_7", level: "competitivo", gender: "varones", maxPlayers: 14, price: "10.00", joined: ["pedro", "frank"] },
    // Historial (para las metricas del admin): terminados y uno cancelado.
    { title: "Pichanga del domingo", organizer: "luis", venue: "Complejo Los Olivos", startsAt: inDays(-3, 18), format: "futbol_7", level: "recreativo", gender: "mixto", maxPlayers: 14, price: "10.00", joined: ["jorge", "diego", "andrea", "carlos", "renzo", "frank", "pedro", "miguel", "valeria", "luis"], status: "finished" },
    { title: "Fulbito de la semana pasada", organizer: "miguel", venue: "Canchas La Molina Sport", startsAt: inDays(-5, 21), format: "futbol_5", level: "intermedio", gender: "varones", maxPlayers: 10, price: "15.00", joined: ["carlos", "renzo", "jorge", "diego", "pedro", "frank", "luis", "valeria"], status: "finished" },
    { title: "Mixto de Miraflores (viernes)", organizer: "valeria", venue: "Fútbol Miraflores Arena", startsAt: inDays(-7, 19), format: "futbol_6", level: "recreativo", gender: "mixto", maxPlayers: 12, price: "20.00", joined: ["andrea", "frank", "pedro", "luis", "jorge", "diego", "miguel"], status: "finished" },
    { title: "Pichanga en Cayma (anterior)", organizer: "diego", venue: "Complejo Cayma Fútbol", startsAt: inDays(-4, 20), format: "futbol_7", level: "recreativo", gender: "mixto", maxPlayers: 14, price: "10.00", joined: ["andrea", "pedro", "jorge", "luis", "frank", "renzo"], status: "finished" },
    { title: "Loza SJL (lluvia)", organizer: "pedro", venue: "Loza Deportiva San Juan de Lurigancho", startsAt: inDays(-2, 17), format: "futbol_7", level: "competitivo", gender: "varones", maxPlayers: 14, price: "8.00", joined: ["luis", "jorge"], status: "cancelled" },
    // Mas partidos abiertos en las distintas ciudades.
    { title: "Fútbol 8 en San Borja", organizer: "carlos", venue: "DeporPlaza San Borja", startsAt: inDays(2, 20), format: "futbol_8", level: "competitivo", gender: "varones", maxPlayers: 16, price: "20.00", joined: ["luis", "jorge", "diego", "miguel", "andrea", "valeria", "renzo", "frank", "pedro"] },
    { title: "Pichanga mixta en Surco", organizer: "andrea", venue: "Complejo Surco Fútbol 7", startsAt: inDays(5, 19), format: "futbol_7", level: "recreativo", gender: "mixto", maxPlayers: 14, price: "12.00", joined: ["valeria", "frank", "pedro", "luis", "jorge", "diego"] },
    { title: "Fútbol 11 dominguero", organizer: "jorge", venue: "Canchas Villa El Salvador", startsAt: inDays(6, 9), format: "futbol_11", level: "recreativo", gender: "varones", maxPlayers: 22, price: "8.00", joined: ["luis", "diego", "miguel", "carlos", "andrea", "valeria", "renzo", "frank", "pedro"] },
    { title: "Loza en Villa El Salvador", organizer: "pedro", venue: "Canchas Villa El Salvador", startsAt: inDays(3, 18), format: "futbol_5", level: "competitivo", gender: "varones", maxPlayers: 10, price: "7.00", joined: ["luis", "jorge", "diego", "miguel", "carlos", "andrea", "valeria", "renzo"] },
    { title: "Pichanga Arequipa nocturna", organizer: "diego", venue: "Complejo Cayma Fútbol", startsAt: inDays(4, 22), format: "futbol_7", level: "intermedio", gender: "mixto", maxPlayers: 14, price: "11.00", joined: ["miguel", "andrea", "valeria", "frank"] },
    { title: "Fulbito Yanahuara express", organizer: "valeria", venue: "Canchas Yanahuara Sport", startsAt: inDays(1, 18), format: "futbol_5", level: "recreativo", gender: "mixto", maxPlayers: 10, price: "9.00", joined: ["andrea", "miguel", "diego", "pedro", "frank", "carlos", "luis"] },
    { title: "Fútbol 7 en Trujillo", organizer: "frank", venue: "Complejo Víctor Larco", startsAt: inDays(6, 20), format: "futbol_7", level: "intermedio", gender: "mixto", maxPlayers: 14, price: "10.00", joined: ["jorge", "diego", "renzo", "luis", "pedro"] },
    { title: "Loza cusqueña", organizer: "miguel", venue: "Fulbito Wanchaq", startsAt: inDays(5, 17), format: "futbol_6", level: "recreativo", gender: "mixto", maxPlayers: 12, price: "6.00", joined: ["renzo", "carlos", "andrea"] },
    { title: "Pichanga Piura full", organizer: "renzo", venue: "Canchas Castilla Piura", startsAt: inDays(2, 21), format: "futbol_7", level: "competitivo", gender: "varones", maxPlayers: 8, price: "12.00", joined: ["pedro", "frank", "jorge", "luis", "diego", "miguel", "carlos", "andrea"] },
    { title: "Pichanga Los Olivos mixta", organizer: "carlos", venue: "Complejo Los Olivos", startsAt: inDays(7, 20), format: "futbol_7", level: "recreativo", gender: "mixto", maxPlayers: 14, price: "10.00", joined: ["andrea", "valeria", "luis", "jorge", "diego", "renzo"] },
    { title: "Fútbol 5 La Molina", organizer: "andrea", venue: "Canchas La Molina Sport", startsAt: inDays(3, 20), format: "futbol_5", level: "intermedio", gender: "mujeres", maxPlayers: 10, price: "15.00", joined: ["valeria", "miguel", "carlos", "renzo", "frank", "pedro", "luis", "jorge"] },
    // Cusco: un partido por distrito (7 mas, uno por cada distrito nuevo).
    { title: "Pichanga en el Garcilaso", organizer: "luis", venue: "Estadio Garcilaso", startsAt: inDays(2, 20), format: "futbol_11", level: "intermedio", gender: "varones", maxPlayers: 22, price: "12.00", joined: ["jorge", "diego", "miguel", "carlos", "frank", "renzo"] },
    { title: "Fulbito en Ccorca", organizer: "pedro", venue: "Complejo Deportivo Ccorca", startsAt: inDays(3, 16), format: "futbol_5", level: "recreativo", gender: "mixto", maxPlayers: 10, price: "5.00", joined: ["andrea", "valeria", "frank"] },
    { title: "Pichanga en Poroy", organizer: "miguel", venue: "Canchas Poroy", startsAt: inDays(4, 18), format: "futbol_7", level: "recreativo", gender: "mixto", maxPlayers: 14, price: "7.00", joined: ["luis", "jorge", "pedro", "andrea"] },
    { title: "Fútbol 7 San Jerónimo", organizer: "carlos", venue: "Polideportivo San Jerónimo", startsAt: inDays(5, 20), format: "futbol_7", level: "intermedio", gender: "varones", maxPlayers: 14, price: "9.00", joined: ["diego", "renzo", "frank", "miguel", "jorge"] },
    { title: "Mixto en San Sebastián", organizer: "andrea", venue: "Canchas San Sebastián", startsAt: inDays(2, 19), format: "futbol_6", level: "recreativo", gender: "mixto", maxPlayers: 12, price: "10.00", joined: ["valeria", "pedro", "luis", "carlos", "renzo", "frank"] },
    { title: "Pichanga en Santiago", organizer: "renzo", venue: "Complejo Santiago Fútbol", startsAt: inDays(6, 21), format: "futbol_7", level: "competitivo", gender: "varones", maxPlayers: 14, price: "11.00", joined: ["jorge", "diego", "miguel", "frank", "pedro"] },
    { title: "Loza en Saylla", organizer: "valeria", venue: "Loza Saylla", startsAt: inDays(1, 17), format: "futbol_5", level: "recreativo", gender: "mixto", maxPlayers: 10, price: "6.00", joined: ["andrea", "miguel", "carlos", "luis"] },
    // Mas historial.
    { title: "Pichanga de aniversario", organizer: "jorge", venue: "DeporPlaza San Borja", startsAt: inDays(-10, 20), format: "futbol_7", level: "intermedio", gender: "mixto", maxPlayers: 14, price: "15.00", joined: ["luis", "diego", "miguel", "carlos", "andrea", "valeria", "renzo", "frank", "pedro"], status: "finished" },
    { title: "Fulbito en Surco (anterior)", organizer: "carlos", venue: "Complejo Surco Fútbol 7", startsAt: inDays(-8, 19), format: "futbol_5", level: "recreativo", gender: "mixto", maxPlayers: 10, price: "12.00", joined: ["andrea", "valeria", "frank", "pedro", "luis", "jorge", "diego"], status: "finished" },
    { title: "Loza en Cusco (suspendida)", organizer: "diego", venue: "Fulbito Wanchaq", startsAt: inDays(-6, 17), format: "futbol_6", level: "recreativo", gender: "mixto", maxPlayers: 12, price: "6.00", joined: ["renzo", "miguel", "andrea"], status: "cancelled" },
  ];

  for (const s of samples) {
    if (existingTitles.has(s.title)) continue;
    const [match] = await db
      .insert(matches)
      .values({
        organizerId: uid(s.organizer),
        venueId: venueId(s.venue),
        title: s.title,
        startsAt: s.startsAt,
        format: s.format,
        level: s.level,
        gender: s.gender,
        maxPlayers: s.maxPlayers,
        pricePerPlayer: s.price,
        status: (s as { status?: string }).status ?? "open",
      })
      .returning();
    const rows = [s.organizer, ...s.joined].map((name, i) => ({
      matchId: match.id,
      userId: uid(name),
      status: i < s.maxPlayers ? "confirmed" : "waitlist",
    }));
    await db.insert(matchPlayers).values(rows).onConflictDoNothing();
    const confirmed = rows.filter((r) => r.status === "confirmed").length;
    if (confirmed >= s.maxPlayers) await db.update(matches).set({ status: "full" }).where(and(eq(matches.id, match.id)));
  }
}
