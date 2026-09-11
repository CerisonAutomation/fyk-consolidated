# CSS Architecture - BEM Patterns & Best Practices

## Overview

BEM (Block, Element, Modifier) is a CSS naming methodology that creates structured, maintainable, and scalable stylesheets. It provides clear rules for naming classes to avoid conflicts and make code self-documenting.

---

## BEM Naming Convention

```
.block {}
.block__element {}
.block--modifier {}
.block__element--modifier {}
```

- **Block**: Standalone entity (component, widget, section)
- **Element**: Part of a block (has no standalone meaning)
- **Modifier**: Variation or state of a block/element

---

## Core Patterns

### Basic Block

```css
.card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
}
```

### Block + Element

```css
.card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
}

.card__title {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.card__image {
  width: 100%;
  border-radius: 4px;
}

.card__actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}
```

### Block + Modifier

```css
.card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
}

.card--featured {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px #3b82f6;
}

.card--compact {
  padding: 0.5rem;
}
```

### Block + Element + Modifier

```css
.card__title {
  font-size: 1.25rem;
  font-weight: 700;
}

.card__title--large {
  font-size: 1.5rem;
}

.card__title--truncated {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

---

## HTML Implementation

```html
<!-- Block -->
<article class="card">
  <!-- Element -->
  <img class="card__image" src="photo.jpg" alt="Photo" />

  <!-- Element -->
  <h2 class="card__title">Card Title</h2>

  <!-- Element -->
  <p class="card__description">Description text</p>

  <!-- Element with Modifier -->
  <div class="card__actions card__actions--vertical">
    <button class="button button--primary">Action</button>
    <button class="button button--secondary">Cancel</button>
  </div>
</article>

<!-- Block with Modifier -->
<article class="card card--featured">
  <h2 class="card__title card__title--large">Featured Card</h2>
</article>
```

---

## Component Architecture

### Button Component

```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-weight: 500;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.button--primary {
  background-color: #3b82f6;
  color: white;
}

.button--primary:hover {
  background-color: #2563eb;
}

.button--secondary {
  background-color: transparent;
  border: 1px solid #d1d5db;
  color: #374151;
}

.button--danger {
  background-color: #ef4444;
  color: white;
}

.button--small {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

.button--large {
  padding: 0.75rem 1.5rem;
  font-size: 1.125rem;
}

.button--disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
```

### Navigation Component

```css
.nav {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.nav__list {
  display: flex;
  list-style: none;
  gap: 0.5rem;
}

.nav__link {
  padding: 0.5rem 1rem;
  text-decoration: none;
  color: #374151;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.nav__link:hover {
  background-color: #f3f4f6;
}

.nav__link--active {
  background-color: #eff6ff;
  color: #2563eb;
  font-weight: 500;
}

.nav__logo {
  font-size: 1.25rem;
  font-weight: 700;
  margin-right: auto;
}
```

### Form Component

```css
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form__group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.form__input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.15s;
}

.form__input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px #dbeafe;
}

.form__input--error {
  border-color: #ef4444;
}

.form__error {
  font-size: 0.75rem;
  color: #ef4444;
}

.form__actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
```

---

## File Structure Patterns

### By Component (Recommended)

```
css/
  components/
    _card.css
    _button.css
    _nav.css
    _form.css
  utilities/
    _spacing.css
    _typography.css
  base/
    _reset.css
    _typography.css
  index.css
```

```css
/* index.css */
@import 'base/reset';
@import 'base/typography';
@import 'components/card';
@import 'components/button';
@import 'components/nav';
@import 'components/form';
@import 'utilities/spacing';
@import 'utilities/typography';
```

### By Feature

```
css/
  features/
    auth/
      _login.css
      _register.css
    dashboard/
      _sidebar.css
      _widgets.css
  shared/
    _button.css
    _modal.css
```

---

## Advanced BEM Patterns

### State Classes (BEM + State)

```css
/* Use is-* or has-* for JavaScript state hooks */
.modal.is-open {
  display: flex;
}

.checkbox.is-checked {
  background-color: #3b82f6;
}

.dropdown.is-expanded .dropdown__menu {
  opacity: 1;
  visibility: visible;
}

/* BEM modifier for visual state */
.button--loading {
  position: relative;
  color: transparent;
}

.button--loading::after {
  content: '';
  position: absolute;
  width: 1rem;
  height: 1rem;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
```

### JavaScript Hooks Pattern

```css
/* JavaScript hooks use data-* or aria-* attributes */
[data-tooltip] {
  position: relative;
}

[data-tooltip]::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.25rem 0.5rem;
  background: #1f2937;
  color: white;
  font-size: 0.75rem;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
}

[data-tooltip]:hover::after {
  opacity: 1;
}
```

### Nested BEM (Naming Convention Only)

```css
/* Elements within elements - flatten the naming */
.card {
  /* Block */
}

.card__header {
  /* Direct child of block */
}

.card__header__title {
  /* WRONG - avoid deep nesting */
}

/* RIGHT - keep element naming flat */
.card__title {
  /* Always one level deep from block */
}
```

---

## CSS Custom Properties Integration

```css
/* Define design tokens */
:root {
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-secondary: #6b7280;
  --color-success: #10b981;
  --color-danger: #ef4444;

  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  --font-sans: system-ui, -apple-system, sans-serif;
  --font-mono: ui-monospace, monospace;

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
}

/* Use in BEM components */
.button--primary {
  background-color: var(--color-primary);
}

.button--primary:hover {
  background-color: var(--color-primary-hover);
}
```

---

## Alternatives & Comparison

### OOCSS (Object-Oriented CSS)

```css
/* Separate structure from skin */
.media {
  display: flex;
  align-items: flex-start;
}

.media--image {
  /* Modifier for image variant */
}

.media__body {
  flex: 1;
}
```

### SMACSS (Scalable and Modular Architecture)

```css
/* Categories: Base, Layout, Module, State, Theme */

/* Base */
h1 { font-size: 2rem; }

/* Layout */
.l-header { display: flex; }
.l-sidebar { width: 250px; }

/* Module */
.card { border: 1px solid #ccc; }

/* State */
.is-hidden { display: none; }
.is-active { color: blue; }
```

### ITCSS (Inverted Triangle CSS)

```
css/
  1-settings/     -- Variables, config
  2-tools/        -- Mixins, functions
  3-generic/      -- Reset, normalize
  4-elements/     -- HTML element styling
  5-objects/      -- Layout patterns
  6-components/   -- UI components
  7-utilities/    -- Overrides, helpers
```

---

## Best Practices

1. **One block per component** - each UI component gets its own BEM block
2. **Never nest elements more than one level deep** - `block__element__element` is wrong
3. **Use modifiers for variants** - not for creating new blocks
4. **Keep utilities separate** - helper classes outside BEM blocks
5. **Use `is-*` or `has-*` for JavaScript state** - distinct from BEM modifiers
6. **Name by purpose, not appearance** - `card--featured` not `card--blue`
7. **Use CSS custom properties** for design tokens within BEM blocks
8. **Scope everything** - no bare element selectors (e.g., avoid `h2 {}`)
