'use server';

import { createHash, randomBytes } from 'crypto';
import { requireAuth } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/core/types';

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  is_revoked: boolean;
};

export async function generateApiKey(name: string): Promise<ActionResult<{ key: string; row: ApiKeyRow }>> {
  const user = await requireAuth();
  if (!name.trim()) return { error: 'Nama key wajib diisi', data: null };

  const full = randomBytes(24).toString('base64url');
  const prefix = full.slice(0, 10);
  const hash = createHash('sha256').update(full).digest('hex');

  const sb = await createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from('api_keys' as any).insert({
    user_id: user.id,
    name: name.trim(),
    key_prefix: prefix,
    key_hash: hash,
  }).select('id, name, key_prefix, last_used_at, created_at, is_revoked').single()) as any;

  if (error || !data) return { error: error?.message || 'Gagal generate key', data: null };

  return {
    data: {
      key: full,
      row: {
        id: data.id,
        name: data.name,
        key_prefix: data.key_prefix,
        last_used_at: data.last_used_at,
        created_at: data.created_at,
        is_revoked: data.is_revoked,
      },
    },
    error: null,
  };
}

export async function revokeApiKey(id: string): Promise<ActionResult<null>> {
  const user = await requireAuth();
  const sb = await createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from('api_keys' as any).update({ is_revoked: true }).eq('id', id).eq('user_id', user.id)) as any;
  if (error) return { error: error.message, data: null };
  return { data: null, error: null };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function validateApiKey(key: string): Promise<{ valid: boolean; userId?: string }> {
  const hash = createHash('sha256').update(key).digest('hex');
  const sb = await createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from('api_keys' as any)
    .select('user_id')
    .eq('key_hash', hash)
    .eq('is_revoked', false)
    .maybeSingle()) as any;

  if (data) {
    // Update last_used_at
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('api_keys' as any).update({ last_used_at: new Date().toISOString() }).eq('key_hash', hash)) as any;
    return { valid: true, userId: data.user_id };
  }

  return { valid: false };
}
