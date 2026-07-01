import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const TTL_MS = 24 * 60 * 60 * 1000;

export async function cacheGet<T>(db: SupabaseClient, key: string): Promise<T | null> {
  const { data: row } = await db.from('search_cache').select('data, created_at').eq('key', key).maybeSingle();
  if (!row) return null;
  if (Date.now() - new Date(row.created_at).getTime() > TTL_MS) {
    await db.from('search_cache').delete().eq('key', key);
    return null;
  }
  return row.data as T;
}

export async function cacheSet(db: SupabaseClient, key: string, data: unknown): Promise<void> {
  await db.from('search_cache').upsert({ key, data, created_at: new Date().toISOString() });
}
