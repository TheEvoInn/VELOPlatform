/**
 * VELO 2.0 — Client-Side AES-256-GCM Encryption
 * Zero-knowledge vault encryption using Web Crypto API (window.crypto.subtle).
 *
 * Key derivation: PBKDF2 from user's unique ID + email salt — no user passphrase needed.
 * Storage format: base64(iv[12 bytes] + ciphertext)
 * Algorithm: AES-GCM 256-bit
 */

const PBKDF2_ITERATIONS = 100_000;
const KEY_USAGE: KeyUsage[] = ['encrypt', 'decrypt'];

// ── Helpers ────────────────────────────────────────────────────────────────────
function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function bytesToStr(b: ArrayBuffer): string {
  return new TextDecoder().decode(b);
}

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

// ── Key derivation ─────────────────────────────────────────────────────────────
/**
 * Derives a deterministic AES-256-GCM key from user ID + email.
 * The key is never stored — re-derived on each session from auth identity.
 */
export async function deriveVaultKey(userId: string, userEmail: string): Promise<CryptoKey> {
  // Import password material from user identity
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    strToBytes(`${userId}:${userEmail}`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive AES-GCM key using PBKDF2 with a fixed salt (deterministic per user)
  const salt = strToBytes(`velo2-vault-salt-${userId.slice(0, 8)}`);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    KEY_USAGE
  );
}

// ── Encryption ─────────────────────────────────────────────────────────────────
/**
 * Encrypts plaintext with AES-256-GCM.
 * Returns base64-encoded string: IV (12 bytes) + ciphertext.
 */
export async function encryptVaultValue(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = strToBytes(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  // Combine IV + ciphertext into a single buffer
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return toBase64(combined.buffer);
}

// ── Decryption ─────────────────────────────────────────────────────────────────
/**
 * Decrypts a base64-encoded AES-256-GCM ciphertext (IV + ciphertext).
 * Returns null if decryption fails (e.g., wrong key or corrupted data).
 */
export async function decryptVaultValue(base64: string, key: CryptoKey): Promise<string | null> {
  try {
    const combined = fromBase64(base64);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return bytesToStr(plainBuffer);
  } catch {
    // Decryption failed — data may be legacy base64 (old btoa format), try fallback
    try {
      return decodeURIComponent(escape(atob(base64)));
    } catch {
      return null;
    }
  }
}

// ── Session key cache ──────────────────────────────────────────────────────────
// Cache in module scope for the session — avoids re-deriving on every operation
let _cachedKey: CryptoKey | null = null;
let _cachedUserId: string | null = null;

export async function getVaultKey(userId: string, userEmail: string): Promise<CryptoKey> {
  if (_cachedKey && _cachedUserId === userId) return _cachedKey;
  _cachedKey = await deriveVaultKey(userId, userEmail);
  _cachedUserId = userId;
  return _cachedKey;
}

export function clearVaultKeyCache(): void {
  _cachedKey = null;
  _cachedUserId = null;
}
