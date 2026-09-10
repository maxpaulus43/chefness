import { z } from "zod";

export const cloudSyncStatusSchema = z.object({
  entitled: z.boolean(),
  enabled: z.boolean(),
  busy: z.boolean(),
  dirty: z.boolean(),
  available: z.boolean(),
  needsAccountConfirmation: z.boolean(),
  lastSyncedAt: z.string().nullable(),
  error: z.string().nullable(),
  revision: z.number(),
});
export type CloudSyncStatus = z.infer<typeof cloudSyncStatusSchema>;
