import { defineStore } from 'pinia';
import { ref } from 'vue';
import api, { SERVER_URL } from '../services/api';

export const useBrandingStore = defineStore('branding', () => {
  const appName = ref('MeteorEdit');
  const logoUrl = ref<string | null>(null);
  const accentColor = ref('#38bdf8');
  const faviconUrl = ref<string | null>(null);
  const loginMessage = ref('');
  const loginBackgroundUrl = ref<string | null>(null);
  const registrationEnabled = ref(true);
  const announcementEnabled = ref(false);
  const announcementMessage = ref('');
  const announcementVariant = ref<'info' | 'warning' | 'error'>('info');
  const loaded = ref(false);

  async function fetchBranding() {
    try {
      const { data } = await api.get('/settings/branding');
      appName.value = data.appName || 'MeteorEdit';
      accentColor.value = data.accentColor || '#38bdf8';
      loginMessage.value = data.loginMessage || '';
      registrationEnabled.value = data.registrationEnabled !== false;
      announcementEnabled.value = !!data.announcementEnabled;
      announcementMessage.value = data.announcementMessage || '';
      announcementVariant.value = data.announcementVariant || 'info';
      logoUrl.value = data.logoPath ? `${SERVER_URL}/${data.logoPath}` : null;
      faviconUrl.value = data.faviconPath ? `${SERVER_URL}/${data.faviconPath}` : null;
      loginBackgroundUrl.value = data.loginBackgroundPath ? `${SERVER_URL}/${data.loginBackgroundPath}` : null;
      applyBranding();
      loaded.value = true;
    } catch {
      loaded.value = true;
    }
  }

  function applyBranding() {
    document.title = appName.value;

    const root = document.documentElement;
    root.style.setProperty('--me-accent', accentColor.value);
    root.style.setProperty('--me-accent-glow', hexToGlow(accentColor.value));

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (faviconUrl.value) {
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = faviconUrl.value;
    }
  }

  function hexToGlow(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.15)`;
  }

  return { appName, logoUrl, accentColor, faviconUrl, loginMessage, loginBackgroundUrl, registrationEnabled, announcementEnabled, announcementMessage, announcementVariant, loaded, fetchBranding, applyBranding };
});
