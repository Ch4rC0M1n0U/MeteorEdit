<template>
  <v-app>
    <AppBar v-if="authStore.isAuthenticated" />
    <v-main>
      <div
        v-if="brandingStore.announcementEnabled && brandingStore.announcementMessage"
        class="announcement-banner"
        :class="`announcement-${brandingStore.announcementVariant}`"
      >
        <v-icon size="18" class="mr-2">{{ announcementIcon }}</v-icon>
        {{ brandingStore.announcementMessage }}
      </div>
      <router-view />
    </v-main>
    <ConfirmDialog />
    <CommandPalette v-if="authStore.isAuthenticated" />
    <PwaUpdatePrompt />
  </v-app>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useTheme } from 'vuetify';
import { useAuthStore } from './stores/auth';
import { useThemeStore } from './stores/theme';
import { useBrandingStore } from './stores/branding';
import AppBar from './components/common/AppBar.vue';
import ConfirmDialog from './components/common/ConfirmDialog.vue';
import CommandPalette from './components/common/CommandPalette.vue';
import PwaUpdatePrompt from './components/common/PwaUpdatePrompt.vue';

const authStore = useAuthStore();
const themeStore = useThemeStore();
const brandingStore = useBrandingStore();
const vuetifyTheme = useTheme();

const announcementIcon = computed(() => {
  const icons: Record<string, string> = {
    info: 'mdi-information-outline',
    warning: 'mdi-alert-outline',
    error: 'mdi-alert-circle-outline',
  };
  return icons[brandingStore.announcementVariant] || 'mdi-information-outline';
});

onMounted(() => {
  themeStore.init(vuetifyTheme);
  brandingStore.fetchBranding();
});
</script>

<style scoped>
.announcement-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
}
.announcement-info {
  background: #1976d2;
}
.announcement-warning {
  background: #f57c00;
}
.announcement-error {
  background: #d32f2f;
}
</style>
