# Despliegue en Vercel

Guia corta. Las variables y su significado estan en `.env.example`.

## 1. Como esta armado

- `vercel.json` define `"buildCommand": "node scripts/build-vercel.mjs"` (sin framework).
- `scripts/build-vercel.mjs` genera `.vercel/output` (Build Output API):
  - el cliente Vite como sitio estatico;
  - el servidor Express empaquetado con esbuild como una sola funcion.
- `server/vercel-handler.ts` es el punto de entrada de esa funcion: recibe
  las peticiones y las pasa a la app Express.

## 2. Que se pierde en Vercel

- Presencia en linea y chat en tiempo real: dependen de WebSocket, que
  Vercel no ofrece. Por eso se usa `VITE_DISABLE_WS=1`.
- Los intervalos de recordatorios (`setInterval`) no existen: pasan a un
  cron diario en `/api/cron/jobs`, que exige `CRON_SECRET`.
- El disco es de solo lectura: las subidas (fotos, adjuntos, comprobantes,
  portadas) exigen R2 configurado.

## 3. Pasos

### Paso 1. Cargar variables

Con la CLI (una por una) o en el panel de Vercel (Settings > Environment Variables):

```bash
vercel env add DATABASE_URL production
vercel env add SESSION_SECRET production
vercel env add CRON_SECRET production
```

Las `VITE_*` deben existir ANTES del build, porque se incrustan al compilar.
Si las cambias, hay que volver a desplegar.

### Paso 2. Configurar Supabase

En Authentication > URL Configuration:

- Site URL: el dominio de Vercel, sin barra final.
- Redirect URLs, por ejemplo:

```text
https://appdepichangas.vercel.app/auth/callback
```

### Paso 3. Vista previa

```bash
vercel deploy
```

Prueba la URL de vista previa (ver comprobaciones abajo).

### Paso 4. Produccion

```bash
vercel deploy --prod
```

### Paso 5. Migraciones (solo si hay columnas nuevas)

Define `RUN_MIGRATIONS=1`, despliega una vez y luego quitala:

```bash
vercel env add RUN_MIGRATIONS production
vercel deploy --prod
vercel env rm RUN_MIGRATIONS production
```

## 4. Comprobaciones

```bash
# Debe responder 200
curl -i https://appdepichangas.vercel.app/api/venues

# Sin credencial: debe rechazar (401)
curl -i https://appdepichangas.vercel.app/api/cron/jobs

# Con credencial: debe ejecutar (200)
curl -i -H "Authorization: Bearer $CRON_SECRET" https://appdepichangas.vercel.app/api/cron/jobs
```

Ademas: inicia sesion desde el navegador y sube una foto para validar R2.

## 5. Seguridad

- El repositorio es publico: nunca versiones cookies (`*_cookies.txt`),
  `uploads/` ni `.env`.
- `SUPABASE_SERVICE_ROLE_KEY` y cualquier secreto jamas llevan prefijo `VITE_`.
- Si algun secreto se filtro, rotalo en su proveedor y actualizalo en Vercel.
