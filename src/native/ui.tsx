import type { PropsWithChildren, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { colors } from "@/theme";

export function ScreenHeader({ title, action }: { title: string; action?: ReactNode }) {
  return <View style={styles.header}><Text style={styles.title}>{title}</Text>{action}</View>;
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ label, onPress, variant = "primary", disabled = false }: {
  label: string; onPress: () => void; variant?: "primary" | "secondary" | "danger"; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, styles[variant], (pressed || disabled) && styles.dim]}>
    <Text style={[styles.buttonText, variant !== "primary" && styles.secondaryText]}>{label}</Text>
  </Pressable>;
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
  </Pressable>;
}

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.stone400} {...props} style={[styles.input, props.multiline && styles.multiline, props.style]} />;
}

export function Empty({ title, body }: { title: string; body: string }) {
  return <View style={styles.empty}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.muted}>{body}</Text></View>;
}

export function Loading() { return <ActivityIndicator color={colors.saffron} style={{ margin: 24 }} />; }

// eslint-disable-next-line react-refresh/only-export-components -- shared native primitives intentionally colocate their styles
export const nativeStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  scroll: { padding: 16, paddingBottom: 32, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  label: { color: colors.espresso, fontSize: 15, fontWeight: "700" },
  muted: { color: colors.stone600, lineHeight: 21 },
  error: { color: colors.danger, lineHeight: 20 },
  sectionTitle: { color: colors.espresso, fontSize: 20, fontWeight: "700", marginTop: 8 },
});

const styles = StyleSheet.create({
  header: { minHeight: 58, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.stone200, backgroundColor: colors.glassStrong },
  title: { fontSize: 27, fontWeight: "700", color: colors.espresso },
  card: { padding: 16, gap: 10, borderRadius: 16, backgroundColor: colors.glassStrong, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder, shadowColor: colors.espresso, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  button: { minHeight: 44, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, alignItems: "center", justifyContent: "center", backgroundColor: colors.saffron },
  primary: { backgroundColor: colors.saffron }, secondary: { backgroundColor: colors.saffronTint, borderWidth: 1, borderColor: colors.saffronTintBorder }, danger: { backgroundColor: colors.dangerTint, borderWidth: 1, borderColor: colors.dangerTintBorder }, dim: { opacity: 0.5 },
  buttonText: { color: colors.white, fontWeight: "700" }, secondaryText: { color: colors.espresso },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.stone300, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: colors.white },
  chipSelected: { borderColor: colors.saffron, backgroundColor: colors.saffronTint }, chipText: { color: colors.stone600 }, chipTextSelected: { color: colors.saffronDeep, fontWeight: "700" },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.stone300, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, color: colors.espresso, backgroundColor: colors.white, fontSize: 16 }, multiline: { minHeight: 88, textAlignVertical: "top" },
  empty: { alignItems: "center", padding: 32, gap: 8 }, emptyTitle: { color: colors.espresso, fontSize: 20, fontWeight: "700", textAlign: "center" }, muted: { color: colors.stone600, lineHeight: 21, textAlign: "center" },
});
