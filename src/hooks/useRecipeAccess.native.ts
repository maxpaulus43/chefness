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
  UNLIMITED_RECIPES_PRODUCT_ID,
  type RecipeAccess,
} from "@/lib/recipe-access";

const RecipeAccessContext = createContext<RecipeAccess | null>(null);

export function RecipeAccessProvider({ children }: PropsWithChildren) {
  const [hasUnlimitedRecipes, setHasUnlimitedRecipes] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grantPurchase = (purchase: Purchase) => {
    if (purchase.productId !== UNLIMITED_RECIPES_PRODUCT_ID) return;
    // ponytail: StoreKit's current entitlement is enough for this local-only
    // unlock. Add server validation if Chefness later gains user accounts.
    setHasUnlimitedRecipes(true);
    setIsPurchasing(false);
    setError(null);
    void finishTransaction({ purchase, isConsumable: false }).catch(() =>
      setError(
        "Unlimited Recipes is unlocked, but the App Store transaction is still pending.",
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
      fetchProducts({ skus: [UNLIMITED_RECIPES_PRODUCT_ID] }),
      getAvailablePurchases(),
    ])
      .then(([, purchases]) => {
        if (active)
          setHasUnlimitedRecipes(
            purchases.some(
              (purchase) => purchase.productId === UNLIMITED_RECIPES_PRODUCT_ID,
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
        request: { apple: { sku: UNLIMITED_RECIPES_PRODUCT_ID } },
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
        (purchase) => purchase.productId === UNLIMITED_RECIPES_PRODUCT_ID,
      );
      setHasUnlimitedRecipes(restored);
      if (!restored) setError("No previous Unlimited Recipes purchase found.");
    } catch {
      setError("Purchases could not be restored. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const product = products.find(
    (item) => item.id === UNLIMITED_RECIPES_PRODUCT_ID,
  );
  const value: RecipeAccess = {
    hasUnlimitedRecipes,
    isLoading,
    isPurchasing,
    canPurchase: connected && Boolean(product),
    price: product?.displayPrice ?? "$9.99",
    error,
    purchase,
    restore,
  };

  return createElement(RecipeAccessContext.Provider, { value }, children);
}

export function useRecipeAccess() {
  const value = useContext(RecipeAccessContext);
  if (!value) throw new Error("useRecipeAccess requires RecipeAccessProvider");
  return value;
}
