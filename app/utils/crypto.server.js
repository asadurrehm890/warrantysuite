import crypto from "crypto";

// AES-256-GCM at-rest encryption for merchant-supplied secrets
// (Brevo API key, Cloudinary secret, etc.)
//
// Key is read from env var SETTINGS_ENCRYPTION_KEY as a 32-byte base64 string.
// Generate one with:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//
// Storage layout (single base64 string):
//   v1 || iv (12 bytes) || authTag (16 bytes) || ciphertext

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

let cachedKey = null;

function getKey() {
  if (cachedKey) return cachedKey;

  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "SETTINGS_ENCRYPTION_KEY env var is not set. Generate one with `node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"` and set it in your environment."
    );
  }

  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `SETTINGS_ENCRYPTION_KEY must decode to 32 bytes (got ${buf.length}).`
    );
  }

  cachedKey = buf;
  return cachedKey;
}

export function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(`${VERSION}:`);
}

export function encryptSecret(plaintext) {
  if (plaintext == null || plaintext === "") return plaintext;
  if (isEncrypted(plaintext)) return plaintext;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const payload = Buffer.concat([iv, tag, ciphertext]).toString("base64");
  return `${VERSION}:${payload}`;
}

export function decryptSecret(value) {
  if (value == null || value === "") return value;
  if (!isEncrypted(value)) {
    // Legacy plaintext value (pre-encryption); return as-is so existing
    // installs keep working until the merchant re-saves and triggers encryption.
    return value;
  }

  const payload = Buffer.from(value.slice(VERSION.length + 1), "base64");
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
