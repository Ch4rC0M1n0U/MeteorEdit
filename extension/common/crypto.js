// E2E encryption for extension → MeteorEdit dossier
// Mirrors the client-side scheme used by client/src/stores/encryption.ts:
//   - AES-256-GCM key generated per payload
//   - Payload (cookies JSON) encrypted with AES key + 12-byte IV
//   - AES key wrapped with the dossier's RSA-OAEP-4096 public key (SHA-256)
//   - Output: { encryptedKey, iv, ciphertext } base64-encoded

function bytesToB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importPublicKey(spkiPem) {
  const pemBody = spkiPem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '');
  const der = b64ToBytes(pemBody);
  return crypto.subtle.importKey(
    'spki',
    der,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
}

export async function encryptForDossier(publicKeyPem, payloadObj) {
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payloadObj));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext)
  );
  const rawAes = new Uint8Array(await crypto.subtle.exportKey('raw', aesKey));
  const pubKey = await importPublicKey(publicKeyPem);
  const wrappedKey = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pubKey, rawAes)
  );

  return {
    version: 1,
    algorithm: 'RSA-OAEP-4096+AES-256-GCM',
    encryptedKey: bytesToB64(wrappedKey),
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(ciphertext),
  };
}
