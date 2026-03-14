import { ref, onBeforeUnmount } from 'vue';
import { useEncryptionStore } from '../stores/encryption';
import { decryptFile } from '../utils/encryption';
import api from '../services/api';

export function useDecryptedFile() {
  const encryptionStore = useEncryptionStore();
  const objectUrls = ref<string[]>([]);

  async function getDecryptedUrl(
    dossierId: string,
    fileUrl: string,
    contentType = 'application/octet-stream'
  ): Promise<string> {
    // Extract filename from fileUrl (e.g., "/uploads/abc123.ext" -> "abc123.ext"
    // or "uploads/media/captures/abc.png" -> "media/captures/abc.png")
    const uploadsIdx = fileUrl.indexOf('uploads/');
    let filename: string;
    if (uploadsIdx !== -1) {
      filename = fileUrl.substring(uploadsIdx + 'uploads/'.length);
    } else {
      filename = fileUrl.split('/').pop() || '';
    }
    if (!filename) throw new Error('Invalid file URL');

    // Fetch encrypted blob via authenticated API route
    const response = await api.get(`/files/${filename}`, { responseType: 'arraybuffer' });

    // Decrypt
    const dossierKey = await encryptionStore.getDossierKey(dossierId);
    if (!dossierKey) {
      // Fallback: file might not be encrypted (legacy)
      const blob = new Blob([response.data], { type: contentType });
      const url = URL.createObjectURL(blob);
      objectUrls.value.push(url);
      return url;
    }

    try {
      const decryptedBuffer = await decryptFile(dossierKey, response.data);
      const blob = new Blob([decryptedBuffer], { type: contentType });
      const url = URL.createObjectURL(blob);
      objectUrls.value.push(url);
      return url;
    } catch {
      // Decryption failed - might be a legacy unencrypted file
      const blob = new Blob([response.data], { type: contentType });
      const url = URL.createObjectURL(blob);
      objectUrls.value.push(url);
      return url;
    }
  }

  function revokeAll() {
    for (const url of objectUrls.value) {
      URL.revokeObjectURL(url);
    }
    objectUrls.value = [];
  }

  onBeforeUnmount(() => {
    revokeAll();
  });

  return { getDecryptedUrl, revokeAll };
}
