<template>
  <div
    v-if="authStore.isAuthenticated"
    class="app app-shell"
    :class="{ 'sidebar-collapsed': sidebarCollapsed }"
    :data-sidebar="sidebarCollapsed ? 'collapsed' : 'expanded'"
  >
    <AppSidebar
      :counts="navCounts"
      @update:collapsed="(v: boolean) => sidebarCollapsed = v"
    />
    <div class="main-area app__main">
      <AppTopbar
        :title="pageTitle"
        :icon="pageIcon"
        :notif-count="messagingStore.totalUnread ?? 0"
        @open-search="onOpenSearch"
        @open-notifications="onOpenNotifications"
        @open-whats-new="onOpenWhatsNew"
      >
        <template #actions>
          <div id="topbar-actions" />
        </template>
      </AppTopbar>
      <div
        v-if="brandingStore.announcementEnabled && brandingStore.announcementMessage"
        class="announcement-banner"
        :class="`announcement-${brandingStore.announcementVariant}`"
      >
        <i :class="announcementIcon" style="margin-right: 8px;" />
        {{ brandingStore.announcementMessage }}
      </div>
      <ExtensionPromoBanner />
      <main class="main-content">
        <router-view />
      </main>
    </div>
    <ConfirmDialog />
    <CommandPalette />
    <PwaUpdatePrompt />
    <Toast position="top-right" />
    <PhoneScannerDialog
      :visible="toolsUI.phoneScannerOpen"
      :dossier-id="dossierStore.currentDossier?._id ?? null"
      @update:visible="(v: boolean) => v ? toolsUI.openPhoneScanner() : toolsUI.closePhoneScanner()"
    />
    <MessagingBubble />
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
import { useMessagingStore } from './stores/messaging';
import AppSidebar from './components/common/AppSidebar.vue';
import AppTopbar from './components/common/AppTopbar.vue';
import ConfirmDialog from './components/common/ConfirmDialog.vue';
import CommandPalette from './components/common/CommandPalette.vue';
import PwaUpdatePrompt from './components/common/PwaUpdatePrompt.vue';
import ExtensionPromoBanner from './components/common/ExtensionPromoBanner.vue';
import PhoneScannerDialog from './components/tools/PhoneScannerDialog.vue';
import MessagingBubble from './components/messaging/MessagingBubble.vue';
import Toast from 'primevue/toast';
import { useToolsUIStore } from './stores/toolsUI';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const brandingStore = useBrandingStore();
const dossierStore = useDossierStore();
const messagingStore = useMessagingStore();
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
    return dossierStore.currentDossier ? dossierStore.currentDossier.title : t('nav.dashboard');
  }
  const titles: Record<string, string> = {
    '/admin': t('nav.admin'),
    '/profile': t('nav.profile'),
    '/templates': t('nav.templates'),
    '/help': t('nav.help'),
    '/osint-search': t('nav.osintSearch') || 'OSINT Search',
    '/companies': t('nav.companies'),
    '/extension': t('nav.extension'),
    '/messages': t('nav.messages'),
  };
  return titles[route.path] || '';
});

// v3.37 — icône topbar par route (matche les icônes de la sidebar v3)
const pageIcon = computed(() => {
  if (route.path === '/' || route.path === '/home') {
    return dossierStore.currentDossier
      ? (dossierStore.currentDossier.icon?.startsWith('pi ') ? dossierStore.currentDossier.icon.replace('pi ', '') : 'pi-folder-open')
      : 'pi-home';
  }
  const icons: Record<string, string> = {
    '/admin': 'pi-cog',
    '/profile': 'pi-user',
    '/templates': 'pi-file',
    '/help': 'pi-question-circle',
    '/osint-search': 'pi-search',
    '/companies': 'pi-building',
    '/extension': 'pi-puzzle',
    '/messages': 'pi-comments',
  };
  return icons[route.path] || 'pi-home';
});

// v3.37 — compteurs nav v3 (sidebar reçoit via props.counts)
const navCounts = computed(() => ({
  dossiers: dossierStore.activeDossiers.length || 0,
  tasks: dossierStore.tasksTodayCount || 0,
  messages: messagingStore.totalUnread || 0,
}));

function handleLogout() {
  authStore.logout();
  router.push('/login');
}

// v3.37 — handlers événements topbar
function onOpenSearch() {
  // CommandPalette s'ouvre via Ctrl+K — déclencher le shortcut
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true }));
}
function onOpenNotifications() {
  router.push('/profile?tab=notifications');
}
function onOpenWhatsNew() {
  // Délégué à WhatsNew modal — déclenchement via event global
  window.dispatchEvent(new CustomEvent('open-whats-new'));
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
