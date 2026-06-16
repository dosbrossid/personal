import { createHash } from 'crypto';
import { createMcpClient } from '@/mcp/client';

export async function validateKey(key: string): Promise<{ valid: boolean; userId?: string }> {
  const hash = createHash('sha256').update(key).digest('hex');
  const sb = createMcpClient();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb.from('api_keys' as any)
      .select('user_id')
      .eq('key_hash', hash)
      .eq('is_revoked', false)
      .maybeSingle()) as any;

    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb.from('api_keys' as any).update({ last_used_at: new Date().toISOString() }).eq('key_hash', hash)) as any;
      return { valid: true, userId: data.user_id };
    }
  } catch {
    // Table mungkin belum ada
  }

  return { valid: false };
}
