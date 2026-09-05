import type { PropsWithChildren } from "react";
import type { Entitlements } from "@/lib/entitlements";

/** The retained web app has no StoreKit and no iCloud Sync. */
const webEntitlements: Entitlements = {
  hasCloudSync: false,
  isLoading: false,
  isPurchasing: false,
  canPurchase: false,
  price: "",
  error: null,
  purchase: async () => {},
  restore: async () => {},
};

export function EntitlementsProvider({ children }: PropsWithChildren) {
  return children;
}

export function useEntitlements() {
  return webEntitlements;
}
