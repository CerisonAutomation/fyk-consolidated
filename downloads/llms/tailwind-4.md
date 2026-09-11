# Tailwind CSS 4 - Patterns & Implementation Guide

## Overview

Tailwind CSS v4 represents a major rewrite with a Rust-based engine delivering 3.5-5x faster full builds and 100x+ faster incremental builds. It shifts from JavaScript configuration to CSS-first configuration and deeply integrates modern CSS features.

---

## Performance Benchmarks

| Build Type | v3.4 | v4.0 | Improvement |
|---|---|---|---|
| Full build | 378ms | 100ms | 3.78x |
| New CSS incremental | 44ms | 5ms | 8.8x |
| No new CSS incremental | 35ms | 192us | 182x |

---

## Installation

### PostCSS Setup

```bash
npm i tailwindcss @tailwindcss/postcss
```

```javascript
// postcss.config.js
export default {
  plugins: ["@tailwindcss/postcss"],
};
```

```css
/* app.css */
@import "tailwindcss";
```

### Vite Plugin (Recommended)

```bash
npm i @tailwindcss/vite
```

```javascript
// vite.config.ts
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
});
```

---

## CSS-First Configuration

No more `tailwind.config.js`. All customization happens in CSS via `@theme`:

```css
@import "tailwindcss";

@theme {
  --font-display: "Satoshi", "sans-serif";
  --breakpoint-3xl: 1920px;
  --color-avocado-500: oklch(0.84 0.18 117.33);
  --spacing: 0.25rem;
}
```

All theme values are automatically exposed as CSS custom properties:

```css
:root {
  --color-avocado-500: oklch(0.84 0.18 117.33);
}
```

### Dynamic Utilities

Spacing, grid columns, and data attributes now accept arbitrary numbers:

```html
<!-- Dynamic spacing via --spacing variable -->
<div class="mt-8 w-17 pr-29">
  <!-- Generates: .mt-8 { margin-top: calc(var(--spacing) * 8); } -->
</div>

<!-- Dynamic grid columns (no predefined scale needed) -->
<div class="grid grid-cols-15">...</div>

<!-- Dynamic data attributes -->
<div data-current:opacity-100>...</div>
```

---

## Auto Content Detection

Tailwind v4 auto-detects source files. Manually add sources with `@source`:

```css
@import "tailwindcss";
@source "../node_modules/@my-company/ui-lib";
```

Built-in `@import` support - no `postcss-import` plugin needed.

---

## Container Queries (Built-in)

No plugin required:

```html
<div class="@container">
  <div class="grid grid-cols-1 @sm:grid-cols-3 @lg:grid-cols-4">
    <!-- Responsive to container width, not viewport -->
  </div>
</div>
```

Range queries:

```html
<div class="@min-md:@max-xl:hidden">...</div>
```

Max-width variants:

```html
<div class="@max-md:grid-cols-1">...</div>
```

---

## New Utilities & Variants

### 3D Transforms

```html
<div class="rotate-x-45 rotate-y-12 scale-z-150 translate-z-8 perspective-500">
  3D transformed element
</div>
```

### Extended Gradients

```html
<!-- Angular linear gradient -->
<div class="bg-linear-45 from-blue-500 to-purple-600">...</div>

<!-- Interpolation mode -->
<div class="bg-linear-to-r/oklch from-50% to-100%">...</div>

<!-- Conic gradient -->
<div class="bg-conic from-0% from-blue-500 via-50% via-purple-500 to-100% to-red-500">...</div>

<!-- Radial gradient -->
<div class="bg-radial from-white from-0% to-blue-500 to-100%">...</div>
```

### Transition Discrete (`@starting-style`)

```html
<div class="transition-discrete starting:open:opacity-0 starting:open:scale-95">
  Element appears with scale + opacity animation
</div>
```

### `not-*` Variant

```html
<div class="not-hover:opacity-75 not-focus-visible:ring-0">
  Styles applied when state does NOT match
</div>
```

### Inset Shadows

```html
<!-- Up to 4 shadow layers -->
<div class="inset-shadow-sm inset-ring-2 inset-ring-blue-500/50">...</div>
```

### Other New Utilities

- `field-sizing: content` - Auto-resize textarea
- `color-scheme: dark` - Fix dark mode scrollbar
- `font-stretch` - Font width control
- `inert` variant - For inert elements
- `nth-*` variants - nth-child without custom selectors
- `in-*` variant - Like `group-*` without requiring `.group` class

---

## Modern CSS Integration

### Native Cascade Layers

```css
@layer base, components, utilities;

@layer base {
  body { font-family: system-ui; }
}
```

### Registered Custom Properties (for animation)

```css
@property --gradient-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@keyframes rotate-gradient {
  to { --gradient-angle: 360deg; }
}

.animated-gradient {
  background: conic-gradient(from var(--gradient-angle), blue, purple);
  animation: rotate-gradient 2s linear infinite;
}
```

### color-mix() for Opacity

```css
/* Apply opacity to any color, including CSS variables */
.element {
  color: color-mix(in srgb, var(--color-primary) 70%, transparent);
}
```

### Logical Properties

```css
/* Automatically handles RTL */
.element {
  margin-inline-start: 1rem;
  padding-block: 0.5rem;
  border-inline-end: 2px solid gray;
}
```

---

## Migration from v3

### Upgrade Tool

```bash
npx @tailwindcss/upgrade
```

Key migrations:

1. Replace `tailwind.config.js` with `@theme` in CSS
2. Update imports: `@import "tailwindcss"` replaces `@tailwind base/components/utilities`
3. Arbitrary values simplified: `w-[17px]` becomes `w-17`
4. Remove `postcss-import` plugin (built-in now)

### Configuration Mapping

| v3 Config | v4 CSS |
|---|---|
| `theme.extend.colors` | `@theme { --color-*: ... }` |
| `theme.extend.fontFamily` | `@theme { --font-*: ... }` |
| `theme.extend.screens` | `@theme { --breakpoint-*: ... }` |
| `theme.extend.spacing` | `@theme { --spacing: ... }` |
| `content: [...]` | `@source "..."` |

---

## Best Practices

1. **Use the Vite plugin** over PostCSS for best performance
2. **Embrace CSS variables** - they are first-class citizens in v4
3. **Use `@theme` for design tokens** - centralize all custom values
4. **Leverage container queries** - they replace many media query patterns
5. **Use `transition-discrete`** for enter/exit animations without JS
6. **Prefer logical properties** for RTL support
7. **Use `color-mix()`** instead of opacity modifiers on variables
