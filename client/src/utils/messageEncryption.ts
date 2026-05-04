import {
  importPublicKey,
  encryptDossierKey,
  decryptDossierKey,
  generateDossierKey,
  encryptContent,
  decryptContent,
} from './encryption';

/**
 * E2E encryption for direct messages.
 *
 * Each message gets a fresh AES-256-GCM key. The body is encrypted once with
 * that key (encryptContent already prepends the IV to the ciphertext), then
 * the AES key is wrapped (RSA-OAEP) with each recipient's RSA public key
 * (including the sender themselves so they can read their own messages on
 * other devices).
 *
 * Wire format stored in Message.body — JSON string:
 *
 *   {
 *     "v": 1,
 *     "ct": "<base64 (iv ‖ ciphertext)>",
 *     "keys": {
 *       "<userIdA>": "<base64 wrapped AES key>",
 *       "<userIdB>": "<base64 wrapped AES key>"
 *     }
 *   }
 */

export interface DmEnvelope {
  v: 1;
  ct: string;
  keys: Record<string, string>;
}

/**
 * Encrypt a plain-text body for an arbitrary list of recipients.
 * @param body plain text
 * @param recipients map `{ userId -> RSA public key as JWK string }`
 */
export async function encryptDmBody(
  body: string,
  recipients: Record<string, string>
): Promise<string> {
  const aesKey = await generateDossierKey();
  const ct = await encryptContent(body, aesKey);

  const keys: Record<string, string> = {};
  for (const [userId, pubKeyJwk] of Object.entries(recipients)) {
    if (!pubKeyJwk) continue;
    const pubKey = await importPublicKey(pubKeyJwk);
    keys[userId] = await encryptDossierKey(aesKey, pubKey);
  }

  const envelope: DmEnvelope = { v: 1, ct, keys };
  return JSON.stringify(envelope);
}

/**
 * Decrypt a DM envelope using the current user's private key.
 * Returns null if the envelope can't be decrypted (wrong recipient, parse error…).
 */
export async function decryptDmBody(
  envelopeJson: string,
  myUserId: string,
  myPrivateKey: CryptoKey
): Promise<string | null> {
  try {
    const env = JSON.parse(envelopeJson) as DmEnvelope;
    if (env.v !== 1) return null;
    const myWrapped = env.keys?.[myUserId];
    if (!myWrapped) return null;
    const aesKey = await decryptDossierKey(myWrapped, myPrivateKey);
    const decrypted = await decryptContent(env.ct, aesKey);
    return typeof decrypted === 'string' ? decrypted : String(decrypted);
  } catch {
    return null;
  }
}
