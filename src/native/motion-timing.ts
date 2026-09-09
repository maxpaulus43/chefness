// Pure timing helpers for native motion. Kept free of React Native imports so
// they can be unit-tested with `bun test`.

export const STAGGER_STEP_MS = 45;
export const STAGGER_MAX_ITEMS = 8;

/**
 * Delay for the n-th item of a list that is animating in. Only the first
 * screenful is staggered; items mounted later (e.g. while scrolling) appear
 * immediately so the list never looks blank.
 */
export function staggerDelay(
  index: number,
  isInitialRender: boolean,
  step = STAGGER_STEP_MS,
  maxItems = STAGGER_MAX_ITEMS,
): number {
  if (!isInitialRender || index <= 0) return 0;
  return Math.min(index, maxItems) * step;
}

export interface CelebrationParticle {
  angle: number;
  distance: number;
  size: number;
  rotation: number;
  colorIndex: number;
  delay: number;
}

// Small deterministic PRNG (mulberry32) so a burst is reproducible for a seed.
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Describes a ring of confetti-like particles bursting outward from a point.
 * Angles are spread evenly with jitter so the burst reads as round rather than
 * clumpy, and the upper half travels slightly farther for a "toss" feel.
 */
export function celebrationParticles(
  count: number,
  seed = 1,
  colorCount = 4,
): CelebrationParticle[] {
  const random = createRandom(seed);
  const particles: CelebrationParticle[] = [];
  for (let index = 0; index < count; index += 1) {
    const base = (index / count) * Math.PI * 2;
    const angle = base + (random() - 0.5) * (Math.PI / count);
    const upward = Math.sin(angle) < 0 ? 1.25 : 0.9;
    particles.push({
      angle,
      distance: (56 + random() * 40) * upward,
      size: 6 + Math.round(random() * 5),
      rotation: (random() - 0.5) * 540,
      colorIndex: index % colorCount,
      delay: Math.round(random() * 60),
    });
  }
  return particles;
}
