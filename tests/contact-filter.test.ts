// Ejecutar: npx tsx --test tests/contact-filter.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { compileFilterRule, maskContact, scanContact, describeScan, type FilterRules } from "../shared/contact-filter";
import { severityFor } from "../shared/alert-severity";

const rules: FilterRules = {
  blacklist: ["whatsapp", "wsp", "escríbeme", "por fuera", "wa.me"].map(compileFilterRule),
  whitelist: ["935436864", "+51935436864"].map(compileFilterRule),
};

test("telefono internacional con espacios: alta y enmascarado", () => {
  const text = "llamame al +58 414 123 4567 gracias";
  assert.equal(scanContact(text, rules).severity, "high");
  assert.equal(maskContact(text, rules), "llamame al +** *** *** **** gracias");
});

test("telefono pegado y con guiones: alta", () => {
  assert.equal(scanContact("mi cel 987654321", rules).severity, "high");
  assert.equal(maskContact("987-654-321", rules), "***-***-***");
});

test("enlace directo: alta y reemplazado por ****", () => {
  const text = "escribeme https://wa.me/51999999999 ya";
  const scan = scanContact(text, rules);
  assert.equal(scan.severity, "high");
  assert.equal(scan.links.length, 1);
  assert.equal(scan.phones.length, 0); // el numero del enlace no se cuenta dos veces
  assert.equal(maskContact(text, rules), "escribeme **** ya");
});

test("email: alta", () => {
  assert.equal(scanContact("a juan.perez@gmail.com", rules).severity, "high");
  assert.equal(maskContact("a juan.perez@gmail.com", rules), "a ****");
});

test("palabra ambigua: media y sin cambios", () => {
  const text = "mejor hablamos por whatsapp";
  assert.equal(scanContact(text, rules).severity, "medium");
  assert.equal(maskContact(text, rules), text);
});

test("numero de la lista blanca (Yape del admin): sin marca", () => {
  assert.equal(scanContact("yapea al 935436864", rules).severity, null);
  assert.equal(maskContact("yapea al 935436864", rules), "yapea al 935436864");
});

test("lista blanca + telefono ajeno en el mismo mensaje: se censura solo el ajeno", () => {
  const text = "yape 935436864 o llamame 987654321";
  assert.equal(scanContact(text, rules).severity, "high");
  assert.equal(maskContact(text, rules), "yape 935436864 o llamame *********");
});

test("montos, fechas y numeros cortos o largos: sin marca", () => {
  for (const t of ["pago 1500 soles", "entrega 21-10-2026", "S/ 350.50", "cuenta 12345678901234567890", "pedido 12345678"]) {
    assert.equal(scanContact(t, rules).severity, null, t);
  }
});

test("describeScan y severityFor de respaldo", () => {
  const scan = scanContact("wsp al 987654321", rules);
  assert.match(describeScan(scan), /número: 987654321/);
  assert.equal(severityFor("número: 987654321"), "high");
  assert.equal(severityFor("enlace: https://wa.me/1"), "high");
  assert.equal(severityFor("instagram"), "medium");
  assert.equal(severityFor("whatsapp, wsp"), "medium");
});
