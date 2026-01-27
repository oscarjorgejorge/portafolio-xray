'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { API } from '@/lib/constants';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: API.STALE_TIME_MS,
            refetchOnWindowFocus: false,
            retry: API.RETRY_COUNT,
          },
          mutations: {
            retry: API.RETRY_COUNT,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

