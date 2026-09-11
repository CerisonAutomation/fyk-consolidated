# WCAG 2.2 Guidelines Summary

> Source: W3C Web Accessibility Initiative (WAI)
> Published: 5 October 2023 as W3C Recommendation
> URL: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/

## Overview

WCAG 2.2 provides 9 additional success criteria beyond WCAG 2.1. The 2.0 and 2.1 success criteria are essentially the same in 2.2, with one exception: **4.1.1 Parsing is obsolete and removed from WCAG 2.2**.

---

## New Success Criteria in WCAG 2.2

### Guideline 2.4 -- Navigable

#### 2.4.11 Focus Not Obscured (Minimum) -- Level AA

**What to do:** Ensure when an item gets keyboard focus, it is at least partially visible.

**Why it matters:** People who cannot use a mouse need to see what has keyboard focus.

**Success criteria:** When a user interface component receives keyboard focus, the component is not entirely hidden due to author-created content.

**Implementation checklist:**
- [ ] Sticky headers/footers do not completely cover focused elements
- [ ] Chat widgets do not hide focused content
- [ ] Cookie banners do not obscure focused items
- [ ] Users can reveal focused component without advancing keyboard focus

```css
/* Ensure focused elements are not hidden behind fixed-position elements */
:focus {
  /* Ensure the focused element scrolls into view */
  scroll-margin-top: 80px; /* Account for sticky header height */
  scroll-margin-bottom: 80px; /* Account for sticky footer height */
}
```

#### 2.4.12 Focus Not Obscured (Enhanced) -- Level AAA

**What to do:** Ensure when an item gets keyboard focus, it is **fully** visible (not just partially).

**Success criteria:** When a user interface component receives keyboard focus, no part of the component is hidden by author-created content.

#### 2.4.13 Focus Appearance -- Level AAA

**What to do:** Use a focus indicator of sufficient size and contrast.

**Success criteria:** When the keyboard focus indicator is visible:
- Area of focus indicator is at least as large as a 2 CSS pixel thick perimeter of the unfocused component
- Has a contrast ratio of at least 3:1 between focused and unfocused states

```css
/* Good focus indicator example */
:focus-visible {
  outline: 3px solid #1a73e8;
  outline-offset: 2px;
}

/* Avoid: thin, low-contrast outlines */
:focus {
  outline: 1px solid #ccc; /* Too thin, too low contrast */
}
```

---

### Guideline 2.5 -- Input Modalities

#### 2.5.7 Dragging Movements -- Level AA

**What to do:** For any action that involves dragging, provide a simple pointer alternative.

**Why it matters:** Some people cannot use a mouse to drag items (e.g., hand tremors, motor impairments).

**Success criteria:** All functionality that uses a dragging movement can be achieved by a single pointer without dragging, unless dragging is essential.

**Implementation patterns:**
```html
<!-- Good: Provide alternative controls for drag-and-drop lists -->
<div class="sortable-list" role="listbox" aria-label="Reorderable items">
  <div role="option">
    <span>Item 1</span>
    <button aria-label="Move Item 1 up" class="move-up">^</button>
    <button aria-label="Move Item 1 down" class="move-down">v</button>
  </div>
</div>
```

#### 2.5.8 Target Size (Minimum) -- Level AA

**What to do:** Ensure targets meet a minimum size or have sufficient spacing.

**Success criteria:** The size of the target for pointer inputs is at least **24 by 24 CSS pixels**, except where:
- Spacing: Undersized targets positioned so 24px diameter circles do not intersect
- Equivalent: Function can be achieved through a different control that meets this criterion
- Inline: Target is in a sentence or constrained by line-height
- User agent control: Size determined by user agent
- Essential: Particular presentation is essential

```css
/* Ensure minimum target size */
button, a, input[type="checkbox"], input[type="radio"] {
  min-width: 24px;
  min-height: 24px;
}

/* For touch targets, prefer 44x44px (iOS guideline) */
@media (pointer: coarse) {
  button, a {
    min-width: 44px;
    min-height: 44px;
    padding: 10px;
  }
}
```

---

### Guideline 3.2 -- Predictable

#### 3.2.6 Consistent Help -- Level A

**What to do:** Put help in the same place when it is on multiple pages.

**Why it matters:** People who need help can find it more easily if it is in the same place.

**Success criteria:** If a web page contains help mechanisms (human contact, self-help, automated contact) repeated on multiple pages, they occur in the same relative order.

**Implementation:**
```html
<!-- Good: Consistent help placement across pages -->
<!-- In page footer, always at the same position -->
<footer>
  <nav aria-label="Help">
    <a href="/help">Help Center</a>
    <a href="/contact">Contact Us</a>
    <a href="/chat">Live Chat</a>
  </nav>
</footer>
```

---

### Guideline 3.3 -- Input Assistance

#### 3.3.7 Redundant Entry -- Level A

**What to do:** Do not ask for the same information twice in the same session.

**Why it matters:** Some people with cognitive disabilities have difficulty remembering what they entered before.

**Success criteria:** Information previously entered by or provided to the user that is required to be entered again in the same process is either:
- Auto-populated, OR
- Available for the user to select

**Exceptions:**
- Re-entering is essential (security verification)
- Previously entered information is no longer valid

```javascript
// Good: Auto-populate previously entered information
function prefillFormStep(currentStep) {
  const savedData = getSessionData();
  if (currentStep === 2 && savedData.name) {
    document.getElementById('name').value = savedData.name;
    document.getElementById('email').value = savedData.email;
  }
}
```

#### 3.3.8 Accessible Authentication (Minimum) -- Level AA

**What to do:** Do not make people solve, recall, or transcribe something to log in.

**Why it matters:** Some people with cognitive disabilities cannot solve puzzles, memorize a username and password, or retype one-time passcodes.

**Success criteria:** A cognitive function test (remembering password, solving puzzle) is not required unless:
- Alternative authentication method exists (e.g., magic link, biometric)
- Mechanism assists the user (e.g., password manager support, copy/paste allowed)
- Test is object recognition
- Test is identifying user-provided personal content

```html
<!-- Good: Allow password managers and copy/paste -->
<input type="email" name="email" autocomplete="email" />
<input type="password" name="password" autocomplete="current-password" />

<!-- Good: Magic link / passwordless authentication -->
<button type="button" onclick="sendMagicLink()">
  Send me a login link
</button>
```

#### 3.3.9 Accessible Authentication (Enhanced) -- Level AAA

**What to do:** Do not make people recognize objects or user-supplied images and media to login.

**Success criteria:** A cognitive function test is not required unless alternative method or mechanism is provided.

---

## Quick Reference: WCAG 2.2 Compliance Checklist

| Criterion | Level | Description |
|-----------|-------|-------------|
| 2.4.11 Focus Not Obscured (Minimum) | AA | Focused items at least partially visible |
| 2.4.12 Focus Not Obscured (Enhanced) | AAA | Focused items fully visible |
| 2.4.13 Focus Appearance | AAA | Focus indicator size and contrast |
| 2.5.7 Dragging Movements | AA | Single-pointer alternative for drag |
| 2.5.8 Target Size (Minimum) | AA | 24x24px minimum target size |
| 3.2.6 Consistent Help | A | Help mechanisms in consistent position |
| 3.3.7 Redundant Entry | A | No repeated info entry in same process |
| 3.3.8 Accessible Authentication (Minimum) | AA | No cognitive tests for login |
| 3.3.9 Accessible Authentication (Enhanced) | AAA | No object recognition for login |

---

## WCAG 2.2 Conformance Levels

- **Level A** -- Minimum accessibility. Must be satisfied.
- **Level AA** -- Addresses the most common barriers. Recommended target for most sites.
- **Level AAA** -- Highest level. Not required for entire sites, but target for specific content.

## Additional Resources

- [WCAG 2.2 Full Specification](https://www.w3.org/TR/WCAG22/)
- [Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/)
- [How to Meet WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/)
- [WCAG 2 FAQ](https://www.w3.org/WAI/WCAG22/faq/)
