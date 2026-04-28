// ============================================================
// Server Actions: Academic Vault
// Handles: create, update, delete vault items
// ============================================================

'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { requireAuth } from '@/lib/auth'
import type { ActionResult, AcademicVaultItem } from '@/core/types'

const VAULT_BUCKET = 'vault'
const MAX_VAULT_FILE_SIZE = 50 * 1024 * 1024
const ALLOWED_VAULT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'])
const ALLOWED_VAULT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

function getFileExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() || ''
}

function getTitleFromFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').trim() || fileName
}

function sanitizeStorageFileName(fileName: string) {
  const extension = getFileExtension(fileName)
  const baseName = getTitleFromFileName(fileName)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'document'

  return extension ? `${baseName}.${extension}` : baseName
}

function validateVaultFile(file: File) {
  const extension = getFileExtension(file.name)

  if (!ALLOWED_VAULT_EXTENSIONS.has(extension)) {
    return `Format file "${file.name}" belum didukung. Gunakan PDF, DOCX, PPTX, atau XLSX.`
  }

  if (file.type && !ALLOWED_VAULT_MIME_TYPES.has(file.type)) {
    return `Tipe file "${file.name}" tidak valid untuk Academic Vault.`
  }

  if (file.size > MAX_VAULT_FILE_SIZE) {
    return `File "${file.name}" terlalu besar. Maksimal 50MB.`
  }

  return null
}

/**
 * Create a new vault item
 */
export async function createVaultItem(data: {
  title: string
  description?: string
  document_type: string
  file_format?: string
  file_url: string
  gdrive_id?: string | null
  file_size_bytes?: number | null
  semester?: string | null
  mata_kuliah?: string | null
}): Promise<ActionResult<AcademicVaultItem>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()

    if (!data.title?.trim()) {
      return { data: null, error: 'Title wajib diisi' }
    }
    if (!data.document_type) {
      return { data: null, error: 'Tipe dokumen wajib diisi' }
    }

    const { data: item, error } = await supabase
      .from('academic_vault_items')
      .insert({
        user_id: user.id,
        title: data.title.trim(),
        description: data.description || null,
        document_type: data.document_type,
        file_format: data.file_format || 'pdf',
        file_url: data.file_url,
        gdrive_id: data.gdrive_id || null,
        file_size_bytes: data.file_size_bytes || null,
        semester: data.semester || null,
        mata_kuliah: data.mata_kuliah || null,
      })
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    return { data: item as AcademicVaultItem, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Upload one or more files to Supabase Storage and create vault records.
 */
export async function uploadVaultDocuments(formData: FormData): Promise<ActionResult<AcademicVaultItem[]>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const storageAdmin = createServiceRoleClient()
    const files = formData
      .getAll('files')
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)

    if (files.length === 0) {
      return { data: null, error: 'Pilih minimal satu file untuk diupload' }
    }

    const documentType = String(formData.get('document_type') || 'materi_ajar')
    const semester = String(formData.get('semester') || '').trim() || null
    const mataKuliah = String(formData.get('mata_kuliah') || '').trim() || null
    const uploadedItems: AcademicVaultItem[] = []

    for (const file of files) {
      const validationError = validateVaultFile(file)
      if (validationError) {
        return { data: null, error: validationError }
      }

      const extension = getFileExtension(file.name)
      const storagePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}-${sanitizeStorageFileName(file.name)}`

      const { error: uploadError } = await storageAdmin.storage
        .from(VAULT_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type || undefined,
          upsert: false,
        })

      if (uploadError) {
        return { data: null, error: `Gagal upload "${file.name}": ${uploadError.message}` }
      }

      const { data: item, error: insertError } = await supabase
        .from('academic_vault_items')
        .insert({
          user_id: user.id,
          title: getTitleFromFileName(file.name),
          description: null,
          document_type: documentType,
          file_format: extension,
          file_url: storagePath,
          gdrive_id: null,
          file_size_bytes: file.size,
          semester,
          mata_kuliah: mataKuliah,
        })
        .select()
        .single()

      if (insertError) {
        await storageAdmin.storage.from(VAULT_BUCKET).remove([storagePath])
        return { data: null, error: `File terupload, tapi metadata gagal disimpan: ${insertError.message}` }
      }

      uploadedItems.push(item as AcademicVaultItem)
    }

    return { data: uploadedItems, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Create a short-lived private download/share URL for a vault document.
 */
export async function createVaultDownloadUrl(id: string): Promise<ActionResult<string>> {
  try {
    const user = await requireAuth()
    const supabase = await createServerClient()
    const storageAdmin = createServiceRoleClient()

    const { data: item, error } = await supabase
      .from('academic_vault_items')
      .select('file_url, gdrive_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .single()

    if (error) return { data: null, error: error.message }
    if (!item?.file_url && !item?.gdrive_id) return { data: null, error: 'File tidak ditemukan' }

    if (item.gdrive_id) {
      return { data: `https://drive.google.com/file/d/${item.gdrive_id}/view`, error: null }
    }

    if (/^https?:\/\//.test(item.file_url)) {
      return { data: item.file_url, error: null }
    }

    const { data, error: signedUrlError } = await storageAdmin.storage
      .from(VAULT_BUCKET)
      .createSignedUrl(item.file_url, 60)

    if (signedUrlError) return { data: null, error: signedUrlError.message }
    return { data: data.signedUrl, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Update an existing vault item
 */
export async function updateVaultItem(
  id: string,
  updates: Partial<{
    title: string
    description: string | null
    document_type: string
    semester: string | null
    mata_kuliah: string | null
  }>
): Promise<ActionResult<AcademicVaultItem>> {
  try {
    await requireAuth()
    const supabase = await createServerClient()

    const { data: item, error } = await supabase
      .from('academic_vault_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    return { data: item as AcademicVaultItem, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}

/**
 * Soft delete a vault item
 */
export async function deleteVaultItem(id: string): Promise<ActionResult<null>> {
  try {
    await requireAuth()
    const supabase = await createServerClient()

    const { error } = await supabase
      .from('academic_vault_items')
      .update({ is_deleted: true })
      .eq('id', id)

    if (error) return { data: null, error: error.message }
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Terjadi kesalahan' }
  }
}
