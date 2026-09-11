# Image Optimization Patterns

## Overview

Images typically account for 50%+ of page weight on most websites. Proper optimization directly impacts LCP, CLS, bandwidth usage, and user experience. This guide covers formats, responsive images, lazy loading, and layout shift prevention.

---

## 1. Image Format Selection

### Format Comparison

| Format | Best For | Compression | Browser Support | Typical Size Reduction |
|--------|----------|-------------|-----------------|----------------------|
| **AVIF** | Photos, complex images | Lossy + Lossless | Chrome 85+, Firefox 93+, Safari 16.4+ | ~50% vs JPEG |
| **WebP** | Photos, transparent images | Lossy + Lossless | 97%+ global support | ~25-35% vs JPEG |
| **JPEG** | Photos (fallback) | Lossy | Universal | Baseline |
| **PNG** | Graphics, transparency | Lossless | Universal | ~80% larger than WebP |
| **SVG** | Icons, logos, illustrations | Vector | Universal | Scales perfectly |
| **GIF** | Simple animations | Both | Universal | Replace with video |

### Format Decision Tree

```
Is it a vector graphic (icon, logo, diagram)?
  YES --> Use SVG
  NO --> Is it an animation?
    YES --> Use MP4/WebM video instead of GIF
    NO --> Does it need transparency?
      YES --> Is photo-like? --> Use AVIF/WebP with alpha
              Is graphical? --> Use PNG (fallback) or SVG
      NO --> Is it a photo?
        YES --> Use AVIF (best) > WebP > JPEG (fallback)
        NO --> Use WebP or AVIF
```

### WebP Implementation

```html
<!-- Format negotiation with <picture> -->
<picture>
  <source srcset="image.avif" type="image/avif">
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="Description" width="800" height="600">
</picture>
```

```bash
# Convert to WebP
cwebp -q 80 input.jpg -o output.webp

# Convert to AVIF
avifenc --min 0 --max 63 -a end-usage=q -a cq-level=30 input.jpg output.avif
```

### Replace GIF with Video

```html
<!-- BAD: Heavy animated GIF -->
<img src="animation.gif" alt="Animated content" width="400" height="300">

<!-- GOOD: Lightweight video -->
<video autoplay loop muted playsinline width="400" height="300">
  <source src="animation.webm" type="video/webm">
  <source src="animation.mp4" type="video/mp4">
</video>
```

---

## 2. Responsive Images

### Using `srcset` and `sizes`

```html
<!-- Serve different image sizes based on viewport -->
<img
  srcset="
    hero-400.jpg   400w,
    hero-800.jpg   800w,
    hero-1200.jpg 1200w,
    hero-1600.jpg 1600w
  "
  sizes="
    (max-width: 600px) 100vw,
    (max-width: 1000px) 50vw,
    33vw
  "
  src="hero-800.jpg"
  alt="Hero image"
  width="1600"
  height="800"
  loading="lazy"
  decoding="async"
>
```

**How `sizes` works:**
1. Browser evaluates media queries from left to right
2. Uses the first matching condition
3. Multiplies the resulting width by device pixel ratio
4. Selects the best `srcset` candidate

### Art Direction with `<picture>`

Serve completely different crops for different viewports:

```html
<picture>
  <!-- Mobile: square crop -->
  <source
    media="(max-width: 600px)"
    srcset="hero-mobile.avif 400w, hero-mobile-2x.avif 800w"
    type="image/avif"
  >
  <source
    media="(max-width: 600px)"
    srcset="hero-mobile.webp 400w, hero-mobile-2x.webp 800w"
    type="image/webp"
  >

  <!-- Tablet: landscape crop -->
  <source
    media="(max-width: 1000px)"
    srcset="hero-tablet.avif 800w, hero-tablet-2x.avif 1600w"
    type="image/avif"
  >
  <source
    media="(max-width: 1000px)"
    srcset="hero-tablet.webp 800w, hero-tablet-2x.webp 1600w"
    type="image/webp"
  >

  <!-- Desktop: wide crop -->
  <source srcset="hero-desktop.avif 1600w" type="image/avif">
  <source srcset="hero-desktop.webp 1600w" type="image/webp">

  <!-- Fallback -->
  <img src="hero-desktop.jpg" alt="Hero image" width="1600" height="800">
</picture>
```

### DPR-Aware Images

```html
<!-- Serve different images based on device pixel ratio -->
<img
  srcset="
    photo.jpg   1x,
    photo-2x.jpg 2x,
    photo-3x.jpg 3x
  "
  src="photo.jpg"
  alt="Description"
  width="400"
  height="300"
>
```

---

## 3. Lazy Loading

### Native Lazy Loading (Simplest)

```html
<!-- Browser-level lazy loading -->
<img
  src="image.jpg"
  alt="Below the fold image"
  loading="lazy"
  decoding="async"
  width="800"
  height="600"
>
```

**Important:** Never use `loading="lazy"` on your LCP image (above-the-fold hero).

### Intersection Observer Pattern (More Control)

```html
<img
  src=""
  data-src="image.jpg"
  alt="Lazy loaded image"
  class="lazy"
  width="800"
  height="600"
>
```

```javascript
const imageObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      img.classList.remove('lazy');
      imageObserver.unobserve(img);
    }
  });
}, {
  rootMargin: '200px 0px', // Load 200px before entering viewport
  threshold: 0.01
});

document.querySelectorAll('img.lazy').forEach(img => {
  imageObserver.observe(img);
});
```

### Lazy Loading with Blur-Up Placeholder

```css
img.lazy {
  filter: blur(10px);
  transition: filter 0.3s;
}

img.lazy.loaded {
  filter: blur(0);
}
```

```javascript
const imageObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;

      // Create low-res placeholder first
      const lowRes = new Image();
      lowRes.src = img.dataset.placeholder;
      lowRes.onload = () => {
        img.src = img.dataset.src;
        img.classList.add('loaded');
      };

      imageObserver.unobserve(img);
    }
  });
}, { rootMargin: '300px 0px' });
```

### Lazy Loading Background Images

```javascript
const bgObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      el.style.backgroundImage = `url(${el.dataset.bg})`;
      bgObserver.unobserve(el);
    }
  });
}, { rootMargin: '200px 0px' });

document.querySelectorAll('[data-bg]').forEach(el => {
  bgObserver.observe(el);
});
```

### Performance Considerations

- Do not lazy load images above the fold (hurts LCP)
- Use `rootMargin` to preload images before they enter the viewport
- Combine `loading="lazy"` with `decoding="async"` for native lazy loading
- Be cautious with too much lazy loading -- it can cause layout shifts if not paired with dimensions

---

## 4. Preventing Layout Shift (CLS)

### Always Set Width and Height

```html
<!-- The browser uses width/height to calculate aspect ratio -->
<img src="photo.jpg" width="800" height="600" alt="Description">
```

```css
/* CSS makes the image responsive while maintaining aspect ratio */
img {
  max-width: 100%;
  height: auto;
}
```

### Aspect Ratio Containers

```css
/* Modern approach: use aspect-ratio */
.image-container {
  aspect-ratio: 16 / 9;
  background: #f0f0f0;
  overflow: hidden;
}

.image-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Legacy approach: padding-top hack */
.image-container {
  position: relative;
  padding-top: 56.25%; /* 9/16 * 100 */
}

.image-container img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
```

### Skeleton Placeholders

```css
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

```html
<div class="skeleton" style="aspect-ratio: 16/9; width: 100%; border-radius: 8px;"></div>
```

---

## 5. Image CDNs

Image CDNs automatically handle format conversion, resizing, compression, and delivery.

### Common Image CDN Patterns

```bash
# imgix URL-based transformations
https://example.imgix.net/photo.jpg?w=800&h=600&fit=crop&auto=format,compress

# Cloudinary transformations
https://res.cloudinary.com/demo/image/upload/w_800,h_600,c_fill,f_auto,q_auto/photo.jpg

# Cloudflare Images
https://example.com/cdn-cgi/image/width=800,height=600,format=auto/photo.jpg
```

### Server-Side Format Negotiation

```javascript
// Express.js example
app.use('/images', (req, res, next) => {
  const accept = req.get('Accept');

  if (accept.includes('image/avif') && supportsAvif(req.path)) {
    return serveImage(req, res, '.avif');
  }
  if (accept.includes('image/webp') && supportsWebp(req.path)) {
    return serveImage(req, res, '.webp');
  }
  return next();
});
```

---

## 6. Compression

### Lossy Compression Settings

| Format | Recommended Quality | Notes |
|--------|-------------------|-------|
| JPEG | 75-85 | Lower for thumbnails, higher for hero images |
| WebP | 75-85 | Same quality at smaller file size |
| AVIF | 63-70 | Lower quality value needed for equivalent quality |

### Lossless Compression

```bash
# OptiPNG for PNG images
optipng -o7 input.png

# Zopflipng for maximum PNG compression
zopflipng --lossy_transparent -m input.png output.png

# SVGO for SVG optimization
npx svgo input.svg -o output.svg
```

---

## 7. Critical Patterns Summary

| Pattern | Impact | Implementation |
|---------|--------|---------------|
| Use AVIF/WebP | 25-50% smaller files | `<picture>` element |
| Responsive images | Correct sizing per viewport | `srcset` + `sizes` |
| Lazy loading | Faster initial load | `loading="lazy"` or Intersection Observer |
| Set dimensions | Prevents CLS | `width`/`height` attributes + CSS `height: auto` |
| Image CDN | Auto-optimization at edge | imgix, Cloudinary, Cloudflare |
| Replace GIF with video | 90%+ size reduction | `<video autoplay loop muted>` |
| Compression | 25-75% smaller files | Build tools, CDN, server config |

---

*Sources: web.dev (serve-images-webp, image-performance, fast), MDN (responsive images)*
