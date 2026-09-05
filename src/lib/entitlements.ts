/**
 * Chefness is free to use on-device. The single non-consumable purchase
 * unlocks iCloud Sync across the user's devices.
 *
 * The product identifier predates the sync feature: it was sold as
 * "Unlimited Recipes" before the recipe limit was removed. Keeping the same
 * identifier means everyone who bought the original unlock keeps their
 * entitlement (now iCloud Sync) without a second purchase.
 */
export const CLOUD_SYNC_PRODUCT_ID = "com.maxpaulus.chefness.unlimited_recipes";

export const CLOUD_SYNC_FALLBACK_PRICE = "$9.99";

export interface Entitlements {
  /** Whether the iCloud Sync purchase is owned on this Apple ID. */
  hasCloudSync: boolean;
  isLoading: boolean;
  isPurchasing: boolean;
  canPurchase: boolean;
  price: string;
  error: string | null;
  purchase: () => Promise<void>;
  restore: () => Promise<void>;
}
