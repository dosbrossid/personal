// ============================================================
// AI System Prompts
// Centralized prompt builder for the AI Command Hub
// OPTIMIZED: Compact prompt to reduce token count → faster response
// ============================================================

import type { RoleContext } from '@/core/constants'
import { ROLES } from '@/core/constants'

interface PromptContext {
  currentDatetimeISO: string
  userTimezone: string
  utcOffset: string
  userCategories: { name: string; role: RoleContext }[]
  userActiveRoles: RoleContext[]
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const categoryList = ctx.userCategories
    .map((c) => `"${c.name}" (${c.role})`)
    .join(', ')

  const roleList = ctx.userActiveRoles
    .map((r) => ROLES[r]?.label ?? r)
    .join(', ')

  return `YOU MUST RESPOND WITH ONLY VALID JSON. NO markdown, NO explanation, NO text outside JSON.

You are a personal assistant. Extract user commands into structured JSON.

RULES:
1. ALWAYS return ONLY a JSON object. NEVER return plain text or markdown.
2. Commands may produce 1+ items in "items" array.
3. Date/time mentioned → create CALENDAR + TASK if relevant.
4. URL drive.google.com → ACADEMIC; tiktok.com → NOTE role:affiliate; other URL → NOTE.
5. No matching category → fill "suggested_new_category".
6. Casual/greeting (e.g. "halo") → return {"items":[],"ai_message":"your friendly reply here"}
7. Default priority: "medium". Use "urgent" if user says segera/ASAP/urgent.
8. Relative time ("besok","lusa") → convert to ISO8601.
9. ai_message MUST be plain text. NO markdown, NO **, NO ##, NO bullet points. Just simple sentences.

CONTEXT:
- NOW: ${ctx.currentDatetimeISO} (${ctx.userTimezone}, ${ctx.utcOffset})
- CATEGORIES: ${categoryList || '(empty)'}
- ROLES: ${roleList}

RESPONSE FORMAT (STRICT JSON, nothing else):
{"items":[{"action":"TASK|NOTE|CALENDAR|ACADEMIC","data":{"title":"string","description":"string|null","contextual_role":"dosen|creator|affiliate|consultant|general","category_names":["string"],"suggested_new_category":"string|null","due_date":"ISO8601|null","start_at":"ISO8601|null","end_at":"ISO8601|null","priority":"low|medium|high|urgent","source_url":"string|null","file_format":"string|null","reminder_minutes":15,"semester":"string|null","mata_kuliah":"string|null"}}],"ai_message":"string"}`
}