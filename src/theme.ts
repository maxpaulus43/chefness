// ---------------------------------------------------------------------------
// Design tokens — shared "warm kitchen / glassmorphism" theme
// ---------------------------------------------------------------------------
//
// Derived from the Magic Patterns Chefness mockup. The whole app uses inline
// React.CSSProperties style objects (no Tailwind), so these tokens give every
// component a single source of truth for colors, fonts, shadows, and radii.
//
// Palette:
//   cream     warm off-white page background
//   espresso  near-black warm brown — primary text + dark accents
//   saffron   golden amber — primary/active accent (replaces the old blue)
//   rose      dusty pink — destructive / "remove" accents
//   stone*    warm neutral grays for muted text & borders

export const colors = {
  cream: "#FAF7F2",
  creamDeep: "#F5F1EA",
  espresso: "#2A1F1A",
  saffron: "#C8923B",
  saffronDeep: "#B07F2E",
  rose: "#E8C4C4",
  roseText: "#9B5C5C",

  // Warm neutral scale (Tailwind "stone"-ish, tuned warmer)
  stone900: "#2A1F1A",
  stone700: "#4A3F38",
  stone600: "#6B5F56",
  stone500: "#8A7E74",
  stone400: "#A99E94",
  stone300: "#D4CCC4",
  stone200: "#E4DDD5",

  // Translucent surfaces for the "glass" card look
  glass: "rgba(255, 255, 255, 0.8)",
  glassStrong: "rgba(255, 255, 255, 0.9)",
  glassBorder: "rgba(120, 100, 80, 0.14)",

  // Tinted accent fills
  saffronTint: "rgba(200, 146, 59, 0.12)",
  saffronTintBorder: "rgba(200, 146, 59, 0.28)",
  roseTint: "rgba(232, 196, 196, 0.28)",
  roseTintBorder: "rgba(232, 196, 196, 0.5)",

  // Status colors (kept semantic, nudged warmer where helpful)
  success: "#3F7D4E",
  successTint: "#E9F2EA",
  successTintBorder: "#C2DCC6",
  danger: "#B5453B",
  dangerTint: "#FBEFEE",
  dangerTintBorder: "#EBC9C5",
  white: "#FFFFFF",
} as const;

export const fonts = {
  serif: "'Fraunces', Georgia, 'Times New Roman', serif",
  sans: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
} as const;

export const shadows = {
  glass:
    "0 1px 2px rgba(40, 25, 15, 0.04), 0 8px 24px -8px rgba(40, 25, 15, 0.08)",
  glassLg:
    "0 2px 4px rgba(40, 25, 15, 0.05), 0 12px 32px -12px rgba(40, 25, 15, 0.12)",
  glassXl:
    "0 4px 6px rgba(40, 25, 15, 0.06), 0 16px 40px -16px rgba(40, 25, 15, 0.15)",
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 9999,
} as const;
