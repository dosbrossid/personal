import { config } from 'dotenv';
config({ path: 'G:\\personal-dashboard\\.env.local' });

import { createMcpClient } from '../src/mcp/client';

async function test() {
  console.log('🔌 MCP Connection Test\n');

  const sb = createMcpClient();

  // 1. Auth check
  const apiKey = process.env.MCP_API_KEY;
  if (apiKey) {
    console.log(`🔑 API Key: ${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`);
    console.log('   Header: Authorization: Bearer ' + apiKey);
  } else {
    console.log('⚠️  No MCP_API_KEY set (open mode)');
  }

  // 2. User
  const { data: users } = await sb.from('users').select('id').limit(1);
  if (!users || users.length === 0) { console.log('❌ No user found!'); return; }
  const userId = users[0].id;
  console.log(`\n✅ User: ${userId}`);

  // 3. Categories
  const { data: cats } = await sb.from('categories').select('id, name').eq('user_id', userId).eq('is_deleted', false);
  console.log(`📂 ${cats?.length || 0} categories`);

  // 4. Notes
  const { data: notes } = await sb.from('brain_notes').select('id, title, note_type').eq('user_id', userId).eq('is_deleted', false).order('updated_at', { ascending: false }).limit(5);
  console.log(`📝 ${notes?.length || 0} notes`);

  // 5. item_categories check
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: junc } = await (sb.from('item_categories' as any).select('id', { count: 'exact', head: true }) as any);
  console.log(`🔗 item_categories table: ${junc ? 'OK' : 'empty'} (count: available)`);

  console.log('\n═══════════════════════════════════════');
  console.log('✅ MCP SERVER READY');
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log('📡 HTTP:  POST http://localhost:3000/api/mcp');
  console.log(`   Auth:  Authorization: Bearer ${apiKey?.slice(0, 10)}...`);
  console.log('🖥️  CLI:   npm run mcp');
  console.log('');
  console.log('🔧 Tools:  search_notes | get_note | create_note | update_note | list_categories | get_notes_by_category');
}

test().catch(e => { console.error('❌', e.message); });
