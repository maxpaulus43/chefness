import { useEffect, type PropsWithChildren } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type ColorValue,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/theme";
import { useAccessibilityPreferences } from "@/native/accessibility";
import { haptics, type HapticName } from "@/native/haptics";
import { popIn, springs } from "@/native/motion";
import {
  celebrationParticles,
  type CelebrationParticle,
} from "@/native/motion-timing";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. Slightly smaller values suit larger surfaces. */
  scaleTo?: number;
  /** Haptic played on press. Pass `null` to keep a control silent. */
  haptic?: HapticName | null;
}

/**
 * A Pressable that physically responds to touch: it shrinks with a snappy
 * spring on press-down and bounces back on release, with an optional haptic.
 */
export function PressableScale({
  style,
  scaleTo = 0.96,
  haptic = "tap",
  onPressIn,
  onPressOut,
  onPress,
  ...props
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => {
        scale.set(withSpring(scaleTo, springs.snappy));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, springs.bouncy));
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic) haptics[haptic]();
        onPress?.(event);
      }}
      style={[style, animatedStyle]}
    />
  );
}

/** Wraps content that should spring into view when it mounts. */
export function Pop({
  children,
  style,
  delay = 0,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle>; delay?: number }>) {
  return (
    <Animated.View entering={popIn().delay(delay)} style={style}>
      {children}
    </Animated.View>
  );
}

/** Gentle, continuous float for hero and empty-state illustrations. */
export function Breathe({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { reduceMotion } = useAccessibilityPreferences();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    progress.set(
      withRepeat(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -5 * progress.get() },
      { scale: 1 + 0.035 * progress.get() },
    ],
  }));
  return (
    <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
  );
}

/** Three softly bouncing dots shown while the assistant is thinking. */
export function TypingDots({
  color = colors.saffronDeep,
  label = "Thinking",
}: {
  color?: ColorValue;
  label?: string;
}) {
  const { reduceMotion } = useAccessibilityPreferences();
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={styles.dots}
    >
      {[0, 1, 2].map((index) => (
        <Dot key={index} index={index} color={color} animate={!reduceMotion} />
      ))}
    </View>
  );
}

function Dot({
  index,
  color,
  animate,
}: {
  index: number;
  color: ColorValue;
  animate: boolean;
}) {
  const offset = useSharedValue(0);
  useEffect(() => {
    if (!animate) return;
    offset.set(
      withDelay(
        index * 150,
        withRepeat(
          withSequence(
            withTiming(-6, { duration: 280, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 280, easing: Easing.in(Easing.quad) }),
            withTiming(0, { duration: 340 }),
          ),
          -1,
          false,
        ),
      ),
    );
    return () => cancelAnimation(offset);
  }, [animate, index, offset]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + (-offset.get() / 6) * 0.55,
    transform: [{ translateY: offset.get() }],
  }));
  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: color }, animatedStyle]}
    />
  );
}

const celebrationColors = [
  colors.saffron,
  colors.rose,
  colors.success,
  colors.saffronDeep,
] as const;

/**
 * A brief confetti burst centred on its parent. Increment `burst` to fire it
 * again; it renders nothing until the first burst and never blocks touches.
 */
export function Celebration({ burst }: { burst: number }) {
  const { reduceMotion } = useAccessibilityPreferences();
  if (burst <= 0 || reduceMotion) return null;
  const particles = celebrationParticles(14, burst);
  return (
    <View pointerEvents="none" style={styles.celebration}>
      {particles.map((particle, index) => (
        <Particle key={`${burst}-${index}`} particle={particle} />
      ))}
    </View>
  );
}

function Particle({ particle }: { particle: CelebrationParticle }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(
      withDelay(
        particle.delay,
        withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) }),
      ),
    );
  }, [particle.delay, progress]);
  const animatedStyle = useAnimatedStyle(() => {
    const t = progress.get();
    const x = Math.cos(particle.angle) * particle.distance * t;
    // A little gravity so particles arc rather than fly straight.
    const y = Math.sin(particle.angle) * particle.distance * t + 64 * t * t;
    return {
      opacity: t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / 0.45),
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${particle.rotation * t}deg` },
        { scale: 1 - 0.35 * t },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: particle.size,
          height: particle.size,
          borderRadius: particle.colorIndex % 2 ? particle.size / 2 : 2,
          backgroundColor: celebrationColors[particle.colorIndex],
        },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 23,
    paddingHorizontal: 2,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  celebration: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  particle: { position: "absolute" },
});
