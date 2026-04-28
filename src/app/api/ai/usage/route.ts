import { requireAuth } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase/server';
import type { AIUsageStats } from '@/core/types';

export async function GET() {
  try {
    const user = await requireAuth();
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from('ai_hub_logs')
      .select('tokens_used, latency_ms')
      .eq('user_id', user.id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const stats = (data ?? []).reduce<AIUsageStats>(
      (acc, log) => {
        acc.totalRequests += 1;
        acc.totalTokens += log.tokens_used ?? 0;
        acc.avgLatencyMs += log.latency_ms ?? 0;
        return acc;
      },
      { totalRequests: 0, totalTokens: 0, avgLatencyMs: 0 }
    );

    if (stats.totalRequests > 0) {
      stats.avgLatencyMs = Math.round(stats.avgLatencyMs / stats.totalRequests);
    }

    return Response.json(stats);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
