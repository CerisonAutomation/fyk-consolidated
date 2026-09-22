/**
 * Enterprise Accessibility — WCAG 2.2 AA
 * Gold: keyboard, screen-reader, focus, semantic HTML, contrast, forms
 */

export type A11yCheck = { rule: string; level: "A" | "AA" | "AAA"; status: "pass" | "fail" | "warn"; message: string; element?: string };

export function checkContrast(foreground: string, background: string): { ratio: number; aa: boolean; aaa: boolean; aaLarge: boolean } {
  // Simplified contrast check — in real app use culori
  const lum = (hex: string) => {
    const rgb = parseInt(hex.replace("#", ""), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;
    const srgb = [r, g, b].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  };

  try {
    const l1 = lum(foreground);
    const l2 = lum(background);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return { ratio: Math.round(ratio * 100) / 100, aa: ratio >= 4.5, aaa: ratio >= 7, aaLarge: ratio >= 3 };
  } catch {
    return { ratio: 1, aa: false, aaa: false, aaLarge: false };
  }
}

export function getA11yProps(type: "button" | "link" | "input" | "dialog" | "tab" | "menu") {
  switch (type) {
    case "button":
      return { role: "button", tabIndex: 0, "aria-pressed": undefined };
    case "link":
      return { role: "link", tabIndex: 0 };
    case "input":
      return { "aria-required": undefined, "aria-invalid": undefined, "aria-describedby": undefined };
    case "dialog":
      return { role: "dialog", "aria-modal": true, "aria-labelledby": undefined };
    case "tab":
      return { role: "tab", "aria-selected": undefined, tabIndex: -1 };
    case "menu":
      return { role: "menu", "aria-orientation": "vertical" };
  }
}

export function checkKeyboardNavigation(elements: Array<{ tag: string; tabIndex?: number; hasFocusVisible?: boolean; hasAriaLabel?: boolean }>): A11yCheck[] {
  const checks: A11yCheck[] = [];

  for (const el of elements) {
    if (el.tag === "button" || el.tag === "a" || el.tag === "input") {
      if (el.tabIndex === -1) checks.push({ rule: "keyboard", level: "A", status: "fail", message: `${el.tag} has tabIndex -1 but should be keyboard accessible`, element: el.tag });
      if (!el.hasFocusVisible) checks.push({ rule: "focus-visible", level: "AA", status: "warn", message: `${el.tag} missing focus visible style`, element: el.tag });
    }
    if ((el.tag === "button" || el.tag === "a") && !el.hasAriaLabel) {
      checks.push({ rule: "label", level: "A", status: "warn", message: `${el.tag} missing aria-label or text content`, element: el.tag });
    }
  }

  return checks;
}

export function checkSemanticHtml(html: string): A11yCheck[] {
  const checks: A11yCheck[] = [];

  if (!/<main/.test(html)) checks.push({ rule: "landmark", level: "A", status: "fail", message: "Missing <main> landmark" });
  if (!/<nav/.test(html)) checks.push({ rule: "landmark", level: "A", status: "warn", message: "Missing <nav> landmark" });
  if (/<div[^>]*role="button"/.test(html) && !/<button/.test(html)) checks.push({ rule: "semantic", level: "A", status: "warn", message: "Use <button> instead of div with role=button" });
  if (/<img[^>]*>/.test(html) && !/<img[^>]*alt=/.test(html)) checks.push({ rule: "img-alt", level: "A", status: "fail", message: "Images missing alt attribute" });
  if (/<input/.test(html) && !/<label/.test(html)) checks.push({ rule: "label", level: "A", status: "fail", message: "Inputs missing associated <label>" });

  return checks;
}

export function checkFormAccessibility(fields: Array<{ name: string; hasLabel: boolean; hasError: boolean; hasDescription: boolean; required: boolean }>): A11yCheck[] {
  const checks: A11yCheck[] = [];

  for (const field of fields) {
    if (!field.hasLabel) checks.push({ rule: "form-label", level: "A", status: "fail", message: `Field ${field.name} missing label`, element: field.name });
    if (field.required && !field.hasError) checks.push({ rule: "form-required", level: "A", status: "warn", message: `Required field ${field.name} should have aria-required and error handling`, element: field.name });
    if (!field.hasDescription && field.required) checks.push({ rule: "form-description", level: "AA", status: "warn", message: `Field ${field.name} could benefit from description`, element: field.name });
  }

  return checks;
}

export const WCAG_AA_REQUIREMENTS = [
  { id: "1.1.1", name: "Non-text Content", level: "A", description: "All non-text content has text alternative" },
  { id: "1.3.1", name: "Info and Relationships", level: "A", description: "Information structure can be programmatically determined" },
  { id: "1.4.3", name: "Contrast (Minimum)", level: "AA", description: "Text contrast ratio at least 4.5:1" },
  { id: "1.4.11", name: "Non-text Contrast", level: "AA", description: "UI components contrast at least 3:1" },
  { id: "2.1.1", name: "Keyboard", level: "A", description: "All functionality available via keyboard" },
  { id: "2.4.3", name: "Focus Order", level: "A", description: "Focusable components receive focus in meaningful order" },
  { id: "2.4.7", name: "Focus Visible", level: "AA", description: "Keyboard focus indicator visible" },
  { id: "3.3.1", name: "Error Identification", level: "A", description: "Errors described in text" },
  { id: "3.3.2", name: "Labels or Instructions", level: "A", description: "Labels or instructions provided" },
  { id: "4.1.2", name: "Name, Role, Value", level: "A", description: "Name and role can be programmatically determined" },
] as const;

export function runA11yAudit(html: string, elements: Array<{ tag: string; tabIndex?: number; hasFocusVisible?: boolean; hasAriaLabel?: boolean }>): { checks: A11yCheck[]; pass: boolean; score: number } {
  const checks = [...checkSemanticHtml(html), ...checkKeyboardNavigation(elements)];
  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  const score = Math.max(0, 100 - fails * 10 - warns * 2);
  return { checks, pass: fails === 0, score };
}
