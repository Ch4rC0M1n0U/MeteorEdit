import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ThemeInstance } from 'vuetify';

export const useThemeStore = defineStore('theme', () => {
  const saved = localStorage.getItem('me-theme');
  const isDark = ref(saved ? saved === 'dark' : true);

  let vuetifyTheme: ThemeInstance | null = null;

  // Apply on load
  applyDataTheme(isDark.value);

  function applyDataTheme(dark: boolean) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  function init(theme: ThemeInstance) {
    vuetifyTheme = theme;
    theme.global.name.value = isDark.value ? 'meteorDark' : 'meteorLight';
    applyDataTheme(isDark.value);
  }

  function toggle() {
    isDark.value = !isDark.value;
    if (vuetifyTheme) {
      vuetifyTheme.global.name.value = isDark.value ? 'meteorDark' : 'meteorLight';
    }
    applyDataTheme(isDark.value);
    localStorage.setItem('me-theme', isDark.value ? 'dark' : 'light');
  }

  return { isDark, toggle, init };
});
