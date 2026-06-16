import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  const user = await requireAuth();
  const sb = await createServerClient();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from('api_keys' as any)
      .select('id, name, key_prefix, last_used_at, created_at, is_revoked')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })) as any;

    if (error) throw error;

    return NextResponse.json({ keys: data || [] });
  } catch {
    return NextResponse.json({ keys: [], error: 'Table not found' }, { status: 500 });
  }
}
