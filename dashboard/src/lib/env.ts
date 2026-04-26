export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

/**
 * True when `NEXT_PUBLIC_SUPABASE_URL` is set (trimmed). Used in client bundles to pick
 * “cloud” UI paths (API fetch) vs local fallbacks — distinct from {@link isSupabaseConfigured}.
 */
export function hasPublicSupabaseUrl(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
}

export function supabasePublicEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
