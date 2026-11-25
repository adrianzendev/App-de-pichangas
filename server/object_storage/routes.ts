import type { Express } from "express";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

// Miniaturas on-the-fly para las burbujas del chat: GET /objects/uploads/<uuid>?w=640
// devuelve un WebP de ese ancho (sin ampliar) en vez del original (hasta 10MB).
// Solo anchos de la lista (evita fabricar variantes arbitrarias); se cachean en
// disco y el navegador las guarda 1 año (las rutas llevan UUID: no cambian).
// 96/192 son de avatar (con ?sq=1: recorte cuadrado centrado); 320/640 del chat y de avatares grandes.
const THUMB_WIDTHS = new Set([96, 192, 320, 640]);
const THUMB_MIME = new Set(["image/jpeg", "image/png", "image/webp"]); // GIF se sirve original (animado)
const THUMB_DIR = path.join(os.tmpdir(), "miltareas-thumbs");
const ONE_YEAR_SEC = 31536000;
const thumbJobs = new Map<string, Promise<string | null>>(); // evita generar 2 veces la misma miniatura a la vez

function thumbFile(objectPath: string, width: number, square: boolean): string {
  return path.join(THUMB_DIR, `${crypto.createHash("sha1").update(objectPath).digest("hex")}-w${width}${square ? "-sq" : ""}.webp`);
}

async function ensureThumb(service: ObjectStorageService, objectFile: any, objectPath: string, width: number, square: boolean): Promise<string | null> {
  const file = thumbFile(objectPath, width, square);
  if (fs.existsSync(file)) return file;
  const running = thumbJobs.get(file);
  if (running) return running;
  const job = (async () => {
    try {
      const { buffer, contentType } = await service.readObjectBuffer(objectFile);
      if (!THUMB_MIME.has(contentType.split(";")[0].trim().toLowerCase())) return null;
      await fs.promises.mkdir(THUMB_DIR, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await sharp(buffer, { failOn: "none" }).rotate().resize(square ? { width, height: width, fit: "cover", withoutEnlargement: true } : { width, withoutEnlargement: true }).webp({ quality: 75 }).toFile(tmp);
      await fs.promises.rename(tmp, file);
      return file;
    } catch (err) {
      console.error("Thumbnail failed, serving original:", err);
      return null;
    } finally {
      thumbJobs.delete(file);
    }
  })();
  thumbJobs.set(file, job);
  return job;
}

/**
 * Register object storage routes for file uploads.
 *
 * This provides example routes for the presigned URL upload flow:
 * 1. POST /api/uploads/request-url - Get a presigned URL for uploading
 * 2. The client then uploads directly to the presigned URL
 *
 * IMPORTANT: These are example routes. Customize based on your use case:
 * - Add authentication middleware for protected uploads
 * - Add file metadata storage (save to database after upload)
 * - Add ACL policies for access control
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Request a presigned URL for file upload.
   *
   * Request body (JSON):
   * {
   *   "name": "filename.jpg",
   *   "size": 12345,
   *   "contentType": "image/jpeg"
   * }
   *
   * Response:
   * {
   *   "uploadURL": "https://storage.googleapis.com/...",
   *   "objectPath": "/objects/uploads/uuid"
   * }
   *
   * IMPORTANT: The client should NOT send the file to this endpoint.
   * Send JSON metadata only, then upload the file directly to uploadURL.
   */
  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Extract object path from the presigned URL for later reference
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        // Echo back the metadata for client convenience
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Serve uploaded objects.
   *
   * GET /objects/:objectPath(*)
   *
   * This serves files from object storage. For public files, no auth needed.
   * For protected files, add authentication middleware and ACL checks.
   */
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      // Miniatura ya generada: se sirve del disco sin consultar el storage (un HeadObject remoto ~300ms).
      const wCached = Number(req.query.w);
      const square = req.query.sq === "1";
      if (req.method === "GET" && THUMB_WIDTHS.has(wCached) && fs.existsSync(thumbFile(req.path, wCached, square))) {
        res.set({ "Content-Type": "image/webp", "Cache-Control": `public, max-age=${ONE_YEAR_SEC}, immutable` });
        return res.sendFile(thumbFile(req.path, wCached, square));
      }

      const objectFile = await objectStorageService.getObjectEntityFile(req.path);

      // HEAD (p. ej. probeAttachment del chat): solo cabeceras, sin bajar el objeto completo del storage.
      if (req.method === "HEAD") {
        const { contentType, size } = await objectStorageService.getObjectHead(req.path);
        res.set({ "Content-Type": contentType || "application/octet-stream", ...(size ? { "Content-Length": String(size) } : {}), "Cache-Control": `public, max-age=${ONE_YEAR_SEC}, immutable` });
        return res.status(200).end();
      }

      const w = Number(req.query.w);
      if (THUMB_WIDTHS.has(w)) {
        const thumb = await ensureThumb(objectStorageService, objectFile, req.path, w, square);
        if (thumb) {
          res.set({ "Content-Type": "image/webp", "Cache-Control": `public, max-age=${ONE_YEAR_SEC}, immutable` });
          return res.sendFile(thumb);
        }
      }

      // Rutas con UUID: el contenido no cambia, el navegador puede guardarlo 1 año.
      await objectStorageService.downloadObject(objectFile, res, ONE_YEAR_SEC);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

