# Keyboard Navigation Patterns for Web Applications

> Source: W3C WAI-ARIA Authoring Practices Guide (APG)
> URL: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/

## Core Principle

> All interactive elements must be operable via the keyboard. Browsers do not provide keyboard support for GUI components made accessible with ARIA -- authors must provide keyboard support in their code.

---

## Fundamental Conventions

### Tab Key Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move focus to next focusable element |
| `Shift + Tab` | Move focus to previous focusable element |
| `Enter` | Activate links, buttons, and menu items |
| `Space` | Activate buttons, toggle checkboxes, select items |
| `Arrow Keys` | Navigate within composite widgets |
| `Escape` | Close menus, dialogs, and popups; return focus to trigger |
| `Home` | Move to first item in a list/group |
| `End` | Move to last item in a list/group |

### Focus Management Rules

1. **Tab and Shift+Tab** move focus between UI components
2. **Arrow keys** move focus inside components with multiple focusable elements
3. **Only one element** has focus at any time
4. **Focus must be visible** -- users must always know where focus is

---

## Widget-Specific Keyboard Patterns

### Radio Group

```html
<fieldset role="radiogroup" aria-labelledby="group-label">
  <legend id="group-label">Choose a delivery option</legend>
  <input type="radio" name="delivery" id="opt1" value="standard" />
  <label for="opt1">Standard (3-5 days)</label>
  <input type="radio" name="delivery" id="opt2" value="express" />
  <label for="opt2">Express (1-2 days)</label>
  <input type="radio" name="delivery" id="opt3" value="overnight" />
  <label for="opt3">Overnight</label>
</fieldset>
```

| Key | Action |
|-----|--------|
| `Tab` | Moves focus into the group (to the checked radio or first radio) |
| `Tab` (again) | Moves focus out of the group |
| `Down/Right Arrow` | Selects and moves focus to the next radio |
| `Up/Left Arrow` | Selects and moves focus to the previous radio |
| `Space` | Selects the focused radio |

### Tab List

```html
<div role="tablist" aria-label="Settings">
  <button role="tab" 
          aria-selected="true" 
          aria-controls="panel-profile" 
          id="tab-profile"
          tabindex="0">
    Profile
  </button>
  <button role="tab" 
          aria-selected="false" 
          aria-controls="panel-security" 
          id="tab-security"
          tabindex="-1">
    Security
  </button>
  <button role="tab" 
          aria-selected="false" 
          aria-controls="panel-notifications" 
          id="tab-notifications"
          tabindex="-1">
    Notifications
  </button>
</div>

<div role="tabpanel" id="panel-profile" aria-labelledby="tab-profile">
  Profile content...
</div>
<div role="tabpanel" id="panel-security" aria-labelledby="tab-security" hidden>
  Security content...
</div>
<div role="tabpanel" id="panel-notifications" aria-labelledby="tab-notifications" hidden>
  Notifications content...
</div>
```

| Key | Action |
|-----|--------|
| `Tab` | Moves focus into the tab list, then to the active tab panel |
| `Right Arrow` | Moves focus and selection to the next tab |
| `Left Arrow` | Moves focus and selection to the previous tab |
| `Home` | Moves focus to the first tab |
| `End` | Moves focus to the last tab |
| `Delete` | Closes the current tab (if closeable) |

```javascript
// Automatic activation (tabs activate on focus)
tabList.addEventListener('keydown', (e) => {
  const tabs = [...tabList.querySelectorAll('[role="tab"]')];
  const currentIndex = tabs.indexOf(document.activeElement);
  
  let newIndex;
  switch (e.key) {
    case 'ArrowRight':
      newIndex = (currentIndex + 1) % tabs.length;
      break;
    case 'ArrowLeft':
      newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      break;
    case 'Home':
      newIndex = 0;
      break;
    case 'End':
      newIndex = tabs.length - 1;
      break;
    default:
      return;
  }
  
  e.preventDefault();
  tabs[newIndex].focus();
  activateTab(tabs[newIndex]);
});
```

### Menu and Menu Bar

```html
<nav aria-label="Main navigation">
  <ul role="menubar" aria-label="Main menu">
    <li role="none">
      <button role="menuitem" aria-expanded="false" aria-haspopup="true">
        Products
      </button>
      <ul role="menu" hidden>
        <li role="none">
          <a role="menuitem" href="/analytics">Analytics</a>
        </li>
        <li role="none">
          <a role="menuitem" href="/dashboard">Dashboard</a>
        </li>
      </ul>
    </li>
  </ul>
</nav>
```

| Key | Action |
|-----|--------|
| `Enter/Space` | Opens submenu; activates menu item |
| `Down Arrow` | Opens submenu; moves to next item in menu |
| `Up Arrow` | Moves to previous item in menu |
| `Left Arrow` | Closes submenu; moves to parent menubar item |
| `Right Arrow` | Opens next submenu in menubar |
| `Home` | Moves to first item in current menu |
| `End` | Moves to last item in current menu |
| `Escape` | Closes submenu; returns focus to parent menu item |
| `Tab` | Moves focus out of the menu (should close all menus) |

### Listbox

```html
<div role="listbox" aria-label="Select a color" tabindex="0">
  <div role="option" aria-selected="true" id="opt-red">
    <span aria-hidden="true" style="color: red;">&#9679;</span> Red
  </div>
  <div role="option" aria-selected="false" id="opt-blue">
    <span aria-hidden="true" style="color: blue;">&#9679;</span> Blue
  </div>
  <div role="option" aria-selected="false" id="opt-green">
    <span aria-hidden="true" style="color: green;">&#9679;</span> Green
  </div>
</div>
```

| Key | Action |
|-----|--------|
| `Down Arrow` | Moves focus and selection to next option |
| `Up Arrow` | Moves focus and selection to previous option |
| `Home` | Moves focus to first option |
| `End` | Moves focus to last option |
| `Space` | Selects the focused option (in multi-select: toggles) |
| `Shift + Down/Up` | Extends selection in multi-select |

### Tree View

```html
<ul role="tree" aria-label="File explorer">
  <li role="treeitem" aria-expanded="true">
    <span>src</span>
    <ul role="group">
      <li role="treeitem">
        <span>index.ts</span>
      </li>
      <li role="treeitem" aria-expanded="false">
        <span>components</span>
        <ul role="group" hidden>
          <li role="treeitem">
            <span>Button.tsx</span>
          </li>
        </ul>
      </li>
    </ul>
  </li>
</ul>
```

| Key | Action |
|-----|--------|
| `Right Arrow` | Expands collapsed node; moves to first child if expanded |
| `Left Arrow` | Collapses expanded node; moves to parent if collapsed |
| `Down Arrow` | Moves to next visible tree item |
| `Up Arrow` | Moves to previous visible tree item |
| `Home` | Moves to first tree item |
| `End` | Moves to last visible tree item |
| `Enter/Space` | Activates the focused item |

### Grid / Data Table

```html
<div role="grid" aria-label="Project status" aria-rowcount="3" aria-colcount="4">
  <div role="row" aria-rowindex="1">
    <div role="columnheader">Name</div>
    <div role="columnheader">Status</div>
    <div role="columnheader">Due Date</div>
    <div role="columnheader">Actions</div>
  </div>
  <div role="row" aria-rowindex="2">
    <div role="gridcell">Project Alpha</div>
    <div role="gridcell">In Progress</div>
    <div role="gridcell">2024-03-15</div>
    <div role="gridcell">
      <button aria-label="Edit Project Alpha">Edit</button>
    </div>
  </div>
</div>
```

| Key | Action |
|-----|--------|
| `Arrow Keys` | Move focus between cells |
| `Home` | Moves to first cell in current row |
| `End` | Moves to last cell in current row |
| `Ctrl + Home` | Moves to first cell in grid |
| `Ctrl + End` | Moves to last cell in grid |
| `Page Down/Up` | Moves focus down/up one page |
| `Enter` | Activates the focused cell |

### Modal Dialog

```html
<div role="dialog" 
     aria-modal="true" 
     aria-labelledby="dialog-title"
     aria-describedby="dialog-desc">
  <h2 id="dialog-title">Delete Item</h2>
  <p id="dialog-desc">This action cannot be undone.</p>
  <button>Confirm Delete</button>
  <button>Cancel</button>
</div>
```

| Key | Action |
|-----|--------|
| `Tab` | Moves focus to next focusable element within dialog |
| `Shift + Tab` | Moves focus to previous focusable element within dialog |
| `Escape` | Closes the dialog; returns focus to trigger element |

**Critical:** Focus must be trapped within the dialog. `Tab` should cycle through focusable elements within the dialog only.

### Combobox

```html
<label id="combo-label">Choose a fruit</label>
<div role="combobox" 
     aria-expanded="false" 
     aria-controls="combo-listbox"
     aria-activedescendant=""
     aria-labelledby="combo-label">
  <input type="text" 
         aria-autocomplete="list" 
         aria-controls="combo-listbox" />
</div>
<ul role="listbox" id="combo-listbox" hidden>
  <li role="option" id="opt-apple">Apple</li>
  <li role="option" id="opt-banana">Banana</li>
  <li role="option" id="opt-cherry">Cherry</li>
</ul>
```

| Key | Action |
|-----|--------|
| `Down Arrow` | Opens dropdown; moves to next option |
| `Up Arrow` | Moves to previous option |
| `Enter` | Selects the focused option; closes dropdown |
| `Escape` | Closes dropdown; returns focus to input |
| `Type` | Filters options based on input |

---

## Focus Management Patterns

### Setting Focus on Dynamic Content

```javascript
// After content loads, move focus to it
function loadContent(url) {
  fetch(url)
    .then(res => res.text())
    .then(html => {
      const container = document.getElementById('content');
      container.innerHTML = html;
      
      // Set focus to the new content
      const heading = container.querySelector('h2');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus();
      }
    });
}

// When opening a modal
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  
  // Store trigger for focus return
  modal.dataset.trigger = document.activeElement.id;
  
  // Focus first focusable element
  const firstFocusable = modal.querySelector(
    'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  firstFocusable?.focus();
}

// When closing a modal
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  
  // Return focus to trigger
  const trigger = document.getElementById(modal.dataset.trigger);
  trigger?.focus();
}
```

### Focus Restoration

```javascript
// Save and restore focus across page transitions
class FocusManager {
  static #focusStack = [];
  
  static save() {
    this.#focusStack.push(document.activeElement);
  }
  
  static restore() {
    const previous = this.#focusStack.pop();
    if (previous && document.body.contains(previous)) {
      previous.focus();
    }
  }
  
  static clear() {
    this.#focusStack = [];
  }
}

// Usage
FocusManager.save();
openDrawer();
// ... later
closeDrawer();
FocusManager.restore();
```

---

## Skip Navigation Links

```html
<body>
  <!-- Skip link (first focusable element) -->
  <a href="#main-content" class="skip-link">
    Skip to main content
  </a>
  
  <header>
    <nav aria-label="Main navigation">
      <!-- Navigation items -->
    </nav>
  </header>
  
  <main id="main-content" tabindex="-1">
    <!-- Main content -->
  </main>
</body>
```

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px 16px;
  z-index: 100;
  transition: top 0.2s;
}

.skip-link:focus {
  top: 0;
}
```

---

## Roving tabindex Pattern

For composite widgets, only one element in the group should be in the tab sequence:

```html
<div role="toolbar" aria-label="Text formatting">
  <button tabindex="0">Bold</button>
  <button tabindex="-1">Italic</button>
  <button tabindex="-1">Underline</button>
  <button tabindex="-1">Strikethrough</button>
</div>
```

```javascript
// Roving tabindex implementation
const toolbar = document.querySelector('[role="toolbar"]');
const buttons = toolbar.querySelectorAll('button');

toolbar.addEventListener('keydown', (e) => {
  const currentIndex = [...buttons].indexOf(document.activeElement);
  let newIndex;
  
  switch (e.key) {
    case 'ArrowRight':
      newIndex = (currentIndex + 1) % buttons.length;
      break;
    case 'ArrowLeft':
      newIndex = (currentIndex - 1 + buttons.length) % buttons.length;
      break;
    case 'Home':
      newIndex = 0;
      break;
    case 'End':
      newIndex = buttons.length - 1;
      break;
    default:
      return;
  }
  
  e.preventDefault();
  
  // Update tabindex values
  buttons[currentIndex].setAttribute('tabindex', '-1');
  buttons[newIndex].setAttribute('tabindex', '0');
  buttons[newIndex].focus();
});
```

---

## References

- [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- [W3C Keyboard Accessibility](https://www.w3.org/WAI/fundamentals/accessibility-guidelines/content/keyboard)
- [WebAIM Keyboard Accessibility](https://webaim.org/techniques/keyboard/)
