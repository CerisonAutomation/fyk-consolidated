# Screen Reader Testing Patterns

> Sources: W3C WAI, WebAIM, Deque University, MDN Web Docs
> Reference: https://www.w3.org/WAI/test-evaluate/

## Overview

Screen readers convert on-screen content to speech or braille output. They are essential for blind and visually impaired users. Testing with real screen readers is the only way to verify full accessibility.

---

## Major Screen Readers

| Screen Reader | Platform | Browser Support | Cost |
|--------------|----------|----------------|------|
| **NVDA** | Windows | Firefox, Chrome | Free |
| **JAWS** | Windows | Firefox, Chrome, Edge | Paid (free for 40-min trials) |
| **VoiceOver** | macOS, iOS | Safari | Free (built-in) |
| **TalkBack** | Android | Chrome | Free (built-in) |
| **Narrator** | Windows | Edge | Free (built-in) |

---

## Essential Keyboard Shortcuts

### NVDA (Windows)

| Key | Action |
|-----|--------|
| `Insert + Down Arrow` | Read from cursor |
| `Insert + Space` | Toggle between focus/browse mode |
| `H` / `Shift + H` | Next/previous heading |
| `D` / `Shift + D` | Next/previous landmark |
| `K` / `Shift + K` | Next/previous link |
| `F` / `Shift + F` | Next/previous form field |
| `T` / `Shift + T` | Next/previous table |
| `Insert + F7` | Elements list (headings, links, landmarks) |
| `NVDA + F5` | Refreshes the document |
| `NVDA + Q` | Quit NVDA |

### VoiceOver (macOS)

| Key | Action |
|-----|--------|
| `VO + A` | Read all (VO = Ctrl + Option) |
| `VO + Right/Left Arrow` | Next/previous item |
| `VO + Command + H` | Next heading |
| `VO + Command + L` | Next landmark |
| `VO + U` | Rotor (headings, links, form controls) |
| `VO + Space` | Activate current item |
| `VO + Shift + Down` | Read from cursor |
| `Control` | Stop speech |

### JAWS (Windows)

| Key | Action |
|-----|--------|
| `Down Arrow` | Say next line |
| `Insert + Down Arrow` | Read from cursor |
| `H` / `Shift + H` | Next/previous heading |
| `R` / `Shift + R` | Next/previous landmark |
| `Tab` | Next form control |
| `Insert + F3` | Elements list |
| `Insert + F6` | Headings list |

---

## Testing Checklist

### 1. Page Structure and Navigation

```html
<!-- Test: Can screen reader navigate page structure? -->

<!-- Landmarks should be identifiable -->
<header role="banner">Site Header</header>
<nav aria-label="Main navigation">...</nav>
<main role="main">
  <h1>Page Title</h1>
  <article>
    <h2>Section Heading</h2>
    <p>Content...</p>
  </article>
</main>
<aside role="complementary">Sidebar</aside>
<footer role="contentinfo">Footer</footer>
```

**Test steps:**
1. Open screen reader's landmark/heading list
2. Verify all landmarks are announced with correct labels
3. Verify heading hierarchy is logical (h1 > h2 > h3)
4. Test navigation between landmarks using shortcut keys
5. Verify skip navigation link works

### 2. Images and Media

```html
<!-- Informative image: describe the content -->
<img src="chart.png" alt="Sales increased 45% from January to March 2024" />

<!-- Decorative image: empty alt -->
<img src="divider.png" alt="" />

<!-- Complex image: provide long description -->
<figure>
  <img src="architecture.png" 
       alt="System architecture diagram" 
       aria-describedby="arch-desc" />
  <figcaption id="arch-desc">
    The system uses a three-tier architecture: client, API gateway, 
    and microservices. Data flows from client through the gateway 
    to services, which communicate via message queues.
  </figcaption>
</figure>

<!-- SVG: accessible name -->
<svg role="img" aria-labelledby="svg-title">
  <title id="svg-title">Revenue Chart</title>
  <!-- SVG content -->
</svg>

<!-- Video with captions -->
<video controls>
  <source src="tutorial.mp4" type="video/mp4" />
  <track kind="captions" src="captions.vtt" srclang="en" label="English" />
  <track kind="descriptions" src="descriptions.vtt" srclang="en" label="Audio Descriptions" />
</video>
```

### 3. Forms and Inputs

```html
<!-- Associated labels (essential) -->
<label for="email">Email address</label>
<input type="email" id="email" required aria-describedby="email-help" />
<span id="email-help">We'll never share your email.</span>

<!-- Error messages -->
<label for="password">Password</label>
<input type="password" 
       id="password" 
       aria-invalid="true" 
       aria-describedby="password-error" 
       aria-required="true" />
<span id="password-error" role="alert">
  Password must be at least 8 characters
</span>

<!-- Grouped fields -->
<fieldset>
  <legend>Shipping address</legend>
  <label for="street">Street</label>
  <input type="text" id="street" />
  
  <label for="city">City</label>
  <input type="text" id="city" />
</fieldset>

<!-- Custom select/combobox -->
<label id="country-label">Country</label>
<div role="combobox" 
     aria-expanded="false" 
     aria-controls="country-listbox"
     aria-labelledby="country-label">
  <input type="text" aria-autocomplete="list" />
</div>
<ul role="listbox" id="country-listbox" hidden>
  <li role="option">United States</li>
  <li role="option">Canada</li>
  <li role="option">United Kingdom</li>
</ul>
```

**Test steps:**
1. Navigate through form using Tab
2. Verify each field has a visible and programmatic label
3. Submit form with errors -- verify error messages are announced
4. Verify required fields are announced as required
5. Test form submission success/failure announcements

### 4. Dynamic Content

```html
<!-- Status updates -->
<div aria-live="polite" aria-atomic="true" id="cart-count">
  Shopping cart: 3 items
</div>

<!-- Error alerts -->
<div role="alert" aria-live="assertive">
  Session expiring in 2 minutes
</div>

<!-- Loading states -->
<div aria-live="polite" id="loading-status">
  Loading content...
</div>

<!-- Progress -->
<div role="progressbar" 
     aria-valuenow="50" 
     aria-valuemin="0" 
     aria-valuemax="100"
     aria-label="Upload progress">
  50% uploaded
</div>
```

**Test steps:**
1. Trigger dynamic content update
2. Verify announcement is made at appropriate time
3. Verify announcement is not too verbose
4. Test with both polite and assertive live regions
5. Verify live regions don't announce on initial page load

### 5. Interactive Widgets

#### Tabs

```html
<!-- Test that tab changes are announced -->
<div role="tablist" aria-label="Settings">
  <button role="tab" aria-selected="true" aria-controls="p1" id="t1">General</button>
  <button role="tab" aria-selected="false" aria-controls="p2" id="t2" tabindex="-1">Advanced</button>
</div>
<div role="tabpanel" id="p1" aria-labelledby="t1">General settings</div>
<div role="tabpanel" id="p2" aria-labelledby="t2" hidden>Advanced settings</div>
```

**Test:** Arrow between tabs -- screen reader should announce "General, selected, tab 1 of 2"

#### Modal Dialog

```html
<!-- Test: Focus management and trapping -->
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title" id="dialog">
  <h2 id="dialog-title">Confirm Deletion</h2>
  <p>Are you sure?</p>
  <button>Yes, delete</button>
  <button>Cancel</button>
</div>
```

**Test steps:**
1. Open modal -- focus should move to modal
2. Tab through modal -- focus should not escape
3. Escape should close modal and return focus to trigger
4. Background content should be inert (not navigable)

#### Toast Notifications

```html
<!-- Test: Toast appears and is announced -->
<div role="status" aria-live="polite" class="toast">
  Changes saved successfully
</div>
```

**Test:** Trigger toast -- screen reader should announce "Changes saved successfully"

### 6. Tables

```html
<table aria-label="Monthly sales data">
  <caption>Monthly Sales Data for 2024</caption>
  <thead>
    <tr>
      <th scope="col">Month</th>
      <th scope="col">Revenue</th>
      <th scope="col">Orders</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">January</th>
      <td>$45,000</td>
      <td>320</td>
    </tr>
  </tbody>
</table>
```

**Test steps:**
1. Navigate to table -- announce table dimensions
2. Navigate cells -- announce row and column headers
3. Use screen reader table navigation mode
4. Verify scope attributes work correctly

---

## Common Screen Reader Issues

### 1. Missing Accessible Names

```html
<!-- BAD: No accessible name -->
<button><svg><!-- icon --></svg></button>

<!-- GOOD: Has accessible name -->
<button aria-label="Close menu">
  <svg aria-hidden="true"><!-- icon --></svg>
</button>
```

### 2. Incorrect Role Usage

```html
<!-- BAD: Wrong role -->
<div role="button" onclick="doSomething()">Click me</div>
<!-- Screen reader announces "button" but no keyboard support -->

<!-- GOOD: Native element -->
<button type="button" onclick="doSomething()">Click me</button>
```

### 3. Live Region Not Announcing

```javascript
// BAD: Content already in DOM
document.getElementById('status').textContent = 'Saved';

// GOOD: Force re-announcement
const status = document.getElementById('status');
status.textContent = '';
requestAnimationFrame(() => {
  status.textContent = 'Saved';
});
```

### 4. Focus Management After Action

```javascript
// BAD: Focus lost after deletion
function deleteItem(item) {
  item.remove();
  // Focus goes to body -- screen reader user is lost
}

// GOOD: Focus restored to logical position
function deleteItem(item) {
  const nextItem = item.nextElementSibling || item.previousElementSibling;
  item.remove();
  
  if (nextItem) {
    nextItem.setAttribute('tabindex', '-1');
    nextItem.focus();
  } else {
    // List is empty -- announce it
    document.getElementById('empty-message').focus();
  }
}
```

---

## Automated Testing Tools

| Tool | Type | Purpose |
|------|------|---------|
| **axe-core** | Browser extension/API | Automated accessibility testing |
| **Lighthouse** | Chrome DevTools | Performance + accessibility audit |
| **WAVE** | Browser extension | Visual accessibility evaluation |
| **Pa11y** | CLI/CI tool | Automated testing pipeline |
| **Storybook a11y addon** | Component testing | Per-component checks |

---

## Testing Script Template

```markdown
## Screen Reader Test: [Feature Name]

### Setup
- Screen reader: [NVDA/VoiceOver/JAWS]
- Browser: [Chrome/Firefox/Safari]
- OS: [Windows/macOS]

### Test Cases

#### 1. Page Load
- [ ] Page title is announced
- [ ] Landmarks are navigable
- [ ] Heading structure is logical

#### 2. Navigation
- [ ] Skip link works
- [ ] All links are announced with descriptive text
- [ ] Focus order is logical

#### 3. Forms
- [ ] Labels are associated with inputs
- [ ] Required fields are announced
- [ ] Error messages are announced
- [ ] Success messages are announced

#### 4. Dynamic Content
- [ ] Status updates are announced
- [ ] Error alerts are announced
- [ ] Loading states are announced

#### 5. Interactive Widgets
- [ ] Widget role is announced
- [ ] Widget state changes are announced
- [ ] Keyboard interaction works as expected

### Issues Found
| Issue | Severity | Steps to Reproduce | Fix |
|-------|----------|-------------------|-----|
| [Description] | [Critical/Major/Minor] | [Steps] | [Fix] |
```

---

## References

- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Screen Reader Testing](https://webaim.org/techniques/screenreader/)
- [Deque University Screen Reader Testing](https://dequeuniversity.com/screenreader)
- [MDN Accessibility Testing](https://developer.mozilla.org/en-US/docs/Learn/Tools_and_testing/Cross_browser_testing/Accessibility_testing)
