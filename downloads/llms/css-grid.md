# CSS Grid Layout - Patterns & Implementation Guide

## Overview

CSS Grid is a two-dimensional layout system that handles both columns and rows simultaneously. It excels at page-level layouts, complex component arrangements, and responsive designs without media queries.

---

## Core Concepts

### Grid Container

```css
.container {
  display: grid;
  grid-template-columns: 200px 1fr 200px;
  grid-template-rows: auto 1fr auto;
  gap: 1rem;
}
```

### Grid Items

```css
.item {
  grid-column: 1 / 3;    /* Span from line 1 to line 3 */
  grid-row: 1;           /* Place in row 1 */
}
```

---

## Column & Row Definitions

### Fixed Sizes

```css
.grid {
  grid-template-columns: 200px 300px 200px;
  grid-template-rows: 100px auto 100px;
}
```

### Fractional Units (fr)

```css
/* Equal columns */
.grid {
  grid-template-columns: 1fr 1fr 1fr;
}

/* Sidebar layout */
.layout {
  grid-template-columns: 250px 1fr;
}

/* Content-focused */
.content-layout {
  grid-template-columns: 1fr 2fr 1fr;
}
```

### minmax()

```css
/* Columns: at least 200px, grow to fill */
.grid {
  grid-template-columns: minmax(200px, 1fr) minmax(200px, 1fr);
}

/* Prevent text overflow */
.item {
  min-width: 0; /* Override default min-width: auto */
  overflow: hidden;
}
```

### repeat()

```css
/* Repeat pattern */
.grid {
  grid-template-columns: repeat(4, 1fr);
}

/* Alternating columns */
.grid {
  grid-template-columns: repeat(3, 2fr 1fr);
}
```

---

## Responsive Patterns (No Media Queries)

### Auto-Fit (Expand to Fill)

```css
/* Cards fill available space */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}
```

### Auto-Fill (Fixed Count)

```css
/* Exactly 4 columns, even if space remains */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}
```

### Comparison

```css
/* auto-fit: stretches items to fill container */
.auto-fit {
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

/* auto-fill: keeps items at min size, leaves gap */
.auto-fill {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}
```

---

## Named Grid Areas

### Template Areas

```css
.page {
  display: grid;
  grid-template-areas:
    "header  header  header"
    "sidebar content aside"
    "footer  footer  footer";
  grid-template-columns: 250px 1fr 200px;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
}

.header  { grid-area: header; }
.sidebar { grid-area: sidebar; }
.content { grid-area: content; }
.aside   { grid-area: aside; }
.footer  { grid-area: footer; }
```

### Responsive Named Areas

```css
.page {
  display: grid;
  grid-template-areas:
    "header"
    "content"
    "sidebar"
    "footer";
  grid-template-columns: 1fr;
}

@media (min-width: 768px) {
  .page {
    grid-template-areas:
      "header  header"
      "content sidebar"
      "footer  footer";
    grid-template-columns: 1fr 250px;
  }
}

@media (min-width: 1024px) {
  .page {
    grid-template-areas:
      "header header header"
      "nav    content sidebar"
      "footer footer footer";
    grid-template-columns: 200px 1fr 200px;
  }
}
```

### Spanning Multiple Areas

```css
.featured {
  grid-area: header / header / content / content; /* Span 2 rows, 2 columns */
}
```

---

## Alignment

### Container Alignment

```css
.grid {
  /* Horizontal alignment of items */
  justify-items: start;    /* start | end | center | stretch */

  /* Vertical alignment of items */
  align-items: start;      /* start | end | center | stretch */

  /* Horizontal alignment of entire grid */
  justify-content: center; /* start | end | center | stretch | space-between | space-around */

  /* Vertical alignment of entire grid */
  align-content: center;   /* start | end | center | stretch | space-between | space-around */

  /* Shorthand */
  place-items: center center;
  place-content: center center;
}
```

### Item Alignment

```css
.item {
  justify-self: end;   /* Override container's justify-items */
  align-self: center;  /* Override container's align-items */

  /* Shorthand */
  place-self: end center;
}
```

### Centering Pattern

```css
/* Perfect centering */
.center-grid {
  display: grid;
  place-items: center;
  min-height: 100vh;
}
```

---

## Item Placement

### Line Numbers

```css
.item {
  grid-column: 1 / 3;      /* Lines 1 to 3 (span 2) */
  grid-row: 2 / 4;         /* Lines 2 to 4 (span 2) */
}
```

### Span Keywords

```css
.item {
  grid-column: span 3;      /* Span 3 columns */
  grid-row: span 2;         /* Span 2 rows */
}
```

### Grid Line Names

```css
.grid {
  grid-template-columns: [start] 1fr [content-start] 2fr [content-end] 1fr [end];
}

.item {
  grid-column: content-start / content-end;
}
```

### Explicit Placement

```css
.item-a {
  grid-column: 1;
  grid-row: 1;
}

.item-b {
  grid-column: 3;
  grid-row: 1;
}

.item-c {
  grid-column: 1 / -1;  /* Span full width (to last line) */
  grid-row: 2;
}
```

---

## Auto-Placement

### Basic Flow

```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: minmax(100px, auto);
}
```

### Dense Packing

```css
.grid {
  grid-auto-flow: dense; /* Fill earlier gaps */
}

/* Warning: May reorder items visually */
```

### Implicit Rows

```css
.grid {
  grid-auto-rows: 150px;           /* Default row height */
  grid-auto-columns: 1fr;          /* Default column width */
}
```

---

## Common Layout Patterns

### Holy Grail Layout

```css
.holy-grail {
  display: grid;
  grid-template:
    "header  header  header" auto
    "nav     main    aside"  1fr
    "footer  footer  footer" auto
    / 200px  1fr     200px;
  min-height: 100vh;
}
```

### Dashboard Layout

```css
.dashboard {
  display: grid;
  grid-template-columns: 260px 1fr;
  grid-template-rows: auto 1fr;
  min-height: 100vh;
}

.dashboard-header {
  grid-column: 1 / -1;
}

.dashboard-sidebar {
  grid-row: 2;
}

.dashboard-content {
  grid-row: 2;
}
```

### Card Grid (Responsive)

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
  padding: 1.5rem;
}
```

### Photo Gallery

```css
.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  grid-auto-rows: 200px;
  gap: 0.5rem;
}

.gallery__item--wide {
  grid-column: span 2;
}

.gallery__item--tall {
  grid-row: span 2;
}

.gallery__item--large {
  grid-column: span 2;
  grid-row: span 2;
}
```

### Sticky Sidebar

```css
.layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}
```

### Multi-Line Form

```css
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-grid .full-width {
  grid-column: 1 / -1;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
```

### Pricing Table

```css
.pricing {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  max-width: 1000px;
  margin: 0 auto;
}

.pricing__card--featured {
  transform: scale(1.05);
  z-index: 1;
}

@media (max-width: 768px) {
  .pricing {
    grid-template-columns: 1fr;
  }

  .pricing__card--featured {
    transform: none;
  }
}
```

### Magazine Layout

```css
.magazine {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(3, 200px);
  gap: 1rem;
}

.magazine__article--hero {
  grid-column: 1 / 3;
  grid-row: 1 / 3;
}

.magazine__article--sidebar {
  grid-column: 3 / 5;
  grid-row: 1;
}
```

---

## Subgrid

### Basic Subgrid

```css
/* Parent defines tracks */
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

/* Child inherits parent's tracks */
.grid__item {
  display: grid;
  grid-template-columns: subgrid;
  grid-row: span 2;
}
```

### Alignment with Subgrid

```css
/* Cards with aligned content */
.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.card {
  display: grid;
  grid-template-rows: subgrid;
  grid-row: span 3; /* header, body, footer */
}

/* All card headers align, all footers align */
```

---

## Advanced Techniques

### Overlapping Items

```css
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(2, 200px);
}

.hero {
  grid-column: 1 / -1;  /* Full width */
  grid-row: 1;
}

.overlay {
  grid-column: 1 / 3;
  grid-row: 2;
  align-self: end;
  transform: translateY(50%);
}
```

### Aspect Ratio

```css
.square {
  aspect-ratio: 1;
}

.wide {
  aspect-ratio: 16 / 9;
}

.portrait {
  aspect-ratio: 3 / 4;
}
```

### Grid with Flexbox (Hybrid)

```css
/* Grid for page layout */
.page {
  display: grid;
  grid-template-columns: 250px 1fr;
  min-height: 100vh;
}

/* Flexbox within grid items */
.card {
  display: flex;
  flex-direction: column;
}

.card__content {
  flex: 1; /* Push footer to bottom */
}
```

### Container Queries with Grid

```css
.card-container {
  container-type: inline-size;
}

.card-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@container (min-width: 500px) {
  .card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@container (min-width: 900px) {
  .card-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

---

## Grid vs Flexbox

### When to Use Grid

- Two-dimensional layouts (rows AND columns)
- Page-level layouts
- Complex component arrangements
- Overlapping elements
- When you need precise item placement

### When to Use Flexbox

- One-dimensional layouts (row OR column)
- Content distribution along an axis
- When items need to grow/shrink independently
- Navigation bars
- Card content alignment

### Combination Pattern

```css
/* Grid for overall layout */
.page {
  display: grid;
  grid-template-columns: 250px 1fr;
}

/* Flexbox for component internals */
.nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.card {
  display: flex;
  flex-direction: column;
}
```

---

## Browser Support

- Chrome: 57+
- Firefox: 52+
- Safari: 10.1+
- Edge: 16+

### Fallback Pattern

```css
/* Flexbox fallback */
.container {
  display: flex;
  flex-wrap: wrap;
}

.container > * {
  flex: 1 1 300px;
}

/* Grid override */
@supports (display: grid) {
  .container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }

  .container > * {
    flex: none;
  }
}
```

---

## Best Practices

1. **Use `auto-fill`/`auto-fit`** for responsive grids without media queries
2. **Name grid areas** for readable, maintainable layouts
3. **Use `gap`** instead of margins on grid items
4. **Prefer `fr` units** for proportional sizing
5. **Use `minmax()`** for flexible constraints
6. **Combine Grid + Flexbox** - Grid for layout, Flexbox for component internals
7. **Use `place-items: center`** for quick centering
8. **Override `min-width: auto`** on grid items if text overflow is an issue
9. **Use `grid-auto-flow: dense`** carefully - it can reorder items
10. **Use `aspect-ratio`** instead of padding-bottom hacks
