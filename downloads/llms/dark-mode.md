# CSS Dark Mode - Implementation Patterns & Best Practices

## Overview

Dark mode is implemented using CSS media queries, custom properties, and the `color-scheme` property. Modern approaches use `prefers-color-scheme` for automatic OS-based switching, with manual toggle support via class or data attribute overrides.

---

## Core Implementation

### Basic System Preference

```css
/* Light theme (default) */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #1a1a1a;
  --text-secondary: #6b7280;
  --border-color: #e5e7eb;
}

/* Dark theme (auto via OS preference) */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1a1a1a;
    --bg-secondary: #2d2d2d;
    --text-primary: #f5f5f5;
    --text-secondary: #9ca3af;
    --border-color: #404040;
  }
}
```

### Usage

```css
body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.card {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
}
```

---

## Manual Toggle Pattern

### Class-Based Switching

```css
/* Light theme (default) */
:root,
[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --accent: #3b82f6;
  --accent-hover: #2563eb;
}

/* Dark theme */
[data-theme="dark"] {
  --bg-primary: #0f0f0f;
  --bg-secondary: #1a1a1a;
  --text-primary: #f9fafb;
  --text-secondary: #9ca3af;
  --accent: #60a5fa;
  --accent-hover: #93bbfd;
}
```

```html
<html data-theme="light">
  <!-- or -->
<html data-theme="dark">
```

### JavaScript Toggle

```javascript
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';

  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

// Initialize on load
const saved = localStorage.getItem('theme');
if (saved) {
  document.documentElement.setAttribute('data-theme', saved);
}
```

### System + Manual Override

```css
/* System preference as default */
:root {
  --bg-primary: #ffffff;
  --text-primary: #111827;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg-primary: #0f0f0f;
    --text-primary: #f9fafb;
  }
}

/* Manual override takes priority */
[data-theme="dark"] {
  --bg-primary: #0f0f0f;
  --text-primary: #f9fafb;
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --text-primary: #111827;
}
```

---

## Color Palette Patterns

### Semantic Color Tokens

```css
:root {
  /* Backgrounds */
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --bg-tertiary: #f3f4f6;
  --bg-elevated: #ffffff;
  --bg-overlay: rgba(0, 0, 0, 0.5);

  /* Text */
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-tertiary: #9ca3af;
  --text-inverse: #ffffff;

  /* Borders */
  --border-primary: #e5e7eb;
  --border-secondary: #d1d5db;
  --border-focus: #3b82f6;

  /* Interactive */
  --accent: #3b82f6;
  --accent-hover: #2563eb;
  --accent-active: #1d4ed8;

  /* Status */
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
  --info: #3b82f6;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #0a0a0a;
    --bg-secondary: #171717;
    --bg-tertiary: #262626;
    --bg-elevated: #1a1a1a;
    --bg-overlay: rgba(0, 0, 0, 0.7);

    --text-primary: #fafafa;
    --text-secondary: #a3a3a3;
    --text-tertiary: #737373;
    --text-inverse: #111827;

    --border-primary: #262626;
    --border-secondary: #404040;
    --border-focus: #60a5fa;

    --accent: #60a5fa;
    --accent-hover: #93c5fd;
    --accent-active: #bfdbfe;

    --success: #34d399;
    --warning: #fbbf24;
    --error: #f87171;
    --info: #60a5fa;

    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
    --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
    --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
  }
}
```

### Gray Scale (Tailwind-inspired)

```css
:root {
  --gray-50: #f9fafb;
  --gray-100: #f3f4f6;
  --gray-200: #e5e7eb;
  --gray-300: #d1d5db;
  --gray-400: #9ca3af;
  --gray-500: #6b7280;
  --gray-600: #4b5563;
  --gray-700: #374151;
  --gray-800: #1f2937;
  --gray-900: #111827;
  --gray-950: #030712;
}

@media (prefers-color-scheme: dark) {
  :root {
    --gray-50: #030712;
    --gray-100: #111827;
    --gray-200: #1f2937;
    --gray-300: #374151;
    --gray-400: #4b5563;
    --gray-500: #6b7280;
    --gray-600: #9ca3af;
    --gray-700: #d1d5db;
    --gray-800: #e5e7eb;
    --gray-900: #f3f4f6;
    --gray-950: #f9fafb;
  }
}
```

---

## Component Patterns

### Card

```css
.card {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
  transition: background-color 0.2s, border-color 0.2s;
}

.card__title {
  color: var(--text-primary);
  font-weight: 600;
}

.card__description {
  color: var(--text-secondary);
}
```

### Button

```css
.button {
  background-color: var(--accent);
  color: var(--text-inverse);
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  transition: background-color 0.15s;
}

.button:hover {
  background-color: var(--accent-hover);
}

.button--secondary {
  background-color: transparent;
  border: 1px solid var(--border-primary);
  color: var(--text-primary);
}

.button--secondary:hover {
  background-color: var(--bg-tertiary);
}
```

### Input

```css
.input {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-primary);
  color: var(--text-primary);
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.input:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input::placeholder {
  color: var(--text-tertiary);
}
```

### Navigation

```css
.nav {
  background-color: var(--bg-primary);
  border-bottom: 1px solid var(--border-primary);
}

.nav__link {
  color: var(--text-secondary);
  transition: color 0.15s, background-color 0.15s;
}

.nav__link:hover {
  color: var(--text-primary);
  background-color: var(--bg-tertiary);
}

.nav__link--active {
  color: var(--accent);
}
```

---

## Browser UI Theming

### color-scheme Property

```css
/* Tell browser to use dark mode UI */
:root {
  color-scheme: light dark;
}

/* Override for specific elements */
.dark-only {
  color-scheme: dark;
}

.light-only {
  color-scheme: light;
}
```

### HTML Meta Tag

```html
<!-- Auto: follows system preference -->
<meta name="color-scheme" content="light dark">

<!-- Force light -->
<meta name="color-scheme" content="light">

<!-- Force dark -->
<meta name="color-scheme" content="dark">
```

### Effect on Native Elements

```css
/* Scrollbars, form controls, etc. */
:root {
  color-scheme: light dark;
}

/* Dark scrollbar in dark mode */
@media (prefers-color-scheme: dark) {
  ::-webkit-scrollbar {
    background: #1a1a1a;
  }

  ::-webkit-scrollbar-thumb {
    background: #404040;
  }
}
```

---

## Image & Media Handling

### Dark Mode Images

```css
/* Slightly dim images in dark mode */
@media (prefers-color-scheme: dark) {
  img:not([src*=".svg"]) {
    opacity: 0.9;
    transition: opacity 0.2s;
  }

  img:not([src*=".svg"]):hover {
    opacity: 1;
  }
}
```

### SVG Color Inheritance

```html
<div style="color-scheme: dark">
  <svg>
    <style>
      :root { color: black; }
      @media (prefers-color-scheme: dark) {
        :root { color: white; }
      }
    </style>
    <circle fill="currentColor" r="50" />
  </svg>
</div>
```

### Logo Swapping

```html
<!-- Light logo -->
<img class="logo logo--light" src="logo-dark.png" alt="Logo" />

<!-- Dark logo -->
<img class="logo logo--dark" src="logo-light.png" alt="Logo" />
```

```css
.logo--dark {
  display: none;
}

@media (prefers-color-scheme: dark) {
  .logo--light {
    display: none;
  }

  .logo--dark {
    display: block;
  }
}
```

### Using `picture` Element

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="logo-white.svg" />
  <img src="logo-dark.svg" alt="Logo" />
</picture>
```

---

## Transition Patterns

### Smooth Theme Switch

```css
* {
  transition:
    background-color 0.3s ease,
    color 0.3s ease,
    border-color 0.3s ease,
    box-shadow 0.3s ease;
}

/* Disable for elements that shouldn't animate */
.no-transition {
  transition: none !important;
}
```

### Flash of Unstyled Content (FOUC) Prevention

```html
<script>
  // Inline script in <head> - runs before render
  const theme = localStorage.getItem('theme');
  if (theme) {
    document.documentElement.setAttribute('data-theme', theme);
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
</script>
```

```css
/* Hide content until theme is applied */
html:not([data-theme]) {
  visibility: hidden;
}

html[data-theme] {
  visibility: visible;
}
```

---

## Accessibility

### Focus Indicators

```css
/* Ensure focus is visible in both themes */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (prefers-color-scheme: dark) {
  :focus-visible {
    outline-color: var(--accent);
    /* Blue on dark background is fine, but ensure contrast */
  }
}
```

### Color Contrast Requirements

```css
/* WCAG AA: 4.5:1 for normal text, 3:1 for large text */

/* Light mode */
:root {
  --text-primary: #111827;    /* On #ffffff: 16.75:1 */
  --text-secondary: #4b5563;  /* On #ffffff: 7.45:1 */
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --text-primary: #f9fafb;    /* On #0a0a0a: 18.06:1 */
    --text-secondary: #a3a3a3;  /* On #0a0a0a: 9.17:1 */
  }
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition-duration: 0.01ms !important;
  }
}
```

---

## Advanced Patterns

### Multiple Theme Support

```css
:root,
[data-theme="light"] {
  --bg-primary: #ffffff;
  --text-primary: #111827;
}

[data-theme="dark"] {
  --bg-primary: #0a0a0a;
  --text-primary: #f9fafb;
}

[data-theme="midnight"] {
  --bg-primary: #0d1117;
  --text-primary: #c9d1d9;
  --accent: #58a6ff;
}

[data-theme="solarized"] {
  --bg-primary: #fdf6e3;
  --text-primary: #657b83;
  --accent: #268bd2;
}
```

### System Preference Detection

```javascript
// Check if user prefers dark mode
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

// Listen for changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  const newTheme = e.matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
});
```

### Tailwind CSS Dark Mode

```html
<!-- Class strategy -->
<html class="dark">

<!-- Media strategy (default) -->
<html>
  <!-- Automatically applies dark: variants -->
</html>
```

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class', // or 'media'
};
```

```html
<!-- Usage -->
<div class="bg-white dark:bg-gray-900 text-black dark:text-white">
  Content adapts to theme
</div>
```

### CSS Nesting (Modern)

```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);

  @media (prefers-color-scheme: dark) {
    border-color: var(--border-secondary);
  }

  &__title {
    color: var(--text-primary);
  }

  &__description {
    color: var(--text-secondary);
  }
}
```

---

## Common Mistakes

### 1. Hardcoded Colors

```css
/* BAD */
.card {
  background: white;
  color: black;
}

/* GOOD */
.card {
  background: var(--bg-primary);
  color: var(--text-primary);
}
```

### 2. Forgetting Hover States

```css
/* BAD - hover state invisible in dark mode */
.link {
  color: blue;
}

/* GOOD */
.link {
  color: var(--accent);
}

.link:hover {
  color: var(--accent-hover);
}
```

### 3. Ignoring Shadow Visibility

```css
/* BAD - shadow invisible on dark backgrounds */
.card {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* GOOD */
.card {
  box-shadow: var(--shadow-sm);
}
```

### 4. Not Testing Both Themes

Always verify:
- Color contrast ratios
- Shadow visibility
- Border visibility
- Focus indicator visibility
- Image appearance
- Form control styling
- Scrollbar appearance

---

## Browser Support

- `prefers-color-scheme`: 76+ (Chrome), 67+ (Firefox), 12.1+ (Safari), 79+ (Edge)
- `color-scheme`: 81+ (Chrome), 75+ (Firefox), 13+ (Safari), 81+ (Edge)

---

## Best Practices

1. **Use CSS custom properties** for all colors - centralize theme definitions
2. **Define light theme first**, override with dark
3. **Use semantic color names** (`--text-primary`) not appearance names (`--gray-900`)
4. **Set `color-scheme: light dark`** on `:root` for native UI theming
5. **Prevent FOUC** with inline script in `<head>`
6. **Test both themes** - check contrast, shadows, borders, images
7. **Respect `prefers-reduced-motion`** for theme transitions
8. **Use `data-theme` attribute** over class for manual toggling
9. **Provide manual override** - don't rely solely on system preference
10. **Use `<picture>` element** for theme-specific images
11. **Ensure focus indicators** are visible in both themes
12. **Log theme changes** for analytics and debugging
