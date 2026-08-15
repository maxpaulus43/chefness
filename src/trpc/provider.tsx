import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/trpc/client";

/**
 * Wraps children with both the React-Query `QueryClientProvider`
 * and the tRPC provider so every descendant can use `trpc.*.useQuery()` etc.
 */
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Signed-in users use focus/reconnect refetches for cross-device
            // freshness without maintaining real-time Firestore listeners.
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
          },
        },
      }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
