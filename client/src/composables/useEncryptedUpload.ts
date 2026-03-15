import { useEncryptionStore } from '../stores/encryption';
import { encryptFile, hashFile } from '../utils/encryption';
import api from '../services/api';

export function useEncryptedUpload() {
  const encryptionStore = useEncryptionStore();

  /**
   * Encrypt and upload a file for a dossier.
   * @param dossierId - The dossier this file belongs to
   * @param file - The File object to upload
   * @param endpoint - API endpoint (e.g., '/nodes/:id/upload')
   * @param fieldName - Form field name (default: 'file')
   */
  async function uploadEncryptedFile(
    dossierId: string,
    file: File,
    endpoint: string,
    fieldName = 'file'
  ): Promise<{ data: any }> {
    const arrayBuffer = await file.arrayBuffer();
    const plainHash = await hashFile(arrayBuffer);
    const dossierKey = await encryptionStore.getDossierKey(dossierId);

    const formData = new FormData();

    if (dossierKey) {
      const encryptedBuffer = await encryptFile(dossierKey, arrayBuffer);
      const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
      const encryptedFile = new File([encryptedBlob], file.name + '.enc', { type: 'application/octet-stream' });
      formData.append(fieldName, encryptedFile);
      formData.append('originalContentType', file.type);
      formData.append('originalFileSize', file.size.toString());
      formData.append('plainHash', plainHash);
    } else {
      console.warn(`[Encryption] No dossier key for ${dossierId} — uploading file in plaintext. Is encryption unlocked?`, {
        isUnlocked: encryptionStore.isUnlocked,
        hasKeys: encryptionStore.hasKeys,
      });
      formData.append(fieldName, file);
    }

    return api.post(endpoint, formData);
  }

  /**
   * Encrypt and upload an image (for TipTap editor).
   */
  async function uploadEncryptedImage(
    dossierId: string,
    file: File
  ): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const dossierKey = await encryptionStore.getDossierKey(dossierId);

    const formData = new FormData();

    if (dossierKey) {
      const encryptedBuffer = await encryptFile(dossierKey, arrayBuffer);
      const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
      const encryptedFile = new File([encryptedBlob], file.name + '.enc', { type: 'application/octet-stream' });
      formData.append('image', encryptedFile);
      formData.append('originalContentType', file.type);
    } else {
      console.warn(`[Encryption] No dossier key for ${dossierId} — uploading image in plaintext. Is encryption unlocked?`, {
        isUnlocked: encryptionStore.isUnlocked,
        hasKeys: encryptionStore.hasKeys,
      });
      formData.append('image', file);
    }

    const { data } = await api.post('/upload/image', formData);
    return data.url;
  }

  return { uploadEncryptedFile, uploadEncryptedImage };
}
