# Backend Plan Part 1 — Architecture & Data Layer

> **Hybrid:** Dashboard = SPA + SWR (seamless) · Public Blog = SSR (SEO)
> **Stack:** Next.js 16.2 · Supabase Client Only · SWR · Vercel

---

## 1. Hybrid Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  DASHBOARD (SPA-like)                                       │
│                                                             │
│  Client Components ('use client')                           │
│    ├── useSWR('/api/tasks') ──→ Route Handler ──→ Supabase  │
│    ├── useSWR('/api/notes') ──→ Route Handler ──→ Supabase  │
│    └── onClick ──→ Server Action ──→ Supabase               │
│                       └── mutate() ──→ SWR revalidate       │
│                                                             │
│  ✓ No full page reload                                      │
│  ✓ Optimistic updates                                       │
│  ✓ Instant navigation (client-side routing)                 │
│  ✓ Real-time feel                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  PUBLIC BLOG (SSR for SEO)                                  │
│                                                             │
│  Server Components (async)                                  │
│    ├── Direct Supabase query (no API route needed)          │
│    ├── generateMetadata() for SEO                           │
│    └── View count increment via Server Action               │
│                                                             │
│  ✓ Crawlable by search engines                              │
│  ✓ Fast first paint                                         │
│  ✓ OpenGraph meta tags                                      │
└─────────────────────────────────────────────────────────────┘
```

### Kenapa Hybrid?

| Bagian | Rendering | Alasan |
|--------|-----------|--------|
| Dashboard | **Client (SPA+SWR)** | Interaktif, no reload, optimistic UI |
| Public Blog | **Server (SSR)** | SEO, meta tags, crawlable |
| Login | **Server** | Simple form, progressive enhancement |

### Data Flow Pattern

```
READ:   Client Component → useSWR('/api/xxx') → Route Handler → Supabase → JSON
WRITE:  Client Component → Server Action → Supabase → mutate() SWR cache
```

---

## 2. Database Schema (Full SQL)

```sql
-- ═══════════════════════════════════════════
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════

-- ─── USERS ───
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  telegram_chat_id TEXT,
  preferences JSONB DEFAULT '{"timezone":"Asia/Jakarta","theme":"dark","locale":"id","onboarding_completed":false}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── CATEGORIES ───
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT '📁',
  contextual_role TEXT NOT NULL CHECK (contextual_role IN ('dosen','creator','affiliate','consultant','general')),
  is_system BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── TASKS ───
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  contextual_role TEXT NOT NULL CHECK (contextual_role IN ('dosen','creator','affiliate','consultant','general')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── BRAIN NOTES ───
CREATE TABLE public.brain_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_body TEXT NOT NULL DEFAULT '',
  note_type TEXT DEFAULT 'text' CHECK (note_type IN ('text','link','idea','snippet')),
  contextual_role TEXT NOT NULL,
  attachment_url TEXT,
  attachment_type TEXT,
  attachment_size_bytes BIGINT,
  source_url TEXT,
  ai_summary TEXT,
  is_pinned BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── HABITS ───
CREATE TABLE public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  frequency TEXT DEFAULT 'daily' CHECK (frequency IN ('daily','weekly')),
  contextual_role TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(habit_id, log_date)
);

-- ─── CALENDAR EVENTS ───
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  is_all_day BOOLEAN DEFAULT false,
  reminder_minutes INT,
  contextual_role TEXT NOT NULL,
  recurrence TEXT DEFAULT 'none' CHECK (recurrence IN ('none','daily','weekly','monthly')),
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── ACADEMIC VAULT ───
CREATE TABLE public.academic_vault_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL,
  file_format TEXT NOT NULL,
  file_url TEXT NOT NULL,
  gdrive_id TEXT,
  file_size_bytes BIGINT,
  ai_summary TEXT,
  semester TEXT,
  mata_kuliah TEXT,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── BLOG ───
CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content_json JSONB,
  content_html TEXT DEFAULT '',
  content_text TEXT DEFAULT '',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public','unlisted','private')),
  featured_image_url TEXT,
  featured_image_alt TEXT,
  meta_title TEXT,
  meta_description TEXT,
  canonical_url TEXT,
  reading_time_minutes INT DEFAULT 0,
  word_count INT DEFAULT 0,
  view_count INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.blog_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  post_count INT DEFAULT 0,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.blog_post_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.blog_tags(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, tag_id)
);

CREATE TABLE public.blog_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  width INT,
  height INT,
  alt_text TEXT,
  caption TEXT,
  used_in_post_id UUID REFERENCES public.blog_posts(id),
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── NOTIFICATIONS ───
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel TEXT DEFAULT 'push',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── AUDIT LOGS ───
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══ TRIGGERS ═══

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON brain_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON habits FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON academic_vault_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON blog_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON blog_tags FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON blog_media FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Audit trail trigger
CREATE OR REPLACE FUNCTION audit_trigger_fn() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, table_name, record_id, action, old_data, new_data)
  VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    lower(TG_OP),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON tasks FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON brain_notes FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON habits FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON calendar_events FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON academic_vault_items FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON blog_posts FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

-- ═══ RLS ═══
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_vault_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Owner-only policies (apply pattern to each table)
CREATE POLICY "own_data" ON users FOR ALL USING (id = auth.uid());
CREATE POLICY "own_data" ON categories FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_data" ON tasks FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_data" ON brain_notes FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_data" ON habits FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_data" ON habit_logs FOR ALL USING (habit_id IN (SELECT id FROM habits WHERE user_id = auth.uid()));
CREATE POLICY "own_data" ON calendar_events FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_data" ON academic_vault_items FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_data" ON blog_posts FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_data" ON blog_tags FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_data" ON blog_post_tags FOR ALL USING (post_id IN (SELECT id FROM blog_posts WHERE user_id = auth.uid()));
CREATE POLICY "own_data" ON blog_media FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_data" ON notifications FOR ALL USING (user_id = auth.uid());

-- Public read for published blog
CREATE POLICY "public_read" ON blog_posts FOR SELECT
  USING (status = 'published' AND visibility = 'public' AND is_deleted = false);
CREATE POLICY "public_read_tags" ON blog_tags FOR SELECT USING (is_deleted = false);
CREATE POLICY "public_read_post_tags" ON blog_post_tags FOR SELECT
  USING (post_id IN (SELECT id FROM blog_posts WHERE status = 'published'));
```

---

## 3. API Route Handlers (for SWR)

SWR membutuhkan endpoint HTTP untuk fetch. Setiap module punya Route Handler.

### 3.1 Route Structure

```
src/app/api/
├── tasks/
│   └── route.ts           # GET (list) + POST (create)
├── tasks/[id]/
│   └── route.ts           # PATCH (update) + DELETE (soft delete)
├── notes/
│   └── route.ts           # GET + POST
├── notes/[id]/
│   └── route.ts           # PATCH + DELETE
├── habits/
│   └── route.ts           # GET + POST
├── habits/[id]/
│   └── route.ts           # PATCH + DELETE
├── habits/[id]/logs/
│   └── route.ts           # POST (toggle log)
├── calendar/
│   └── route.ts           # GET + POST
├── calendar/[id]/
│   └── route.ts           # PATCH + DELETE
├── vault/
│   └── route.ts           # GET + POST
├── vault/[id]/
│   └── route.ts           # PATCH + DELETE
├── blog/posts/
│   └── route.ts           # GET + POST
├── blog/posts/[id]/
│   └── route.ts           # PATCH + DELETE
├── blog/tags/
│   └── route.ts           # GET + POST
├── categories/
│   └── route.ts           # GET + POST
├── dashboard/stats/
│   └── route.ts           # GET (aggregated stats)
├── notifications/
│   └── route.ts           # GET
├── upload/
│   └── route.ts           # POST (vault files)
├── upload/blog/
│   └── route.ts           # POST (blog images)
├── public/blog/
│   └── route.ts           # GET (public, no auth)
├── public/blog/[slug]/
│   └── route.ts           # GET (public, no auth)
└── public/rss/
    └── route.ts           # GET (RSS feed)
```

### 3.2 Route Handler Pattern

```typescript
// src/app/api/tasks/route.ts
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

// GET /api/tasks?status=todo&role=dosen
export async function GET(request: NextRequest) {
  const user = await requireAuth()
  const supabase = await createServerClient()
  const { searchParams } = request.nextUrl

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  const status = searchParams.get('status')
  if (status) query = query.eq('status', status)

  const role = searchParams.get('role')
  if (role) query = query.eq('contextual_role', role)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

// POST /api/tasks
export async function POST(request: NextRequest) {
  const user = await requireAuth()
  const supabase = await createServerClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...body, user_id: user.id })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data, { status: 201 })
}
```

```typescript
// src/app/api/tasks/[id]/route.ts
// PATCH /api/tasks/:id
export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/tasks/[id]'>) {
  const user = await requireAuth()
  const { id } = await ctx.params
  const supabase = await createServerClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('tasks')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}

// DELETE /api/tasks/:id (soft delete)
export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/tasks/[id]'>) {
  const user = await requireAuth()
  const { id } = await ctx.params
  const supabase = await createServerClient()

  const { error } = await supabase
    .from('tasks')
    .update({ is_deleted: true })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ success: true })
}
```

### 3.3 Dashboard Stats Endpoint

```typescript
// src/app/api/dashboard/stats/route.ts
export async function GET() {
  const user = await requireAuth()
  const supabase = await createServerClient()

  const [tasks, habits, notes, events] = await Promise.all([
    supabase.from('tasks').select('id, status, priority', { count: 'exact' })
      .eq('is_deleted', false),
    supabase.from('habits').select('id, habit_logs(is_completed, log_date)')
      .eq('is_deleted', false).eq('is_active', true),
    supabase.from('brain_notes').select('id, is_pinned', { count: 'exact' })
      .eq('is_deleted', false),
    supabase.from('calendar_events').select('*')
      .eq('is_deleted', false)
      .gte('start_at', new Date().toISOString().split('T')[0]),
  ])

  return Response.json({
    activeTasks: tasks.count,
    urgentTasks: tasks.data?.filter(t => t.priority === 'urgent').length,
    habitCompletion: calcHabitStreak(habits.data),
    totalNotes: notes.count,
    pinnedNotes: notes.data?.filter(n => n.is_pinned).length,
    todayEvents: events.data?.length,
  })
}
```

---

## 4. Auth & Middleware

### 4.1 Supabase Client Files

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// src/lib/supabase/server.ts
import { createServerClient as _createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerClient() {
  const cookieStore = await cookies()
  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options))
        },
      },
    }
  )
}
```

```typescript
// src/lib/auth.ts
import { createServerClient } from '@/lib/supabase/server'

export async function getUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) throw new Error('Unauthorized')
  return user
}
```

See **Part 2** for SWR hooks, Server Actions, Blog CMS detail, and execution roadmap.
