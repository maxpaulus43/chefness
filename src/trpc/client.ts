/**
 * In-browser tRPC client.
 *
 * Uses `unstable_localLink` so every procedure call is resolved
 * directly against the router in the same JS context — no HTTP
 * server, no fetch, no network at all.
 */
import { createTRPCClient, unstable_localLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { appRouter } from "@/trpc/router";
import type { AppRouter } from "@/trpc/router";

/** React-Query–aware tRPC hooks (e.g. `trpc.recipe.list.useQuery()`). */
export const trpc = createTRPCReact<AppRouter>();

/** Vanilla tRPC client — used to feed the React provider. */
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    unstable_localLink({
      router: appRouter,
      createContext: async () => ({}),
    }),
  ],
});
