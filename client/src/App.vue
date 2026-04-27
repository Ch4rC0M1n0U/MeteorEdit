<template>
  <div v-if="authStore.isAuthenticated" class="app-shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <AppSidebar
      :collapsed="sidebarCollapsed"
      @toggle-collapse="sidebarCollapsed = !sidebarCollapsed"
      @logout="handleLogout"
    />
    <div class="main-area">
      <AppTopbar
        :title="pageTitle"
        :subtitle="pageSubtitle"
        :dossier-icon="(route.path === '/' || route.path === '/home') && dossierStore.currentDossier ? (dossierStore.currentDossier.icon || 'mdi-folder-outline') : undefined"
        @toggle-sidebar="sidebarCollapsed = !sidebarCollapsed"
      />
      <div
        v-if="brandingStore.announcementEnabled && brandingStore.announcementMessage"
        class="announcement-banner"
        :class="`announcement-${brandingStore.announcementVariant}`"
      >
        <i :class="announcementIcon" style="margin-right: 8px;" />
        {{ brandingStore.announcementMessage }}
      </div>
      <main class="main-content">
        <router-view />
      </main>
    </div>
    <ConfirmDialog />
    <CommandPalette />
    <PwaUpdatePrompt />
    <PhoneScannerDialog
      :visible="toolsUI.phoneScannerOpen"
      :dossier-id="dossierStore.currentDossier?._id ?? null"
      @update:visible="(v: boolean) => v ? toolsUI.openPhoneScanner() : toolsUI.closePhoneScanner()"
    />
  </div>

  <!-- Non-authenticated views (login, register, setup, maintenance) -->
  <template v-else>
    <router-view />
    <PwaUpdatePrompt />
  </template>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from './stores/auth';
import { useThemeStore } from './stores/theme';
import { useBrandingStore } from './stores/branding';
import { useDossierStore } from './stores/dossier';
import AppSidebar from './components/common/AppSidebar.vue';
import AppTopbar from './components/common/AppTopbar.vue';
import ConfirmDialog from './components/common/ConfirmDialog.vue';
import CommandPalette from './components/common/CommandPalette.vue';
import PwaUpdatePrompt from './components/common/PwaUpdatePrompt.vue';
import PhoneScannerDialog from './components/tools/PhoneScannerDialog.vue';
import { useToolsUIStore } from './stores/toolsUI';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const brandingStore = useBrandingStore();
const dossierStore = useDossierStore();
const toolsUI = useToolsUIStore();

const sidebarCollapsed = ref(false);

// Auto-collapse sidebar when opening a dossier, expand when closing
watch(() => dossierStore.currentDossier, (current, previous) => {
  if (current && !previous) {
    sidebarCollapsed.value = true;
  } else if (!current && previous) {
    sidebarCollapsed.value = false;
  }
});

const announcementIcon = computed(() => {
  const icons: Record<string, string> = {
    info: 'pi pi-info-circle',
    warning: 'pi pi-exclamation-triangle',
    error: 'pi pi-times-circle',
  };
  return icons[brandingStore.announcementVariant] || 'pi pi-info-circle';
});

const pageTitle = computed(() => {
  if (route.path === '/' || route.path === '/home') {
    return dossierStore.currentDossier ? dossierStore.currentDossier.title : t('home.myDossiers');
  }
  const titles: Record<string, string> = {
    '/admin': t('nav.admin'),
    '/profile': t('nav.profile'),
    '/templates': t('nav.templates'),
    '/help': t('nav.help'),
    '/osint-search': t('nav.osintSearch') || 'OSINT Search',
  };
  return titles[route.path] || '';
});

const pageSubtitle = computed(() => {
  if ((route.path === '/' || route.path === '/home') && !dossierStore.currentDossier) {
    const count = dossierStore.dossiers.length;
    return `${count} dossier${count > 1 ? 's' : ''}`;
  }
  return '';
});

function handleLogout() {
  authStore.logout();
  router.push('/login');
}

onMounted(() => {
  themeStore.applyTheme();
  brandingStore.fetchBranding();
});
</script>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.main-content {
  flex: 1;
  overflow-y: auto;
}
.announcement-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
}
.announcement-info { background: #1976d2; }
.announcement-warning { background: #f57c00; }
.announcement-error { background: #d32f2f; }
</style>
