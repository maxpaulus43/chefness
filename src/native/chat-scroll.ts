export const CHAT_BOTTOM_THRESHOLD = 72;

export function isNearChatBottom(
  contentHeight: number,
  viewportHeight: number,
  offsetY: number,
  threshold = CHAT_BOTTOM_THRESHOLD,
) {
  return contentHeight - viewportHeight - offsetY <= threshold;
}
