import { expect, test } from "bun:test";
import { getTabBarMetrics, TAB_BAR_CONTENT_HEIGHT } from "../src/native/layout";

test("keeps the full tab row above a Home-indicator inset", () => {
  expect(getTabBarMetrics(34)).toEqual({
    height: TAB_BAR_CONTENT_HEIGHT + 34,
    paddingBottom: 34,
  });
});

test("keeps the standard tab height on a phone without a bottom inset", () => {
  expect(getTabBarMetrics(0)).toEqual({
    height: TAB_BAR_CONTENT_HEIGHT,
    paddingBottom: 0,
  });
});
