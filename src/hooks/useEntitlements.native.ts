import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import {
  ErrorCode,
  finishTransaction,
  getAvailablePurchases,
  restorePurchases,
  useIAP,
  type Purchase,
} from "expo-iap";
import {
  CLOUD_SYNC_FALLBACK_PRICE,
  CLOUD_SYNC_PRODUCT_ID,
  type Entitlements,
} from "@/lib/entitlements";

const EntitlementsContext = createContext<Entitlements | null>(null);

export function EntitlementsProvider({ children }: PropsWithChildren) {
  const [hasCloudSync, setHasCloudSync] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grantPurchase = (purchase: Purchase) => {
    if (purchase.productId !== CLOUD_SYNC_PRODUCT_ID) return;
    // StoreKit's current entitlement is the source of truth. The synced data
    // lives in the user's own iCloud private database, so there is no server
    // of ours that would need receipt validation.
    setHasCloudSync(true);
    setIsPurchasing(false);
    setError(null);
    void finishTransaction({ purchase, isConsumable: false }).catch(() =>
      setError(
        "iCloud Sync is unlocked, but the App Store transaction is still pending.",
      ),
    );
  };

  const { connected, products, fetchProducts, requestPurchase } = useIAP({
    onPurchaseSuccess: grantPurchase,
    onPurchaseError: (purchaseError) => {
      setIsPurchasing(false);
      if (purchaseError.code !== ErrorCode.UserCancelled)
        setError("The purchase could not be completed. Please try again.");
    },
    onError: () => setError("The App Store is unavailable. Please try again."),
  });

  useEffect(() => {
    if (!connected) return;
    let active = true;
    setIsLoading(true);
    void Promise.all([
      fetchProducts({ skus: [CLOUD_SYNC_PRODUCT_ID] }),
      getAvailablePurchases(),
    ])
      .then(([, purchases]) => {
        if (active)
          setHasCloudSync(
            purchases.some(
              (purchase) => purchase.productId === CLOUD_SYNC_PRODUCT_ID,
            ),
          );
      })
      .catch(() => {
        if (active) setError("The App Store is unavailable. Please try again.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [connected, fetchProducts]);

  const purchase = async () => {
    setIsPurchasing(true);
    setError(null);
    try {
      await requestPurchase({
        request: { apple: { sku: CLOUD_SYNC_PRODUCT_ID } },
        type: "in-app",
      });
    } catch (purchaseError) {
      setIsPurchasing(false);
      if (
        typeof purchaseError !== "object" ||
        purchaseError === null ||
        !("code" in purchaseError) ||
        purchaseError.code !== ErrorCode.UserCancelled
      )
        setError("The purchase could not be completed. Please try again.");
    }
  };

  const restore = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await restorePurchases();
      const purchases = await getAvailablePurchases();
      const restored = purchases.some(
        (purchase) => purchase.productId === CLOUD_SYNC_PRODUCT_ID,
      );
      setHasCloudSync(restored);
      if (!restored) setError("No previous iCloud Sync purchase found.");
    } catch {
      setError("Purchases could not be restored. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const product = products.find((item) => item.id === CLOUD_SYNC_PRODUCT_ID);
  const value: Entitlements = {
    hasCloudSync,
    isLoading,
    isPurchasing,
    canPurchase: connected && Boolean(product),
    price: product?.displayPrice ?? CLOUD_SYNC_FALLBACK_PRICE,
    error,
    purchase,
    restore,
  };

  return createElement(EntitlementsContext.Provider, { value }, children);
}

export function useEntitlements() {
  const value = useContext(EntitlementsContext);
  if (!value) throw new Error("useEntitlements requires EntitlementsProvider");
  return value;
}
