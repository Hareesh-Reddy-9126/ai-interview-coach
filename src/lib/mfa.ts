/**
 * TOTP (Time-Based One-Time Password) utilities using Web Crypto API.
 *
 * RFC 6238 implementation — no external dependencies, works entirely in the
 * browser. Used for MFA enrollment and verification.
 *
 * Steps:
 *   1. generateSecret() → base32 secret key
 *   2. totpURL(secret, email) → otpauth:// URL (render as QR code)
 *   3. verifyTokenAsync(secret, token) → boolean (valid for ±1 step = 90s)
 *   4. generateRecoveryCodes() → 8 single-use codes
 */

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Generate a random base32-encoded secret (160 bits = 20 bytes → 32 chars).
 */
export function generateSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let result = "";
  let buffer = 0;
  let bitsLeft = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitsLeft += 8;
    while (bitsLeft >= 5) {
      result += BASE32_CHARS[(buffer >> (bitsLeft - 5)) & 31];
      bitsLeft -= 5;
    }
  }
  return result;
}

/**
 * Decode a base32 secret to raw bytes.
 */
function decodeSecret(secret: string): Uint8Array {
  let buffer = 0;
  let bitsLeft = 0;
  const bytes: number[] = [];
  for (const char of secret.toUpperCase()) {
    const val = BASE32_CHARS.indexOf(char);
    if (val === -1) continue;
    buffer = (buffer << 5) | val;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bytes.push((buffer >> (bitsLeft - 8)) & 0xff);
      bitsLeft -= 8;
    }
  }
  return new Uint8Array(bytes);
}

async function sha1(data: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest("SHA-1", data);
  return new Uint8Array(hash);
}

/**
 * HMAC-SHA1 based TOTP token computation.
 */
async function hmacSha1Token(key: Uint8Array, data: Uint8Array): Promise<string> {
  const BLOCK_SIZE = 64;
  const keyBytes = key.length > BLOCK_SIZE ? await sha1(key) : key;
  const paddedKey = new Uint8Array(BLOCK_SIZE);
  paddedKey.set(keyBytes);

  const oKeyPad = new Uint8Array(BLOCK_SIZE);
  const iKeyPad = new Uint8Array(BLOCK_SIZE);
  for (let i = 0; i < BLOCK_SIZE; i++) {
    oKeyPad[i] = paddedKey[i] ^ 0x5c;
    iKeyPad[i] = paddedKey[i] ^ 0x36;
  }

  const inner = new Uint8Array(iKeyPad.length + data.length);
  inner.set(iKeyPad);
  inner.set(data, iKeyPad.length);

  const innerHash = await sha1(inner);

  const outer = new Uint8Array(oKeyPad.length + innerHash.length);
  outer.set(oKeyPad);
  outer.set(innerHash, oKeyPad.length);

  const hash = await sha1(outer);

  // Dynamic truncation (RFC 4226)
  const offset = hash[hash.length - 1] & 0xf;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % 1_000_000;
  return otp.toString().padStart(6, "0");
}

/**
 * Verify a TOTP token with ±1 step drift tolerance (90s window).
 */
export async function verifyTokenAsync(secret: string, token: string): Promise<boolean> {
  const currentStep = Math.floor(Date.now() / 1000 / 30);
  for (let offset = -1; offset <= 1; offset++) {
    const timeStep = currentStep + offset;
    const timeBytes = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) {
      timeBytes[i] = timeStep & 0xff;
    }
    const key = decodeSecret(secret);
    const expected = await hmacSha1Token(key, timeBytes);
    if (expected === token) return true;
  }
  return false;
}

/**
 * Build an otpauth:// URL for QR code scanning.
 */
export function totpURL(secret: string, email: string, issuer = "AI Interview Lab"): string {
  const encodedSecret = encodeURIComponent(secret);
  const encodedEmail = encodeURIComponent(email);
  const encodedIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${encodedSecret}&issuer=${encodedIssuer}&digits=6&period=30`;
}

/**
 * Generate 8 single-use recovery codes (16 chars each).
 */
export function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    let code = "";
    for (const byte of bytes) code += BASE32_CHARS[byte % BASE32_CHARS.length];
    codes.push(code);
  }
  return codes;
}
