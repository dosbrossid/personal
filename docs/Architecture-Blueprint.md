# Architecture Blueprint v2 (Final)

> Divalidasi berdasarkan 11 prinsip `skill-coding-agent.md`. Semua gap dari audit telah ditambal.

---

## 1. Tech Stack (Hierarki yang Benar)

```
Bahasa      → TypeScript (superset JavaScript)
Runtime     → Node.js (via Vercel Serverless & Edge)
Framework   → Next.js 15 (App Router)
Library     → React 19, SWR, Zod, Shadcn UI, TailwindCSS
Database    → PostgreSQL (dikelola oleh Supabase)
Auth        → Supabase Auth (cookie-based SSR)
Storage     → Supabase Storage (untuk file PDF/DOC/JPG)
AI Service  → Opencode Go (REST API, LLM)
Deployment  → Vercel (hosting, serverless functions, edge middleware)
Messaging   → Telegram Bot API (webhook mode)
Notifikasi  → Web Push API (PWA) + Telegram Bot
```

---

## 2. Middleware Proxy Architecture

### 2.1 Mengapa Middleware sebagai Proxy?
1. **API Key Protection:** Key Opencode Go dan Supabase Service Role TIDAK PERNAH dikirim ke browser. Middleware berjalan di Vercel Edge (server-side).
2. **Auth Session Refresh:** Cookie session Supabase di-refresh secara otomatis di setiap request melalui middleware, sehingga user tidak tiba-tiba logout.
3. **Route Protection:** Halaman dashboard dilindungi — redirect ke `/login` jika belum autentikasi.

### 2.2 Middleware Flow Diagram

```
Browser Request
      │
      ▼
┌──────────────────────────────────────┐
│         VERCEL EDGE MIDDLEWARE       │
│  File: src/middleware.ts             │
│                                      │
│  1. Baca cookie session Supabase     │
│  2. Refresh token jika hampir expired│
│  3. Cek route:                       │
│     /login → jika sudah login,       │
│              redirect ke /dashboard  │
│     /dashboard/* → jika belum login, │
│                    redirect ke /login│
│     /api/webhook/* → bypass auth     │
│                     (pakai secret)   │
│  4. Set updated cookie ke response   │
└──────────────────────────────────────┘
      │
      ▼
  Next.js App (Page / API Route)
```

### 2.3 Supabase Client Variants
Kita membutuhkan **3 varian** Supabase client untuk 3 konteks berbeda:

| Varian | File | Digunakan di | Kemampuan |
|--------|------|-------------|-----------|
| `createBrowserClient()` | `lib/supabase/client.ts` | Client Components (SWR fetcher) | Read-only via RLS |
| `createServerClient()` | `lib/supabase/server.ts` | Server Actions, Route Handlers | Read + Write via RLS + cookie |
| `createMiddlewareClient()` | `lib/supabase/middleware.ts` | Edge Middleware | Session refresh only |

---

## 3. Domain Structure (Final)

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx                  # Layout tanpa navbar
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # Layout dengan sidebar/bento + Cmd+K
│   │   ├── page.tsx                    # Home: AI Command Hub (default)
│   │   ├── vault/page.tsx              # Academic Vault
│   │   ├── tasks/page.tsx              # Task Management
│   │   ├── habits/page.tsx             # Habit Tracker
│   │   ├── calendar/page.tsx           # Calendar View
│   │   ├── notes/page.tsx              # Brain Notes (Second Brain)
│   │   └── settings/page.tsx           # Preferensi, Telegram linking
│   ├── api/
│   │   ├── webhook/
│   │   │   └── telegram/route.ts       # POST: Telegram webhook handler
│   │   ├── cron/
│   │   │   └── notifications/route.ts  # GET: Cron job kirim notifikasi
│   │   └── debug/
│   │       └── opencode-check/route.ts # GET: Debug route API check
│   └── layout.tsx                      # Root layout (fonts, metadata)
│
├── components/
│   ├── ui/                             # Shadcn UI primitives (button, dialog, dll)
│   ├── shared/
│   │   ├── CommandHub.tsx              # AI chat interface
│   │   ├── CommandPalette.tsx          # Cmd+K global search
│   │   ├── DraftPreview.tsx            # Preview saran AI sebelum confirm
│   │   ├── FilterBar.tsx              # Reusable filter (waktu, role, status)
│   │   ├── FileUploader.tsx           # Upload PDF/DOC/JPG + Drive link
│   │   └── AppShell.tsx               # Bento grid layout wrapper
│   └── modules/
│       ├── vault/                      # Komponen spesifik Academic Vault
│       ├── tasks/                      # Komponen spesifik Tasks
│       ├── habits/                     # Komponen spesifik Habits
│       ├── calendar/                   # Komponen spesifik Calendar
│       └── notes/                      # Komponen spesifik Brain Notes
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # Browser client (SWR)
│   │   ├── server.ts                   # Server client (Actions)
│   │   └── middleware.ts               # Middleware client (Edge)
│   ├── ai/
│   │   ├── opencode.ts                 # API wrapper Opencode Go
│   │   ├── prompts.ts                  # System prompts tersentralisasi
│   │   └── parser.ts                   # Parse AI response → typed objects
│   ├── telegram/
│   │   ├── bot.ts                      # Telegram Bot API wrapper
│   │   └── webhook-validator.ts        # Validasi webhook signature
│   └── utils.ts                        # Formatting, date helpers
│
├── core/
│   ├── schemas/                        # Zod schemas (validasi input)
│   │   ├── brain-note.schema.ts
│   │   ├── task.schema.ts
│   │   ├── habit.schema.ts
│   │   ├── vault.schema.ts
│   │   ├── calendar.schema.ts
│   │   └── category.schema.ts
│   ├── types/                          # TypeScript type definitions
│   │   └── database.types.ts           # Auto-generated dari Supabase CLI
│   └── constants.ts                    # Enum values, role colors, dll
│
├── actions/                            # Next.js Server Actions
│   ├── ai.actions.ts                   # parseCommandDraft, executeConfirmedDraft
│   ├── notes.actions.ts                # CRUD brain notes
│   ├── vault.actions.ts                # CRUD + upload academic vault
│   ├── tasks.actions.ts                # CRUD tasks
│   ├── habits.actions.ts               # CRUD habits + check-in
│   ├── calendar.actions.ts             # CRUD calendar events
│   └── categories.actions.ts           # CRUD categories
│
├── hooks/                              # Custom React hooks (SWR wrappers)
│   ├── use-brain-notes.ts
│   ├── use-tasks.ts
│   ├── use-habits.ts
│   ├── use-vault.ts
│   ├── use-calendar.ts
│   ├── use-categories.ts
│   └── use-global-search.ts
│
├── middleware.ts                        # Vercel Edge Middleware (auth proxy)
│
└── BUG-HISTORY.md                      # Log bug terstruktur (prinsip #4)
```

---

## 4. SWR Architecture (Seamless UI/UX)

### 4.1 Hook Pattern (Standar untuk Semua Modul)

```typescript
// Contoh: hooks/use-tasks.ts
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';

interface UseTasksOptions {
  status?: 'todo' | 'in_progress' | 'done';
  role?: string;
  categoryId?: string;
  dateRange?: { from: string; to: string };
}

export function useTasks(options: UseTasksOptions = {}) {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.role) params.set('role', options.role);
  if (options.categoryId) params.set('category', options.categoryId);
  if (options.dateRange) {
    params.set('from', options.dateRange.from);
    params.set('to', options.dateRange.to);
  }

  const key = `/api/tasks?${params.toString()}`;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  });

  return { tasks: data ?? [], error, isLoading, mutate };
}
```

### 4.2 Optimistic Mutation Pattern

```typescript
// Contoh: menambah task baru (instant UI, background sync)
async function addTask(newTask: TaskInput) {
  // 1. OPTIMISTIC: langsung tampilkan di UI
  mutate(
    (current) => [...(current ?? []), { ...newTask, id: 'temp-' + Date.now() }],
    { revalidate: false }
  );

  // 2. SYNC: kirim ke server
  const result = await createTaskAction(newTask);

  if (result.error) {
    // 3. ROLLBACK: kembalikan UI ke state sebelumnya
    mutate(); // refetch dari server
    toast.error('Gagal menyimpan: ' + result.error);
  } else {
    // 4. CONFIRM: revalidate untuk dapat ID asli dari server
    mutate();
    toast.success('Task ditambahkan');
  }
}
```

### 4.3 Cross-Module Cache Invalidation
Ketika AI Hub menyimpan data yang tersebar ke beberapa modul sekaligus:

```typescript
// Setelah executeConfirmedDraft() berhasil:
import { mutate } from 'swr';

// Invalidate SEMUA cache yang mungkin terpengaruh
mutate((key) => typeof key === 'string' && key.startsWith('/api/tasks'));
mutate((key) => typeof key === 'string' && key.startsWith('/api/notes'));
mutate((key) => typeof key === 'string' && key.startsWith('/api/calendar'));
mutate((key) => typeof key === 'string' && key.startsWith('/api/categories'));
```

---

## 5. Debug Route: Opencode Go API

Wajib dibuat SEBELUM coding fitur AI Hub (prinsip #3).

```typescript
// src/app/api/debug/opencode-check/route.ts
export async function GET() {
  const tests = await Promise.allSettled([

    // Test 1: API Key valid?
    fetch(OPENCODE_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'ping' }] })
    }).then(r => ({ status: r.status, ok: r.ok })),

    // Test 2: Response format JSON konsisten?
    callOpencode('Simpan catatan: belajar React hooks')
      .then(r => ({ parseable: isValidJSON(r), raw: r })),

    // Test 3: Behavior input kosong?
    callOpencode('')
      .then(r => ({ empty_input_response: r })),

    // Test 4: Latency
    measureLatency(() => callOpencode('test')),

  ]);

  return Response.json({
    timestamp: new Date().toISOString(),
    results: tests.map((t, i) => ({
      test: ['api_key_valid', 'json_format', 'empty_input', 'latency'][i],
      status: t.status,
      value: t.status === 'fulfilled' ? t.value : t.reason?.message,
    }))
  });
}
```

---

## 6. Idempotency Strategy (Telegram Webhook)

```typescript
// src/app/api/webhook/telegram/route.ts
export async function POST(req: Request) {
  const body = await req.json();
  const messageId = body.message?.message_id;

  if (!messageId) return Response.json({ ok: true }); // Non-message update, skip

  // IDEMPOTENCY: cek apakah message ini sudah pernah diproses
  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from('ai_hub_logs')
    .select('id')
    .eq('telegram_message_id', messageId)
    .maybeSingle();

  if (existing) {
    // Sudah pernah diproses → return OK tanpa proses ulang
    return Response.json({ ok: true, skipped: true });
  }

  // Belum pernah → proses normal
  // INSERT ai_hub_logs dengan telegram_message_id ...
}
```

---

## 7. Error Handling Strategy

### 7.1 Server Action Error Contract
Semua Server Actions mengembalikan format yang sama:

```typescript
type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

// Contoh penggunaan
export async function createTask(input: unknown): Promise<ActionResult<Task>> {
  // 1. Validasi Zod
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: 'Validasi gagal: ' + parsed.error.issues[0].message };
  }

  // 2. Auth check
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Unauthorized' };

  // 3. DB Operation
  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}
```

### 7.2 Race Condition Prevention
```typescript
// Di CommandHub.tsx — cegah spam Enter
const [isSubmitting, setIsSubmitting] = useState(false);

async function handleSubmit() {
  if (isSubmitting) return; // Guard clause
  setIsSubmitting(true);
  try {
    await parseCommandDraft(input);
  } finally {
    setIsSubmitting(false);
  }
}
```

---

## 8. Notification Cron Job

Vercel Cron akan memindai `notification_queue` setiap 1 menit:

```typescript
// src/app/api/cron/notifications/route.ts
// Vercel cron config di vercel.json: { "crons": [{ "path": "/api/cron/notifications", "schedule": "* * * * *" }] }

export async function GET(req: Request) {
  // Validasi cron secret
  if (req.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createServiceClient(); // Service role, bypass RLS

  // Ambil notifikasi yang sudah waktunya
  const { data: pending } = await supabase
    .from('notification_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .limit(50);

  for (const notif of pending ?? []) {
    try {
      if (notif.channel === 'telegram') {
        await sendTelegramMessage(notif.user_id, notif.title, notif.body);
      } else if (notif.channel === 'push') {
        await sendWebPush(notif.user_id, notif.title, notif.body);
      }

      // Update status
      await supabase
        .from('notification_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', notif.id);
    } catch (err) {
      await supabase
        .from('notification_queue')
        .update({ status: 'failed', error_message: err.message })
        .eq('id', notif.id);
    }
  }

  return Response.json({ processed: pending?.length ?? 0 });
}
```

---

## 9. Checklist Prinsip #3 (Pre-Coding)

| # | Item | Status |
|---|------|--------|
| 1 | Arsitektur data — 11 tabel, relasi, enum, constraint | ✅ Di PRD v2 |
| 2 | Naming convention — snake_case DB, camelCase JS, PascalCase React | ✅ |
| 3 | Data layer boundary — Browser (read), Server (write), DB (trigger) | ✅ |
| 4 | Domain structure — Folder tree lengkap | ✅ |
| 5 | Data flow diagram — 4 skenario terpetakan | ✅ Di PRD v2 |

---

## 10. Checklist Prinsip #10 (Pre-Production)

| # | Item | Status | Lokasi |
|---|------|--------|--------|
| 1 | Atomic operations (multi-step dibungkus transaction) | ✅ | Supabase RPC |
| 2 | Idempotency (endpoint yang bisa di-retry) | ✅ | Telegram webhook |
| 3 | Soft delete (is_deleted, bukan DELETE) | ✅ | Semua tabel |
| 4 | Audit trail (log perubahan data kritis) | ✅ | DB trigger |
| 5 | Input validation di server (Zod) | ✅ | Server Actions |

---

## 11. Urutan Build (Prinsip #2: Foundation First)

```
Fase 1A: Data Schema
  └─ Buat semua tabel, enum, trigger, RLS, indexes di Supabase

Fase 1B: Server Logic
  └─ Buat Supabase client variants (browser, server, middleware)
  └─ Buat Zod schemas
  └─ Buat Server Actions (CRUD semua modul)
  └─ Buat debug route Opencode Go

Fase 1C: API & Integration
  └─ Buat AI parser (Opencode Go wrapper)
  └─ Buat Telegram webhook handler
  └─ Buat Notification cron job

Fase 1D: UI
  └─ Buat AppShell (Bento Grid layout)
  └─ Buat CommandHub (AI chat interface)
  └─ Buat DraftPreview (confirm flow)
  └─ Buat halaman per modul (notes, vault, tasks, habits, calendar)
  └─ Buat FilterBar (timestamp, role, status)
  └─ Buat CommandPalette (Cmd+K search)
  └─ Polish: animasi, responsive, dark mode
```
