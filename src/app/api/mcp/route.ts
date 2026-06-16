/**
 * MCP Server — Streamable HTTP endpoint.
 *
 * Auth: Authorization: Bearer <api_key>
 * Validasinya via tabel api_keys di Supabase (bukan env).
 * Setup: jalankan SQL di /api/setup kalau tabel belum ada.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp';
import { createKnowledgeMcpServer } from '@/mcp/server';
import { validateKey } from '@/mcp/validate';

let serverInstance: ReturnType<typeof createKnowledgeMcpServer> | null = null;
let cachedUserId: string | null = null;

async function checkAuth(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization');
  if (!auth) return null;

  const key = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  
  // Fallback: env-based key (backward compat)
  if (process.env.MCP_API_KEY && key === process.env.MCP_API_KEY) {
    if (cachedUserId) return cachedUserId;
    return '_env_'; // Will be resolved by getServer
  }

  // DB-based validation
  const { valid, userId: dbUserId } = await validateKey(key);
  if (valid && dbUserId) {
    cachedUserId = dbUserId;
    return dbUserId;
  }

  return null;
}

async function getServer(userId?: string): Promise<ReturnType<typeof createKnowledgeMcpServer>> {
  if (serverInstance) return serverInstance;

  // If we have a userId from auth, use it. Otherwise fallback to env/query.
  if (userId && userId !== '_env_') {
    serverInstance = createKnowledgeMcpServer(userId);
    return serverInstance;
  }

  // Fallback: env-based user ID
  const envId = process.env.MCP_USER_ID;
  if (envId) {
    serverInstance = createKnowledgeMcpServer(envId);
    return serverInstance;
  }

  throw new Error('No user ID found. Set MCP_USER_ID in .env.local or use an API key.');
}

async function handle(req: NextRequest): Promise<Response> {
  const userId = await checkAuth(req);
  if (!userId) {
    return NextResponse.json({
      error: 'Unauthorized — generate API key di Settings > API Keys, lalu kirim Authorization: Bearer <key>',
    }, { status: 401 });
  }

  const server = await getServer(userId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  await server.connect(transport);

  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    parsedBody = undefined;
  }

  return transport.handleRequest(req, { parsedBody });
}

export { handle as GET, handle as POST, handle as DELETE };
