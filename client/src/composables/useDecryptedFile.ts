import { ref, onBeforeUnmount } from 'vue';
import { useEncryptionStore } from '../stores/encryption';
import { decryptFile } from '../utils/encryption';
import api from '../services/api';

/** Check if raw bytes look like a known unencrypted media format */
function looksLikeKnownFormat(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;
  // GIF: 47 49 46
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return true;
  // WebP: RIFF....WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return true;
  // MP4/MOV: ....ftyp (offset 4)
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return true;
  // WebM/MKV: 1A 45 DF A3
  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) return true;
  // MP3: FF FB or FF F3 or FF F2 or ID3
  if (bytes[0] === 0xFF && (bytes[1] === 0xFB || bytes[1] === 0xF3 || bytes[1] === 0xF2)) return true;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  // OGG: OggS
  if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return true;
  // WAV: RIFF....WAVE
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) return true;
  // AVI: RIFF....AVI
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x41 && bytes[9] === 0x56 && bytes[10] === 0x49) return true;
  // FLV: 46 4C 56
  if (bytes[0] === 0x46 && bytes[1] === 0x4C && bytes[2] === 0x56) return true;
  return false;
}

export function useDecryptedFile() {
  const encryptionStore = useEncryptionStore();
  const objectUrls = ref<string[]>([]);

  async function getDecryptedUrl(
    dossierId: string,
    fileUrl: string,
    contentType = 'application/octet-stream',
    noCache = false
  ): Promise<string> {
    // Extract bare filename (last segment) from fileUrl
    // Server searches subdirectories (uploads/, uploads/media/, uploads/media/captures/) automatically
    const filename = fileUrl.split('/').pop() || '';
    if (!filename) throw new Error('Invalid file URL');

    // Fetch encrypted blob via authenticated API route
    const cacheBust = noCache ? `?t=${Date.now()}` : '';
    const response = await api.get(`/files/${filename}${cacheBust}`, { responseType: 'arraybuffer' });

    // Decrypt
    const dossierKey = await encryptionStore.getDossierKey(dossierId);
    if (!dossierKey) {
      // No dossier key available — check if data looks like an unencrypted image
      const bytes = new Uint8Array(response.data);
      if (looksLikeKnownFormat(bytes)) {
        const blob = new Blob([response.data], { type: contentType });
        const url = URL.createObjectURL(blob);
        objectUrls.value.push(url);
        return url;
      }
      // Data is encrypted but we have no key — cannot display
      throw new Error('Encryption key unavailable');
    }

    try {
      const decryptedBuffer = await decryptFile(dossierKey, response.data);
      const blob = new Blob([decryptedBuffer], { type: contentType });
      const url = URL.createObjectURL(blob);
      objectUrls.value.push(url);
      return url;
    } catch {
      // Decryption failed — check if file is actually unencrypted (legacy)
      const bytes = new Uint8Array(response.data);
      if (looksLikeKnownFormat(bytes)) {
        const blob = new Blob([response.data], { type: contentType });
        const url = URL.createObjectURL(blob);
        objectUrls.value.push(url);
        return url;
      }
      throw new Error('Decryption failed');
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
