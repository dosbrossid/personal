<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

# 🤖 AI Agent SOP — Personal Dashboard Project

> **Berlaku untuk:** Claude, Gemini, ChatGPT, dan semua AI coding agent.
> **Tujuan:** Memastikan semua AI model sepemahaman saat mengerjakan project ini.
> **Prinsip utama:** Baca dulu, pahami, baru coding. JANGAN asumsi.

---

## 1. PROJECT IDENTITY

| Key         | Value                                                                                |
| ----------- | ------------------------------------------------------------------------------------ |
| **Nama**    | Personal Dashboard                                                                   |
| **Owner**   | Ziaul Maula, SE, M.Si (Dosen FEB UNSAM · Digital Marketer · Vibe Coder · Consultant) |
| **Purpose** | Multi-role productivity dashboard + public blog                                      |
| **Domain**  | `app.zmaula.web.id` (dashboard) · `zmaula.web.id` (public blog)                      |
| **Status**  | Frontend selesai (mock data), backend in progress                                    |

---

## 2. TECH STACK — WAJIB IKUTI

| Layer             | Technology             | Version | Notes                                                 |
| ----------------- | ---------------------- | ------- | ----------------------------------------------------- |
| **Framework**     | Next.js (App Router)   | 16.2.3  | ⚠️ Baca `node_modules/next/dist/docs/` SEBELUM coding |
| **UI**            | React                  | 19.2.4  | Server + Client Components                            |
| **Styling**       | TailwindCSS            | v4      | PostCSS plugin                                        |
| **UI Components** | shadcn/ui              | v4      | base-ui based                                         |
| **Database**      | Supabase (PostgreSQL)  | —       | Client only, NO ORM                                   |
| **Auth**          | Supabase Auth          | —       | Email + Google OAuth                                  |
| **Storage**       | Supabase Storage       | —       | Buckets: `vault`, `blog-media`                        |
| **State (read)**  | SWR                    | 2.4.1   | Semua dashboard reads via SWR hooks                   |
| **State (write)** | Server Actions         | —       | `'use server'` + `ActionResult<T>`                    |
| **Icons**         | lucide-react           | —       | Konsisten, jangan mix icon libraries                  |
| **Date**          | date-fns + date-fns-tz | —       | Timezone: Asia/Jakarta                                |
| **Toast**         | Sonner                 | —       | Untuk feedback setelah mutations                      |
| **Blog Editor**   | Tiptap                 | —       | Rich text, JSON + HTML output                         |
| **Deploy**        | Vercel                 | —       | Serverless functions                                  |

### DILARANG:

- ❌ Prisma, Drizzle, atau ORM apapun
- ❌ Framer Motion (sudah dihapus karena performance)
- ❌ Axios (gunakan native fetch / SWR)
- ❌ Redux, Zustand, Jotai (SWR sudah cukup untuk state)
- ❌ Menambah dependency baru tanpa izin eksplisit dari user

---

## 3. ARCHITECTURE — Hybrid SPA + SSR

```
DASHBOARD (SPA-like, seamless, no reload):
  READ  → useSWR('/api/xxx') → Route Handler → Supabase → JSON
  WRITE → Server Action → Supabase → mutate() SWR cache → optimistic UI

PUBLIC BLOG (SSR for SEO):
  READ  → Server Component → direct Supabase query → crawlable HTML
  META  → generateMetadata() → OpenGraph per post
```

### Aturan Rendering:

- **Semua page di `(dashboard)/`** = Client Component + SWR hooks
- **Semua page di `public-blog/`** = Server Component (SSR)
- **Login page** = Server Component
- **Jangan campur**: dashboard page TIDAK BOLEH pakai Server Component fetching

---

## 4. FILE STRUCTURE — HARUS DIIKUTI

```
src/
├── app/
│   ├── api/                    # Route Handlers (SWR endpoints)
│   │   ├── tasks/route.ts      # GET + POST
│   │   ├── tasks/[id]/route.ts # PATCH + DELETE
│   │   └── ... (per module)
│   ├── (auth)/login/           # Auth pages
│   ├── (dashboard)/            # Dashboard SPA pages
│   │   ├── page.tsx            # Dashboard home
│   │   ├── tasks/page.tsx
│   │   ├── notes/page.tsx
│   │   ├── habits/page.tsx
│   │   ├── calendar/page.tsx
│   │   ├── vault/page.tsx
│   │   ├── blog/page.tsx
│   │   ├── blog/new/page.tsx
│   │   ├── blog/[id]/edit/page.tsx
│   │   └── settings/page.tsx
│   └── public-blog/            # Public blog (SSR)
│       ├── page.tsx
│       ├── [slug]/page.tsx
│       ├── tag/[slug]/page.tsx
│       └── sitemap.ts
├── actions/                    # Server Actions ('use server')
│   ├── tasks.actions.ts
│   ├── notes.actions.ts
│   ├── habits.actions.ts
│   ├── calendar.actions.ts
│   ├── vault.actions.ts
│   ├── blog.actions.ts
│   ├── categories.actions.ts
│   └── settings.actions.ts
├── hooks/                      # SWR hooks (read)
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
│   ├── supabase/client.ts      # Browser client
│   ├── supabase/server.ts      # Server client
│   ├── supabase/middleware.ts   # Session refresh
│   ├── auth.ts                 # getUser(), requireAuth()
│   ├── fetcher.ts              # SWR fetcher function
│   ├── mock-data.ts            # ⚠️ AKAN DIHAPUS setelah backend live
│   └── utils.ts                # generateSlug, cn(), etc.
├── core/
│   ├── types/index.ts          # TypeScript types
│   ├── types/database.ts       # Auto-generated dari Supabase
│   └── constants.ts            # Enums, colors, nav items
├── components/
│   ├── ui/                     # shadcn/ui primitives
│   ├── shared/                 # Shared components (sidebar, etc.)
│   └── modules/                # Module-specific components
│       ├── dashboard/
│       └── blog/               # BlogEditor, EditorToolbar, etc.
└── middleware.ts                # Auth guard + domain routing
```

---

## 5. CODING CONVENTIONS

### Naming:

| Target     | Convention  | Contoh                                      |
| ---------- | ----------- | ------------------------------------------- |
| Files      | kebab-case  | `tasks.actions.ts`, `use-tasks.ts`          |
| Functions  | camelCase   | `createTask`, `toggleHabitLog`              |
| Components | PascalCase  | `WidgetTasks`, `BlogEditor`                 |
| DB columns | snake_case  | `user_id`, `created_at`, `is_deleted`       |
| Types      | PascalCase  | `Task`, `ActionResult<T>`                   |
| Constants  | UPPER_SNAKE | `MAX_FILE_SIZE`, `TASK_STATUSES`            |
| SWR hooks  | use-xxx     | `useTasks()`, `useBlogPosts()`              |
| Actions    | verb+noun   | `createTask`, `deleteNote`, `togglePinNote` |
| API routes | REST-like   | `GET /api/tasks`, `PATCH /api/tasks/[id]`   |

### TypeScript:

- Selalu gunakan types dari `@/core/types`
- Server Action return type: `ActionResult<T>` (sudah defined)
- Jangan `any` kecuali terpaksa — prefer `unknown` lalu narrow

### Imports:

- Gunakan path alias `@/` (sudah configured)
- Urutan: external libs → internal modules → types → styles

---

## 6. DATA FLOW PATTERNS

### 6.1 READ (SWR Hook → Route Handler → Supabase)

```typescript
// Hook (src/hooks/use-tasks.ts)
const { tasks, isLoading, mutate } = useTasks({ status: 'todo' })

// Route Handler (src/app/api/tasks/route.ts)
export async function GET(request: NextRequest) {
  const user = await requireAuth()
  const supabase = await createServerClient()
  const { data } = await supabase.from('tasks').select('*').eq('is_deleted', false)
  return Response.json(data)
}
```

### 6.2 WRITE (Server Action → Supabase → SWR mutate)

```typescript
// Action (src/actions/tasks.actions.ts)
'use server'
export async function createTask(formData: FormData): Promise<ActionResult<Task>> {
  const user = await requireAuth()
  // ... validate, insert, return result
}

// Usage in Client Component
const result = await createTask(formData)
if (result.error) {
  toast.error(result.error)
  mutate() // rollback
} else {
  toast.success('Task dibuat!')
  mutate() // refresh cache
}
```

### 6.3 OPTIMISTIC UPDATE (wajib untuk UX seamless)

```typescript
// 1. Update UI instantly
mutate(optimisticData, { revalidate: false })
// 2. Server Action
const result = await createTask(formData)
// 3. If error → rollback
if (result.error) mutate() // refetch real data
```

---

## 7. SECURITY RULES — NON-NEGOTIABLE

1. **`requireAuth()`** di SETIAP Route Handler dan Server Action — TANPA KECUALI
2. **RLS** aktif di semua tabel Supabase — DB-level protection
3. **Soft delete** — JANGAN pernah hard delete, gunakan `is_deleted = true`
4. **Input validation** di server — jangan percaya data dari client
5. **File upload**: validasi type + size di server
6. **Audit trail** otomatis via PostgreSQL trigger — jangan disable

---

## 8. BUG HANDLING PROTOCOL

### Sebelum Fix:

1. Catat bug di `BUG-HISTORY.md` dengan format terstruktur
2. Identifikasi: bug baru atau recurring pattern?
3. Kalau solusi sudah dicoba 2x gagal → MUNDUR, validasi premis

### Format Log:

```markdown
## BUG-XXX | YYYY-MM-DD | SEVERITY: Critical/High/Medium/Low
**Gejala:**
**Root Cause:**
**Fix:**
**Pelajaran:**
**Status:** OPEN / RESOLVED
```

### 6 Recurring Patterns yang WAJIB Diwaspadai:

1. **Fire-and-Forget** — UI update, DB gagal diam-diam → await + error handle
2. **Stale SWR Cache** — data tidak sinkron → selalu `mutate()` after action
3. **Client Logic Leak** — business logic di browser → pindahkan ke server
4. **Missing Rollback** — optimistic update gagal → SWR rollback pattern
5. **Race Condition** — auto-save + manual save concurrent → debounce
6. **Premature Optimization** — optimize sebelum ada masalah → profile first

---

## 9. DO'S AND DON'TS

### ✅ DO:

- Baca `node_modules/next/dist/docs/` sebelum pakai API Next.js
- Gunakan `ActionResult<T>` untuk return type Server Actions
- Gunakan SWR `mutate()` setelah setiap mutation
- Gunakan `toast.success()` / `toast.error()` dari Sonner untuk feedback
- Pertahankan semua komentar dan docstring yang existing
- Tanya atau buat planning dulu kalau diminta coding tanpa konteks
- Validasi asumsi sebelum iterasi lebih dari 2x pada pendekatan yang sama

### ❌ DON'T:

- JANGAN tambah dependency baru tanpa izin user
- JANGAN buat logic bisnis di client component
- JANGAN hard delete data apapun
- JANGAN bypass auth check
- JANGAN gunakan `getServerSideProps` / `getStaticProps` (legacy Pages Router)
- JANGAN buat API route di level yang sama dengan page.tsx
- JANGAN gunakan `localStorage` untuk data yang harus persistent
- JANGAN iterasi lebih dari 2x pada pendekatan yang sama tanpa validasi ulang arah

---

## 10. REFERENCE FILES

| File                                      | Purpose                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| `docs/Shipping-Workflow.md`               | Cara kerja owner: ship cepat, smoke test, mini sprint, dan definition of done   |
| `docs/Agent-Operating-Guide.md`           | Panduan agent untuk menangani bug, ide, UX polish, dan architecture change      |
| `PRODUCT-INBOX.md`                        | Inbox wajib untuk setiap komplain, ide, polish, dan keputusan produk dari owner |
| `docs/Backend-Plan-Part1-Architecture.md` | Backend plan: DB schema, API routes, auth                                       |
| `docs/Backend-Plan-Part2-SWR-Actions.md`  | Backend plan: SWR hooks, Server Actions, blog CMS, roadmap                      |
| `docs/PRD-Personal-Dashboard.md`          | Product Requirements Document                                                   |
| `docs/Architecture-Blueprint.md`          | Architecture blueprint                                                          |
| `BUG-HISTORY.md`                          | Bug log — catat semua bug di sini                                               |
| `src/core/types/index.ts`                 | Semua TypeScript types                                                          |
| `src/core/constants.ts`                   | Enums, role colors, nav items                                                   |
| `src/lib/mock-data.ts`                    | Mock data (⚠️ will be removed)                                                  |
| `src/middleware.ts`                       | Auth guard + domain routing                                                     |
| `package.json`                            | Dependencies — JANGAN tambah tanpa izin                                         |

---

## 11. OWNER SHIPPING WORKFLOW

Owner bekerja dengan pola **MVP → pakai nyata → temukan friction → improve bertahap**.
Agent jangan memaksa proses heavy planning, tapi wajib memberi guardrail ringan.

### Setiap ada komplain/ide dari owner:

1. Tambahkan item ringkas ke `PRODUCT-INBOX.md`.
2. Jika itu bug/regression, tambahkan juga entry ke `BUG-HISTORY.md`.
3. Klasifikasikan sebagai `Hotfix`, `UX Polish`, atau `Architecture Upgrade`.
4. Kerjakan fix terkecil yang memberi value paling nyata.
5. Jalankan verifikasi sesuai dampak.

### Agent wajib membaca:

- `docs/Shipping-Workflow.md` untuk cara kerja owner.
- `docs/Agent-Operating-Guide.md` untuk ritual update tracking, escalation, dan closeout.

### Jangan lupa:

- Sebutkan di final response apakah ada migration, env baru, dependency baru, dan apakah sudah push.
- Kalau owner hanya memberi ide dan belum minta implementasi, catat di `PRODUCT-INBOX.md` lalu beri rekomendasi prioritas.

---

## 12. COMMUNICATION STYLE

- Bicara dalam **Bahasa Indonesia** kecuali untuk code dan technical terms
- Jelaskan **KENAPA** sebelum menjelaskan **APA** yang dilakukan
- Kalau tidak yakin → katakan dengan jelas, jangan asumsi
- Kalau ada 2+ pendekatan valid → tunjukkan trade-off, biarkan user pilih
- Kalau user minta fitur baru sebelum existing stabil → pertanyakan prioritas

---

> **Ingat:** AI itu penguat. Fondasi kuat → AI memperkuat.
> Fondasi lemah → AI mempercepat ambruk.
