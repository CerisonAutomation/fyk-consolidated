# Tailwind CSS v4 - Documentation

**Package:** `tailwindcss` v4.1.18
**Docs:** https://tailwindcss.com/docs

## Overview

Tailwind CSS v4 is a CSS-first configuration approach. It works by scanning source files for class names and generating the necessary CSS. Zero runtime, zero config by default.

## Installation with Vite

```bash
npm install tailwindcss @tailwindcss/vite
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
})
```

```css
/* src/index.css */
@import "tailwindcss";
```

## Key Changes from v3 to v4

- **CSS-first configuration** - No more `tailwind.config.js`
- **`@theme` directive** - Define custom theme values in CSS
- **`@source` directive** - Control source file scanning
- **`@apply` still works** but with CSS-first approach
- **No runtime** - All styles generated at build time

## Theme Customization

```css
/* Use @theme to customize */
@theme {
  --color-primary: #3490dc;
  --color-secondary: #ffed4a;
  --color-danger: #e3342f;

  --font-display: "Satoshi", "system-ui", sans-serif;
  --font-body: "Inter", "system-ui", sans-serif;

  --breakpoint-3xl: 1920px;

  --spacing-128: 32rem;
  --spacing-144: 36rem;
}

/* Use theme variables */
.body {
  font-family: var(--font-body);
  color: var(--color-primary);
}
```

## Source Detection

```css
/* Explicitly include source files */
@source "../src/**/*.tsx";

/* Exclude files */
@source not "../node_modules";

/* Scan specific directories */
@source "../components";
@source "../pages";
```

## Common Utility Patterns

### Spacing and Sizing

```html
<div class="p-4 m-2">         <!-- padding: 1rem, margin: 0.5rem -->
<div class="px-6 py-4">       <!-- padding-x: 1.5rem, padding-y: 1rem -->
<div class="w-full h-screen">  <!-- width: 100%, height: 100vh -->
<div class="max-w-2xl mx-auto"> <!-- max-width, centered -->
```

### Flexbox and Grid

```html
<div class="flex items-center justify-between">
  <!-- Flexbox -->
</div>

<div class="grid grid-cols-3 gap-4">
  <!-- 3-column grid -->
</div>

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- Responsive grid -->
</div>
```

### Typography

```html
<h1 class="text-3xl font-bold text-gray-900">
  Heading
</h1>

<p class="text-base text-gray-600 leading-relaxed">
  Body text
</p>

<span class="text-sm font-medium text-blue-600">
  Small text
</span>
```

### Colors

```html
<div class="bg-white text-black">       <!-- Background and text -->
<div class="border border-gray-200">     <!-- Border color -->
<div class="hover:bg-blue-500">         <!-- Hover state -->
<div class="focus:ring-2 focus:ring-blue-500">  <!-- Focus state -->
```

### Responsive Design

```html
<div class="text-sm md:text-base lg:text-lg">
  <!-- Responsive text size -->
</div>

<div class="hidden md:block">
  <!-- Hidden on mobile, visible on md+ -->
</div>

<div class="flex flex-col md:flex-row">
  <!-- Stack on mobile, row on desktop -->
</div>
```

### States and Variants

```html
<button class="bg-blue-500 hover:bg-blue-700 active:bg-blue-900">
  Button
</button>

<input class="focus:outline-none focus:ring-2 focus:ring-blue-500" />

<div class="disabled:opacity-50 disabled:cursor-not-allowed">
  Disabled content
</div>

<div class="dark:bg-gray-800 dark:text-white">
  Dark mode support
</div>
```

### Animations

```html
<div class="transition-all duration-300 ease-in-out">
  Smooth transition
</div>

<div class="animate-spin">   <!-- Spinning -->
<div class="animate-pulse">  <!-- Pulsing -->
```

## @apply Directive

```css
/* Use @apply for reusable component styles */
@layer components {
  .btn {
    @apply px-4 py-2 rounded font-medium transition-colors;
  }

  .btn-primary {
    @apply bg-blue-500 text-white hover:bg-blue-600;
  }

  .btn-secondary {
    @apply bg-gray-200 text-gray-800 hover:bg-gray-300;
  }

  .card {
    @apply bg-white rounded-lg shadow-md p-6;
  }

  .input {
    @apply w-full px-3 py-2 border border-gray-300 rounded-md
           focus:outline-none focus:ring-2 focus:ring-blue-500;
  }
}
```

## Dark Mode

```css
/* v4 uses media queries by default */
@custom-variant dark (&:where(.dark, .dark *));

/* Or use class strategy */
@variant dark (&:where(.dark, .dark *));
```

```html
<div class="dark:bg-gray-900 dark:text-white">
  Dark mode content
</div>
```

## Arbitrary Values

```html
<div class="w-[calc(100%-2rem)]">
  <!-- Arbitrary width -->
</div>

<div class="bg-[#1da1f2]">
  <!-- Arbitrary color -->
</div>

<div class="grid grid-cols-[200px_1fr_200px]">
  <!-- Arbitrary grid -->
</div>

<div class="p-[clamp(1rem,5vw,3rem)]">
  <!-- Arbitrary with CSS function -->
</div>
```

## Plugin Examples

```css
/* Custom utilities */
@utility text-gradient {
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Usage */
<h1 class="text-gradient bg-gradient-to-r from-blue-500 to-purple-500">
  Gradient Text
</h1>
```

## TypeScript Integration

```typescript
// No special TypeScript config needed for Tailwind v4
// Classes are detected from source files automatically

// For IDE support, ensure your editor has Tailwind CSS extension
```

## Common Patterns

### Card Component

```html
<div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
  <h3 class="text-xl font-semibold mb-2">Title</h3>
  <p class="text-gray-600">Description</p>
</div>
```

### Form Input

```html
<input
  type="text"
  class="w-full px-3 py-2 border border-gray-300 rounded-md
         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
         disabled:bg-gray-100 disabled:cursor-not-allowed"
  placeholder="Enter text..."
/>
```

### Navigation

```html
<nav class="flex items-center justify-between p-4 bg-white shadow">
  <div class="text-xl font-bold">Logo</div>
  <div class="flex space-x-4">
    <a href="/" class="text-gray-600 hover:text-blue-600 transition-colors">Home</a>
    <a href="/about" class="text-gray-600 hover:text-blue-600 transition-colors">About</a>
  </div>
</nav>
```

### Responsive Container

```html
<div class="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <!-- Content -->
</div>
```

## Key Patterns

1. Use `@import "tailwindcss"` in your CSS entry point
2. Use `@theme` to customize design tokens
3. Use `@source` to explicitly include/exclude files
4. Use `@apply` for reusable component styles
5. Use responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
6. Use state prefixes: `hover:`, `focus:`, `active:`, `disabled:`
7. Use arbitrary values with `[]` for one-off styles
8. Use `dark:` for dark mode variants
9. Combine utilities for complex layouts
10. Keep component styles in `@layer components`
