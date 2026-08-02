import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serverKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serverKey) {
  throw new Error(
    'SUPABASE_URL and SUPABASE_SECRET_KEY are required on the server. ' +
      'SUPABASE_SERVICE_ROLE_KEY is supported only as a legacy fallback.',
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serverKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
