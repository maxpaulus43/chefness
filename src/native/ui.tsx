import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ColorValue,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useAccessibilityPreferences } from "@/native/accessibility";
import { nativeColors as colors, nativeFonts } from "@/native/theme";

export function ScreenHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  const { reduceTransparency } = useAccessibilityPreferences();
  return (
    <View style={[styles.header, reduceTransparency && styles.opaqueSurface]}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {action}
    </View>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  const { reduceTransparency } = useAccessibilityPreferences();
  return (
    <View
      style={[styles.card, reduceTransparency && styles.opaqueSurface, style]}
    >
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        (pressed || (inactive && !loading)) && styles.dim,
      ]}
    >
      {loading ? (
        <Loading
          compact
          color={variant === "primary" ? colors.white : colors.espresso}
          label={label}
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant !== "primary" && styles.secondaryText,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.stone400}
      {...props}
      style={[styles.input, props.multiline && styles.multiline, props.style]}
    />
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text accessibilityRole="header" style={styles.emptyTitle}>
        {title}
      </Text>
      <Text style={styles.muted}>{body}</Text>
    </View>
  );
}

export function Loading({
  label,
  compact = false,
  color = colors.saffronDeep,
}: {
  label?: string;
  compact?: boolean;
  color?: ColorValue;
} = {}) {
  return (
    <View
      accessible={!compact}
      accessibilityLabel={label ?? "Loading"}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={[styles.loading, !compact && styles.loadingPage]}
    >
      <ActivityIndicator accessible={false} color={color} />
      {label ? (
        <Text style={[styles.loadingText, { color }]}>{label}</Text>
      ) : null}
    </View>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- shared native primitives intentionally colocate their styles
export const nativeStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  scroll: { padding: 16, paddingBottom: 32, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  label: {
    color: colors.espresso,
    fontSize: 15,
    fontFamily: nativeFonts.sansBold,
  },
  muted: {
    color: colors.stone600,
    lineHeight: 21,
    fontFamily: nativeFonts.sans,
  },
  error: { color: colors.danger, lineHeight: 20, fontFamily: nativeFonts.sans },
  sectionTitle: {
    color: colors.espresso,
    fontSize: 20,
    fontFamily: nativeFonts.serifBold,
    marginTop: 8,
  },
});

const styles = StyleSheet.create({
  header: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stone200,
    backgroundColor: colors.glassStrong,
  },
  title: {
    flexShrink: 1,
    fontSize: 27,
    fontFamily: nativeFonts.serifBold,
    color: colors.espresso,
  },
  card: {
    padding: 16,
    gap: 10,
    borderRadius: 16,
    backgroundColor: colors.glassStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    shadowColor: colors.espresso,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  opaqueSurface: {
    backgroundColor: colors.white,
    borderWidth: 1,
    shadowOpacity: 0,
  },
  button: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.saffron,
  },
  primary: { backgroundColor: colors.saffron },
  secondary: {
    backgroundColor: colors.saffronTint,
    borderWidth: 1,
    borderColor: colors.saffronTintBorder,
  },
  danger: {
    backgroundColor: colors.dangerTint,
    borderWidth: 1,
    borderColor: colors.dangerTintBorder,
  },
  dim: { opacity: 0.5 },
  buttonText: { color: colors.white, fontFamily: nativeFonts.sansBold },
  loading: { flexDirection: "row", alignItems: "center", gap: 8 },
  loadingPage: { justifyContent: "center", margin: 24 },
  loadingText: { fontFamily: nativeFonts.sansBold },
  secondaryText: { color: colors.espresso },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.stone300,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: colors.white,
  },
  chipSelected: {
    borderWidth: 2,
    borderColor: colors.saffron,
    backgroundColor: colors.saffronTint,
  },
  chipText: { color: colors.stone600, fontFamily: nativeFonts.sans },
  chipTextSelected: {
    color: colors.saffronDeep,
    fontFamily: nativeFonts.sansBold,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.stone300,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: colors.espresso,
    backgroundColor: colors.white,
    fontSize: 16,
    fontFamily: nativeFonts.sans,
  },
  multiline: { textAlignVertical: "top" },
  empty: { alignItems: "center", padding: 32, gap: 8 },
  emptyTitle: {
    color: colors.espresso,
    fontSize: 20,
    fontFamily: nativeFonts.serifBold,
    textAlign: "center",
  },
  muted: {
    color: colors.stone600,
    lineHeight: 21,
    fontFamily: nativeFonts.sans,
    textAlign: "center",
  },
});
