import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { AccessibilityInfo } from "react-native";

const AccessibilityPreferencesContext = createContext({
  reduceTransparency: false,
  reduceMotion: false,
});

export function AccessibilityPreferencesProvider({
  children,
}: PropsWithChildren) {
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceTransparencyEnabled().then(
      setReduceTransparency,
    );
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const transparency = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency,
    );
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      transparency.remove();
      motion.remove();
    };
  }, []);

  return (
    <AccessibilityPreferencesContext.Provider
      value={{ reduceTransparency, reduceMotion }}
    >
      {children}
    </AccessibilityPreferencesContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- provider and its native preference hook form one boundary
export function useAccessibilityPreferences() {
  return useContext(AccessibilityPreferencesContext);
}
