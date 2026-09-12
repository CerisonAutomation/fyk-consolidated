/**
 * Generates a VAPID key pair for `supabase/functions/notify` and the browser client.
 *
 * WHY THIS EXISTS
 * ---------------
 * Web push is authenticated by the *push service*, not by the app: `web-push` signs every
 * request with a VAPID private key (ES256 over P-256), and a browser refuses a subscription
 * whose `applicationServerKey` is not the matching public key. So the feature is unreachable
 * without a key pair — and *dangerous* if that private key comes from a tutorial, a repo, or
 * a copied `.env`, because whoever holds it can notify every user of this deployment on your
 * domain's name with text they choose.
 *
 * The repository previously documented `VITE_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` in
 * `.env.example` with no way to produce them, which leaves "paste something from the
 * internet" as the only available move. This script is the thing that was missing: no
 * dependency (`node:crypto` only), nothing sent anywhere, and the private key printed once
 * because where it belongs is a deploy secret store, not a checkout.
 *
 *   node scripts/vapid-keys.mjs
 *   node scripts/vapid-keys.mjs --subject mailto:you@example.com
 */
import { createPrivateKey, generateKeyPairSync, randomBytes } from "node:crypto";

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const raw = (value) => Buffer.from(value, "base64url");

// `prime256v1` is what RFC 7515 calls P-256, and it is the only curve web-push accepts.
// `generateKeyPairSync` exports JWK directly, which gives the three base64url components
// VAPID needs (`x`, `y`, `d`) without any DER or PEM handling here.
const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = privateKey.export({ format: "jwk" });
if (jwk.crv !== "P-256" || !jwk.d || !jwk.x || !jwk.y) {
  throw new Error(`unexpected JWK export: ${JSON.stringify(jwk)}`);
}

// `applicationServerKey` and web-push's public key both want the uncompressed point, i.e.
// 0x04 || X || Y — 65 bytes. Trimming the leading 0x04 is the classic way this fails with
// an error message about an invalid key.
const publicKeyRaw = Buffer.concat([Buffer.from([0x04]), raw(jwk.x), raw(jwk.y)]);
const privateKeyRaw = jwk.d;

// The round trip is the check that the encoding above is the encoding `web-push` will
// accept: re-import the JWK and export it again. A key that does not survive that is not a
// key anybody should deploy, so this fails loudly instead of printing a warning.
const reimported = createPrivateKey({
  key: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, d: jwk.d },
  format: "jwk",
}).export({ format: "jwk" });
if (reimported.d !== jwk.d || reimported.x !== jwk.x || reimported.y !== jwk.y) {
  throw new Error("generated key failed its own JWK round trip; do not use this output");
}

const subjectAt = process.argv.indexOf("--subject");
const subject =
  subjectAt >= 0
    ? process.argv[subjectAt + 1]
    : "mailto:ops@your-domain.example";

// The Postgres→function shared secret, generated alongside: the trigger header and the
// function's env must agree, and they must not be a value anybody has ever committed.
const internalToken = randomBytes(32).toString("hex");
const cronToken = randomBytes(32).toString("hex");

console.log(
  [
    "# ── browser (Vite, .env.local / the deploy's build env) ─────────────────────",
    `VITE_VAPID_PUBLIC_KEY=${b64url(publicKeyRaw)}`,
    "",
    "# ── edge function secrets (`supabase secrets set …`) ────────────────────────",
    `VAPID_PRIVATE_KEY=${privateKeyRaw}`,
    `VAPID_SUBJECT=${subject}`,
    `PUSH_INTERNAL_TOKEN=${internalToken}`,
    `CRON_INTERNAL_TOKEN=${cronToken}`,
    "",
    "# ── matching Postgres role settings (README › Push delivery) ────────────────",
    `# alter role authenticated set fyk.push_notify_token = '${internalToken}';`,
    "# alter role authenticated set fyk.push_notify_url   =",
    "#   'https://YOUR-PROJECT-REF.functions.supabase.co/v1/notify';",
    "#",
    "# and point whatever schedules the housekeeping at /v1/cron-cleanup with",
    `# the header 'x-fyk-cron-token: ${cronToken}'.`,
    "",
    "# Keys are shown once and never written to disk. Re-run to make a new pair;",
    "# re-running invalidates existing subscriptions, so do it before you have users.",
  ].join("\n"),
);
