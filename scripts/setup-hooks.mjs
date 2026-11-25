// Activa .githooks como carpeta de hooks del repo. Corre en `npm install` (script prepare).
// No debe fallar nunca: en Railway/CI no hay .git y un exit != 0 aqui rompe la instalacion.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".git")) {
  try {
    execFileSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "ignore" });
  } catch {
    // sin git en PATH: se ignora
  }
}
