import { expect, test } from "bun:test";
import { mergeDictation } from "../src/native/dictation";

test("dictation preserves an existing draft and replaces interim speech", () => {
  expect(mergeDictation("Use the leftovers", "to make soup")).toBe(
    "Use the leftovers to make soup",
  );
  expect(mergeDictation("", "  Make pasta. ")).toBe("Make pasta.");
});
