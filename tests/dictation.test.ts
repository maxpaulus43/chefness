import { afterEach, expect, jest, test } from "bun:test";
import {
  createDictationTimeout,
  mergeDictation,
} from "../src/native/dictation";

afterEach(() => jest.useRealTimers());

test("dictation allows ten seconds of inactivity and resets on speech", () => {
  jest.useFakeTimers();
  let stops = 0;
  const timeout = createDictationTimeout(() => stops++);
  timeout.reset();
  jest.advanceTimersByTime(9_000);
  expect(stops).toBe(0);
  timeout.reset();
  jest.advanceTimersByTime(9_999);
  expect(stops).toBe(0);
  jest.advanceTimersByTime(1);
  expect(stops).toBe(1);
  timeout.reset();
  timeout.clear();
  jest.advanceTimersByTime(10_000);
  expect(stops).toBe(1);
});

test("dictation preserves an existing draft and replaces interim speech", () => {
  expect(mergeDictation("Use the leftovers", "to make soup")).toBe(
    "Use the leftovers to make soup",
  );
  expect(mergeDictation("", "  Make pasta. ")).toBe("Make pasta.");
  const afterPause = mergeDictation("Use the leftovers", "to make soup.");
  expect(mergeDictation(afterPause, " Add carrots.")).toBe(
    "Use the leftovers to make soup. Add carrots.",
  );
});
