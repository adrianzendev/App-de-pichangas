import { createClient } from '@supabase/supabase-js';

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

// Sin credenciales de Supabase (p. ej. un .env local minimo) createClient lanza "supabaseUrl is required" al importar el
// modulo y la app se queda en el spinner de carga. Con valores de relleno la app arranca; el login de Supabase (Google,
// correo) no funcionara hasta definir VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.
export const supabaseConfigured = Boolean(envUrl && envKey);
if (!supabaseConfigured) {
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY no configuradas: login con Supabase desactivado.');
}

export const supabase = createClient(
  envUrl || 'http://localhost:54321',
  envKey || 'sin-configurar',
  {
    auth: {
      flowType: 'pkce',
    },
  },
);
