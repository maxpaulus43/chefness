import { useCallback, useEffect, useRef } from "react";
import {
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  ZoomIn,
  type WithSpringConfig,
} from "react-native-reanimated";
import { staggerDelay } from "@/native/motion-timing";

// Shared spring "feel" so every interaction in the app moves the same way.
// Reanimated honours the system Reduce Motion setting for these by default.
export const springs = {
  /** Quick, controlled response for press-down feedback. */
  snappy: { damping: 18, stiffness: 320, mass: 0.7 },
  /** Calm settle for layout shifts and appearing content. */
  gentle: { damping: 22, stiffness: 170, mass: 1 },
  /** Playful overshoot for pops, toggles, and confirmations. */
  bouncy: { damping: 11, stiffness: 240, mass: 0.8 },
} satisfies Record<string, WithSpringConfig>;

/** Rows shift smoothly when siblings are inserted or removed. */
export const layoutTransition = LinearTransition.springify()
  .damping(22)
  .stiffness(190)
  .mass(0.9);

// Builders are created per call: Reanimated builder methods mutate the
// instance, so a shared constant would leak `.delay()` between callers.

/** Small elements that appear once something succeeds (checkmarks, badges). */
export const popIn = () =>
  ZoomIn.springify().damping(12).stiffness(230).mass(0.8);

/** Content that rises into place. */
export const riseIn = () =>
  FadeInDown.springify().damping(20).stiffness(190).mass(0.9);

/**
 * Returns an `entering` builder for list rows. The first screenful cascades in
 * with a short stagger; rows mounted later appear immediately.
 */
export function useStaggeredEntering() {
  const isInitialRender = useRef(true);
  useEffect(() => {
    const timeout = setTimeout(() => {
      isInitialRender.current = false;
    }, 700);
    return () => clearTimeout(timeout);
  }, []);
  return useCallback(
    (index: number) =>
      riseIn().delay(staggerDelay(index, isInitialRender.current)),
    [],
  );
}

/**
 * Animated style that "pops" (scales up then settles) whenever `selected`
 * turns on. Used for chips and toggles so a selection feels tactile.
 */
export function useSelectionPop(selected: boolean | undefined) {
  const scale = useSharedValue(1);
  const previous = useRef(selected);
  useEffect(() => {
    if (previous.current === selected) return;
    previous.current = selected;
    if (selected) {
      scale.set(
        withSequence(
          withSpring(1.09, springs.snappy),
          withSpring(1, springs.bouncy),
        ),
      );
    }
  }, [scale, selected]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
}
