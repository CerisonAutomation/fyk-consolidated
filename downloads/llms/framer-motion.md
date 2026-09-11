# Framer Motion / Motion for React - Animation Patterns

> Compiled from official documentation at motion.dev (2024+)
> Note: Framer Motion has been renamed to "Motion" (motion.dev)

---

## Table of Contents

1. [Installation & Setup](#installation--setup)
2. [Core Concepts](#core-concepts)
3. [Basic Animations](#basic-animations)
4. [Gesture Animations](#gesture-animations)
5. [Scroll Animations](#scroll-animations)
6. [Layout Animations](#layout-animations)
7. [AnimatePresence (Exit Animations)](#animatepresence-exit-animations)
8. [Spring Physics](#spring-physics)
9. [Keyframe Animations](#keyframe-animations)
10. [SVG Animations](#svg-animations)
11. [Scroll-Linked Animations](#scroll-linked-animations)
12. [Stagger Animations](#stagger-animations)
13. [Variants](#variants)
14. [Motion Values](#motion-values)
15. [Animation Controls](#animation-controls)
16. [Layout ID (Shared Layout)](#layout-id-shared-layout)
17. [Performance Tips](#performance-tips)
18. [Common Patterns & Recipes](#common-patterns--recipes)

---

## Installation & Setup

```bash
npm install motion
```

```tsx
import { motion } from "motion/react";
```

**Key features:**
- Hybrid engine: Web Animations API (120fps) with JS fallback
- Declarative API that integrates with React state and props
- Built-in gesture recognition (tap, drag, hover, focus)
- Layout animations with `layout` prop
- Scroll-triggered and scroll-linked animations
- TypeScript-first, tree-shakable

---

## Core Concepts

### The `motion` Component

Prefix any HTML/SVG tag with `motion.` to make it animatable:

```tsx
import { motion } from "motion/react";

<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.5 }}
>
  Hello World
</motion.div>
```

### Core Props

| Prop | Purpose |
|------|---------|
| `initial` | Starting state before animation |
| `animate` | Target state to animate to |
| `exit` | State when component unmounts |
| `transition` | Animation configuration |
| `whileHover` | State while hovering |
| `whileTap` | State while tapping |
| `whileFocus` | State while focused |
| `whileDrag` | State while dragging |
| `whileInView` | State when scrolled into view |
| `layout` | Animate layout changes |
| `layoutId` | Shared layout animations |

---

## Basic Animations

### Fade In

```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.6 }}
>
  Fades in
</motion.div>
```

### Slide In

```tsx
// Slide from left
<motion.div
  initial={{ x: -100, opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  transition={{ duration: 0.5, ease: "easeOut" }}
>
  Slides in from left
</motion.div>

// Slide from bottom
<motion.div
  initial={{ y: 50, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  transition={{ duration: 0.4 }}
>
  Slides up
</motion.div>
```

### Scale Animation

```tsx
<motion.div
  initial={{ scale: 0.8, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ type: "spring", stiffness: 300, damping: 20 }}
>
  Scales in
</motion.div>
```

### Animated Value Change

```tsx
function AnimatedCounter({ value }) {
  return (
    <motion.span
      key={value}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      {value}
    </motion.span>
  );
}
```

---

## Gesture Animations

### Hover & Tap

```tsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
>
  Click Me
</motion.button>
```

### Complex Hover Effect

```tsx
<motion.div
  whileHover={{
    scale: 1.02,
    boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
  }}
  transition={{ type: "spring", stiffness: 300 }}
  style={{
    padding: "20px",
    borderRadius: "12px",
    background: "white",
  }}
>
  Card with hover effect
</motion.div>
```

### Drag

```tsx
<motion.div
  drag
  dragConstraints={{ left: -100, right: 100, top: -50, bottom: 50 }}
  dragElastic={0.1}
  whileDrag={{ scale: 1.05, cursor: "grabbing" }}
  style={{ cursor: "grab" }}
>
  Drag me
</motion.div>
```

### Drag with Snap

```tsx
function DraggableCard() {
  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 300 }}
      dragSnapToOrigin
      whileDrag={{ scale: 1.05 }}
      onDragEnd={(event, info) => {
        console.log(info.offset.x);
      }}
    >
      Swipe me
    </motion.div>
  );
}
```

---

## Scroll Animations

### Trigger on Viewport Entry

```tsx
<motion.div
  initial={{ opacity: 0, y: 50 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: 0.6 }}
>
  Animates when scrolled into view (once)
</motion.div>
```

### Repeated Scroll Animation

```tsx
<motion.div
  initial={{ opacity: 0 }}
  whileInView={{ opacity: 1 }}
  viewport={{ once: false, amount: 0.5 }}
>
  Animates every time it enters the viewport
</motion.div>
```

### Scroll Progress Bar

```tsx
import { motion, useScroll, useSpring } from "motion/react";

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "4px",
        background: "blue",
        scaleX,
        transformOrigin: "0%",
      }}
    />
  );
}
```

---

## Layout Animations

### Basic Layout

```tsx
<motion.div layout>
  Content that animates when its position changes
</motion.div>
```

### Animated Grid

```tsx
function AnimatedGrid({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
      {items.map((item) => (
        <motion.div
          key={item.id}
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: "20px",
            background: "white",
            borderRadius: "8px",
          }}
        >
          {item.name}
        </motion.div>
      ))}
    </div>
  );
}
```

### Animated Sidebar

```tsx
function Sidebar({ isOpen }) {
  return (
    <motion.aside
      layout
      animate={{ width: isOpen ? 300 : 60 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{ background: "#f0f0f0", height: "100vh" }}
    >
      {isOpen ? <ExpandedContent /> : <CollapsedIcons />}
    </motion.aside>
  );
}
```

---

## AnimatePresence (Exit Animations)

Wraps components that should animate when removed from the DOM.

```tsx
import { AnimatePresence, motion } from "motion/react";

function Modal({ isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              padding: "24px",
              borderRadius: "12px",
            }}
          >
            <h2>Modal Title</h2>
            <p>Modal content</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### List Animations

```tsx
function AnimatedList({ items }) {
  return (
    <ul>
      <AnimatePresence>
        {items.map((item) => (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            layout
          >
            {item.text}
            <button onClick={() => onRemove(item.id)}>Remove</button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
```

---

## Spring Physics

Springs provide natural-feeling animations.

```tsx
// Default spring
<motion.div animate={{ x: 100 }} transition={{ type: "spring" }} />

// Custom spring
<motion.div
  animate={{ x: 100 }}
  transition={{
    type: "spring",
    stiffness: 300,   // Higher = snappier
    damping: 20,       // Higher = less bouncy
    mass: 1,           // Higher = slower
  }}
/>

// Stiff spring (snappy)
<motion.div
  transition={{ type: "spring", stiffness: 500, damping: 30 }}
/>

// Bouncy spring
<motion.div
  transition={{ type: "spring", stiffness: 200, damping: 10 }}
/>

// Gentle spring
<motion.div
  transition={{ type: "spring", stiffness: 100, damping: 20 }}
/>
```

### Spring Presets

```tsx
const springConfig = {
  snappy: { stiffness: 500, damping: 30 },
  gentle: { stiffness: 100, damping: 20 },
  bouncy: { stiffness: 200, damping: 10 },
  wobbly: { stiffness: 150, damping: 8 },
};
```

---

## Keyframe Animations

```tsx
// Multiple keyframes
<motion.div
  animate={{
    scale: [1, 1.2, 1],
    rotate: [0, 10, -10, 0],
  }}
  transition={{
    duration: 0.5,
    times: [0, 0.3, 0.7, 1], // Custom timing
  }}
/>

// Pulsing animation
<motion.div
  animate={{
    scale: [1, 1.05, 1],
  }}
  transition={{
    duration: 2,
    repeat: Infinity,
    ease: "easeInOut",
  }}
/>

// Continuous rotation
<motion.div
  animate={{ rotate: 360 }}
  transition={{
    duration: 2,
    repeat: Infinity,
    ease: "linear",
  }}
/>
```

---

## SVG Animations

### Path Drawing

```tsx
<motion.svg viewBox="0 0 100 100">
  <motion.circle
    cx="50"
    cy="50"
    r="40"
    initial={{ pathLength: 0 }}
    animate={{ pathLength: 1 }}
    transition={{ duration: 2, ease: "easeInOut" }}
    fill="none"
    stroke="blue"
    strokeWidth="2"
  />
</motion.svg>
```

### Animated SVG Icon

```tsx
function Checkmark({ isActive }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      initial={false}
      animate={isActive ? { pathLength: 1 } : { pathLength: 0 }}
    >
      <motion.path
        d="M5 12l5 5L20 7"
        fill="none"
        stroke="green"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.svg>
  );
}
```

---

## Scroll-Linked Animations

Link animations directly to scroll progress.

```tsx
import { motion, useScroll, useTransform } from "motion/react";

function ParallaxSection() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [1, 0.5, 0]);

  return (
    <motion.div style={{ y, opacity }}>
      Parallax content
    </motion.div>
  );
}
```

### Section-Based Scroll

```tsx
function ScrollSection() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 0.8]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 0]);

  return (
    <motion.div ref={ref} style={{ scale, opacity }}>
      Section content
    </motion.div>
  );
}
```

---

## Stagger Animations

### Stagger with Variants

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function StaggeredList({ items }) {
  return (
    <motion.ul
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {items.map((item) => (
        <motion.li key={item.id} variants={itemVariants}>
          {item.name}
        </motion.li>
      ))}
    </motion.ul>
  );
}
```

### Stagger with useInView

```tsx
function StaggerCards() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        visible: {
          transition: { staggerChildren: 0.15 },
        },
      }}
    >
      {[1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          variants={{
            hidden: { opacity: 0, y: 40 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          style={{ padding: "20px", background: "white", marginBottom: "16px" }}
        >
          Card {i}
        </motion.div>
      ))}
    </motion.div>
  );
}
```

---

## Variants

Variants let you define named animation states and propagate them through the component tree.

```tsx
const buttonVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.1 },
  tap: { scale: 0.95 },
};

function AnimatedButton({ children }) {
  return (
    <motion.button
      variants={buttonVariants}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      {children}
    </motion.button>
  );
}
```

### Orchestration

```tsx
const parentVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.1,
    },
  },
};

const childVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300 },
  },
};

function AnimatedContainer({ children }) {
  return (
    <motion.div
      variants={parentVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}
```

---

## Motion Values

Reactive values that update without causing re-renders.

```tsx
import { motion, useMotionValue, useTransform } from "motion/react";

function DraggableBox() {
  const x = useMotionValue(0);
  const scale = useTransform(x, [-200, 0, 200], [1.5, 1, 1.5]);
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);

  return (
    <motion.div
      drag="x"
      style={{ x, scale, rotate }}
    >
      Drag me
    </motion.div>
  );
}
```

---

## Animation Controls

Programmatic control over animations.

```tsx
import { motion, useAnimationControls } from "motion/react";

function ControlledAnimation() {
  const controls = useAnimationControls();

  return (
    <div>
      <motion.div
        animate={controls}
        initial={{ opacity: 0 }}
      />
      <button onClick={() => controls.start({ opacity: 1 })}>
        Show
      </button>
      <button onClick={() => controls.start({ opacity: 0 })}>
        Hide
      </button>
      <button onClick={() => controls.start({
        x: [0, 100, 0],
        transition: { duration: 0.5 },
      })}>
        Move
      </button>
    </div>
  );
}
```

---

## Layout ID (Shared Layout)

Animate between two components as if they're the same element.

```tsx
import { AnimatePresence, motion, LayoutGroup } from "motion/react";

function App() {
  const [selectedId, setSelectedId] = useState(null);

  return (
    <LayoutGroup>
      <div>
        {items.map((item) => (
          <motion.div
            key={item.id}
            layoutId={item.id}
            onClick={() => setSelectedId(item.id)}
            style={{ cursor: "pointer", padding: "20px" }}
          >
            {item.title}
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedId && (
          <motion.div
            layoutId={selectedId}
            onClick={() => setSelectedId(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {items.find((i) => i.id === selectedId)?.title}
          </motion.div>
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}
```

---

## Performance Tips

1. **Use `layout` instead of position calculations** -- Motion handles it natively
2. **Prefer `will-change: transform`** for GPU-accelerated animations
3. **Use `initial={false}`** to skip entry animations
4. **Avoid animating `width`/`height`** -- use `scale` or `layout` instead
5. **Use `useMotionValue`** instead of `useState` for values that don't affect render
6. **Set `viewport={{ once: true }}`** for scroll animations that should only play once
7. **Keep animation trees shallow** -- deep nesting of animated components hurts performance

---

## Common Patterns & Recipes

### Page Transition

```tsx
function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
```

### Toast Notification

```tsx
function Toast({ message, isVisible }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 50, x: "-50%" }}
          style={{
            position: "fixed",
            bottom: "20px",
            left: "50%",
            background: "#333",
            color: "white",
            padding: "12px 24px",
            borderRadius: "8px",
          }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### Accordion

```tsx
function Accordion({ title, children }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>
        {title}
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          ▼
        </motion.span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: "hidden" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### Image Hover Reveal

```tsx
function ImageCard({ src, alt, title }) {
  return (
    <motion.div
      whileHover="hovered"
      initial="rest"
      style={{ position: "relative", overflow: "hidden", borderRadius: "12px" }}
    >
      <motion.img
        src={src}
        alt={alt}
        variants={{
          rest: { scale: 1 },
          hovered: { scale: 1.1 },
        }}
        transition={{ duration: 0.4 }}
        style={{ width: "100%", display: "block" }}
      />
      <motion.div
        variants={{
          rest: { opacity: 0, y: 20 },
          hovered: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.3 }}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "20px",
          background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
          color: "white",
        }}
      >
        {title}
      </motion.div>
    </motion.div>
  );
}
```

---

*Sources: motion.dev, framer.com/motion*
