import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MenuView, type MenuAction } from "@react-native-menu/menu";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { haptics } from "@/native/haptics";
import { springs } from "@/native/motion";
import { nativeColors as colors, nativeFonts } from "@/native/theme";

export function LongPressMenu({
  children,
  menuActions,
  onMenuAction,
}: PropsWithChildren<{
  menuActions: MenuAction[];
  onMenuAction: (id: string) => void;
}>) {
  return (
    <MenuView
      style={styles.menu}
      actions={menuActions}
      shouldOpenOnLongPress
      onPressAction={({ nativeEvent }) => onMenuAction(nativeEvent.event)}
    >
      {children}
    </MenuView>
  );
}

export function MenuButton({
  menuActions,
  onMenuAction,
}: {
  menuActions: MenuAction[];
  onMenuAction: (id: string) => void;
}) {
  return (
    <MenuView
      actions={menuActions}
      onPressAction={({ nativeEvent }) => onMenuAction(nativeEvent.event)}
      shouldOpenOnLongPress={false}
    >
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel="More actions"
        accessibilityHint="Opens the same actions available by long pressing"
        style={styles.menuButton}
      >
        <Ionicons
          accessible={false}
          name="ellipsis-horizontal"
          size={22}
          color={colors.stone600}
        />
      </View>
    </MenuView>
  );
}

export function SwipeActionRow({
  children,
  onDelete,
}: PropsWithChildren<{ onDelete: () => void }>) {
  return (
    <Swipeable
      overshootRight={false}
      rightThreshold={44}
      renderRightActions={(_progress, _drag, swipeable) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete"
          style={({ pressed }) => [styles.deleteAction, pressed && styles.dim]}
          onPress={() => {
            haptics.warning();
            swipeable.close();
            onDelete();
          }}
        >
          <Ionicons
            accessible={false}
            name="trash-outline"
            size={22}
            color={colors.white}
          />
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      )}
    >
      {children}
    </Swipeable>
  );
}

export function ListInteractionRow({
  children,
  menuActions,
  onMenuAction,
  onDelete,
  onPress,
}: PropsWithChildren<{
  menuActions: MenuAction[];
  onMenuAction: (id: string) => void;
  onDelete: () => void;
  onPress?: () => void;
}>) {
  // The row settles slightly under the finger, like a physical card. The
  // press-down is delayed a touch so a scroll that starts on the row does not
  // flash it.
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onBegin(() => {
      scale.set(withDelay(70, withSpring(0.975, springs.snappy)));
    })
    .onFinalize(() => {
      scale.set(withSpring(1, springs.bouncy));
    })
    .onEnd(() => {
      haptics.tap();
      onPress?.();
    });
  const content = (
    <LongPressMenu menuActions={menuActions} onMenuAction={onMenuAction}>
      {children}
    </LongPressMenu>
  );
  return (
    <SwipeActionRow onDelete={onDelete}>
      <Animated.View style={[styles.rowContainer, pressStyle]}>
        {onPress ? (
          <GestureDetector gesture={tap}>{content}</GestureDetector>
        ) : (
          content
        )}
        <View style={styles.menuPosition}>
          <MenuButton menuActions={menuActions} onMenuAction={onMenuAction} />
        </View>
      </Animated.View>
    </SwipeActionRow>
  );
}

const styles = StyleSheet.create({
  menu: { flex: 1 },
  deleteAction: {
    width: 88,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.danger,
    borderRadius: 16,
  },
  dim: { opacity: 0.75 },
  deleteText: {
    color: colors.white,
    fontSize: 13,
    fontFamily: nativeFonts.sansBold,
  },
  rowContainer: { position: "relative" },
  menuPosition: { position: "absolute", right: 4, bottom: 4 },
  menuButton: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
