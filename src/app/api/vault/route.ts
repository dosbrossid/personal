// ============================================================
// Route Handler: /api/vault
// GET  — List academic vault items (SWR endpoint)
// POST — Create vault item
// ============================================================

import { type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

// GET /api/vault?doc_type=rps&semester=Genap+2025/2026&mata_kuliah=xxx
export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const supabase = await createServerClient()
    const { searchParams } = request.nextUrl

    let query = supabase
      .from('academic_vault_items')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    const docType = searchParams.get('doc_type')
    if (docType) query = query.eq('document_type', docType)

    const semester = searchParams.get('semester')
    if (semester) query = query.eq('semester', semester)

    const mataKuliah = searchParams.get('mata_kuliah')
    if (mataKuliah) query = query.ilike('mata_kuliah', `%${mataKuliah}%`)

    const { data, error } = await query

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json(data)
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/vault
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const body = await request.json()

    if (!body.title?.trim()) {
      return Response.json({ error: 'Title wajib diisi' }, { status: 400 })
    }
    if (!body.document_type) {
      return Response.json({ error: 'Tipe dokumen wajib diisi' }, { status: 400 })
    }
    if (!body.file_url && !body.gdrive_id) {
      return Response.json({ error: 'File URL atau Google Drive ID wajib diisi' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('academic_vault_items')
      .insert({
        user_id: user.id,
        title: body.title.trim(),
        description: body.description || null,
        document_type: body.document_type,
        file_format: body.file_format || 'pdf',
        file_url: body.file_url || '',
        gdrive_id: body.gdrive_id || null,
        file_size_bytes: body.file_size_bytes || null,
        semester: body.semester || null,
        mata_kuliah: body.mata_kuliah || null,
      })
      .select()
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    return Response.json(data, { status: 201 })
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
