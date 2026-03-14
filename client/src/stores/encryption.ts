import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../services/api';
import {
  generateKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPrivateKey,
  encryptPrivateKey,
  decryptPrivateKey,
  generateDossierKey,
  exportDossierKey,
  importDossierKey,
  encryptDossierKey,
  decryptDossierKey,
  encryptContent,
  decryptContent,
  importPublicKey,
} from '../utils/encryption';

export const useEncryptionStore = defineStore('encryption', () => {
  // Decrypted private key in memory (never persisted)
  const privateKey = ref<CryptoKey | null>(null);
  const publicKey = ref<CryptoKey | null>(null);
  const hasKeys = ref(false);

  // Cache of decrypted dossier AES keys: dossierId -> CryptoKey
  const dossierKeyCache = new Map<string, CryptoKey>();

  const isUnlocked = computed(() => !!privateKey.value);

  // --- sessionStorage persistence ---
  const SESSION_KEY = 'me_crypto_session';
  let ephemeralKey: CryptoKey | null = null;

  async function getEphemeralKey(): Promise<CryptoKey> {
    if (!ephemeralKey) {
      ephemeralKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    }
    return ephemeralKey;
  }

  async function saveToSession(): Promise<void> {
    if (!privateKey.value) return;
    try {
      const key = await getEphemeralKey();
      const privateKeyJwk = await exportPrivateKey(privateKey.value);
      // Serialize dossier key cache
      const dossierKeysObj: Record<string, string> = {};
      for (const [id, dk] of dossierKeyCache.entries()) {
        const rawBuf = await exportDossierKey(dk);
        const bytes = new Uint8Array(rawBuf);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        dossierKeysObj[id] = btoa(binary);
      }
      const data = JSON.stringify({ privateKeyJwk, dossierKeys: dossierKeysObj });
      const encoded = new TextEncoder().encode(data);
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
      const payload = {
        iv: btoa(String.fromCharCode(...iv)),
        data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to save crypto session:', e);
    }
  }

  async function tryRestoreFromSession(): Promise<boolean> {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw || !ephemeralKey) return false;
    try {
      const { iv, data } = JSON.parse(raw);
      const ivArr = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
      const dataArr = Uint8Array.from(atob(data), c => c.charCodeAt(0));
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivArr },
        ephemeralKey,
        dataArr
      );
      const parsed = JSON.parse(new TextDecoder().decode(decrypted));

      // Restore private key
      privateKey.value = await importPrivateKey(parsed.privateKeyJwk);

      // Restore dossier keys
      if (parsed.dossierKeys) {
        for (const [id, keyStr] of Object.entries(parsed.dossierKeys)) {
          const binary = atob(keyStr as string);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const dk = await importDossierKey(bytes.buffer);
          dossierKeyCache.set(id, dk);
        }
      }
      hasKeys.value = true;
      return true;
    } catch (e) {
      console.error('Failed to restore crypto session:', e);
      sessionStorage.removeItem(SESSION_KEY);
      return false;
    }
  }

  function clearSession(): void {
    sessionStorage.removeItem(SESSION_KEY);
    ephemeralKey = null;
  }

  /**
   * Check if the user already has encryption keys stored on the server.
   */
  async function checkKeys(): Promise<boolean> {
    try {
      const { data } = await api.get('/encryption/keys');
      hasKeys.value = !!data.publicKey;
      return hasKeys.value;
    } catch {
      hasKeys.value = false;
      return false;
    }
  }

  /**
   * Generate a new RSA key pair and store it on the server.
   * Called on first login or when user enables encryption.
   */
  async function initializeKeys(password: string): Promise<void> {
    const keyPair = await generateKeyPair();
    const pubKeyStr = await exportPublicKey(keyPair.publicKey);
    const { encryptedPrivateKey: encPrivKey, salt } = await encryptPrivateKey(
      keyPair.privateKey,
      password
    );

    await api.post('/encryption/keys', {
      publicKey: pubKeyStr,
      encryptedPrivateKey: encPrivKey,
      salt,
    });

    privateKey.value = keyPair.privateKey;
    publicKey.value = keyPair.publicKey;
    hasKeys.value = true;
    await saveToSession();
  }

  /**
   * Decrypt the private key using the user's password.
   * Called after login.
   */
  async function unlockKeys(password: string): Promise<boolean> {
    try {
      const { data } = await api.get('/encryption/keys');
      if (!data.encryptedPrivateKey || !data.salt) {
        return false;
      }
      privateKey.value = await decryptPrivateKey(
        data.encryptedPrivateKey,
        password,
        data.salt
      );
      if (data.publicKey) {
        publicKey.value = await importPublicKey(data.publicKey);
      }
      hasKeys.value = true;
      await saveToSession();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lock keys (e.g., on logout).
   */
  function lockKeys(): void {
    privateKey.value = null;
    publicKey.value = null;
    hasKeys.value = false;
    dossierKeyCache.clear();
    clearSession();
  }

  /**
   * Generate a dossier AES key and encrypt it with the owner's public key.
   */
  async function setupDossierEncryption(dossierId: string): Promise<void> {
    if (!privateKey.value || !publicKey.value) {
      throw new Error('Cles de chiffrement non deverrouillees');
    }

    const dossierAesKey = await generateDossierKey();
    const encryptedKey = await encryptDossierKey(dossierAesKey, publicKey.value);

    // Get current user ID from the auth store data in localStorage token
    const { data: meData } = await api.get('/auth/me');
    const userId = meData.id;

    await api.put(`/encryption/dossier/${dossierId}`, {
      encryptedKeys: [{ userId, encryptedKey }],
      isEncrypted: true,
    });

    dossierKeyCache.set(dossierId, dossierAesKey);
  }

  /**
   * Disable encryption on a dossier.
   */
  async function disableDossierEncryption(dossierId: string): Promise<void> {
    await api.put(`/encryption/dossier/${dossierId}`, {
      encryptedKeys: [],
      isEncrypted: false,
    });
    dossierKeyCache.delete(dossierId);
  }

  /**
   * Get or load the dossier AES key for decryption.
   */
  async function getDossierKey(dossierId: string): Promise<CryptoKey | null> {
    if (dossierKeyCache.has(dossierId)) {
      return dossierKeyCache.get(dossierId)!;
    }

    if (!privateKey.value) return null;

    try {
      const { data } = await api.get(`/encryption/dossier/${dossierId}`);
      if (!data.encryptionKeys?.length) return null;

      const { data: meData } = await api.get('/auth/me');
      const userId = meData.id;

      const myKey = data.encryptionKeys.find(
        (k: any) => k.userId === userId || k.userId?._id === userId
      );
      if (!myKey) return null;

      const dossierAesKey = await decryptDossierKey(myKey.encryptedKey, privateKey.value);
      dossierKeyCache.set(dossierId, dossierAesKey);
      await saveToSession();
      return dossierAesKey;
    } catch {
      return null;
    }
  }

  /**
   * Share a dossier key with another user by re-encrypting it with their public key.
   */
  async function shareDossierKey(dossierId: string, targetUserId: string): Promise<void> {
    const dossierAesKey = await getDossierKey(dossierId);
    if (!dossierAesKey) {
      throw new Error('Impossible de recuperer la cle du dossier');
    }

    // Get target user's public key
    const { data: keyData } = await api.get(`/encryption/keys/${targetUserId}`);
    if (!keyData.publicKey) {
      throw new Error("L'utilisateur cible n'a pas de cles de chiffrement");
    }

    const targetPubKey = await importPublicKey(keyData.publicKey);
    const encryptedKey = await encryptDossierKey(dossierAesKey, targetPubKey);

    // Get current encryption keys for this dossier
    const { data: dossierData } = await api.get(`/encryption/dossier/${dossierId}`);
    const existingKeys = dossierData.encryptionKeys || [];

    // Replace or add the key for this user
    const filtered = existingKeys.filter(
      (k: any) => (k.userId?._id || k.userId) !== targetUserId
    );
    filtered.push({ userId: targetUserId, encryptedKey });

    await api.put(`/encryption/dossier/${dossierId}`, {
      encryptedKeys: filtered,
    });
  }

  /**
   * Encrypt data for a dossier.
   */
  async function encryptForDossier(dossierId: string, data: any): Promise<string> {
    const key = await getDossierKey(dossierId);
    if (!key) throw new Error('Cle de chiffrement du dossier introuvable');
    return encryptContent(data, key);
  }

  /**
   * Decrypt data from a dossier.
   */
  async function decryptForDossier(dossierId: string, encryptedData: string): Promise<any> {
    const key = await getDossierKey(dossierId);
    if (!key) throw new Error('Cle de chiffrement du dossier introuvable');
    return decryptContent(encryptedData, key);
  }

  return {
    isUnlocked,
    hasKeys,
    checkKeys,
    initializeKeys,
    unlockKeys,
    lockKeys,
    tryRestoreFromSession,
    setupDossierEncryption,
    disableDossierEncryption,
    getDossierKey,
    shareDossierKey,
    encryptForDossier,
    decryptForDossier,
  };
});
