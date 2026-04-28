import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import type { AIUsageStats } from '@/core/types';

const defaultStats: AIUsageStats = {
  totalRequests: 0,
  totalTokens: 0,
  avgLatencyMs: 0,
};

export function useAIUsage() {
  const { data, error, isLoading, mutate } = useSWR<AIUsageStats>(
    '/api/ai/usage',
    fetcher
  );

  return {
    stats: data ?? defaultStats,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
