/**
 * Breakpoint constants aligned with Tailwind CSS defaults.
 * Use these for JavaScript-based responsive logic to stay consistent with CSS media queries.
 */
export const BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export const MOBILE_BREAKPOINT = BREAKPOINTS.md;
