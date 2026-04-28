// ============================================================
// Route Handler: /api/blog/media
// POST — Upload blog image to Supabase Storage and register blog_media.
// ============================================================

import { requireAuth } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/service';

const BLOG_MEDIA_BUCKET = 'blog-media';
const MAX_BLOG_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function sanitizeStorageFileName(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase() || 'png';
  const baseName = fileName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'blog-image';

  return `${baseName}.${extension}`;
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const supabase = createServiceRoleClient();
    const formData = await request.formData();
    const file = formData.get('file');
    const contextValue = formData.get('context');
    const registerBlogMediaValue = formData.get('registerBlogMedia');

    const context =
      typeof contextValue === 'string' && ['blog', 'cover', 'note'].includes(contextValue)
        ? contextValue
        : 'blog';
    const shouldRegisterBlogMedia = registerBlogMediaValue !== 'false';

    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: 'Pilih gambar yang ingin diupload' }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return Response.json({ error: 'Format gambar belum didukung. Gunakan JPG, PNG, WEBP, atau GIF.' }, { status: 400 });
    }

    if (file.size > MAX_BLOG_IMAGE_SIZE) {
      return Response.json({ error: 'Ukuran gambar terlalu besar. Maksimal 10MB.' }, { status: 400 });
    }

    const storagePath = `${user.id}/${context}/${Date.now()}-${crypto.randomUUID()}-${sanitizeStorageFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from(BLOG_MEDIA_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return Response.json({ error: uploadError.message }, { status: 400 });
    }

    const { data: publicUrlData } = supabase.storage
      .from(BLOG_MEDIA_BUCKET)
      .getPublicUrl(storagePath);

    let mediaId: string | undefined;

    if (shouldRegisterBlogMedia) {
      const { data: media, error: mediaError } = await supabase
        .from('blog_media')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_url: storagePath,
          file_type: file.type,
          file_size_bytes: file.size,
        })
        .select()
        .single();

      if (mediaError) {
        await supabase.storage.from(BLOG_MEDIA_BUCKET).remove([storagePath]);
        return Response.json({ error: mediaError.message }, { status: 400 });
      }

      mediaId = media.id;
    }

    return Response.json({
      data: {
        id: mediaId,
        storagePath,
        publicUrl: publicUrlData.publicUrl,
        mimeType: file.type,
        originalName: file.name,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return Response.json(
      { error: error instanceof Error ? error.message : 'Gagal upload gambar blog' },
      { status: 500 }
    );
  }
}
