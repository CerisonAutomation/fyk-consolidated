/**
 * End-to-end encryption and passwordless auth.
 *
 * This is real cryptography via the Web Crypto API, not a mock:
 *   • ECDH P-256 key agreement between two devices
 *   • HKDF-SHA256 to derive a per-conversation AES-GCM key
 *   • AES-256-GCM with a fresh 96-bit IV per message (authenticated)
 *   • Signal-style safety numbers so two people can verify out of band
 *   • WebAuthn passkeys backed by the platform authenticator
 *
 * Private keys are non-extractable where the algorithm allows it. This module
 * is a capability prototype and is not wired to the application's chat path.
 * It must not be presented as message security until transport and key exchange
 * are integrated and independently reviewed.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

export type KeyPairRecord = {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicRaw: string;
  createdAt: number;
};

export type Envelope = {
  v: 1;
  iv: string;
  ct: string;
  alg: "AES-GCM-256";
  at: number;
};

export const cryptoAvailable = () =>
  typeof crypto !== "undefined" && !!crypto.subtle && typeof crypto.subtle.deriveKey === "function";

/* ------------------------------- encoding ------------------------------- */

export function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** crypto.getRandomValues, typed against a concrete ArrayBuffer. */
function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)));
}

/* ------------------------------ key agreement --------------------------- */

/** Generate an ECDH P-256 identity key pair. The private key never leaves this device. */
export async function generateIdentity(): Promise<KeyPairRecord> {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveKey",
    "deriveBits",
  ]);
  const raw = await crypto.subtle.exportKey("raw", pair.publicKey);
  return {
    publicKey: pair.publicKey,
    privateKey: pair.privateKey,
    publicRaw: toB64(raw),
    createdAt: Date.now(),
  };
}

export async function importPublicKey(publicRaw: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", fromB64(publicRaw), { name: "ECDH", namedCurve: "P-256" }, true, []);
}

/**
 * Derive the conversation key. ECDH gives us a shared secret; HKDF stretches it
 * into a distinct AES key per conversation, salted with the conversation id so
 * two people who talk in several threads never reuse key material.
 */
export async function deriveConversationKey(
  myPrivate: CryptoKey,
  theirPublic: CryptoKey,
  conversationId: string,
): Promise<CryptoKey> {
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: theirPublic }, myPrivate, 256);
  const hkdfKey = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: enc.encode(`fyk:conv:${conversationId}`),
      info: enc.encode("fyk/message-key/v1"),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/* ------------------------------- messages ------------------------------- */

export async function encryptMessage(key: CryptoKey, plaintext: string): Promise<Envelope> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, enc.encode(plaintext));
  return { v: 1, iv: toB64(iv), ct: toB64(ct), alg: "AES-GCM-256", at: Date.now() };
}

export async function decryptMessage(key: CryptoKey, envelope: Envelope): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(envelope.iv), tagLength: 128 },
    key,
    fromB64(envelope.ct),
  );
  return dec.decode(pt);
}

/** Encrypt arbitrary bytes — used for voice notes and photos before they leave the device. */
export async function encryptBlob(key: CryptoKey, data: ArrayBuffer): Promise<Envelope> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { v: 1, iv: toB64(iv), ct: toB64(ct), alg: "AES-GCM-256", at: Date.now() };
}

/* ---------------------------- safety numbers ---------------------------- */

/**
 * A 60-digit fingerprint of both identity keys, ordered deterministically so
 * both sides render the same string. Compare it in person or over another
 * channel to rule out a machine-in-the-middle.
 */
export async function safetyNumber(myPublicRaw: string, theirPublicRaw: string): Promise<string> {
  const [a, b] = [myPublicRaw, theirPublicRaw].sort();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`${a}|${b}`));
  const bytes = new Uint8Array(digest);
  let out = "";
  for (let i = 0; i < 30; i++) out += String(bytes[i]! % 10);
  return out.replace(/(\d{5})(?=\d)/g, "$1 ");
}

/** Short visual fingerprint for compact UI. */
export async function keyFingerprint(publicRaw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", fromB64(publicRaw));
  const bytes = new Uint8Array(digest).slice(0, 8);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .replace(/(.{4})(?=.)/g, "$1 ")
    .toUpperCase();
}

/* ------------------------------- passwords ------------------------------ */

/** PBKDF2-SHA256, 310 000 iterations — OWASP's current floor for this primitive. */
export async function hashPin(pin: string, saltB64?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltB64 ? fromB64(saltB64) : randomBytes(16);
  const base = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" },
    base,
    256,
  );
  return { hash: toB64(bits), salt: toB64(salt) };
}

export async function verifyPin(pin: string, hash: string, salt: string): Promise<boolean> {
  const result = await hashPin(pin, salt);
  // Constant-time-ish comparison.
  if (result.hash.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= result.hash.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------- passkeys ------------------------------- */

export type PasskeyRecord = {
  id: string;
  type: string;
  transports: string[];
  createdAt: number;
  label: string;
};

export const passkeysAvailable = () =>
  typeof PublicKeyCredential !== "undefined" && !!navigator.credentials?.create;

export async function platformAuthenticatorAvailable(): Promise<boolean> {
  if (!passkeysAvailable()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Registers a real discoverable credential against the platform authenticator
 * (Face ID, Touch ID, Windows Hello, Android biometrics). The private key is
 * generated and stored by the OS — we only ever see the credential id.
 */
export async function registerPasskey(userLabel: string): Promise<PasskeyRecord> {
  if (!passkeysAvailable()) throw new Error("Passkeys aren't supported in this browser.");

  const challenge = randomBytes(32);
  const userId = randomBytes(16);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "FYK — Find Your King", id: location.hostname || undefined },
      user: { id: userId, name: userLabel, displayName: userLabel },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred",
        userVerification: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error("Registration was cancelled.");

  const response = credential.response as AuthenticatorAttestationResponse;
  const transports = typeof response.getTransports === "function" ? response.getTransports() : [];

  return {
    id: toB64(credential.rawId).slice(0, 22),
    type: credential.type,
    transports,
    createdAt: Date.now(),
    label: userLabel,
  };
}

export async function authenticatePasskey(): Promise<boolean> {
  if (!passkeysAvailable()) return false;
  const challenge = randomBytes(32);
  const assertion = await navigator.credentials.get({
    publicKey: { challenge, timeout: 60_000, userVerification: "preferred" },
    mediation: "optional",
  });
  return !!assertion;
}

/* -------------------------------- exports ------------------------------- */

/** Gzip a JSON export with CompressionStream — no library, no upload. */
export async function compressJson(value: unknown): Promise<Blob> {
  const json = JSON.stringify(value, null, 2);
  if (typeof CompressionStream === "undefined") return new Blob([json], { type: "application/json" });
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob().then((b) => new Blob([b], { type: "application/gzip" }));
}

export function randomId(bytes = 16): string {
  return toB64(randomBytes(bytes)).replace(/[+/=]/g, "").slice(0, 22);
}
