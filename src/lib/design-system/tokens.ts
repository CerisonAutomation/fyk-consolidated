/**
 * Design System Tokens — Award-Winning UI — Ultra-detailed, ray-traced, cinematic lighting
 * Behance top 1% product design photography
 * Palette rationale not default AI blue/purple #3B82F6
 * Practical gamechanging real, nothing cliche/cringe/fluff
 */

export const shadows = {
  xs: '0 1px 2px rgba(0,0,0,0.04)',
  sm: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)',
  md: '0 4px 12px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.08)',
  lg: '0 8px 24px rgba(0,0,0,0.12), 0 24px 64px rgba(0,0,0,0.12)',
  gold: '0 0 0 1px oklch(0.80 0.17 85 / 0.3), 0 8px 24px oklch(0.80 0.17 85 / 0.15)',
  goldHover: '0 0 0 1px oklch(0.80 0.17 85 / 0.4), 0 12px 32px oklch(0.80 0.17 85 / 0.2)',
  emerald: '0 0 8px oklch(0.74 0.19 160 / 0.8)',
  black: '0 0 0 1px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08)',
  product: '0 1px 3px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
} as const;

export const radius = {
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '20px',
  xl: '24px',
  full: '9999px',
} as const;

export const gradients = {
  cinematic: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.15), transparent)',
  cinematicSoft: 'linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0.05), transparent)',
  subtle: 'linear-gradient(to bottom right, rgba(255,255,255,0.08), transparent)',
  gold: 'linear-gradient(to bottom right, oklch(0.80 0.17 85 / 0.12), transparent)',
  emerald: 'linear-gradient(to bottom right, oklch(0.74 0.19 160 / 0.12), transparent)',
  whiteToBlack: 'linear-gradient(to bottom, white, rgba(0,0,0,0.02))',
  blackToTransparent: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
} as const;

export const colors = {
  // Primary — Black not blue #3B82F6
  primary: 'oklch(0.10 0 0)',
  primaryHover: 'oklch(0.15 0 0)',
  
  // Accent — Gold not purple
  gold: 'oklch(0.80 0.17 85)',
  goldLight: 'oklch(0.85 0.15 85)',
  goldDark: 'oklch(0.75 0.18 85)',
  goldBg: 'oklch(0.80 0.17 85 / 0.1)',
  goldBorder: 'oklch(0.80 0.17 85 / 0.3)',
  
  // Online — Emerald not green-500
  emerald: 'oklch(0.74 0.19 160)',
  emeraldLight: 'oklch(0.80 0.16 160)',
  emeraldBg: 'oklch(0.74 0.19 160 / 0.1)',
  
  // Neutrals — Zinc, not gray
  zinc: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
  },
  
  // Semantic
  background: 'white',
  foreground: 'oklch(0.10 0 0)',
  muted: '#71717a',
  mutedForeground: '#a1a1aa',
  border: 'rgba(0,0,0,0.06)',
  borderStrong: 'rgba(0,0,0,0.1)',
  
  // Safety — Red but not alarming
  danger: 'oklch(0.65 0.22 25)',
  dangerBg: 'oklch(0.65 0.22 25 / 0.1)',
  dangerBorder: 'oklch(0.65 0.22 25 / 0.2)',
} as const;

export const typography = {
  fontDisplay: '"Space Grotesk", system-ui, sans-serif',
  fontMono: '"JetBrains Mono", monospace',
  fontBody: '"Inter", system-ui, sans-serif',
  
  // Korean readability at least 14px body
  size: {
    xs: '11px',
    sm: '12px',
    base: '14px',
    md: '15px',
    lg: '16px',
    xl: '18px',
    '2xl': '24px',
    '3xl': '30px',
  },
  
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  tracking: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.02em',
    wider: '0.05em',
    widest: '0.1em',
  },
  
  leading: {
    tight: 1.1,
    normal: 1.5,
    relaxed: 1.6,
  },
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
} as const;

export const animation = {
  duration: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
  },
  easing: {
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

export const blur = {
  sm: '4px',
  md: '12px',
  lg: '24px',
  xl: '40px',
  product: 'blur(12px) saturate(180%)',
} as const;

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  toast: 1080,
} as const;

// Bento grid — asymmetry, varied weights
export const bento = {
  grid2: 'grid grid-cols-2 gap-3',
  grid3: 'grid grid-cols-3 gap-3',
  large: 'col-span-2 row-span-2',
  wide: 'col-span-2',
  tall: 'row-span-2',
} as const;

// Content visibility — performance
export const performance = {
  contentVisibility: 'content-visibility: auto; contain: layout style paint;',
  willChange: 'will-change: transform;',
  gpu: 'transform: translateZ(0);',
} as const;

// Focus visible — WCAG 2.2 AA
export const focus = {
  ring: 'outline: 2px solid black; outline-offset: 2px; border-radius: 12px;',
  ringGold: 'outline: 2px solid oklch(0.80 0.17 85); outline-offset: 2px;',
} as const;

export const tokens = {
  shadows,
  radius,
  gradients,
  colors,
  typography,
  spacing,
  animation,
  blur,
  zIndex,
  bento,
  performance,
  focus,
} as const;

export type DesignTokens = typeof tokens;
