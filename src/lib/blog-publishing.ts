import 'server-only';

import { createServiceRoleClient } from '@/lib/supabase/service';

export async function publishDueScheduledPosts() {
  const supabase = createServiceRoleClient();
  const nowIso = new Date().toISOString();

  const { data: duePosts, error: selectError } = await supabase
    .from('blog_posts')
    .select('id')
    .eq('status', 'draft')
    .eq('is_deleted', false)
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', nowIso)
    .limit(50);

  if (selectError) {
    throw new Error(selectError.message);
  }

  const ids = (duePosts ?? []).map((post) => post.id);
  if (ids.length === 0) {
    return { publishedCount: 0 };
  }

  const { error: updateError } = await supabase
    .from('blog_posts')
    .update({
      status: 'published',
      published_at: nowIso,
      scheduled_at: null,
      updated_at: nowIso,
    })
    .in('id', ids);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { publishedCount: ids.length };
}
