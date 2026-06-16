/**
 * MCP Server — Streamable HTTP endpoint.
 *
 * Endpoint: POST /api/mcp
 * Transport: WebStandardStreamableHTTPServerTransport (SSE + JSON)
 * Kompatibel dengan Cursor, Claude Desktop (HTTP mode), Continue.dev, dll.
 */

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp';
import { createKnowledgeMcpServer } from '@/mcp/server';
import { createMcpClient } from '@/mcp/client';

let serverInstance: ReturnType<typeof createKnowledgeMcpServer> | null = null;

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
  // GET is used for SSE stream connection
  const server = await getServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function DELETE(req: NextRequest) {
  // DELETE closes the session
  const server = await getServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}
