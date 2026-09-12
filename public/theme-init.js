/*
 * Runs before first paint, from <head>. Two jobs, both about the frame around the app.
 *
 * 1. Apply the stored theme. `<html>` is server-rendered with `class="dark"`, so a user who
 *    chose light mode saw a black flash on every load until React hydrated. This file existed
 *    and was correct, and was loaded by nothing — which is how that flash survived several
 *    passes of review.
 * 2. Keep `theme-color` in step with it. TanStack Start de-duplicates `<meta name="…">` by
 *    `name`, so the dark *and* light variants a manifest-driven install wants cannot both be
 *    rendered from `__root.tsx` — the later one silently wins and the other disappears. Setting
 *    it here, from the same `resolved` value the class comes from, is what makes the status-bar
 *    colour match the surface under it in both schemes.
 *
 * Both hexes are the app's `--color-background` token (see `src/styles.css`), regenerated into
 * `public/manifest.webmanifest` by `pnpm icons:build`, and asserted equal to the tokens by
 * `src/lib/app-shell.test.ts`. Hand-editing them here is the drift that test exists to catch.
 */
(function () {
  var THEME_COLOR = { dark: "#010101", light: "#f9f8f7" };

  function paintThemeColor(resolved) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", THEME_COLOR[resolved] || THEME_COLOR.dark);
  }

  try {
    var stored = window.localStorage.getItem("theme");
    var mode = stored === "light" || stored === "dark" || stored === "auto" ? stored : "dark";
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var resolved = mode === "auto" ? (prefersDark ? "dark" : "light") : mode;
    var root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    if (mode === "auto") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", mode);
    }
    root.style.colorScheme = resolved;
    paintThemeColor(resolved);
  } catch (e) {
    paintThemeColor("dark");
  }
})();
