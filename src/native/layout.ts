export const TAB_BAR_CONTENT_HEIGHT = 62;

export function getTabBarMetrics(bottomInset: number) {
  return {
    height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
    paddingBottom: bottomInset,
  } as const;
}
