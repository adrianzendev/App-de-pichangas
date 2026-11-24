import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { bp } from "./breakpoints";
import { twTokens } from "./tw-merge-tokens";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  define: {
    __BP__: JSON.stringify(bp), // breakpoints de index.css para client/src/lib/breakpoints.ts
    __TW_TOKENS__: JSON.stringify(twTokens), // tokens de tailwind.config.ts para cn() (tailwind-merge)
  },
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  envDir: import.meta.dirname, // .env vive en la raiz, no en client/ (sin esto VITE_* queda vacio en build)
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Librerias estables en chunks propios: se cachean entre deploys y no
        // se re-descargan cuando solo cambia codigo de la app.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("wouter")) return "vendor-react";
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
