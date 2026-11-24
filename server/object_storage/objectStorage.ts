import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

// ─── Detección de entorno ───────────────────────────────────────────────────
const USE_R2 = !!process.env.R2_ACCESS_KEY_ID;

// ─── Replit sidecar (solo se usa si NO hay R2) ──────────────────────────────
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// ─── Cliente GCS (Replit) ───────────────────────────────────────────────────
let _gcsStorage: any = null;
async function getGCSStorage() {
  if (!_gcsStorage) {
    const { Storage } = await import("@google-cloud/storage");
    _gcsStorage = new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: "external_account",
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: {
            type: "json",
            subject_token_field_name: "access_token",
          },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "",
    });
  }
  return _gcsStorage;
}

// ─── Cliente S3 compatible (Cloudflare R2) ──────────────────────────────────
let _s3Client: any = null;
async function getS3Client() {
  if (!_s3Client) {
    const { S3Client } = await import("@aws-sdk/client-s3");
    _s3Client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _s3Client;
}

// ─── Error público ───────────────────────────────────────────────────────────
export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// ─── Helpers internos ────────────────────────────────────────────────────────
function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  if (parts.length < 3) throw new Error("Invalid path: must contain at least a bucket name");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

async function signGCSUrl({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket_name: bucketName,
        object_name: objectName,
        method,
        expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
      }),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign GCS URL, errorcode: ${response.status}, make sure you're running on Replit`
    );
  }
  const { signed_url } = await response.json();
  return signed_url;
}

async function signR2Url({
  objectName,
  method,
  ttlSec,
}: {
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } =
    await import("@aws-sdk/client-s3");

  const s3 = await getS3Client();
  const bucket = process.env.R2_BUCKET_NAME!;

  const CommandMap: Record<string, any> = {
    GET: GetObjectCommand,
    PUT: PutObjectCommand,
    DELETE: DeleteObjectCommand,
    HEAD: HeadObjectCommand,
  };
  const Cmd = CommandMap[method];
  const command = new Cmd({ Bucket: bucket, Key: objectName });
  return getSignedUrl(s3, command, { expiresIn: ttlSec });
}

// ─── Clase principal ─────────────────────────────────────────────────────────
export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
      )
    );
    if (paths.length === 0 && !USE_R2) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir && !USE_R2) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  // Busca un archivo público — GCS (Replit) o R2
  async searchPublicObject(filePath: string): Promise<any | null> {
    if (USE_R2) {
      const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
      const s3 = await getS3Client();
      const key = `public/${filePath}`;
      try {
        await s3.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }));
        return { _r2Key: key }; // objeto liviano que identifica el archivo
      } catch {
        return null;
      }
    }

    // GCS path
    const storage = await getGCSStorage();
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (exists) return file;
    }
    return null;
  }

  // Descarga un archivo hacia el Response de Express
  async downloadObject(fileOrRef: any, res: Response, cacheTtlSec: number = 3600) {
    try {
      if (USE_R2) {
        const { GetObjectCommand } = await import("@aws-sdk/client-s3");
        const s3 = await getS3Client();
        const key: string = fileOrRef._r2Key ?? fileOrRef;
        const result = await s3.send(
          new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key })
        );
        res.set({
          "Content-Type": result.ContentType || "application/octet-stream",
          ...(result.ContentLength ? { "Content-Length": String(result.ContentLength) } : {}),
          "Cache-Control": `public, max-age=${cacheTtlSec}${cacheTtlSec >= 31536000 ? ", immutable" : ""}`,
        });
        // Sin este handler, un 'error' (ej. cliente aborta la descarga a
        // medio camino, ECONNRESET) queda sin listener — evento 'error' no
        // escuchado en un EventEmitter de Node es fatal y tumba TODO el
        // proceso, no solo esta request. Mismo guardia que ya tiene la
        // rama GCS de abajo.
        const body = result.Body as any;
        body.on("error", (err: Error) => {
          console.error("Stream error (R2):", err);
          if (!res.headersSent) res.status(500).json({ error: "Error streaming file" });
        });
        body.pipe(res);
        return;
      }

      // GCS path
      const [metadata] = await fileOrRef.getMetadata();
      const aclPolicy = await getObjectAclPolicy(fileOrRef);
      const isPublic = aclPolicy?.visibility === "public";
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}${cacheTtlSec >= 31536000 ? ", immutable" : ""}`,
      });
      const stream = fileOrRef.createReadStream();
      stream.on("error", (err: Error) => {
        console.error("Stream error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Error streaming file" });
      });
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) res.status(500).json({ error: "Error downloading file" });
    }
  }

  // Genera URL firmada para subir un archivo nuevo (solo GCS/Replit)
  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();

    if (USE_R2) {
      const key = `private/uploads/${objectId}`;
      return signR2Url({ objectName: key, method: "PUT", ttlSec: 900 });
    }

    // GCS path
    const privateObjectDir = this.getPrivateObjectDir();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    return signGCSUrl({ bucketName, objectName, method: "PUT", ttlSec: 900 });
  }

  // Sube un buffer directamente al storage y devuelve el path /objects/...
  // Para R2: usa PutObjectCommand (sin presigned URL — más confiable desde el backend)
  // Para GCS: usa presigned URL como antes
  async uploadObjectEntity(buffer: Buffer, contentType: string): Promise<string> {
    const objectId = randomUUID();

    if (USE_R2) {
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      const s3 = await getS3Client();
      const key = `private/uploads/${objectId}`;
      await s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }));
      return `/objects/uploads/${objectId}`;
    }

    // GCS path: usa presigned URL (sidecar de Replit)
    const privateObjectDir = this.getPrivateObjectDir();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const uploadURL = await signGCSUrl({ bucketName, objectName, method: "PUT", ttlSec: 900 });
    const uploadAbort = new AbortController();
    const uploadTimeout = setTimeout(() => uploadAbort.abort(), 30_000);
    let response: globalThis.Response;
    try {
      response = await fetch(uploadURL, {
        method: "PUT",
        body: buffer,
        headers: { "Content-Type": contentType },
        signal: uploadAbort.signal,
      });
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw new Error("GCS upload timeout: el archivo tardó más de 30s en subirse");
      }
      throw err;
    } finally {
      clearTimeout(uploadTimeout);
    }
    if (!response.ok) {
      throw new Error(`GCS upload failed: ${response.status} ${await response.text()}`);
    }
    const normalizedFullPath = `${privateObjectDir}/uploads/${objectId}`;
    const { objectName: on } = parseObjectPath(normalizedFullPath);
    return `/objects/${on}`;
  }

  // Lee el objeto completo en memoria (para generar miniaturas con sharp).
  async readObjectBuffer(fileOrRef: any): Promise<{ buffer: Buffer; contentType: string }> {
    if (USE_R2) {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const s3 = await getS3Client();
      const key: string = fileOrRef._r2Key ?? fileOrRef;
      const result = await s3.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }));
      const bytes = await (result.Body as any).transformToByteArray();
      return { buffer: Buffer.from(bytes), contentType: result.ContentType || "application/octet-stream" };
    }
    const [metadata] = await fileOrRef.getMetadata();
    const [buffer] = await fileOrRef.download();
    return { buffer, contentType: metadata.contentType || "application/octet-stream" };
  }

  // Content-Type de un objeto /objects/... (null si no existe / falla).
  // Tipo y peso del objeto sin descargarlo (HEAD).
  async getObjectHead(objectPath: string): Promise<{ contentType: string | null; size: number }> {
    try {
      const file = await this.getObjectEntityFile(objectPath);
      if (USE_R2) {
        const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
        const s3 = await getS3Client();
        const head = await s3.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: file._r2Key }));
        return { contentType: head.ContentType || null, size: head.ContentLength ?? 0 };
      }
      const [metadata] = await file.getMetadata();
      return { contentType: metadata.contentType || null, size: Number(metadata.size) || 0 };
    } catch {
      return { contentType: null, size: 0 };
    }
  }

  async getObjectContentType(objectPath: string): Promise<string | null> {
    return (await this.getObjectHead(objectPath)).contentType;
  }

  // Obtiene el archivo a partir de una ruta /objects/...
  async getObjectEntityFile(objectPath: string): Promise<any> {
    if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) throw new ObjectNotFoundError();
    const entityId = parts.slice(1).join("/");

    if (USE_R2) {
      const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
      const s3 = await getS3Client();
      const key = `private/${entityId}`;
      try {
        await s3.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }));
        return { _r2Key: key };
      } catch {
        throw new ObjectNotFoundError();
      }
    }

    // GCS path
    const storage = await getGCSStorage();
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) entityDir = `${entityDir}/`;
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = storage.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) throw new ObjectNotFoundError();
    return objectFile;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (USE_R2) {
      // Normaliza URLs de R2 a rutas /objects/...
      const r2Endpoint = process.env.R2_ENDPOINT || "";
      const bucket = process.env.R2_BUCKET_NAME || "";
      if (rawPath.startsWith(`${r2Endpoint}/${bucket}/private/`)) {
        const entityId = rawPath.slice(`${r2Endpoint}/${bucket}/private/`.length).split("?")[0];
        return `/objects/${entityId}`;
      }
      return rawPath;
    }

    // GCS path (comportamiento original)
    if (!rawPath.startsWith("https://storage.googleapis.com/")) return rawPath;
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) objectEntityDir = `${objectEntityDir}/`;
    if (!rawObjectPath.startsWith(objectEntityDir)) return rawObjectPath;
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) return normalizedPath;

    if (USE_R2) {
      // R2 no tiene ACLs granulares por objeto — visibilidad se maneja a nivel de bucket
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: any;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    if (USE_R2) {
      // Con R2 todos los archivos privados son accesibles vía URL firmada
      return true;
    }
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

