import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/core/types/database';

/**
 * Supabase client untuk MCP server — pakai service role key (admin),
 * tidak butuh cookies/session. Hanya untuk penggunaan lokal/personal.
 */
export function createMcpClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'MCP server requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.'
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
