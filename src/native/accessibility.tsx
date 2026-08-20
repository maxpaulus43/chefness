import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { AccessibilityInfo } from "react-native";

const AccessibilityPreferencesContext = createContext({ reduceTransparency: false });

export function AccessibilityPreferencesProvider({ children }: PropsWithChildren) {
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    const subscription = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReduceTransparency);
    return () => subscription.remove();
  }, []);

  return <AccessibilityPreferencesContext.Provider value={{ reduceTransparency }}>{children}</AccessibilityPreferencesContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- provider and its native preference hook form one boundary
export function useAccessibilityPreferences() {
  return useContext(AccessibilityPreferencesContext);
}
