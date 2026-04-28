# Backend Plan Part 2 — SWR Hooks, Actions & Blog CMS

---

## 5. SWR Hooks (Read Layer — SPA Feel)

### 5.1 SWR Fetcher Setup

```typescript
// src/lib/fetcher.ts
export const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || 'Request failed')
  }
  return res.json()
}
```

### 5.2 Hook Structure

```
src/hooks/
├── use-tasks.ts
├── use-notes.ts
├── use-habits.ts
├── use-calendar.ts
├── use-vault.ts
├── use-blog.ts
├── use-categories.ts
├── use-dashboard-stats.ts
└── use-notifications.ts
```

### 5.3 Hook Implementations

```typescript
// src/hooks/use-tasks.ts
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import type { Task } from '@/core/types'

export function useTasks(filters?: { status?: string; role?: string }) {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.role) params.set('role', filters.role)
  const query = params.toString()

  const { data, error, isLoading, mutate } = useSWR<Task[]>(
    `/api/tasks${query ? `?${query}` : ''}`,
    fetcher
  )

  return {
    tasks: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,  // ← used after Server Action mutations
  }
}

// src/hooks/use-notes.ts
export function useNotes(filters?: { type?: string; role?: string }) {
  const params = new URLSearchParams()
  if (filters?.type) params.set('type', filters.type)
  if (filters?.role) params.set('role', filters.role)
  const query = params.toString()

  const { data, error, isLoading, mutate } = useSWR<BrainNote[]>(
    `/api/notes${query ? `?${query}` : ''}`, fetcher
  )
  return { notes: data ?? [], isLoading, isError: !!error, mutate }
}

// src/hooks/use-habits.ts
export function useHabits() {
  const { data, error, isLoading, mutate } = useSWR<Habit[]>(
    '/api/habits', fetcher
  )
  return { habits: data ?? [], isLoading, isError: !!error, mutate }
}

// src/hooks/use-calendar.ts
export function useCalendarEvents(month?: string) {
  const params = month ? `?month=${month}` : ''
  const { data, error, isLoading, mutate } = useSWR<CalendarEvent[]>(
    `/api/calendar${params}`, fetcher
  )
  return { events: data ?? [], isLoading, isError: !!error, mutate }
}

// src/hooks/use-vault.ts
export function useVaultItems(filters?: { docType?: string; semester?: string; mataKuliah?: string }) {
  const params = new URLSearchParams()
  if (filters?.docType) params.set('doc_type', filters.docType)
  if (filters?.semester) params.set('semester', filters.semester)
  if (filters?.mataKuliah) params.set('mata_kuliah', filters.mataKuliah)
  const query = params.toString()

  const { data, error, isLoading, mutate } = useSWR<AcademicVaultItem[]>(
    `/api/vault${query ? `?${query}` : ''}`, fetcher
  )
  return { items: data ?? [], isLoading, isError: !!error, mutate }
}

// src/hooks/use-blog.ts
export function useBlogPosts(filters?: { status?: string }) {
  const params = filters?.status ? `?status=${filters.status}` : ''
  const { data, error, isLoading, mutate } = useSWR<BlogPost[]>(
    `/api/blog/posts${params}`, fetcher
  )
  return { posts: data ?? [], isLoading, isError: !!error, mutate }
}

export function useBlogPost(id: string) {
  const { data, error, isLoading, mutate } = useSWR<BlogPost>(
    id ? `/api/blog/posts/${id}` : null, fetcher
  )
  return { post: data, isLoading, isError: !!error, mutate }
}

export function useBlogTags() {
  const { data, error, isLoading, mutate } = useSWR<BlogTag[]>(
    '/api/blog/tags', fetcher
  )
  return { tags: data ?? [], isLoading, isError: !!error, mutate }
}

// src/hooks/use-categories.ts
export function useCategories() {
  const { data, error, isLoading, mutate } = useSWR<Category[]>(
    '/api/categories', fetcher
  )
  return { categories: data ?? [], isLoading, isError: !!error, mutate }
}

// src/hooks/use-dashboard-stats.ts
export function useDashboardStats() {
  const { data, error, isLoading } = useSWR<DashboardStats>(
    '/api/dashboard/stats', fetcher, { refreshInterval: 60000 } // refresh every 60s
  )
  return { stats: data, isLoading, isError: !!error }
}

// src/hooks/use-notifications.ts
export function useNotifications() {
  const { data, error, isLoading, mutate } = useSWR<Notification[]>(
    '/api/notifications', fetcher, { refreshInterval: 30000 }
  )
  return { notifications: data ?? [], isLoading, isError: !!error, mutate }
}
```

---

## 6. Server Actions (Write Layer — Mutations)

### 6.1 Pattern: Action + SWR mutate()

```typescript
// Example usage in a Client Component:
'use client'
import { useTasks } from '@/hooks/use-tasks'
import { createTask, deleteTask } from '@/actions/tasks.actions'
import { toast } from 'sonner'

export function TasksClient() {
  const { tasks, isLoading, mutate } = useTasks()

  async function handleCreate(formData: FormData) {
    // 1. Optimistic update
    const optimistic = { id: 'temp', title: formData.get('title'), status: 'todo', ... }
    mutate([optimistic, ...tasks], { revalidate: false })

    // 2. Server Action
    const result = await createTask(formData)

    // 3. Revalidate SWR cache with real data
    if (result.error) {
      toast.error(result.error)
      mutate() // rollback — refetch from server
    } else {
      toast.success('Task dibuat!')
      mutate() // refetch to get real ID
    }
  }

  async function handleDelete(taskId: string) {
    // Optimistic: remove from list
    mutate(tasks.filter(t => t.id !== taskId), { revalidate: false })

    const result = await deleteTask(taskId)
    if (result.error) {
      toast.error(result.error)
      mutate() // rollback
    } else {
      toast.success('Task dihapus')
    }
  }

  return <>{/* render tasks */}</>
}
```

### 6.2 Action Files

```
src/actions/
├── tasks.actions.ts
├── notes.actions.ts
├── habits.actions.ts
├── calendar.actions.ts
├── vault.actions.ts
├── blog.actions.ts
├── categories.actions.ts
└── settings.actions.ts
```

### 6.3 All Actions (Signatures)

```typescript
// ─── tasks.actions.ts ───
'use server'
export async function createTask(formData: FormData): Promise<ActionResult<Task>>
export async function updateTask(id: string, data: Partial<Task>): Promise<ActionResult<Task>>
export async function deleteTask(id: string): Promise<ActionResult<null>>
export async function toggleTaskStatus(id: string, status: TaskStatus): Promise<ActionResult<Task>>

// ─── notes.actions.ts ───
'use server'
export async function createNote(formData: FormData): Promise<ActionResult<BrainNote>>
export async function updateNote(id: string, data: Partial<BrainNote>): Promise<ActionResult<BrainNote>>
export async function deleteNote(id: string): Promise<ActionResult<null>>
export async function togglePinNote(id: string, pinned: boolean): Promise<ActionResult<null>>

// ─── habits.actions.ts ───
'use server'
export async function createHabit(formData: FormData): Promise<ActionResult<Habit>>
export async function updateHabit(id: string, data: Partial<Habit>): Promise<ActionResult<Habit>>
export async function deleteHabit(id: string): Promise<ActionResult<null>>
export async function toggleHabitLog(habitId: string, date: string): Promise<ActionResult<HabitLog>>

// ─── calendar.actions.ts ───
'use server'
export async function createEvent(formData: FormData): Promise<ActionResult<CalendarEvent>>
export async function updateEvent(id: string, data: Partial<CalendarEvent>): Promise<ActionResult<CalendarEvent>>
export async function deleteEvent(id: string): Promise<ActionResult<null>>

// ─── vault.actions.ts ───
'use server'
export async function createVaultItem(data: Partial<AcademicVaultItem>): Promise<ActionResult<AcademicVaultItem>>
export async function updateVaultItem(id: string, data: Partial<AcademicVaultItem>): Promise<ActionResult<AcademicVaultItem>>
export async function deleteVaultItem(id: string): Promise<ActionResult<null>>

// ─── categories.actions.ts ───
'use server'
export async function createCategory(formData: FormData): Promise<ActionResult<Category>>
export async function updateCategory(id: string, data: Partial<Category>): Promise<ActionResult<Category>>
export async function deleteCategory(id: string): Promise<ActionResult<null>>

// ─── settings.actions.ts ───
'use server'
export async function updateProfile(formData: FormData): Promise<ActionResult<null>>
export async function updatePreferences(prefs: Partial<UserPreferences>): Promise<ActionResult<null>>
```

### 6.4 Action Implementation Pattern

```typescript
// src/actions/tasks.actions.ts
'use server'
import { requireAuth } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import type { ActionResult, Task, TaskStatus } from '@/core/types'

export async function createTask(formData: FormData): Promise<ActionResult<Task>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    const title = formData.get('title') as string
    if (!title?.trim()) return { data: null, error: 'Title wajib diisi' }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: (formData.get('description') as string) || null,
        priority: (formData.get('priority') as string) || 'medium',
        contextual_role: (formData.get('contextual_role') as string) || 'general',
        due_date: (formData.get('due_date') as string) || null,
      })
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function deleteTask(id: string): Promise<ActionResult<null>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    const { error } = await supabase
      .from('tasks')
      .update({ is_deleted: true })
      .eq('id', id)

    if (error) return { data: null, error: error.message }
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
```

---

## 7. Blog CMS — Full Pipeline

### 7.1 Dependencies

```bash
npm i @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-link @tiptap/extension-placeholder @tiptap/extension-code-block-lowlight lowlight
```

### 7.2 Blog Components

```
src/components/modules/blog/
├── BlogEditor.tsx           # Tiptap wrapper + auto-save
├── EditorToolbar.tsx        # B, I, H1, H2, code, image, link
├── EditorSidebar.tsx        # Tags, SEO, publish settings
└── ImageUploadButton.tsx    # Upload → /api/upload/blog → insert in editor
```

### 7.3 Blog Actions (Detail)

```typescript
// src/actions/blog.actions.ts
'use server'

export async function createDraft(title: string): Promise<ActionResult<BlogPost>> {
  const user = await requireAuth()
  const supabase = await createServerClient()
  const slug = generateSlug(title || 'untitled')

  // Ensure unique slug
  const { data: existing } = await supabase
    .from('blog_posts').select('id').eq('slug', slug).single()
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug

  const { data, error } = await supabase
    .from('blog_posts')
    .insert({ user_id: user.id, title: title || 'Untitled', slug: finalSlug })
    .select().single()

  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

export async function saveDraft(input: {
  id: string; title?: string; slug?: string;
  content_json?: any; content_html?: string; content_text?: string;
  word_count?: number; reading_time_minutes?: number; excerpt?: string;
}): Promise<ActionResult<null>> {
  const user = await requireAuth()
  const supabase = await createServerClient()
  const { id, ...updateData } = input

  // Re-generate slug if title changed
  if (updateData.title) {
    const newSlug = generateSlug(updateData.title)
    const { data: collision } = await supabase
      .from('blog_posts').select('id').eq('slug', newSlug).neq('id', id).single()
    updateData.slug = collision ? `${newSlug}-${Date.now()}` : newSlug
  }

  const { error } = await supabase
    .from('blog_posts').update(updateData).eq('id', id)

  if (error) return { data: null, error: error.message }
  return { data: null, error: null }
}

export async function publishPost(id: string): Promise<ActionResult<null>> {
  const user = await requireAuth()
  const supabase = await createServerClient()

  const { error } = await supabase
    .from('blog_posts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { data: null, error: error.message }
  return { data: null, error: null }
}

export async function unpublishPost(id: string): Promise<ActionResult<null>>
export async function deletePost(id: string): Promise<ActionResult<null>>
export async function updatePostMeta(id: string, meta: object): Promise<ActionResult<null>>
export async function updatePostTags(postId: string, tagIds: string[]): Promise<ActionResult<null>>
export async function incrementViewCount(id: string): Promise<ActionResult<null>>
export async function createTag(name: string, color: string): Promise<ActionResult<BlogTag>>
export async function deleteTag(id: string): Promise<ActionResult<null>>
```

### 7.4 Editor Auto-Save Flow

```typescript
// Inside BlogEditor.tsx
useEffect(() => {
  if (!editor || !postId) return
  const interval = setInterval(async () => {
    const json = editor.getJSON()
    const html = editor.getHTML()
    const text = editor.getText()
    const wordCount = text.split(/\s+/).filter(Boolean).length

    await saveDraft({
      id: postId,
      content_json: json,
      content_html: html,
      content_text: text,
      word_count: wordCount,
      reading_time_minutes: Math.ceil(wordCount / 200),
    })
  }, 30000) // every 30 seconds

  return () => clearInterval(interval)
}, [editor, postId])
```

### 7.5 Image Upload Route

```typescript
// src/app/api/upload/blog/route.ts
export async function POST(request: NextRequest) {
  const user = await requireAuth()
  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file?.type.startsWith('image/')) {
    return Response.json({ error: 'Images only' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ error: 'Max 5MB' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const path = `blog/${user.id}/${Date.now()}-${file.name}`
  const { data, error } = await supabase.storage
    .from('blog-media').upload(path, file)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage
    .from('blog-media').getPublicUrl(data.path)

  await supabase.from('blog_media').insert({
    user_id: user.id, file_name: file.name,
    file_url: publicUrl, file_type: file.type, file_size_bytes: file.size,
  })

  return Response.json({ url: publicUrl })
}
```

---

## 8. Public Blog (SSR for SEO)

```typescript
// src/app/public-blog/[slug]/page.tsx
// SEO per halaman
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createServerClient()
  const { data: post } = await supabase
    .from('blog_posts')
    .select('title, excerpt, meta_title, meta_description, featured_image_url')
    .eq('slug', slug).eq('status', 'published').single()

  if (!post) return { title: 'Not Found' }
  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.excerpt,
    openGraph: {
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt || '',
      images: post.featured_image_url ? [post.featured_image_url] : [],
      type: 'article',
    },
  }
}
```

New routes needed:
- `src/app/public-blog/tag/[slug]/page.tsx` — Posts filtered by tag
- `src/app/public-blog/sitemap.ts` — Auto-generated sitemap
- `src/app/api/public/rss/route.ts` — RSS feed

---

## 9. Complete File Structure

```
src/
├── app/
│   ├── api/                          # Route Handlers (SWR endpoints)
│   │   ├── tasks/route.ts
│   │   ├── tasks/[id]/route.ts
│   │   ├── notes/route.ts
│   │   ├── notes/[id]/route.ts
│   │   ├── habits/route.ts
│   │   ├── habits/[id]/route.ts
│   │   ├── habits/[id]/logs/route.ts
│   │   ├── calendar/route.ts
│   │   ├── calendar/[id]/route.ts
│   │   ├── vault/route.ts
│   │   ├── vault/[id]/route.ts
│   │   ├── blog/posts/route.ts
│   │   ├── blog/posts/[id]/route.ts
│   │   ├── blog/tags/route.ts
│   │   ├── categories/route.ts
│   │   ├── dashboard/stats/route.ts
│   │   ├── notifications/route.ts
│   │   ├── upload/route.ts
│   │   ├── upload/blog/route.ts
│   │   ├── public/blog/route.ts
│   │   ├── public/blog/[slug]/route.ts
│   │   └── public/rss/route.ts
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/                  # All SPA with SWR hooks
│   │   ├── page.tsx                  # Dashboard (useDashboardStats)
│   │   ├── tasks/page.tsx            # useTasks()
│   │   ├── notes/page.tsx            # useNotes()
│   │   ├── habits/page.tsx           # useHabits()
│   │   ├── calendar/page.tsx         # useCalendarEvents()
│   │   ├── vault/page.tsx            # useVaultItems()
│   │   ├── blog/page.tsx             # useBlogPosts()
│   │   ├── blog/new/page.tsx         # Tiptap editor
│   │   ├── blog/[id]/edit/page.tsx   # Tiptap editor (edit mode)
│   │   └── settings/page.tsx
│   └── public-blog/                  # SSR for SEO
│       ├── layout.tsx
│       ├── page.tsx
│       ├── [slug]/page.tsx
│       ├── tag/[slug]/page.tsx       # NEW
│       └── sitemap.ts                # NEW
├── actions/                          # Server Actions (mutations)
│   ├── tasks.actions.ts
│   ├── notes.actions.ts
│   ├── habits.actions.ts
│   ├── calendar.actions.ts
│   ├── vault.actions.ts
│   ├── blog.actions.ts
│   ├── categories.actions.ts
│   └── settings.actions.ts
├── hooks/                            # SWR hooks (reads)
│   ├── use-tasks.ts
│   ├── use-notes.ts
│   ├── use-habits.ts
│   ├── use-calendar.ts
│   ├── use-vault.ts
│   ├── use-blog.ts
│   ├── use-categories.ts
│   ├── use-dashboard-stats.ts
│   └── use-notifications.ts
├── lib/
│   ├── supabase/client.ts
│   ├── supabase/server.ts
│   ├── supabase/middleware.ts
│   ├── auth.ts
│   ├── fetcher.ts                    # SWR fetcher
│   └── utils.ts                      # generateSlug, etc.
├── components/modules/blog/
│   ├── BlogEditor.tsx
│   ├── EditorToolbar.tsx
│   └── EditorSidebar.tsx
├── core/
│   ├── types/index.ts                # (existing, keep)
│   ├── types/database.ts             # Generated from Supabase
│   └── constants.ts                  # (existing, keep)
└── middleware.ts                      # Auth guard + domain routing
```

---

## 10. Execution Roadmap

### Phase 1: Foundation (Day 1)
- [ ] Create Supabase project
- [ ] Run full SQL schema
- [ ] Enable RLS + triggers
- [ ] `npm i @supabase/ssr @supabase/supabase-js`
- [ ] Create `lib/supabase/*`, `lib/auth.ts`, `lib/fetcher.ts`
- [ ] Update `middleware.ts`
- [ ] `npx supabase gen types typescript > src/core/types/database.ts`
- [ ] Login page with Supabase Auth

### Phase 2: API Routes + SWR Hooks (Day 2)
- [ ] Create all Route Handlers (GET/POST/PATCH/DELETE)
- [ ] Create all SWR hooks
- [ ] Create `useDashboardStats` hook
- [ ] Test all endpoints with browser/curl

### Phase 3: Server Actions + Wire UI (Day 3-4)
- [ ] Create all Server Actions
- [ ] Wire Tasks page: replace mock → `useTasks()` + actions
- [ ] Wire Notes page: `useNotes()` + actions
- [ ] Wire Habits page: `useHabits()` + actions
- [ ] Wire Calendar page: `useCalendarEvents()` + actions
- [ ] Wire Dashboard: `useDashboardStats()`

### Phase 4: Vault + Storage (Day 5)
- [ ] Create Supabase Storage buckets
- [ ] Upload route handler (`/api/upload`)
- [ ] Wire Vault page: `useVaultItems()` + upload
- [ ] Wire Settings page

### Phase 5: Blog CMS (Day 6-7)
- [ ] Install Tiptap
- [ ] Build BlogEditor + toolbar + sidebar
- [ ] Blog image upload (`/api/upload/blog`)
- [ ] Blog actions (create, save, publish, tags)
- [ ] Wire `/blog/new` → Tiptap + auto-save
- [ ] Wire `/blog/[id]/edit` → edit mode
- [ ] Wire `/blog` list → `useBlogPosts()`

### Phase 6: Public Blog + SEO (Day 8)
- [ ] Wire `/public-blog` → Supabase SSR
- [ ] Wire `/public-blog/[slug]` → SSR + `generateMetadata`
- [ ] View count increment
- [ ] Create `/public-blog/tag/[slug]`
- [ ] Create `sitemap.ts`
- [ ] Create RSS route
- [ ] Medium-like reading progress bar

### Phase 7: Deploy (Day 9)
- [ ] Vercel deployment
- [ ] Environment variables
- [ ] Domain: zmaula.web.id → public blog
- [ ] Subdomain: app.zmaula.web.id → dashboard
- [ ] Delete `src/lib/mock-data.ts`
- [ ] E2E testing

---

## 11. Security Checklist

- [x] `requireAuth()` di setiap Route Handler + Server Action
- [x] RLS di semua tabel (DB-level)
- [x] Soft delete (is_deleted flag)
- [x] Audit trail via PostgreSQL trigger
- [x] Input validation server-side
- [x] File upload: type + size validation
- [x] Slug uniqueness enforcement
- [x] CSRF protection (bawaan Server Actions)
- [x] Optimistic rollback on error (SWR mutate)
