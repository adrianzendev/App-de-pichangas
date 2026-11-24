import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// vite.config.ts solo se necesita en desarrollo. Con un import estatico, esbuild lo empaqueta en dist/index.js
// y el servidor de produccion carga tailwindcss/tailwind.config.ts al arrancar (y se cae). La ruta va en una
// variable para que esbuild no la resuelva: en produccion este import nunca se ejecuta.
const VITE_CONFIG_PATH = "../vite.config";

export async function setupVite(app: Express, server: Server, port: number) {
  const { default: viteConfig } = await import(/* @vite-ignore */ VITE_CONFIG_PATH);
  const serverOptions = {
    middlewareMode: true,
    // clientPort explicito: setupVite corre antes de server.listen(), asi
    // que Vite no puede inferir el puerto leyendo la direccion del socket
    // (todavia no escucha) — sin esto el script HMR inyectado queda con
    // "ws://localhost:undefined" y tira SyntaxError en el navegador.
    hmr: { server, clientPort: port },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Hashed assets (JS, CSS, images) — safe to cache 1 year, content never changes for a given name
  app.use('/assets', express.static(path.join(distPath, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }));

  // Everything else (including index.html) — no long-term cache so new deploys are picked up
  app.use(express.static(distPath, {
    setHeaders(res, filePath) {
      if (/(index\.html|service-worker\.js|manifest\.json|offline\.html)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
