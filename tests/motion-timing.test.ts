import { expect, test } from "bun:test";
import {
  celebrationParticles,
  STAGGER_MAX_ITEMS,
  STAGGER_STEP_MS,
  staggerDelay,
} from "../src/native/motion-timing";

test("list rows stagger only on the first render and cap the delay", () => {
  expect(staggerDelay(0, true)).toBe(0);
  expect(staggerDelay(3, true)).toBe(3 * STAGGER_STEP_MS);
  expect(staggerDelay(STAGGER_MAX_ITEMS + 20, true)).toBe(
    STAGGER_MAX_ITEMS * STAGGER_STEP_MS,
  );
  expect(staggerDelay(5, false)).toBe(0);
});

test("celebration bursts are deterministic and spread around the circle", () => {
  const first = celebrationParticles(14, 7);
  const second = celebrationParticles(14, 7);
  expect(first).toEqual(second);
  expect(first).toHaveLength(14);
  expect(celebrationParticles(14, 8)).not.toEqual(first);

  const angles = first.map((particle) => particle.angle);
  const sorted = [...angles].sort((a, b) => a - b);
  expect(sorted).toEqual(angles);
  expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(Math.PI);
  for (const particle of first) {
    expect(particle.size).toBeGreaterThanOrEqual(6);
    expect(particle.distance).toBeGreaterThan(0);
    expect(particle.colorIndex).toBeLessThan(4);
    expect(particle.delay).toBeGreaterThanOrEqual(0);
  }
});
