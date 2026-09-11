# Color Contrast Accessibility

> Sources: WCAG 2.2, WebAIM, W3C WAI
> URLs:
> - https://webaim.org/resources/contrastchecker/
> - https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

## WCAG Contrast Requirements

### Level AA (Recommended Minimum)

| Content Type | Minimum Ratio | Examples |
|-------------|---------------|----------|
| Normal text (< 18pt / < 14pt bold) | **4.5:1** | Body text, labels, placeholders |
| Large text (>= 18pt / >= 14pt bold) | **3:1** | Headings, large buttons |
| UI components & graphical objects | **3:1** | Form borders, icons, focus indicators |

### Level AAA (Enhanced)

| Content Type | Minimum Ratio | Examples |
|-------------|---------------|----------|
| Normal text | **7:1** | High-contrast body text |
| Large text | **4.5:1** | High-contrast headings |

**Text Size Reference:**
- 18pt = 24px
- 14pt bold = 18.66px bold
- Large text: 14pt+ bold OR 18pt+ regular

---

## Contrast Calculation

### Relative Luminance

The contrast ratio formula:

```
Contrast Ratio = (L1 + 0.05) / (L2 + 0.05)
```

Where:
- `L1` = relative luminance of the lighter color
- `L2` = relative luminance of the darker color

Relative luminance ranges from 0 (black) to 1 (white).

### Tools for Checking Contrast

| Tool | Type | URL |
|------|------|-----|
| **WebAIM Contrast Checker** | Web tool | https://webaim.org/resources/contrastchecker/ |
| **WebAIM Link Contrast Checker** | Web tool | https://webaim.org/resources/linkcontrastchecker/ |
| **Colour Contrast Analyser** | Desktop app | https://www.tpgi.com/color-contrast-checker/ |
| **Chrome DevTools** | Browser built-in | Inspect element > Computed > contrast ratio |
| **Figma a11y plugin** | Design tool | Stark, Axe, or Able plugin |

---

## Common Color Combinations and Compliance

### Pass at AA (4.5:1 for normal text)

| Foreground | Background | Ratio | Status |
|-----------|------------|-------|--------|
| #000000 (black) | #FFFFFF (white) | 21:1 | PASS AAA |
| #000000 (black) | #F5F5F5 (light gray) | 18.1:1 | PASS AAA |
| #1A1A1A | #FFFFFF | 17.4:1 | PASS AAA |
| #333333 | #FFFFFF | 12.6:1 | PASS AAA |
| #555555 | #FFFFFF | 7.5:1 | PASS AAA |
| #666666 | #FFFFFF | 5.7:1 | PASS AA |
| #757575 | #FFFFFF | 4.6:1 | PASS AA |
| #767676 | #FFFFFF | 4.5:1 | PASS AA (barely) |
| #888888 | #FFFFFF | 3.5:1 | FAIL AA |
| #0066CC (blue) | #FFFFFF | 5.9:1 | PASS AA |
| #0066CC (blue) | #F0F0F0 | 4.7:1 | PASS AA |
| #0066CC (blue) | #E0E0E0 | 4.0:1 | FAIL AA |
| #CC0000 (red) | #FFFFFF | 4.6:1 | PASS AA |
| #008800 (green) | #FFFFFF | 4.5:1 | PASS AA (barely) |

### Common Failures

| Foreground | Background | Ratio | Status | Fix |
|-----------|------------|-------|--------|-----|
| #AAAAAA | #FFFFFF | 2.3:1 | FAIL | Darken to #767676 or darker |
| #CCCCCC | #FFFFFF | 1.6:1 | FAIL | Use #767676 minimum |
| #999999 | #FFFFFF | 2.8:1 | FAIL | Use #767676 minimum |
| #0066CC | #E0E0E0 | 4.0:1 | FAIL | Darken blue or lighten background |
| #FF0000 | #FFFFFF | 4.0:1 | FAIL | Darken red |

---

## CSS Implementation Patterns

### Design Token System

```css
:root {
  /* Accessible color tokens */
  --color-text-primary: #1A1A1A;      /* 17.4:1 on white */
  --color-text-secondary: #555555;     /* 7.5:1 on white */
  --color-text-tertiary: #666666;      /* 5.7:1 on white */
  --color-text-disabled: #767676;      /* 4.5:1 on white (minimum) */
  
  --color-bg-primary: #FFFFFF;
  --color-bg-secondary: #F5F5F5;
  --color-bg-tertiary: #E0E0E0;
  
  --color-link: #0055CC;               /* 7.1:1 on white */
  --color-link-visited: #551A8B;       /* 7.0:1 on white */
  
  --color-error: #CC0000;              /* 4.6:1 on white */
  --color-success: #007700;            /* 4.8:1 on white */
  --color-warning: #996600;            /* 4.5:1 on white */
  
  --color-focus: #0055CC;              /* 7.1:1 on white */
}
```

### Dark Mode Colors

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-text-primary: #FFFFFF;      /* 15.3:1 on #1A1A1A */
    --color-text-secondary: #D4D4D4;    /* 10.5:1 on #1A1A1A */
    --color-text-tertiary: #AAAAAA;     /* 6.4:1 on #1A1A1A */
    --color-text-disabled: #888888;     /* 3.9:1 on #1A1A1A (AAA for large) */
    
    --color-bg-primary: #1A1A1A;
    --color-bg-secondary: #2A2A2A;
    --color-bg-tertiary: #3A3A3A;
    
    --color-link: #6CB4EE;              /* 7.1:1 on #1A1A1A */
    --color-link-visited: #BB86FC;      /* 6.0:1 on #1A1A1A */
    
    --color-error: #FF6B6B;             /* 5.5:1 on #1A1A1A */
    --color-success: #69DB7C;           /* 8.2:1 on #1A1A1A */
    --color-warning: #FFD43B;           /* 12.5:1 on #1A1A1A */
  }
}
```

### Focus Indicators

```css
/* High-contrast focus indicator */
:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

/* For elements with dark backgrounds */
.dark-bg :focus-visible {
  outline-color: #FFFFFF;
}

/* Never remove focus indicators without replacement */
*:focus {
  outline: none; /* NEVER DO THIS */
}

/* Unless you provide a visible alternative */
*:focus {
  outline: none;
}
*:focus-visible {
  outline: 3px solid #0055CC;
  outline-offset: 2px;
}
```

### Links vs Text Distinction

```css
/* Links must be distinguishable from surrounding text */
/* Option 1: Color + underline (preferred) */
a {
  color: var(--color-link);
  text-decoration: underline;
}

/* Option 2: Color with sufficient contrast difference */
a {
  color: #0055CC;        /* 7.1:1 on white */
  text-decoration: none;
}
p {
  color: #1A1A1A;        /* 17.4:1 on white */
}
/* Contrast between link color and text color must be >= 3:1 */

/* Option 3: Visual indicator (bold, background, border) */
a {
  color: inherit;
  font-weight: bold;
  text-decoration: none;
}
```

---

## Testing Procedures

### Manual Testing

1. **Visual inspection**
   - Zoom to 200% -- can you still read all text?
   - Use Windows High Contrast Mode
   - Test with grayscale filter (CSS: `filter: grayscale(100%)`)

2. **Browser DevTools**
   ```
   Chrome: Inspect > Computed > Contrast ratio
   Firefox: Inspect > Accessibility > Contrast
   ```

3. **CSS override test**
   ```css
   /* Temporarily test all text at minimum contrast */
   * {
     color: #767676 !important;
     background: #FFFFFF !important;
   }
   ```

### Automated Testing

```javascript
// Using axe-core in tests
import { AxePuppeteer } from '@axe-core/puppeteer';

const results = await new AxePuppeteer(page)
  .include('.content')  // Scope to content area
  .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
  .analyze();

const contrastIssues = results.violations.filter(
  v => v.id === 'color-contrast'
);

contrastIssues.forEach(issue => {
  console.log(`${issue.impact}: ${issue.description}`);
  issue.nodes.forEach(node => {
    console.log(`  Element: ${node.html}`);
    console.log(`  Fix: ${node.failureSummary}`);
  });
});
```

### Design Tool Testing

```javascript
// Figma plugin: Stark
// 1. Select text layer
// 2. Run Stark contrast checker
// 3. View AA/AAA compliance for both normal and large text
// 4. Get suggestions for compliant alternatives
```

---

## Special Considerations

### Color Blindness (8% of males, 0.5% of females)

| Type | Colors Affected | % of Males |
|------|----------------|------------|
| Deuteranopia | Red/Green | 1% |
| Protanopia | Red/Green | 1% |
| Tritanopia | Blue/Yellow | 0.01% |
| Deuteranomaly | Red/Green (mild) | 5% |
| Protanomaly | Red/Green (mild) | 1.3% |

**Never use color alone to convey information:**
```html
<!-- BAD: Color-only indicator -->
<span style="color: red;">Required</span>

<!-- GOOD: Color + text indicator -->
<span style="color: red;">* Required</span>

<!-- BAD: Red/green status dots -->
<span class="dot red"></span> Error
<span class="dot green"></span> Success

<!-- GOOD: Color + icon + text -->
<span class="status error" aria-label="Error">
  <svg aria-hidden="true"><!-- error icon --></svg>
  Error
</span>
```

### Translucent / Overlay Colors

```css
/* BAD: Low contrast due to transparency */
.overlay {
  background: rgba(255, 255, 255, 0.7); /* Text on this may fail */
}

/* GOOD: Ensure sufficient contrast with semi-transparent backgrounds */
.overlay {
  background: rgba(255, 255, 255, 0.92); /* Higher opacity for contrast */
}
```

### Images with Text

```html
<!-- Ensure text overlays on images have sufficient contrast -->
<div class="hero" style="background-image: url('hero.jpg')">
  <div class="hero-overlay" style="background: rgba(0, 0, 0, 0.7);">
    <h1 style="color: #FFFFFF;">Title Text</h1>
  </div>
</div>

<!-- Use text shadow or background for readability -->
<style>
.hero-overlay {
  background: rgba(0, 0, 0, 0.7);
  /* Ensures white text on dark overlay = high contrast */
}
</style>
```

---

## Quick Reference Table

| Element | Minimum Contrast | Recommended | Notes |
|---------|-----------------|-------------|-------|
| Body text | 4.5:1 (AA) | 7:1 (AAA) | Primary content |
| Headings | 3:1 (AA, if large) | 4.5:1 (AAA) | 18pt+ or 14pt bold+ |
| Links | 4.5:1 (AA) | 7:1 (AAA) | Also distinguishable from text |
| Buttons | 4.5:1 (AA) | 7:1 (AAA) | Text on button background |
| Form labels | 4.5:1 (AA) | 7:1 (AAA) | Associated with inputs |
| Placeholders | 4.5:1 (AA) | 4.5:1 (AA) | Often fails -- test carefully |
| Error messages | 4.5:1 (AA) | 7:1 (AAA) | Must also use icon/text |
| Icons | 3:1 (AA) | 4.5:1 (AAA) | Against background |
| Focus indicators | 3:1 (AA) | 3:1 (AA) | Against adjacent colors |
| UI borders | 3:1 (AA) | 3:1 (AA) | Form inputs, dividers |

---

## References

- [WCAG 2.2 Understanding SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [WCAG 2.2 Understanding SC 1.4.6](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html)
- [WCAG 2.2 Understanding SC 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [WebAIM Contrast and Color Accessibility](https://webaim.org/articles/contrast/)
- [Colour Contrast Analyser](https://www.tpgi.com/color-contrast-checker/)
