import { DynamicColorIOS, Platform } from "react-native";
import { colors } from "@/theme";

function accessibleColor(light: string, highContrastLight: string) {
  if (Platform.OS !== "ios") return light;
  return DynamicColorIOS({
    light,
    dark: light,
    highContrastLight,
    highContrastDark: highContrastLight,
  });
}

export const nativeColors = {
  ...colors,
  cream: accessibleColor(colors.cream, colors.white),
  creamDeep: accessibleColor(colors.creamDeep, "#F0EAE1"),
  espresso: accessibleColor(colors.espresso, "#120C09"),
  stone700: accessibleColor(colors.stone700, "#2F2722"),
  stone600: accessibleColor(colors.stone600, "#40362F"),
  stone500: accessibleColor(colors.stone500, "#51463E"),
  stone400: accessibleColor(colors.stone400, "#65584F"),
  stone300: accessibleColor(colors.stone300, "#887A6F"),
  stone200: accessibleColor(colors.stone200, "#A99B90"),
  glassBorder: accessibleColor(colors.glassBorder, "#75675C"),
  saffronDeep: accessibleColor(colors.saffronDeep, "#79520F"),
  roseText: accessibleColor(colors.roseText, "#713B3B"),
  danger: accessibleColor(colors.danger, "#8E211A"),
  success: accessibleColor(colors.success, "#245F32"),
} as const;

export const nativeFonts = {
  sans: "Inter_400Regular",
  sansSemiBold: "Inter_600SemiBold",
  sansBold: "Inter_700Bold",
  serifBold: "Fraunces_700Bold",
} as const;
