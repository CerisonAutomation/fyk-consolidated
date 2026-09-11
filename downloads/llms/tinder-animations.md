# Tinder Swipe Animation Implementation Patterns

> Source: FWD Tools swipe cards snippet, CodePen implementations, FreeFrontend card stack, Medium animation tutorials, GitHub Tinder clones. Compiled September 2026.

## Overview

The swipe card is the most iconic dating app interaction. Tinder invented it, and nearly every dating app since has iterated on the same card-based browsing pattern. This document covers the technical implementation of swipe animations using HTML, CSS, and JavaScript.

---

## Core Swipe Mechanics

### The Interaction Model

1. **Card stack**: 3-5 cards stacked with slight offset (showing edges of cards behind)
2. **Drag gesture**: User drags the top card left or right
3. **Rotation**: Card rotates slightly as it's dragged (proportional to drag distance)
4. **Stamp overlay**: "LIKE" (green) or "NOPE" (red) stamp appears as card is dragged
5. **Threshold**: If dragged far enough, card flies off-screen; otherwise snaps back
6. **Stack advancement**: Next card moves up when top card is dismissed

### Gesture Thresholds

```
Swipe Right (Like):
- Horizontal distance > 100px (or 30% of card width)
- Triggers "LIKE" animation
- Card flies off right side

Swipe Left (Nope):
- Horizontal distance < -100px (or 30% of card width)
- Triggers "NOPE" animation
- Card flies off left side

Snap Back:
- Distance < threshold
- Card returns to center with spring animation

Vertical Swipe (Super Like):
- Vertical distance < -100px (upward)
- Triggers "SUPER LIKE" animation
- Card flies off top
```

---

## CSS Implementation

### Card Stack Structure

```css
/* Stack wrapper */
.card-stack {
  position: relative;
  width: 300px;
  height: 400px;
}

/* Individual card */
.card {
  position: absolute;
  inset: 0;
  border-radius: 20px;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  touch-action: none;
  will-change: transform;
  box-shadow: 0 8px 32px rgba(0,0,0,0.14), 
              0 2px 8px rgba(0,0,0,0.08);
  
  /* Default spring-back animation */
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* While being dragged - no transition for smooth tracking */
.card.is-dragging {
  cursor: grabbing;
  transition: none;
}

/* Flying off screen - smooth exit animation */
.card.is-flying {
  transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), 
              opacity 0.45s ease;
}
```

### Card Visual Design

```css
/* Card background (photo) */
.card-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
}

/* Gradient overlay for text readability */
.card-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 24px 22px;
  background: linear-gradient(
    to top, 
    rgba(0,0,0,0.55) 0%, 
    rgba(0,0,0,0.1) 55%, 
    transparent 100%
  );
}

/* Name and info overlay */
.card-name {
  font-size: 22px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0,0,0,0.3);
}

.card-info {
  font-size: 13px;
  color: rgba(255,255,255,0.88);
  margin-top: 4px;
}
```

### Stamp Overlays

```css
/* LIKE stamp (green, right side) */
.stamp-like {
  position: absolute;
  top: 28px;
  right: 18px;
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 0.08em;
  padding: 6px 14px;
  border-radius: 8px;
  border: 3px solid #22c55e;
  color: #22c55e;
  transform: rotate(12deg);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.06s linear;
}

/* NOPE stamp (red, left side) */
.stamp-nope {
  position: absolute;
  top: 28px;
  left: 18px;
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 0.08em;
  padding: 6px 14px;
  border-radius: 8px;
  border: 3px solid #ef4444;
  color: #ef4444;
  transform: rotate(-12deg);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.06s linear;
}

/* Stamp opacity tied to drag distance */
.card.dragging-right .stamp-like { opacity: 1; }
.card.dragging-left .stamp-nope { opacity: 1; }
```

### Stack Depth Effect

```css
/* Cards behind the top card */
.card:nth-child(2) {
  transform: scale(0.95) translateY(10px);
  z-index: -1;
}

.card:nth-child(3) {
  transform: scale(0.90) translateY(20px);
  z-index: -2;
}

.card:nth-child(4) {
  transform: scale(0.85) translateY(30px);
  z-index: -3;
}
```

---

## JavaScript Implementation

### Core Swipe Logic

```javascript
class SwipeCard {
  constructor(element) {
    this.element = element;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.isDragging = false;
    this.threshold = 100; // pixels
    
    this.bindEvents();
  }
  
  bindEvents() {
    // Mouse events
    this.element.addEventListener('mousedown', this.onStart.bind(this));
    document.addEventListener('mousemove', this.onMove.bind(this));
    document.addEventListener('mouseup', this.onEnd.bind(this));
    
    // Touch events
    this.element.addEventListener('touchstart', this.onStart.bind(this));
    document.addEventListener('touchmove', this.onMove.bind(this));
    document.addEventListener('touchend', this.onEnd.bind(this));
  }
  
  onStart(e) {
    this.isDragging = true;
    this.startX = e.type === 'touchstart' 
      ? e.touches[0].clientX 
      : e.clientX;
    this.startY = e.type === 'touchstart' 
      ? e.touches[0].clientY 
      : e.clientY;
    
    this.element.classList.add('is-dragging');
  }
  
  onMove(e) {
    if (!this.isDragging) return;
    
    const clientX = e.type === 'touchmove' 
      ? e.touches[0].clientX 
      : e.clientX;
    const clientY = e.type === 'touchmove' 
      ? e.touches[0].clientY 
      : e.clientY;
    
    this.currentX = clientX - this.startX;
    const currentY = clientY - this.startY;
    
    // Apply transform
    const rotation = this.currentX * 0.1; // degrees
    this.element.style.transform = 
      `translateX(${this.currentX}px) translateY(${currentY * 0.5}px) rotate(${rotation}deg)`;
    
    // Update stamp opacity based on drag distance
    const opacity = Math.min(Math.abs(this.currentX) / this.threshold, 1);
    if (this.currentX > 0) {
      this.element.querySelector('.stamp-like').style.opacity = opacity;
      this.element.querySelector('.stamp-nope').style.opacity = 0;
    } else {
      this.element.querySelector('.stamp-nope').style.opacity = opacity;
      this.element.querySelector('.stamp-like').style.opacity = 0;
    }
    
    // Update color tint
    if (this.currentX > 0) {
      this.element.style.boxShadow = 
        `0 0 ${opacity * 30}px rgba(34, 197, 94, ${opacity * 0.5})`;
    } else {
      this.element.style.boxShadow = 
        `0 0 ${opacity * 30}px rgba(239, 68, 68, ${opacity * 0.5})`;
    }
  }
  
  onEnd() {
    if (!this.isDragging) return;
    this.isDragging = false;
    
    this.element.classList.remove('is-dragging');
    this.element.classList.add('is-flying');
    
    if (Math.abs(this.currentX) > this.threshold) {
      // Fly off screen
      const direction = this.currentX > 0 ? 1 : -1;
      this.element.style.transform = 
        `translateX(${direction * 1000}px) rotate(${direction * 30}deg)`;
      this.element.style.opacity = '0';
      
      // Trigger match/no-match callback
      this.onSwipe(direction > 0 ? 'right' : 'left');
    } else {
      // Snap back to center
      this.element.style.transform = 'translateX(0) rotate(0)';
      this.element.style.boxShadow = '';
    }
    
    this.currentX = 0;
  }
  
  onSwipe(direction) {
    // Override this method for custom behavior
    console.log(`Swiped ${direction}`);
  }
}
```

### Button Controls

```javascript
// Like button (heart)
document.getElementById('like-btn').addEventListener('click', () => {
  const card = document.querySelector('.card:last-child');
  card.classList.add('is-flying');
  card.style.transform = 'translateX(1000px) rotate(30deg)';
  card.style.opacity = '0';
  onSwipe('right');
});

// Nope button (X)
document.getElementById('nope-btn').addEventListener('click', () => {
  const card = document.querySelector('.card:last-child');
  card.classList.add('is-flying');
  card.style.transform = 'translateX(-1000px) rotate(-30deg)';
  card.style.opacity = '0';
  onSwipe('left');
});

// Super Like button (star)
document.getElementById('superlike-btn').addEventListener('click', () => {
  const card = document.querySelector('.card:last-child');
  card.classList.add('is-flying');
  card.style.transform = 'translateY(-1000px) rotate(0deg)';
  card.style.opacity = '0';
  onSwipe('up');
});
```

### Keyboard Controls

```javascript
document.addEventListener('keydown', (e) => {
  const card = document.querySelector('.card:last-child');
  if (!card) return;
  
  switch(e.key) {
    case 'ArrowLeft':
      // Nope
      card.classList.add('is-flying');
      card.style.transform = 'translateX(-1000px) rotate(-30deg)';
      card.style.opacity = '0';
      onSwipe('left');
      break;
    case 'ArrowRight':
      // Like
      card.classList.add('is-flying');
      card.style.transform = 'translateX(1000px) rotate(30deg)';
      card.style.opacity = '0';
      onSwipe('right');
      break;
    case 'ArrowUp':
      // Super Like
      card.classList.add('is-flying');
      card.style.transform = 'translateY(-1000px)';
      card.style.opacity = '0';
      onSwipe('up');
      break;
  }
});
```

---

## Animation Details

### Timing Functions

```css
/* Spring-back animation (when card snaps back) */
transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);

/* Fly-off animation (when card is dismissed) */
transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), 
            opacity 0.45s ease;

/* Stamp fade-in (instant but smooth) */
transition: opacity 0.06s linear;
```

### Haptic Feedback (Mobile)

```javascript
// Trigger haptic feedback on swipe threshold
if (Math.abs(distance) > threshold && !this.hapticTriggered) {
  navigator.vibrate(10); // Short vibration
  this.hapticTriggered = true;
}
```

### Color Tint Animation

```javascript
// Green tint for like (right swipe)
const likeIntensity = Math.min(distance / threshold, 1);
card.style.boxShadow = `0 0 ${likeIntensity * 30}px rgba(34, 197, 94, ${likeIntensity * 0.5})`;

// Red tint for nope (left swipe)
const nopeIntensity = Math.min(Math.abs(distance) / threshold, 1);
card.style.boxShadow = `0 0 ${nopeIntensity * 30}px rgba(239, 68, 68, ${nopeIntensity * 0.5})`;
```

---

## Match Celebration Animation

### Confetti Effect

```javascript
function showMatchAnimation() {
  // Create confetti container
  const confetti = document.createElement('div');
  confetti.className = 'match-confetti';
  document.body.appendChild(confetti);
  
  // Generate confetti pieces
  for (let i = 0; i < 100; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.animationDelay = Math.random() * 0.5 + 's';
    piece.style.backgroundColor = 
      ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3'][Math.floor(Math.random() * 4)];
    confetti.appendChild(piece);
  }
  
  // Show "It's a Match!" overlay
  const matchOverlay = document.createElement('div');
  matchOverlay.className = 'match-overlay';
  matchOverlay.innerHTML = `
    <h2>It's a Match!</h2>
    <p>You and [name] liked each other</p>
    <button>Send Message</button>
  `;
  document.body.appendChild(matchOverlay);
  
  // Cleanup after animation
  setTimeout(() => {
    confetti.remove();
    matchOverlay.remove();
  }, 3000);
}
```

### Match Overlay CSS

```css
.match-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

.match-overlay h2 {
  font-size: 36px;
  color: #fff;
  margin-bottom: 16px;
  animation: bounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes bounceIn {
  from { transform: scale(0); }
  to { transform: scale(1); }
}
```

---

## Performance Optimization

### will-change Property

```css
.card {
  will-change: transform;
}
```

### Passive Event Listeners

```javascript
document.addEventListener('touchmove', this.onMove.bind(this), { passive: true });
```

### requestAnimationFrame

```javascript
onMove(e) {
  if (!this.isDragging) return;
  
  requestAnimationFrame(() => {
    // Apply transform in animation frame
    this.element.style.transform = `translateX(${this.currentX}px) rotate(${rotation}deg)`;
  });
}
```

### GPU Acceleration

```css
.card {
  transform: translateZ(0); /* Force GPU layer */
  backface-visibility: hidden;
}
```

---

## Accessibility Considerations

1. **Keyboard navigation**: Arrow keys for swipe actions
2. **Screen reader announcements**: Announce card content and swipe results
3. **Reduced motion**: Respect `prefers-reduced-motion` media query
4. **Focus management**: Ensure focus moves appropriately after swipe

```css
@media (prefers-reduced-motion: reduce) {
  .card {
    transition: none;
  }
  
  .card.is-flying {
    transition: opacity 0.2s ease;
  }
}
```

---

## Key Takeaways for Implementation

1. **Pointer events** (mouse + touch) provide the most reliable cross-platform gesture handling
2. **Rotation proportional to drag distance** creates natural-feeling physics
3. **Stamp opacity tied to drag distance** gives visual feedback before threshold
4. **Color tint (green/red glow)** reinforces like/nope intent
5. **Spring-back animation** (overshoot cubic-bezier) feels playful and satisfying
6. **Fly-off animation** should be fast (0.45s) and directional
7. **Card stack depth** (scale + translateY) creates layered visual hierarchy
8. **Button and keyboard controls** are essential for accessibility and power users
9. **Match celebration** (confetti + overlay) triggers dopamine and encourages continued use
10. **Performance**: use `will-change`, passive listeners, and `requestAnimationFrame`

---

## References

- FWD Tools Swipe Cards: https://fwdtools.com/ui-snippets/swipe-cards/
- CodePen Tinder Cards: https://codepen.io/RobVermeer/pen/japZpY/
- FreeFrontend Card Stack: https://freefrontend.com/code/tinder-style-swipeable-card-stack-2026-03-23/
- GitHub Tinder Clone: https://github.com/elpanayurich/tinder
- Medium Animation Tutorial: https://medium.com/@japeshsinghal/swipe-right-on-fun-creating-tinder-style-card-animations-a845e29601e5
- Gummble Design Analysis: https://gummble.com/blog/best-dating-app-designs-2026
