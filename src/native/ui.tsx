import { useState, type PropsWithChildren, type ReactNode } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ColorValue,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useAccessibilityPreferences } from "@/native/accessibility";
import type { HapticName } from "@/native/haptics";
import { riseIn, useSelectionPop } from "@/native/motion";
import { Breathe, Pop, PressableScale } from "@/native/motion-views";
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

export type ButtonVariant = "primary" | "secondary" | "danger" | "success";

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  haptic = "tap",
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Haptic on press; `null` for silent buttons (e.g. cancel). */
  haptic?: HapticName | null;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const inactive = disabled || loading;
  // Crossfade only when the loading state changes after mount, so a screen
  // full of buttons does not fade in on first render.
  const [seenLoading, setSeenLoading] = useState(loading);
  const [hasToggled, setHasToggled] = useState(false);
  if (seenLoading !== loading) {
    setSeenLoading(loading);
    setHasToggled(true);
  }
  const light = variant === "primary";
  const glyph = icon ?? (variant === "success" ? "checkmark-circle" : null);
  const textColor = light
    ? colors.white
    : variant === "success"
      ? colors.success
      : variant === "danger"
        ? colors.danger
        : colors.espresso;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: inactive }}
      disabled={inactive}
      haptic={haptic}
      onPress={onPress}
      scaleTo={0.96}
      style={[
        styles.button,
        styles[variant],
        inactive && !loading && styles.dim,
      ]}
    >
      <Animated.View
        key={loading ? "loading" : "label"}
        entering={hasToggled ? FadeIn.duration(160) : undefined}
        style={styles.buttonContent}
      >
        {loading ? (
          <Loading compact color={textColor} label={label} />
        ) : (
          <>
            {glyph ? (
              variant === "success" || variant === "danger" ? (
                <Pop key={variant}>
                  <Ionicons
                    accessible={false}
                    name={glyph}
                    size={18}
                    color={textColor}
                  />
                </Pop>
              ) : (
                <Ionicons
                  accessible={false}
                  name={glyph}
                  size={18}
                  color={textColor}
                />
              )
            ) : null}
            <Text style={[styles.buttonText, { color: textColor }]}>
              {label}
            </Text>
          </>
        )}
      </Animated.View>
    </PressableScale>
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
  const pop = useSelectionPop(selected);
  return (
    <Animated.View style={pop}>
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ selected }}
        haptic="select"
        onPress={onPress}
        scaleTo={0.93}
        style={[styles.chip, selected && styles.chipSelected]}
      >
        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
          {label}
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

export function Field(props: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.stone400}
      selectionColor={colors.saffron}
      {...props}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      style={[
        styles.input,
        props.multiline && styles.multiline,
        focused && styles.inputFocused,
        props.style,
      ]}
    />
  );
}

export function Empty({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Animated.View entering={riseIn()} style={styles.empty}>
      {icon ? (
        <Breathe style={styles.emptyIcon}>
          <Ionicons
            accessible={false}
            name={icon}
            size={40}
            color={colors.saffronDeep}
          />
        </Breathe>
      ) : null}
      <Text accessibilityRole="header" style={styles.emptyTitle}>
        {title}
      </Text>
      <Text style={styles.muted}>{body}</Text>
    </Animated.View>
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
    <Animated.View
      accessible={!compact}
      accessibilityLabel={label ?? "Loading"}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      entering={compact ? undefined : FadeIn.delay(180).duration(240)}
      style={[styles.loading, !compact && styles.loadingPage]}
    >
      <ActivityIndicator accessible={false} color={color} />
      {label ? (
        <Text style={[styles.loadingText, { color }]}>{label}</Text>
      ) : null}
    </Animated.View>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- shared native primitives intentionally colocate their styles
export const nativeStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  scroll: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
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
    borderRadius: 18,
    backgroundColor: colors.glassStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    shadowColor: colors.espresso,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  opaqueSurface: {
    backgroundColor: colors.white,
    borderWidth: 1,
    shadowOpacity: 0,
  },
  button: {
    minHeight: 44,
    borderRadius: 13,
    paddingHorizontal: 15,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.saffron,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  primary: {
    backgroundColor: colors.saffron,
    shadowColor: colors.saffronDeep,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
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
  success: {
    backgroundColor: colors.successTint,
    borderWidth: 1,
    borderColor: colors.successTintBorder,
  },
  dim: { opacity: 0.5 },
  buttonText: { color: colors.white, fontFamily: nativeFonts.sansBold },
  loading: { flexDirection: "row", alignItems: "center", gap: 8 },
  loadingPage: { justifyContent: "center", margin: 24 },
  loadingText: { fontFamily: nativeFonts.sansBold },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.stone300,
    paddingHorizontal: 14,
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
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: colors.espresso,
    backgroundColor: colors.white,
    fontSize: 16,
    fontFamily: nativeFonts.sans,
  },
  inputFocused: { borderColor: colors.saffron },
  multiline: { textAlignVertical: "top" },
  empty: { alignItems: "center", padding: 32, gap: 10 },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.saffronTint,
    marginBottom: 6,
  },
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
