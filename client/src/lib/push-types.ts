// Contrato comun de los canales de notificaciones push: navegador (Web Push, push-web.ts) y app nativa
// (FCM/APNs con Capacitor, push-native.ts). El hook `usePushNotifications` elige el canal y no conoce los detalles.

export type PushPermission = "default" | "granted" | "denied";

export type PushErrorCode =
  | "unsupported"        // este entorno no puede recibir push
  | "permission-denied"  // el usuario rechazo el permiso del sistema
  | "blocked"            // el navegador tiene las notificaciones bloqueadas
  | "not-configured"     // el servidor no tiene claves de push
  | "session-expired"    // el servidor respondio 401
  | "aborted"            // el servicio de push cancelo el registro
  | "failed";

export class PushError extends Error {
  constructor(public readonly code: PushErrorCode, message?: string) {
    super(message ?? code);
    this.name = "PushError";
  }
}

export interface PushChannel {
  isSupported(): Promise<boolean>;
  getPermission(): Promise<PushPermission>;
  /** El dispositivo ya esta registrado para recibir avisos. */
  isSubscribed(): Promise<boolean>;
  /** Pide permiso, registra el dispositivo y lo guarda en el servidor. Lanza `PushError`. */
  subscribe(): Promise<void>;
  unsubscribe(): Promise<void>;
  /** Opcional: vuelve a registrar el dispositivo (los tokens nativos rotan). Nunca lanza. */
  refresh?(): Promise<void>;
}
