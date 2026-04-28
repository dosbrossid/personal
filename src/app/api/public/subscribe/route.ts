// ============================================================
// Route Handler: /api/public/subscribe
// POST — Capture public newsletter subscribers for future autoresponder sync.
// ============================================================

import { type NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

const NEWSLETTER_FALLBACK_BUCKET = 'vault';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getNewsletterFallbackPath(email: string) {
  const safeEmail = email.replace(/[^a-z0-9@._-]+/gi, '-').toLowerCase();
  return `_system/newsletter/${safeEmail}.json`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(String(body.email || ''));
    const fullName = String(body.full_name || '').trim();
    const sourcePath = String(body.source_path || '/').trim() || '/';
    const interest = String(body.interest || '').trim() || null;

    if (!isValidEmail(email)) {
      return Response.json({ error: 'Email tidak valid' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const notes = {
      interest,
      captured_from: 'public_blog',
      user_agent: request.headers.get('user-agent') || null,
    };

    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .upsert(
        {
          email,
          full_name: fullName || null,
          source_path: sourcePath,
          status: 'subscribed',
          notes,
          subscribed_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      )
      .select('id, email, full_name, status')
      .single();

    if (error) {
      const looksLikeMissingTable =
        /newsletter_subscribers/i.test(error.message) ||
        error.code === 'PGRST205';

      if (!looksLikeMissingTable) {
        return Response.json({ error: error.message }, { status: 400 });
      }

      const fallbackPayload = {
        email,
        full_name: fullName || null,
        source_path: sourcePath,
        status: 'subscribed',
        notes,
        subscribed_at: new Date().toISOString(),
      };

      const { error: fallbackError } = await supabase.storage
        .from(NEWSLETTER_FALLBACK_BUCKET)
        .upload(
          getNewsletterFallbackPath(email),
          new Blob([JSON.stringify(fallbackPayload, null, 2)], {
            type: 'application/json',
          }),
          {
            contentType: 'application/json',
            upsert: true,
          }
        );

      if (fallbackError) {
        return Response.json({ error: fallbackError.message }, { status: 400 });
      }

      return Response.json({
        data: {
          email,
          full_name: fullName || null,
          status: 'subscribed',
        },
        message: 'Email berhasil disimpan. Siap dipakai untuk autoresponder berikutnya.',
      });
    }

    return Response.json({
      data,
      message: 'Email berhasil disimpan. Siap dipakai untuk autoresponder berikutnya.',
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Gagal menyimpan subscriber' },
      { status: 500 }
    );
  }
}
