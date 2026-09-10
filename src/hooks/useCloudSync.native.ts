import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import {
  ErrorCode,
  finishTransaction,
  getAvailablePurchases,
  restorePurchases,
  useIAP,
  type Purchase,
} from "expo-iap";
import { ICLOUD_SYNC_PRODUCT_ID } from "@/lib/cloud-access";
import { trpc } from "@/trpc/client";

function useCloudSyncController() {
  const utils = trpc.useUtils();
  const statusQuery = trpc.cloudSync.status.useQuery(undefined, {
    refetchInterval: 2000,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revision = statusQuery.data?.revision;

  useEffect(() => {
    void utils.recipe.invalidate();
    void utils.cookingLog.invalidate();
    void utils.aiPreference.invalidate();
    void utils.chatSession.invalidate();
    void utils.settings.invalidate();
  }, [revision, utils]);

  const grantPurchase = (purchase: Purchase) => {
    if (purchase.productId !== ICLOUD_SYNC_PRODUCT_ID) return;
    setIsPurchasing(false);
    setError(null);
    // StoreKit validates local entitlements, including family-shared purchases.
    void utils.client.cloudSync.setEntitled
      .mutate(true)
      .then(() => finishTransaction({ purchase, isConsumable: false }))
      .catch(() =>
        setError(
          "The upgrade could not be finalized. Restore Purchases to try again.",
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
    void utils.client.cloudSync.probe.mutate().catch(() => {});
  }, [utils]);

  useEffect(() => {
    if (!connected) {
      setIsLoading(false);
      return;
    }
    let active = true;
    const refresh = async () => {
      try {
        const purchases = await getAvailablePurchases();
        if (!active) return;
        await utils.client.cloudSync.setEntitled.mutate(
          purchases.some((item) => item.productId === ICLOUD_SYNC_PRODUCT_ID),
        );
        await utils.client.cloudSync.run.mutate();
      } catch {
        if (active)
          setError("The App Store or iCloud is unavailable. Please try again.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    setIsLoading(true);
    void fetchProducts({ skus: [ICLOUD_SYNC_PRODUCT_ID] }).catch(() => {
      if (active) setError("The App Store is unavailable. Please try again.");
    });
    void refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    // iOS may suspend the app; resume always retries. No closed-app delivery promise.
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void refresh();
    }, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [connected, fetchProducts, utils]);

  const purchase = async () => {
    setIsPurchasing(true);
    setError(null);
    try {
      if (!(await utils.client.cloudSync.probe.mutate())) {
        setIsPurchasing(false);
        return;
      }
      await requestPurchase({
        request: { apple: { sku: ICLOUD_SYNC_PRODUCT_ID } },
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
        (item) => item.productId === ICLOUD_SYNC_PRODUCT_ID,
      );
      await utils.client.cloudSync.setEntitled.mutate(restored);
      if (!restored) setError("No previous iCloud Sync purchase found.");
    } catch {
      setError("Purchases could not be restored. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  const action = async (operation: () => Promise<void>) => {
    setError(null);
    try {
      await operation();
      await utils.cloudSync.status.invalidate();
    } catch {
      setError("Could not change iCloud Sync. Please try again.");
    }
  };
  const product = products.find((item) => item.id === ICLOUD_SYNC_PRODUCT_ID);
  return {
    status: statusQuery.data,
    isLoading,
    isPurchasing,
    canPurchase: connected && Boolean(product),
    price: product?.displayPrice ?? "$9.99",
    error: error ?? statusQuery.error?.message ?? null,
    purchase,
    restore,
    setEnabled: (value: boolean) =>
      action(() => utils.client.cloudSync.setEnabled.mutate(value)),
    syncNow: () => action(() => utils.client.cloudSync.run.mutate()),
    confirmAccount: () =>
      action(() => utils.client.cloudSync.confirmAccount.mutate()),
  };
}

const CloudSyncContext = createContext<ReturnType<
  typeof useCloudSyncController
> | null>(null);
export function CloudSyncProvider({ children }: PropsWithChildren) {
  const value = useCloudSyncController();
  return createElement(CloudSyncContext.Provider, { value }, children);
}
export function useCloudSync() {
  const value = useContext(CloudSyncContext);
  if (!value) throw new Error("useCloudSync requires CloudSyncProvider");
  return value;
}
