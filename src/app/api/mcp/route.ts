/**
 * MCP Server — Streamable HTTP endpoint.
 *
 * Endpoint: POST /api/mcp
 * Transport: WebStandardStreamableHTTPServerTransport (SSE + JSON)
 * Auth: Authorization: Bearer <MCP_API_KEY>
 * Kompatibel dengan Cursor, Claude Desktop (HTTP mode), Continue.dev, dll.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp';
import { createKnowledgeMcpServer } from '@/mcp/server';
import { createMcpClient } from '@/mcp/client';

let serverInstance: ReturnType<typeof createKnowledgeMcpServer> | null = null;

function checkAuth(req: NextRequest): boolean {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) return true; // No API key configured = open (dev mode)
  const auth = req.headers.get('authorization');
  if (!auth) return false;
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  return token === apiKey;
}

async function getServer(): Promise<ReturnType<typeof createKnowledgeMcpServer>> {
  if (serverInstance) return serverInstance;

  const sb = createMcpClient();
  let userId = process.env.MCP_USER_ID;
  if (!userId) {
    const { data: users } = await sb.from('users').select('id').limit(1);
    if (!users || users.length === 0) throw new Error('No user found. Set MCP_USER_ID in .env.local.');
    userId = users[0].id;
  }

  serverInstance = createKnowledgeMcpServer(userId);
  return serverInstance;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized — set MCP_API_KEY di .env.local, lalu kirim Authorization: Bearer <key>' }, { status: 401 });
  }

  const server = await getServer();
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

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const server = await getServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const server = await getServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}
