/**
 * Setup API keys table.
 * Run once: POST /api/setup
 * Hanya bisa dijalankan dengan service role key.
 */

import { NextResponse } from 'next/server';
import { createMcpClient } from '@/mcp/client';

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_revoked BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
`;

export async function POST() {
  // Try to execute SQL via Supabase raw query (requires service role)
  try {
    const sb = createMcpClient();

    // Check if table exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: checkErr } = await (sb.from('api_keys' as any).select('id', { count: 'exact', head: true }) as any);
    
    if (!checkErr) {
      return NextResponse.json({ ok: true, message: 'api_keys table already exists' });
    }

    // If table doesn't exist, provide SQL
    return NextResponse.json({
      ok: false,
      message: 'api_keys table not found. Jalankan SQL berikut di Supabase SQL Editor.',
      sql: CREATE_SQL,
    }, { status: 500 });

  } catch {
    return NextResponse.json({
      ok: false,
      message: 'Setup failed. Jalankan SQL di Supabase SQL Editor.',
      sql: CREATE_SQL,
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const sb = createMcpClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from('api_keys' as any).select('id', { count: 'exact', head: true }) as any);
    
    return NextResponse.json({
      ready: !error,
      sql: error ? CREATE_SQL : undefined,
    });
  } catch {
    return NextResponse.json({
      ready: false,
      sql: CREATE_SQL,
    });
  }
}
