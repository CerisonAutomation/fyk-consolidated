/**
 * Generates `public/icons/*.png`, `public/apple-touch-icon-180.png` and
 * `public/manifest.webmanifest` from the two things that actually define the brand:
 * `public/logo-square.svg` and the design tokens in `src/styles.css`.
 *
 * WHY A SCRIPT AND NOT FIVE COMMITTED SVGs
 * ----------------------------------------
 * The manifest this replaces pointed at `/icons/icon-192.png` and `/icons/icon-512.png`,
 * which did not exist — the directory held only SVGs — so installability was broken on
 * every browser that checks for a real PNG, and the *other* manifest in the same folder
 * (`manifest.json`, referenced by no HTML) named the app "FYKING" with a `theme_color` of
 * `#d4af37` and a `background_color` of `#000000`. Neither hex appears in the app:
 * the palette is `oklch()` in `src/styles.css`. A status bar painted with a colour the
 * design does not use is a visible seam on every Android launch, and two manifests with
 * two different names is two truths with one winner per browser.
 *
 * So: derive, do not transcribe. `theme_color` is the token converted to sRGB here, and
 * `src/lib/app-shell.test.ts` fails when the checked-in artefacts stop matching the
 * tokens — which turns "someone changed the palette and the PWA kept the old gold" from a
 * screenshot-diff mystery into the name of the command that fixes it.
 *
 *   node scripts/build-icons.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const ICONS = join(PUBLIC, "icons");

/* ---------------------------------- colour --------------------------------- */

/**
 * oklch → `#rrggbb`, through culori rather than a hand-copied matrix. Colour maths looks
 * like forty lines you can eyeball and is not: the one-shot Oklab→sRGB coefficients are
 * easy to transcribe one digit wrong, and the failure is a background colour that is
 * *almost* right, which is exactly the defect this script replaces. `culori` is the same
 * library the CSS spec's own test vectors are checked with, and the pairs below are
 * asserted in `src/lib/app-shell.test.ts`.
 */
const culori = await import("culori");
const toRgb = culori.converter("rgb");
function oklchToHex(src) {
  const parsed = culori.parse(src);
  if (!parsed) throw new Error(`unparseable colour: ${src.slice(0, 80)}`);
  const rgb = toRgb(parsed);
  if (!rgb) throw new Error(`could not convert ${src}`);
  return culori.formatHex({ mode: "rgb", r: rgb.r, g: rgb.g, b: rgb.b });
}

const css = readFileSync(join(ROOT, "src", "styles.css"), "utf8");
const token = (name) => {
  const re = new RegExp(`--color-${name}:\\s*([^;]+);`);
  const hit = re.exec(css);
  if (!hit) throw new Error(`--color-${name} not found in src/styles.css`);
  return hit[1].trim();
};
const BACKGROUND = oklchToHex(token("background"));
const GOLD = oklchToHex(token("primary"));

/* ----------------------------------- marks ---------------------------------- */

const LOGO = readFileSync(join(PUBLIC, "logo-square.svg"), "utf8")
  .replace(/<\?xml[^>]*\?>/, "")
  .trim();
const VB = 1024;

/**
 * `scale` is the fraction of the canvas the mark occupies. Maskable icons need the
 * 60% safe zone (Android crops a circle/rounded square out of the middle), so the
 * number is per-artefact rather than a taste.
 */
function mark({ size, scale, background, silhouette = false }) {
  const inner = LOGO.replace(
    /<svg([^]*?)>/,
    (_all, attrs) =>
      `<svg${attrs.replace(/width="[^"]*"/, `width="${VB}"`).replace(
        /height="[^"]*"/,
        `height="${VB}"`,
      )}>`,
  );
  const paint = silhouette
    ? `<style>*{fill:#fff!important;stroke:#fff!important}</style>`
    : "";
  const pad = (1 - scale) / 2;
  const bg = background
    ? `<rect width="${size}" height="${size}" fill="${background}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${paint}${bg}
  <g transform="translate(${(pad * size).toFixed(1)} ${(pad * size).toFixed(1)}) scale(${((scale * size) / VB).toFixed(6)})">${inner}</g>
</svg>`;
}

/**
 * `name` is relative to `public/`, full stop — never `../`. An earlier version wrote the
 * iOS icon with `../apple-touch-icon-180.png`, which landed it in the *repo root*: `public/`
 * shipped no such file, `/apple-touch-icon-180.png` 404'd, and the home-screen icon was
 * missing on iOS while every local check stayed green. `src/lib/app-shell.test.ts` now
 * asserts that every URL the document head references exists under `public/`.
 */
/** The size the composed SVG declares, i.e. what the artefact must actually be. */
function sizeOf(svg) {
  const m = /<svg[^>]*\swidth="(\d+)"/.exec(svg);
  if (!m) throw new Error("composed svg has no width");
  return Number(m[1]);
}

async function png(name, svg) {
  if (name.startsWith("..") || name.startsWith("/")) {
    throw new Error(`${name} must stay inside public/`);
  }
  // Every name is relative to `public/`, and the argument *is* the URL path with the
  // leading slash removed: `icons/icon-192.png` → `/icons/icon-192.png`. Anything cleverer
  // here (a "no slash means icons/" rule, for instance) is how the iOS icon ended up in a
  // directory the document head does not point at.
  const path = join(PUBLIC, name);
  // The SVG declares its own pixel size, so rasterising at the default 96 DPI gives
  // exactly those dimensions. Passing a `density` here is the trap: it scales the whole
  // canvas, `icon-192.png` comes out 768x768, the manifest's declared `sizes` is a lie,
  // and `src/lib/app-shell.test.ts` reads the PNG header to catch it.
  // 4× supersample, then lanczos down to the target size. Vector rasterisation of the
  // brand mark at 32–192 px puts the thin strokes (the `Y` outline, the underline, both
  // ~13 of 1024 units) between pixels, and at 1× they come out half-rendered and jagged.
  const scale = 4;
  const buf = await sharp(Buffer.from(svg.replace(/width="(\d+)" height="(\d+)"/,
    (_m, w, h) => `width="${Number(w) * scale}" height="${Number(h) * scale}"`)), {
    // The SVG's own viewBox is untouched, so the artwork scales with the canvas.
    density: 96 * scale,
  })
    .resize({ width: sizeOf(svg), height: sizeOf(svg), fit: "inside", kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(path, buf);
  console.log(`  wrote ${name.replace(`${ROOT}/`, "")} (${buf.length} bytes)`);
}

/* ---------------------------------- outputs --------------------------------- */

mkdirSync(ICONS, { recursive: true });
console.log(`palette: background ${BACKGROUND}, primary ${GOLD}`);

await png("icons/icon-192.png", mark({ size: 192, scale: 0.78, background: BACKGROUND }));
await png("icons/icon-512.png", mark({ size: 512, scale: 0.78, background: BACKGROUND }));
await png("icons/icon-maskable-512.png", mark({ size: 512, scale: 0.6, background: BACKGROUND }));
await png("icons/badge-72.png", mark({ size: 72, scale: 0.9, background: null, silhouette: true }));
await png("apple-touch-icon-180.png", mark({ size: 180, scale: 0.84, background: BACKGROUND }));
await png("icons/favicon-32.png", mark({ size: 32, scale: 0.9, background: BACKGROUND }));

const routes = [
  ["/grid", "Browse", "Nearby profiles, with filters"],
  ["/right-now", "Right now", "Who is close, right now"],
  ["/notifications", "Inbox", "Matches, messages and alerts"],
];
for (const [url] of routes) {
  const file = join(ROOT, "src", "routes", `${url.slice(1)}.tsx`);
  const dir = join(ROOT, "src", "routes", url.slice(1), "index.tsx");
  if (!existsSync(file) && !existsSync(dir)) {
    throw new Error(`manifest shortcut ${url} has no route file`);
  }
}

const root = readFileSync(join(ROOT, "src", "routes", "__root.tsx"), "utf8");
const title = /title:\s*"([^"]+)"/.exec(root)?.[1];
const description = /name:\s*"description",\s*content:\s*"([^"]+)"/.exec(root)?.[1];
if (!title || !description) {
  throw new Error("could not read the document title/description from src/routes/__root.tsx");
}

writeFileSync(
  join(PUBLIC, "manifest.webmanifest"),
  `${JSON.stringify(
    {
      id: "/",
      name: title,
      short_name: title.split(" — ")[0],
      description,
      lang: "en",
      dir: "ltr",
      start_url: "/",
      scope: "/",
      display: "standalone",
      display_override: ["minimal-ui", "standalone"],
      orientation: "portrait-primary",
      background_color: BACKGROUND,
      theme_color: BACKGROUND,
      categories: ["social", "lifestyle"],
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
      shortcuts: routes.map(([url, name, description2]) => ({
        name,
        url,
        description: description2,
      })),
      // No `screenshots` array: an install card showing a mock-up is a fabricated asset,
      // and the manifest is valid without it.
    },
    null,
    2,
  )}\n`,
);
console.log("  wrote public/manifest.webmanifest");
console.log(`  title ${JSON.stringify(title)}, short_name ${JSON.stringify(title.split(" — ")[0])}`);
