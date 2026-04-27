import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * Lightweight UI store for global tool dialogs that can be opened from anywhere
 * (sidebar, command palette, keyboard shortcut, etc.).
 */
export const useToolsUIStore = defineStore('toolsUI', () => {
  const phoneScannerOpen = ref(false);

  function openPhoneScanner(): void {
    phoneScannerOpen.value = true;
  }
  function closePhoneScanner(): void {
    phoneScannerOpen.value = false;
  }

  return {
    phoneScannerOpen,
    openPhoneScanner,
    closePhoneScanner,
  };
});
