/**
 * Shared tRPC instance.
 *
 * `allowOutsideOfServer` + `isServer: false` lets tRPC run entirely
 * inside the browser — no Node / Deno / Bun server required.
 */
import { initTRPC } from "@trpc/server";

const t = initTRPC.create({
  allowOutsideOfServer: true,
  isServer: false,
});

export const router = t.router;
export const procedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
