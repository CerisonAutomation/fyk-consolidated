# ARIA Attributes Best Practices

> Sources: W3C WAI-ARIA Specification, MDN Web Docs, WAI-ARIA Authoring Practices Guide
> URLs:
> - https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA
> - https://www.w3.org/WAI/standards-guidelines/aria/
> - https://www.w3.org/WAI/ARIA/apg/practices/

## The First Rule of ARIA

> **"If you can use a native HTML element or attribute with the semantics and behavior you require already built in, instead of re-purposing an element and adding an ARIA role, state or property to make it accessible, then do so."**

> **"No ARIA is better than bad ARIA."** -- WebAIM found that home pages with ARIA present averaged 41% more detected errors than those without ARIA.

---

## ARIA Roles Categories

### 1. Landmark Roles (Page Structure)

Use landmark roles to identify page sections. Screen readers use these for keyboard navigation.

| ARIA Role | HTML Equivalent | Use Case |
|-----------|----------------|----------|
| `banner` | `<header>` | Site-wide header |
| `navigation` | `<nav>` | Navigation sections |
| `main` | `<main>` | Primary content |
| `contentinfo` | `<footer>` | Site-wide footer |
| `complementary` | `<aside>` | Sidebar/supporting content |
| `search` | `<search>` | Search functionality |
| `form` | `<form>` | Form with landmark labeling |
| `region` | `<section>` | Named content section |

```html
<!-- Good: Use semantic HTML (preferred) -->
<header>...</header>
<nav aria-label="Main">...</nav>
<main>...</main>
<aside aria-label="Related articles">...</aside>
<footer>...</footer>

<!-- Also good: ARIA landmarks when HTML semantics are insufficient -->
<div role="banner">...</div>
<div role="navigation" aria-label="Main">...</div>
<div role="main">...</div>
<div role="complementary" aria-label="Sidebar">...</div>
<div role="contentinfo">...</div>
```

**Important:** Use landmark roles sparingly. Too many create "noise" in screen readers.

---

### 2. Widget Roles (Interactive Elements)

#### Live Region Roles (Dynamic Content Updates)

```html
<!-- Alert: Important, time-sensitive information -->
<div role="alert" aria-live="assertive">
  Your form has been submitted successfully.
</div>

<!-- Status: Advisory information, not urgent -->
<div role="status" aria-live="polite">
  3 search results found
</div>

<!-- Log: Sequential information updates -->
<div role="log" aria-live="polite">
  <p>Connection established</p>
  <p>Data syncing...</p>
</div>

<!-- Timer: Countdown or elapsed time -->
<div role="timer" aria-live="off" aria-label="Time remaining">
  05:00
</div>
```

#### Common Widget Roles

```html
<!-- Button (prefer <button> element) -->
<button type="button">Click me</button>
<!-- NOT: <div role="button" tabindex="0">Click me</div> -->

<!-- Checkbox -->
<input type="checkbox" id="agree" />
<label for="agree">I agree</label>

<!-- Custom checkbox (when native is insufficient) -->
<div role="checkbox" 
     aria-checked="false" 
     tabindex="0"
     aria-label="Accept terms">
</div>

<!-- Radio Group -->
<fieldset>
  <legend>Choose a color</legend>
  <input type="radio" name="color" id="red" value="red" />
  <label for="red">Red</label>
  <input type="radio" name="color" id="blue" value="blue" />
  <label for="blue">Blue</label>
</fieldset>

<!-- Tab Panel -->
<div role="tablist" aria-label="Account settings">
  <button role="tab" aria-selected="true" aria-controls="panel-1" id="tab-1">
    Profile
  </button>
  <button role="tab" aria-selected="false" aria-controls="panel-2" id="tab-2" tabindex="-1">
    Security
  </button>
</div>
<div role="tabpanel" id="panel-1" aria-labelledby="tab-1">
  <p>Profile settings content</p>
</div>
<div role="tabpanel" id="panel-2" aria-labelledby="tab-2" hidden>
  <p>Security settings content</p>
</div>

<!-- Progress Bar -->
<div role="progressbar" 
     aria-valuenow="75" 
     aria-valuemin="0" 
     aria-valuemax="100"
     aria-label="Upload progress">
</div>

<!-- Slider -->
<input type="range" 
       min="0" max="100" value="50" 
       aria-label="Volume"
       aria-valuemin="0"
       aria-valuemax="100"
       aria-valuenow="50" />

<!-- Switch (toggle) -->
<div role="switch"
     aria-checked="false"
     tabindex="0"
     aria-label="Dark mode">
</div>
```

---

### 3. ARIA States and Properties

#### Essential Attributes

```html
<!-- aria-label: Accessible name when visible text is insufficient -->
<button aria-label="Close dialog">
  <svg><!-- X icon --></svg>
</button>

<input type="search" aria-label="Search articles" />

<!-- aria-labelledby: References another element's text as the label -->
<div role="dialog" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirm Deletion</h2>
  <p>Are you sure you want to delete this item?</p>
</div>

<!-- aria-describedby: Additional description -->
<input type="password" 
       aria-describedby="password-hint" />
<p id="password-hint">Password must be at least 8 characters with one number.</p>

<!-- aria-live: Dynamic content update announcements -->
<div aria-live="polite">
  <!-- Content updates announced to screen readers -->
</div>

<!-- aria-expanded: Collapsible content state -->
<button aria-expanded="false" aria-controls="menu-1">
  Menu
</button>
<ul id="menu-1" hidden>
  <li>Item 1</li>
  <li>Item 2</li>
</ul>

<!-- aria-hidden: Hide decorative/interactive duplicates from AT -->
<span aria-hidden="true"> decorative icon </span>

<!-- aria-disabled: Visual disabled state (keeps focusable) -->
<div role="button" aria-disabled="true" tabindex="0">
  Submit
</div>

<!-- aria-required: Indicates required field -->
<input type="text" aria-required="true" />

<!-- aria-invalid: Validation error state -->
<input type="email" aria-invalid="true" aria-describedby="email-error" />
<p id="email-error" role="alert">Please enter a valid email address.</p>
```

#### Live Region Configuration

```html
<!-- Polite: Waits for user to finish current task -->
<div aria-live="polite">...</div>

<!-- Assertive: Interrupts current announcement -->
<div aria-live="assertive">...</div>

<!-- Atomic: Announces entire region, not just changes -->
<div aria-live="polite" aria-atomic="true">...</div>

<!-- Relevant: What changes should be announced -->
<div aria-live="polite" aria-relevant="additions">...</div>
<div aria-live="polite" aria-relevant="removals">...</div>
<div aria-live="polite" aria-relevant="additions removals">...</div>
```

---

## ARIA Best Practices

### Do's

1. **Use semantic HTML first** -- `<button>`, `<input>`, `<nav>`, `<main>` etc.
2. **Provide accessible names** for all interactive elements
3. **Manage focus** for dynamic content (modals, menus, drawers)
4. **Use `aria-live`** regions for dynamic content updates
5. **Test with actual screen readers** -- NVDA, VoiceOver, JAWS

### Don'ts

1. **Never use `aria-hidden="true"` on focusable elements**
2. **Never use positive `tabindex` values** (e.g., `tabindex="3"`)
3. **Don't add `role` to elements that already have implicit roles** (e.g., `<button role="button">`)
4. **Don't use ARIA to fix inaccessible markup** -- fix the HTML first
5. **Don't use `aria-label` on non-interactive elements** unless used with landmarks

### Common Mistakes

```html
<!-- BAD: Redundant role on native element -->
<button role="button">Submit</button>
<!-- GOOD -->
<button>Submit</button>

<!-- BAD: aria-hidden on focusable element -->
<a href="#" aria-hidden="true">Link</a>

<!-- BAD: Missing accessible name -->
<button><svg><!-- icon --></svg></button>
<!-- GOOD -->
<button aria-label="Delete item"><svg><!-- icon --></svg></button>

<!-- BAD: Using aria-label on non-interactive div -->
<div aria-label="Section">Content</div>
<!-- GOOD -->
<section aria-label="Section">Content</section>
```

---

## Dynamic Content Patterns

### Modal Dialog

```html
<div role="dialog" 
     aria-modal="true" 
     aria-labelledby="modal-title"
     aria-describedby="modal-desc">
  <h2 id="modal-title">Confirm Action</h2>
  <p id="modal-desc">This action cannot be undone.</p>
  <button>Confirm</button>
  <button>Cancel</button>
</div>
```

```javascript
// Focus management for modals
function openModal(modalElement) {
  // Store previous focus
  modalElement.dataset.previousFocus = document.activeElement.id;
  
  // Show modal
  modalElement.hidden = false;
  modalElement.setAttribute('aria-hidden', 'false');
  
  // Move focus to first focusable element in modal
  const firstFocusable = modalElement.querySelector(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  firstFocusable?.focus();
  
  // Trap focus within modal
  modalElement.addEventListener('keydown', trapFocus);
}

function closeModal(modalElement) {
  modalElement.hidden = true;
  modalElement.setAttribute('aria-hidden', 'true');
  
  // Return focus to trigger
  const previousFocus = document.getElementById(
    modalElement.dataset.previousFocus
  );
  previousFocus?.focus();
}

function trapFocus(e) {
  if (e.key !== 'Tab') return;
  
  const focusableElements = e.currentTarget.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  if (e.shiftKey && document.activeElement === firstElement) {
    e.preventDefault();
    lastElement.focus();
  } else if (!e.shiftKey && document.activeElement === lastElement) {
    e.preventDefault();
    firstElement.focus();
  }
}
```

### Toast / Notification

```html
<!-- Container for live announcements -->
<div aria-live="polite" aria-atomic="true" class="sr-only" id="announcer">
</div>

<!-- Visual toast -->
<div role="status" class="toast" aria-live="polite">
  Changes saved successfully
</div>
```

```javascript
function announce(message) {
  const announcer = document.getElementById('announcer');
  announcer.textContent = '';
  // Force re-announcement
  requestAnimationFrame(() => {
    announcer.textContent = message;
  });
}
```

---

## References

- [WAI-ARIA Specification 1.2](https://www.w3.org/TR/wai-aria-1.2/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [MDN ARIA Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)
- [WAI-ARIA Roles on MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
