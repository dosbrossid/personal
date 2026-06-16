import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import * as z from 'zod/v4';
import { createMcpClient } from './client';
import { stripNoteContent } from '@/lib/notes';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/core/types/database';

type Sb = SupabaseClient<Database>;

const NOTE_SELECT = `id, title, content_body, note_type, contextual_role, is_pinned, source_url, ai_summary, created_at, updated_at`;

export function createKnowledgeMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: 'secondbrain-knowledge',
    version: '1.0.0',
  });

  const sb = createMcpClient() as Sb;

  // ─── TOOLS ──────────────────────────────────────────────────────

  server.registerTool(
    'search_notes',
    {
      description:
        'Cari catatan berdasarkan kata kunci. Filter opsional per kategori.',
      inputSchema: z.object({
        q: z.string(),
        category: z.string().optional(),
        limit: z.number().default(10),
      }),
    },
    async (args) => {
      const { q, category, limit } = args as { q: string; category?: string; limit: number };

      let query = sb.from('brain_notes').select(NOTE_SELECT).eq('user_id', userId).eq('is_deleted', false);

      if (category) {
        const { data: cat } = await sb.from('categories').select('id').eq('name', category).eq('user_id', userId).maybeSingle();
        if (cat) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: junction } = await (sb.from('item_categories' as any).select('item_id') as any).eq('category_id', cat.id).eq('item_type', 'brain_note');
          const noteIds = ((junction ?? []) as Array<{ item_id: string }>).map((j) => j.item_id);
          if (noteIds.length === 0) return simpleResult(`Tidak ada catatan di kategori "${category}".`);
          query = query.in('id', noteIds);
        } else {
          return simpleResult(`Kategori "${category}" tidak ditemukan.`);
        }
      }

      query = query.or(`title.ilike.%${q}%,content_body.ilike.%${q}%`).order('updated_at', { ascending: false }).limit(limit);

      const { data: notes } = await query;
      if (!notes || notes.length === 0) return simpleResult(`Tidak ada catatan cocok dengan "${q}".`);

      const results = notes.map(formatNote);
      return simpleResult(`🔍 ${results.length} catatan:\n\n${results.join('\n---\n')}`);
    }
  );

  server.registerTool(
    'get_note',
    {
      description: 'Baca isi lengkap satu catatan berdasarkan ID.',
      inputSchema: z.object({ id: z.string() }),
    },
    async (args) => {
      const { id } = args as { id: string };
      const { data: note } = await sb.from('brain_notes').select(NOTE_SELECT).eq('id', id).eq('user_id', userId).eq('is_deleted', false).maybeSingle();
      if (!note) return simpleResult(`Catatan "${id}" tidak ditemukan.`);

      const cats = await getNoteCategories(sb, note.id);
      const content = stripNoteContent(note.content_body || '');

      const lines = [
        `📝 ${note.title}`,
        note.note_type ? `Tipe: ${note.note_type}` : null,
        note.source_url ? `Sumber: ${note.source_url}` : null,
        cats ? `Kategori: ${cats}` : null,
        note.is_pinned ? '📌 Dipin' : null,
        note.ai_summary ? `\nAI Summary: ${note.ai_summary}` : null,
        `\n${content}`,
        `\n— Dibuat ${note.created_at}, diperbarui ${note.updated_at}`,
      ].filter(Boolean).join('\n');

      return simpleResult(lines);
    }
  );

  server.registerTool(
    'create_note',
    {
      description: 'Buat catatan baru. Kategori akan dibuat otomatis jika belum ada.',
      inputSchema: z.object({
        title: z.string(),
        content: z.string().default(''),
        note_type: z.enum(['text', 'link', 'idea', 'snippet']).default('text'),
        category_names: z.array(z.string()).default([]),
        is_pinned: z.boolean().default(false),
        source_url: z.string().optional(),
      }),
    },
    async (args) => {
      const { title, content, note_type, category_names, is_pinned, source_url } = args as {
        title: string; content: string; note_type: string; category_names: string[]; is_pinned: boolean; source_url?: string;
      };

      const { data: note, error } = await sb
        .from('brain_notes')
        .insert({
          user_id: userId,
          title,
          content_body: content,
          note_type,
          contextual_role: 'general',
          is_pinned,
          source_url: source_url ?? null,
        } as never)
        .select('id')
        .single();

      if (error || !note) return simpleResult(`Gagal membuat catatan: ${error?.message || 'unknown'}`);

      const noteId = (note as { id: string }).id;
      const assigned: string[] = [];
      for (const name of category_names) {
        const catId = await ensureCategory(sb, userId, name);
        if (catId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (sb.from('item_categories' as any).insert({ item_id: noteId, item_type: 'brain_note', category_id: catId }) as any);
          assigned.push(name);
        }
      }

      return simpleResult(`✅ "${title}" dibuat${assigned.length > 0 ? ` | Kategori: ${assigned.join(', ')}` : ''}. ID: ${noteId}`);
    }
  );

  server.registerTool(
    'update_note',
    {
      description: 'Perbarui catatan (judul, isi, pin, kategori).',
      inputSchema: z.object({
        id: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
        note_type: z.enum(['text', 'link', 'idea', 'snippet']).optional(),
        is_pinned: z.boolean().optional(),
        category_names: z.array(z.string()).optional(),
        source_url: z.string().optional(),
      }),
    },
    async (args) => {
      const { id, title, content, note_type, is_pinned, category_names, source_url } = args as {
        id: string; title?: string; content?: string; note_type?: string; is_pinned?: boolean; category_names?: string[]; source_url?: string;
      };

      const patch: Record<string, string | boolean | null | undefined> = {};
      if (title !== undefined) patch.title = title;
      if (content !== undefined) patch.content_body = content;
      if (note_type !== undefined) patch.note_type = note_type;
      if (is_pinned !== undefined) patch.is_pinned = is_pinned;
      if (source_url !== undefined) patch.source_url = source_url;

      if (Object.keys(patch).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (sb.from('brain_notes').update(patch as any).eq('id', id).eq('user_id', userId));
        if (error) return simpleResult(`Gagal update: ${error.message}`);
      }

      if (category_names !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (sb.from('item_categories' as any).delete().eq('item_id', id).eq('item_type', 'brain_note') as any);
        for (const name of category_names) {
          const catId = await ensureCategory(sb, userId, name);
          if (catId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (sb.from('item_categories' as any).insert({ item_id: id, item_type: 'brain_note', category_id: catId }) as any);
          }
        }
      }

      return simpleResult(`✅ Catatan "${title || id}" diperbarui.`);
    }
  );

  server.registerTool(
    'list_categories',
    {
      description: 'Lihat semua kategori dan jumlah catatannya.',
      inputSchema: z.object({}),
    },
    async () => {
      const { data: cats } = await sb.from('categories').select('id, name, color, icon').eq('user_id', userId).eq('is_deleted', false).order('name');
      if (!cats || cats.length === 0) return simpleResult('Belum ada kategori. Buat lewat Knowledge Hub.');

      const result: string[] = [];
      for (const cat of cats) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count } = await (sb.from('item_categories' as any).select('*', { count: 'exact', head: true }).eq('category_id', cat.id).eq('item_type', 'brain_note') as any);
        result.push(`${cat.icon || '📁'} ${cat.name} (${count || 0} catatan)`);
      }

      return simpleResult(`📂 ${cats.length} kategori:\n${result.join('\n')}`);
    }
  );

  server.registerTool(
    'get_notes_by_category',
    {
      description: 'Ambil semua catatan dalam satu kategori.',
      inputSchema: z.object({
        category: z.string(),
        limit: z.number().default(20),
      }),
    },
    async (args) => {
      const { category, limit } = args as { category: string; limit: number };
      const { data: cat } = await sb.from('categories').select('id').eq('name', category).eq('user_id', userId).maybeSingle();
      if (!cat) return simpleResult(`Kategori "${category}" tidak ditemukan.`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: junction } = await (sb.from('item_categories' as any).select('item_id').eq('category_id', cat.id).eq('item_type', 'brain_note').limit(limit) as any);
      if (!junction || junction.length === 0) return simpleResult(`Kategori "${category}" kosong.`);

      const noteIds = (junction as Array<{ item_id: string }>).map((j) => j.item_id);
      const { data: notes } = await sb.from('brain_notes').select(NOTE_SELECT).in('id', noteIds).eq('user_id', userId).eq('is_deleted', false).order('updated_at', { ascending: false });

      const results = (notes ?? []).map(formatNote);
      return simpleResult(`📂 "${category}" (${results.length}):\n\n${results.join('\n---\n')}`);
    }
  );

  return server;
}

// ─── HELPERS ──────────────────────────────────────────────────────

function simpleResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function formatNote(note: Record<string, unknown>): string {
  const preview = stripNoteContent(String(note.content_body || ''));
  const snippet = preview.length > 120 ? preview.slice(0, 120) + '...' : preview;
  return [
    `📝 ${note.title} ${note.is_pinned ? '📌' : ''}`,
    `ID: ${note.id} | ${note.note_type || 'text'}`,
    `Snippet: ${snippet || '(kosong)'}`,
    note.source_url ? `🔗 ${note.source_url}` : null,
    `Diperbarui: ${note.updated_at}`,
  ].filter(Boolean).join('\n');
}

async function getNoteCategories(sb: Sb, noteId: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb.from('item_categories' as any).select('category_id').eq('item_id', noteId).eq('item_type', 'brain_note') as any);
  if (!data || data.length === 0) return '';
  const catIds = (data as Array<{ category_id: string }>).map((d) => d.category_id);
  const { data: cats } = await sb.from('categories').select('name').in('id', catIds);
  return (cats ?? []).map((c) => c.name).join(', ');
}

async function ensureCategory(sb: Sb, userId: string, name: string): Promise<string | null> {
  name = name.trim();
  if (!name) return null;

  const { data: existing } = await sb.from('categories').select('id').eq('name', name).eq('user_id', userId).eq('is_deleted', false).maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await sb
    .from('categories')
    .insert({ user_id: userId, name, contextual_role: 'general' })
    .select('id')
    .single();

  if (error || !created) return null;
  return created.id;
}
