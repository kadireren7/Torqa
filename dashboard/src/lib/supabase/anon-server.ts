import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabasePublicEnv } from "@/lib/env";

/** Anonymous PostgREST client (no cookies). Used for public share RPC only. */
export function createAnonSupabase(): SupabaseClient | null {
  const env = supabasePublicEnv();
  if (!env) return null;
  return createClient(env.url, env.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
