// Ejecutar: npx tsx --test tests/impersonation.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSuperAdmin, MAIN_ADMIN_EMAIL } from "../shared/admin";
import { IMPERSONATION_MAX_MS, createOnceEvery, impersonationExpired, impersonationRule, isSameOrigin, shouldAudit, shouldAuditRead } from "../server/superadmin-rules";

test("lecturas auditadas: chats y pagos al impersonar; sin impersonar, solo el chat de un pedido", () => {
  for (const u of ["/api/chat/threads", "/api/chat/threads/t1/messages?limit=5", "/api/CHAT/last-messages", "/api/payment-verifications", "/api/admin/tasks/t1/chat"]) {
    assert.equal(shouldAuditRead("GET", u, true), true, u);
  }
  assert.equal(shouldAuditRead("GET", "/api/tutors", true), false);
  assert.equal(shouldAuditRead("POST", "/api/chat/threads", true), false); // las escrituras van por shouldAudit
  assert.equal(shouldAuditRead("GET", "/api/admin/tasks/t1/chat", false), true);
  assert.equal(shouldAuditRead("GET", "/api/chat/threads", false), false); // el super admin leyendo su propio chat
  assert.equal(shouldAuditRead("GET", "/api/payment-verifications", false), false);
});

test("una lectura repetida se registra una vez por ventana", () => {
  const once = createOnceEvery(1000, 2);
  assert.equal(once("a", 0), true);
  assert.equal(once("a", 999), false);
  assert.equal(once("a", 1000), true);
  assert.equal(once("b", 1000), true);
  assert.equal(once("c", 1000), true); // lleno y nada vencido: se vacia, nunca crece sin limite
  assert.equal(once("c", 1001), false);
});

test("vencimiento: a los 30 min, y sin hora de inicio cuenta como vencida", () => {
  const now = 1_000_000_000;
  assert.equal(impersonationExpired(now, now), false);
  assert.equal(impersonationExpired(now - IMPERSONATION_MAX_MS + 1, now), false);
  assert.equal(impersonationExpired(now - IMPERSONATION_MAX_MS, now), true);
  assert.equal(impersonationExpired(undefined, now), true);
});

test("isSuperAdmin: solo el admin principal", () => {
  assert.equal(isSuperAdmin(MAIN_ADMIN_EMAIL), true);
  assert.equal(isSuperAdmin("otro@miltareas.com"), false);
  assert.equal(isSuperAdmin(undefined), false);
});

test("solo lectura: toda escritura se bloquea, tambien perfil, pedidos, chat y push", () => {
  for (const [m, u] of [
    ["POST", "/api/user/change-password"],
    ["DELETE", "/api/user/account"],
    ["POST", "/api/payment-verifications"],
    ["POST", "/api/payments/create"],
    ["POST", "/api/bank-accounts"],
    ["DELETE", "/api/user/blocks/u1"],
    ["POST", "/api/auth/reset-password-confirm"],
    ["POST", "/api/auth/dev-login?x=1"],
    ["PUT", "/api/user/current"],
    ["POST", "/api/tasks"],
    ["PATCH", "/api/tasks/t1"],
    ["POST", "/api/chat/send"],
    ["POST", "/api/chat/threads/with/t1"],
    ["POST", "/api/tasks/t1/review"],
    ["POST", "/api/tasks/t1/confirm-delivery"],
    ["POST", "/api/tasks/t1/dispute-delivery"],
    ["POST", "/api/candidates"],
    ["POST", "/api/push/subscribe"],
    ["POST", "/api/push/native-token"],
    ["POST", "/api/uploads/request-url"],
    ["POST", "/api/ruta-que-aun-no-existe"],
  ]) assert.equal(impersonationRule(m, u), "block", `${m} ${u}`);
});

test("el bloqueo no se salta con mayusculas ni barra final (Express las ignora al enrutar)", () => {
  for (const [m, u] of [
    ["POST", "/api/USER/change-password"],
    ["POST", "/api/PAYMENTS/create"],
    ["POST", "/API/bank-accounts"],
    ["DELETE", "/api/user/Account/"],
  ]) assert.equal(impersonationRule(m, u), "block", `${m} ${u}`);
  assert.equal(impersonationRule("POST", "/api/AUTH/LOGOUT/"), "allow");
});

test("se permiten lecturas, cerrar sesion y los POST que no escriben", () => {
  for (const [m, u] of [
    ["GET", "/api/payment-verifications"],
    ["HEAD", "/api/user/current"],
    ["POST", "/api/auth/logout"],
    ["POST", "/api/tutor/unviewed-count"],
    ["POST", "/api/chat/get-or-create"],
  ]) assert.equal(impersonationRule(m, u), "allow", `${m} ${u}`);
});

test("abrir algo no deja rastro en la cuenta real: leido, descargado y vistas responden sin escribir", () => {
  for (const [m, u] of [
    ["POST", "/api/chat/threads/t1/mark-read"],
    ["POST", "/api/chat/mark-read"],
    ["POST", "/api/chat/mark-read/t1/u1"],
    ["POST", "/api/chat/messages/m1/downloaded"],
    ["POST", "/api/tasks/t1/view"],
    ["PATCH", "/api/tasks/t1/mark-proposals-viewed"],
  ]) assert.equal(impersonationRule(m, u), "noop", `${m} ${u}`);
});

test("iniciar/terminar: solo desde el mismo origen", () => {
  const hosts = ["app.miltareas.com", "app.miltareas.com"];
  assert.equal(isSameOrigin("https://app.miltareas.com", hosts), true);
  assert.equal(isSameOrigin("https://APP.miltareas.com", hosts), true);
  assert.equal(isSameOrigin("http://localhost:5000", ["localhost:5000", "localhost"]), true);
  assert.equal(isSameOrigin("https://app.miltareas.com", ["interno:8080", "app.miltareas.com"]), true); // detras de proxy
  assert.equal(isSameOrigin("https://evil.com", hosts), false);
  assert.equal(isSameOrigin("https://app.miltareas.com.evil.com", hosts), false);
  assert.equal(isSameOrigin("null", hosts), false);
  assert.equal(isSameOrigin(undefined, hosts), false);
});

test("auditoria: no GET en admin/users o durante la impersonacion; inicio/fin aparte", () => {
  assert.equal(shouldAudit("GET", "/api/admin/users", false), false);
  assert.equal(shouldAudit("PATCH", "/api/users/u1/status", false), true);
  assert.equal(shouldAudit("POST", "/api/admin/tutors?x=1", false), true);
  assert.equal(shouldAudit("POST", "/API/ADMIN/tutors", false), true);
  assert.equal(shouldAudit("POST", "/api/chat/send", false), false); // super admin chateando normal
  assert.equal(shouldAudit("POST", "/api/chat/send", true), true); // impersonando: todo
  assert.equal(shouldAudit("POST", "/api/admin/impersonate/stop", true), false);
});
