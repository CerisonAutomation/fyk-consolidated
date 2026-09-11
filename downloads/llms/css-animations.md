# CSS Animations - Performance Patterns & Best Practices

## Overview

CSS animations can be buttery smooth when done correctly. The key principle: only animate properties that trigger **compositing** (not layout or paint). The two safe properties are `transform` and `opacity`.

---

## The Rendering Pipeline

Understanding the browser rendering pipeline is critical for animation performance:

1. **JavaScript** - Calculate changes
2. **Style** - Match selectors, compute styles
3. **Layout** - Calculate geometry (expensive)
4. **Paint** - Fill pixels (expensive)
5. **Composite** - Layer assembly (cheapest)

**Rule: Only animate during the Composite phase for maximum performance.**

---

## Performance Tiers

### Tier 1: Composite Only (Best Performance)

```css
/* SAFE - Only compositor thread */
.animate-position {
  animation: slide 0.3s ease;
}

@keyframes slide {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
```

Safe properties:
- `transform`
- `opacity`

### Tier 2: Paint (Acceptable)

```css
/* Moderate - Triggers repaint but no layout */
.animate-color {
  animation: colorFade 0.3s ease;
}

@keyframes colorFade {
  from { color: transparent; }
  to { color: black; }
}
```

Safe-ish properties:
- `color`
- `background-color`
- `box-shadow`
- `border-color`

### Tier 3: Layout (Avoid)

```css
/* BAD - Triggers layout recalculation */
.animate-layout {
  animation: expand 0.3s ease;
}

@keyframes expand {
  from { width: 100px; top: 0; left: 0; }
  to { width: 200px; top: 50px; left: 50px; }
}
```

Expensive properties:
- `width`, `height`
- `top`, `left`, `right`, `bottom`
- `margin`, `padding`
- `border-width`
- `font-size`
- `box-sizing`

---

## Core Animation Patterns

### Slide In

```css
@keyframes slideInFromLeft {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.slide-in-left {
  animation: slideInFromLeft 0.3s ease-out;
}
```

### Fade In

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fadeIn 0.2s ease-in;
}
```

### Scale Up

```css
@keyframes scaleUp {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.scale-up {
  animation: scaleUp 0.2s ease-out;
}
```

### Bounce

```css
@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-20px);
  }
}

.bounce {
  animation: bounce 0.6s ease-in-out infinite;
}
```

### Pulse

```css
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
}

.pulse {
  animation: pulse 2s ease-in-out infinite;
}
```

### Spin

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spin {
  animation: spin 1s linear infinite;
}
```

---

## Transitions (Implicit Animations)

### Basic Transition

```css
.button {
  background-color: #3b82f6;
  color: white;
  transition: background-color 0.15s ease;
}

.button:hover {
  background-color: #2563eb;
}
```

### Multi-Property Transition

```css
.card {
  transform: translateY(0);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.15);
}
```

### Transition Timing Functions

```css
/* Ease (default) */
.transition-ease {
  transition: transform 0.3s ease;
}

/* Linear */
.transition-linear {
  transition: transform 0.3s linear;
}

/* Ease-in-out (most natural) */
.transition-natural {
  transition: transform 0.3s ease-in-out;
}

/* Spring-like effect using cubic-bezier */
.transition-spring {
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Snappy */
.transition-snappy {
  transition: transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
```

---

## will-change Property

### Purpose

Tells the browser an element will change, allowing it to promote to its own compositing layer.

### Usage

```css
/* Promote to own layer for smooth animation */
.animated-element {
  will-change: transform;
}

/* Multiple properties */
.complex-animation {
  will-change: transform, opacity;
}
```

### Best Practices

```css
/* DO: Apply to elements that frequently animate */
.sidebar {
  will-change: transform;
}

/* DON'T: Apply to everything */
/* .everything { will-change: transform; } */

/* DON'T: Apply too early in development */
/* Use browser DevTools to identify bottlenecks first */

/* Fallback for older browsers */
.legacy-fallback {
  transform: translateZ(0); /* Force GPU layer */
}
```

### Performance Impact

```css
/* Without will-change: CPU compositing */
.element { transform: translateX(100px); }

/* With will-change: GPU compositing */
.element {
  will-change: transform;
  transform: translateX(100px);
}
```

---

## Hardware Acceleration

### Force GPU Layer

```css
/* Method 1: translateZ(0) */
.gpu-layer {
  transform: translateZ(0);
}

/* Method 2: will-change (preferred) */
.gpu-layer {
  will-change: transform;
}

/* Method 3: backface-visibility */
.gpu-layer {
  backface-visibility: hidden;
}
```

### Common Mistake: Over-Promoting

```css
/* BAD - Too many layers cause memory issues */
.container > * {
  will-change: transform; /* Each child gets own layer */
}

/* GOOD - Only promote what's animating */
.container > .animating {
  will-change: transform;
}
```

---

## Scroll-Driven Animations

### Modern Approach (2024+)

```css
@keyframes reveal {
  from {
    opacity: 0;
    transform: translateY(50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.scroll-reveal {
  animation: reveal linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
}
```

### Scroll Progress Bar

```css
@keyframes progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

.progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background: #3b82f6;
  transform-origin: left;
  animation: progress linear;
  animation-timeline: scroll();
}
```

---

## View Transitions API

### Page Transitions

```css
/* Old page fades out */
::view-transition-old(root) {
  animation: fade-out 0.3s ease;
}

/* New page fades in */
::view-transition-new(root) {
  animation: fade-in 0.3s ease;
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### Named Transitions

```css
.hero-image {
  view-transition-name: hero;
}

.hero-image-new {
  view-transition-name: hero;
}

::view-transition-old(hero) {
  animation: scale-down 0.3s ease;
}

::view-transition-new(hero) {
  animation: scale-up 0.3s ease;
}
```

---

## Reduced Motion

### Respect User Preferences

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Selective Reduced Motion

```css
/* Keep layout transitions, reduce decorative animations */
@media (prefers-reduced-motion: reduce) {
  .hero-animation {
    animation: none;
  }

  .page-transition {
    transition-duration: 0.1s;
  }

  .hover-lift {
    transition: none;
  }
}
```

---

## Performance Debugging

### Chrome DevTools

1. **Performance Panel**: Record animation, check for "Recalculate Style" or "Layout"
2. **Rendering Panel**: Enable "Paint Flashing" to visualize repaints
3. **FPS Meter**: Monitor frame rate during animation
4. **Layers Panel**: Check number of compositing layers

### Common Issues

```css
/* Problem: Layout thrashing */
@keyframes bad {
  to { width: 200px; } /* Triggers layout */
}

/* Solution: Use transform */
@keyframes good {
  to { transform: scaleX(1.5); } /* Composite only */
}

/* Problem: Paint storm */
@keyframes bad-shadow {
  to { box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
}

/* Solution: Use opacity on pseudo-element */
@keyframes good-shadow {
  to { opacity: 1; }
}

.shadow-element::after {
  content: '';
  position: absolute;
  inset: 0;
  box-shadow: 0 20px 40px rgba(0,0,0,0.3);
  opacity: 0;
  transition: opacity 0.3s;
}

.shadow-element:hover::after {
  opacity: 1;
}
```

---

## Animation Patterns Library

### Loading Spinner

```css
@keyframes spinner {
  to { transform: rotate(360deg); }
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spinner 0.6s linear infinite;
}
```

### Skeleton Loading

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
```

### Modal Entrance

```css
@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes overlayIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  animation: modalIn 0.2s ease-out;
}

.modal-overlay {
  animation: overlayIn 0.2s ease-out;
}
```

### Toast Notification

```css
@keyframes toastIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes toastOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

.toast {
  animation: toastIn 0.3s ease-out;
}

.toast.exiting {
  animation: toastOut 0.3s ease-in forwards;
}
```

---

## Best Practices Summary

1. **Only animate `transform` and `opacity`** for maximum performance
2. **Use `will-change` sparingly** - only for frequently animated elements
3. **Never animate `width`, `height`, `top`, `left`** - use transforms instead
4. **Use `cubic-bezier()`** for natural-feeling timing
5. **Always respect `prefers-reduced-motion`**
6. **Test with DevTools** - check for layout/paint in Performance panel
7. **Prefer CSS animations over JS** when possible
8. **Use `animation-fill-mode: forwards`** to persist final state
9. **Keep animations under 300ms** for UI interactions
10. **Use `requestAnimationFrame`** if you must animate with JavaScript
