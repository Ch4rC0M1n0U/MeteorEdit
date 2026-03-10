<template>
  <v-app>
    <AppBar v-if="authStore.isAuthenticated" />
    <v-main>
      <router-view />
    </v-main>
    <ConfirmDialog />
    <CommandPalette v-if="authStore.isAuthenticated" />
    <PwaUpdatePrompt />
  </v-app>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
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

onMounted(() => {
  themeStore.init(vuetifyTheme);
  brandingStore.fetchBranding();
});
</script>
