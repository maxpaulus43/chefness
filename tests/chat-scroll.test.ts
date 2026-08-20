import { expect, test } from "bun:test";
import {
  CHAT_BOTTOM_THRESHOLD,
  isNearChatBottom,
} from "../src/native/chat-scroll";

test("chat autoscroll remains active at the bottom and within its threshold", () => {
  expect(isNearChatBottom(1200, 600, 600)).toBe(true);
  expect(isNearChatBottom(1200, 600, 600 - CHAT_BOTTOM_THRESHOLD)).toBe(true);
});

test("chat autoscroll pauses after the user moves above the bottom threshold", () => {
  expect(isNearChatBottom(1200, 600, 599 - CHAT_BOTTOM_THRESHOLD)).toBe(false);
});

test("short conversations count as being at the bottom", () => {
  expect(isNearChatBottom(400, 600, 0)).toBe(true);
});
