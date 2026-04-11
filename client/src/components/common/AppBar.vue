<template>
  <header class="me-appbar">
    <div class="me-appbar-left">
      <button class="me-appbar-brand" @click="handleBack">
        <i v-if="dossierStore.currentDossier" class="pi pi-arrow-left" style="font-size: 18px; margin-right: 4px;"></i>
        <img v-if="brandingStore.logoUrl" :src="brandingStore.logoUrl" :alt="brandingStore.appName" class="me-appbar-logo" />
        <span v-else class="logo-icon">&#9670;</span>
        <span class="mono">{{ brandingStore.appName }}</span>
        <span
          class="me-connection-dot"
          :class="backendConnected ? 'me-connection-dot--ok' : 'me-connection-dot--err'"
          :title="backendConnected ? t('nav.backendConnected') : t('nav.backendDisconnected')"
        />
      </button>
    </div>

    <div class="me-appbar-center">
      <SearchBar />
    </div>

    <div class="me-appbar-right">
      <button class="me-icon-btn" @click="themeStore.toggle()" :title="themeStore.isDark ? t('nav.lightMode') : t('nav.darkMode')">
        <i :class="themeStore.isDark ? 'pi pi-sun' : 'pi pi-moon'" style="font-size: 20px;"></i>
      </button>

      <button class="me-icon-btn me-icon-btn--badge" @click="whatsNewOpen = true" :title="t('nav.whatsNew')">
        <i class="pi pi-gift" style="font-size: 20px;"></i>
        <span v-if="whatsNewCount > 0" class="me-notif-badge">{{ whatsNewCount }}</span>
      </button>

      <WhatsNew v-model="whatsNewOpen" @read="whatsNewCount = 0" />

      <NotificationBell />

      <button class="me-icon-btn me-avatar-btn" @click="userMenuRef?.toggle($event)">
        <img v-if="avatarUrl" :src="avatarUrl" alt="Avatar" class="me-avatar me-avatar-img" />
        <span v-else class="me-avatar">{{ initials }}</span>
      </button>
      <Popover ref="userMenuRef">
        <div class="me-dropdown glass-card">
          <router-link to="/profile" class="me-dropdown-item me-dropdown-profile" @click="userMenuRef?.hide()">
            <i class="pi pi-user" style="font-size: 16px; margin-right: 8px;"></i>
            <div class="me-dropdown-profile-text">
              <span class="me-dropdown-name">{{ authStore.user?.firstName }} {{ authStore.user?.lastName }}</span>
              <span class="me-dropdown-email">{{ authStore.user?.email }}</span>
            </div>
          </router-link>
          <div class="me-dropdown-divider" />
          <router-link v-if="authStore.isAdmin" to="/admin" class="me-dropdown-item" @click="userMenuRef?.hide()">
            <i class="pi pi-shield" style="font-size: 16px; margin-right: 8px;"></i>
            {{ t('nav.admin') }}
          </router-link>
          <router-link to="/profile?section=preferences" class="me-dropdown-item" @click="userMenuRef?.hide()">
            <i class="pi pi-cog" style="font-size: 16px; margin-right: 8px;"></i>
            {{ t('nav.preferences') }}
          </router-link>
          <router-link to="/templates" class="me-dropdown-item" @click="userMenuRef?.hide()">
            <i class="pi pi-file-edit" style="font-size: 16px; margin-right: 8px;"></i>
            {{ t('nav.templates') }}
          </router-link>
          <button class="me-dropdown-item" @click="userMenuRef?.hide(); sessionManagerOpen = true">
            <i class="pi pi-shield" style="font-size: 16px; margin-right: 8px;"></i>
            {{ t('nav.sessions') }}
          </button>
          <router-link to="/help" class="me-dropdown-item" @click="userMenuRef?.hide()">
            <i class="pi pi-question-circle" style="font-size: 16px; margin-right: 8px;"></i>
            {{ t('nav.help') }}
          </router-link>
          <div class="me-dropdown-divider" />
          <button class="me-dropdown-item me-dropdown-item--danger" @click="userMenuRef?.hide(); handleLogout()">
            <i class="pi pi-sign-out" style="font-size: 16px; margin-right: 8px;"></i>
            {{ t('auth.logout') }}
          </button>
        </div>
      </Popover>
    </div>

    <!-- Social Session Manager Dialog -->
    <Dialog v-model:visible="sessionManagerOpen" modal :style="{ width: '560px' }" :closable="false">
      <SocialSessionManager v-if="sessionManagerOpen" @close="sessionManagerOpen = false" />
    </Dialog>
  </header>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Popover from 'primevue/popover';
import Dialog from 'primevue/dialog';
import { useAuthStore } from '../../stores/auth';
import { useThemeStore } from '../../stores/theme';
import { useDossierStore } from '../../stores/dossier';
import { useBrandingStore } from '../../stores/branding';
import api, { SERVER_URL } from '../../services/api';
import SearchBar from './SearchBar.vue';
import NotificationBell from './NotificationBell.vue';
import WhatsNew from './WhatsNew.vue';
import SocialSessionManager from '../media/SocialSessionManager.vue';

const userMenuRef = ref();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const dossierStore = useDossierStore();
const brandingStore = useBrandingStore();
const router = useRouter();
const { t } = useI18n();
const sessionManagerOpen = ref(false);
const whatsNewOpen = ref(false);
const whatsNewCount = ref(0);
const backendConnected = ref(true);
let healthInterval: ReturnType<typeof setInterval> | null = null;

async function checkHealth() {
  try {
    await api.get('/health');
    backendConnected.value = true;
  } catch {
    backendConnected.value = false;
  }
}

onMounted(async () => {
  checkHealth();
  healthInterval = setInterval(checkHealth, 30000);

  try {
    const { data } = await api.get('/changelog');
    whatsNewCount.value = data.unreadCount;
  } catch {
    // silent
  }
});

onUnmounted(() => {
  if (healthInterval) clearInterval(healthInterval);
});

const initials = computed(() => {
  const f = authStore.user?.firstName?.[0] || '';
  const l = authStore.user?.lastName?.[0] || '';
  return (f + l).toUpperCase();
});

const avatarUrl = computed(() => {
  return authStore.user?.avatarPath ? `${SERVER_URL}/${authStore.user.avatarPath}` : null;
});

function handleBack() {
  if (dossierStore.currentDossier) {
    dossierStore.closeDossier();
  }
  router.push('/');
}

function handleLogout() {
  authStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.me-appbar {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: var(--me-bg-surface);
  border-bottom: 1px solid var(--me-border);
  flex-shrink: 0;
  z-index: 100;
  gap: 16px;
}
.me-appbar-left {
  flex-shrink: 0;
}
.me-appbar-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  font-weight: 700;
  color: var(--me-text-primary);
  padding: 6px 10px;
  border-radius: var(--me-radius-sm);
  transition: background 0.15s;
}
.me-appbar-brand:hover {
  background: var(--me-accent-glow);
}
.logo-icon {
  color: var(--me-accent);
  font-size: 16px;
}
.me-connection-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
  margin-left: 2px;
  transition: background 0.3s ease, opacity 0.3s ease;
}
.me-connection-dot--ok {
  background: #22c55e;
  opacity: 0.6;
}
.me-connection-dot--err {
  background: #ef4444;
  opacity: 0.8;
}
.me-appbar-logo {
  height: 24px;
  width: auto;
  object-fit: contain;
}
.me-appbar-center {
  flex: 1;
  display: flex;
  justify-content: center;
  max-width: 500px;
  margin: 0 auto;
}
.me-appbar-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}
.me-icon-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--me-radius-xs);
  background: none;
  border: none;
  color: var(--me-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.me-icon-btn:hover {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.me-icon-btn--badge {
  position: relative;
}
.me-notif-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  background: var(--me-error, #ef4444);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  line-height: 1;
}
.me-avatar-btn {
  width: auto;
  padding: 0;
}
.me-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--me-accent);
  color: var(--me-bg-deep);
  font-size: 12px;
  font-weight: 700;
  font-family: var(--me-font-mono);
  display: flex;
  align-items: center;
  justify-content: center;
}
.me-avatar-img {
  object-fit: cover;
  background: var(--me-bg-elevated);
}
.me-dropdown {
  min-width: 220px;
  padding: 8px;
  border-color: var(--me-border) !important;
  box-shadow: var(--me-shadow) !important;
}
.me-dropdown:hover {
  border-color: var(--me-border) !important;
  box-shadow: var(--me-shadow) !important;
}
.me-dropdown-profile {
  align-items: flex-start !important;
}
.me-dropdown-profile-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.me-dropdown-name {
  font-weight: 600;
  color: var(--me-text-primary);
  font-size: 13px;
  line-height: 1.3;
}
.me-dropdown-email {
  color: var(--me-text-muted);
  font-size: 11px;
  font-family: var(--me-font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.me-dropdown-divider {
  height: 1px;
  background: var(--me-border);
  margin: 4px 0;
}
.me-dropdown-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 12px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: none;
  color: var(--me-text-secondary);
  font-size: 14px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s;
}
.me-dropdown-item:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
.me-dropdown-item--danger:hover {
  color: var(--me-error, #ef4444) !important;
}
/* Neutralize router-link active styles in dropdown */
.me-dropdown .router-link-active,
.me-dropdown .router-link-exact-active {
  color: var(--me-text-secondary);
  background: none;
}
.me-dropdown .router-link-active:hover,
.me-dropdown .router-link-exact-active:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
</style>
