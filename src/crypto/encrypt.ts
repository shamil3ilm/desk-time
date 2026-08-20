// AES-GCM 256 via Web Crypto (available in Workers runtime).
// Ciphertext layout: [12-byte IV] || [ciphertext + 16-byte auth tag].
// Master key is a base64 32-byte value stored in Cloudflare Secrets as MASTER_KEY.

const IV_LEN = 12;

async function importKey(masterKeyB64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(masterKeyB64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error(`MASTER_KEY must be 32 bytes (got ${raw.length}) — regenerate with 'node -e "console.log(require(\\"crypto\\").randomBytes(32).toString(\\"base64\\"))"'`);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptString(plaintext: string, masterKeyB64: string): Promise<Uint8Array> {
  const key = await importKey(masterKeyB64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return out;
}

export async function decryptToString(blob: Uint8Array | ArrayBuffer, masterKeyB64: string): Promise<string> {
  const bytes = blob instanceof Uint8Array ? blob : new Uint8Array(blob);
  if (bytes.length <= IV_LEN) throw new Error("Ciphertext too short");
  const iv = bytes.subarray(0, IV_LEN);
  const ct = bytes.subarray(IV_LEN);
  const key = await importKey(masterKeyB64);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}
