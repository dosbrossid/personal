'use client';

import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

export function SWRProvider({ children }: { children: ReactNode }) {
    return (
        <SWRConfig
            value={{
                shouldRetryOnError: true,
                onErrorRetry: (error, _key, _config, revalidate, context) => {
                    const status = (error as Error & { status?: number }).status;

                    if (status === 401 || status === 404) {
                        return;
                    }

                    if (context.retryCount >= 2) {
                        return;
                    }

                    setTimeout(() => {
                        revalidate({ retryCount: context.retryCount + 1 });
                    }, 1500);
                },
            }}
        >
            {children}
        </SWRConfig>
    );
}
