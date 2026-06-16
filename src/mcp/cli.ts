#!/usr/bin/env node

/**
 * MCP server CLI — STDIO transport.
 * Digunakan oleh AI tools (Claude Desktop, Cursor, Continue.dev, dll.)
 * yang mendukung MCP via command-line process.
 *
 * Cara pakai:
 *   npx tsx src/mcp/cli.ts
 * Atau tambahkan ke package.json scripts lalu:
 *   npm run mcp
 *
 * Env yang dibutuhkan:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   MCP_USER_ID (opsional — fallback query ke Supabase)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { createMcpClient } from './client';
import { createKnowledgeMcpServer } from './server';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  const sb = createMcpClient();

  // Resolve user ID
  let userId = process.env.MCP_USER_ID;
  if (!userId) {
    const { data: users } = await sb.from('users').select('id').limit(1);
    if (!users || users.length === 0) {
      console.error('Tidak ada user ditemukan. Set MCP_USER_ID di .env.local.');
      process.exit(1);
    }
    userId = users[0].id;
  }

  console.error(`[SecondBrain MCP] Connected as user: ${userId}`);

  const server = createKnowledgeMcpServer(userId);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});
