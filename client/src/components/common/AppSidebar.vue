<template>
  <aside class="sidebar" :class="{ 'sidebar--collapsed': collapsed }">
    <div class="sidebar-header">
      <div class="sidebar-brand" @click="$emit('toggle-collapse')">
        <div class="brand-icon">
          <img :src="meLogo" alt="MeteorEdit" class="brand-logo" />
        </div>
        <transition name="fade-text">
          <div v-if="!collapsed" class="brand-text">
            <span class="brand-name">{{ brandingStore.appName }}</span>
            <div class="brand-meta">
              <span class="brand-version mono">v{{ appVersion }}</span>
              <span
                class="connection-dot"
                :class="backendConnected ? 'connection-dot--ok' : 'connection-dot--err'"
                :title="backendConnected ? t('nav.backendConnected') : t('nav.backendDisconnected')"
              />
            </div>
          </div>
        </transition>
      </div>
    </div>

    <nav class="sidebar-nav">
      <!-- Close dossier button when a dossier is open -->
      <div v-if="dossierStore.currentDossier" class="nav-section">
        <button
          class="nav-item nav-item--back"
          :title="collapsed ? t('nav.closeDossier') : undefined"
          @click="closeDossier"
        >
          <i class="pi pi-arrow-left nav-icon" />
          <transition name="fade-text">
            <span v-if="!collapsed" class="nav-text">{{ t('nav.closeDossier') }}</span>
          </transition>
        </button>
      </div>

      <div class="nav-section">
        <span v-if="!collapsed" class="nav-label">{{ t('nav.main') }}</span>
        <router-link
          v-for="item in mainNavItems"
          :key="item.key"
          :to="item.to"
          class="nav-item"
          :class="{ 'nav-item--active': isActive(item) }"
          :title="collapsed ? item.label : undefined"
          @click="item.key === 'dossiers' ? onDossiersClick($event) : undefined"
        >
          <span class="nav-active-bar" aria-hidden="true" />
          <i :class="item.icon" class="nav-icon" />
          <transition name="fade-text">
            <span v-if="!collapsed" class="nav-text">{{ item.label }}</span>
          </transition>
          <Badge v-if="item.badge && !collapsed" :value="item.badge" severity="info" class="nav-badge" />
        </router-link>
      </div>

      <div class="nav-section">
        <span v-if="!collapsed" class="nav-label">{{ t('nav.tools') }}</span>
        <router-link
          v-for="item in toolNavItems"
          :key="item.key"
          :to="item.to"
          class="nav-item"
          :class="{ 'nav-item--active': isActive(item) }"
          :title="collapsed ? item.label : undefined"
        >
          <span class="nav-active-bar" aria-hidden="true" />
          <i :class="item.icon" class="nav-icon" />
          <transition name="fade-text">
            <span v-if="!collapsed" class="nav-text">{{ item.label }}</span>
          </transition>
        </router-link>
      </div>
    </nav>

    <div class="sidebar-footer">
      <button class="nav-item" @click="themeStore.toggle()" :title="themeStore.isDark ? t('nav.lightMode') : t('nav.darkMode')">
        <i :class="themeStore.isDark ? 'pi pi-sun' : 'pi pi-moon'" class="nav-icon" />
        <transition name="fade-text">
          <span v-if="!collapsed" class="nav-text">{{ themeStore.isDark ? t('nav.lightMode') : t('nav.darkMode') }}</span>
        </transition>
      </button>
      <div class="nav-item nav-item--user" @click="$router.push('/profile')" style="cursor:pointer">
        <Avatar
          :label="initials"
          :image="avatarUrl || undefined"
          shape="circle"
          class="nav-avatar"
        />
        <transition name="fade-text">
          <div v-if="!collapsed" class="nav-user-info">
            <span class="nav-user-name">{{ authStore.user?.firstName }} {{ authStore.user?.lastName }}</span>
            <span class="nav-user-role">{{ authStore.isAdmin ? 'Admin' : 'Analyste' }}</span>
          </div>
        </transition>
      </div>
      <button class="nav-item nav-item--danger" @click="$emit('logout')" :title="t('auth.logout')">
        <i class="pi pi-sign-out nav-icon" />
        <transition name="fade-text">
          <span v-if="!collapsed" class="nav-text">{{ t('auth.logout') }}</span>
        </transition>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Avatar from 'primevue/avatar';
import Badge from 'primevue/badge';
import { useAuthStore } from '../../stores/auth';
import { useThemeStore } from '../../stores/theme';
import { useDossierStore } from '../../stores/dossier';
import { useMessagingStore } from '../../stores/messaging';
import { useBrandingStore } from '../../stores/branding';
import { SERVER_URL } from '../../services/api';
import api from '../../services/api';

defineProps<{ collapsed: boolean }>();
defineEmits<{ 'toggle-collapse': []; logout: [] }>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const dossierStore = useDossierStore();
const messagingStore = useMessagingStore();
const appVersion = __APP_VERSION__;
const brandingStore = useBrandingStore();

const backendConnected = ref(true);
let healthInterval: ReturnType<typeof setInterval> | null = null;

const meLogo = computed(() => themeStore.isDark ? '/logo-me-red.png' : '/logo-me-blue.png');
const initials = computed(() => {
  const f = authStore.user?.firstName?.[0] || '';
  const l = authStore.user?.lastName?.[0] || '';
  return (f + l).toUpperCase();
});
const avatarUrl = computed(() => authStore.user?.avatarPath ? `${SERVER_URL}/${authStore.user.avatarPath}` : null);

const mainNavItems = computed(() => [
  { key: 'dossiers', icon: 'pi pi-folder', label: t('home.myDossiers'), to: '/', badge: dossierStore.activeDossiers.length || null },
  { key: 'templates', icon: 'pi pi-file-edit', label: t('nav.templates'), to: '/templates' },
  { key: 'messages', icon: 'pi pi-comments', label: t('nav.messages'), to: '/messages', badge: messagingStore.totalUnread || null },
]);

const toolNavItems = computed(() => [
  { key: 'extension', icon: 'mdi mdi-puzzle-outline', label: t('nav.extension'), to: '/extension' },
  { key: 'help', icon: 'pi pi-question-circle', label: t('nav.help'), to: '/help' },
  ...(authStore.isAdmin ? [{ key: 'admin', icon: 'pi pi-shield', label: t('nav.admin'), to: '/admin' }] : []),
]);

function isActive(item: { to: string; key: string }): boolean {
  return route.path === item.to || (item.key === 'dossiers' && route.path === '/');
}

function closeDossier() {
  dossierStore.closeDossier();
  router.push('/');
}

function onDossiersClick(e: MouseEvent) {
  if (dossierStore.currentDossier) {
    e.preventDefault();
    closeDossier();
  }
}

async function checkHealth() {
  try { await api.get('/health'); backendConnected.value = true; } catch { backendConnected.value = false; }
}

onMounted(() => { checkHealth(); healthInterval = setInterval(checkHealth, 30000); });
onUnmounted(() => { if (healthInterval) clearInterval(healthInterval); });
</script>

<style scoped>
.sidebar {
  width: var(--me-sidebar-w, 240px);
  background: var(--me-bg-surface);
  border-right: 1px solid var(--me-border);
  display: flex;
  flex-direction: column;
  transition: width var(--me-dur) var(--me-ease);
  flex-shrink: 0;
  z-index: 50;
}
.sidebar--collapsed { width: var(--me-sidebar-w-collapsed, 64px); }

.sidebar-header {
  padding: 14px 12px;
  border-bottom: 1px solid var(--me-border);
}
.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 8px;
  transition: background 0.15s;
}
.sidebar--collapsed .sidebar-header {
  padding: 16px 0;
  display: flex;
  justify-content: center;
}
.sidebar--collapsed .sidebar-brand {
  padding: 6px;
  justify-content: center;
}
.sidebar-brand:hover { background: var(--me-accent-glow); }
.brand-icon {
  width: 36px; height: 36px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}
.brand-logo { width: 36px; height: 36px; object-fit: contain; }
.brand-text { display: flex; flex-direction: column; min-width: 0; }
.brand-name { font-weight: 700; font-size: 15px; color: var(--me-text-primary); white-space: nowrap; }
.brand-meta { display: flex; align-items: center; gap: 6px; }
.brand-version { font-size: 10px; color: var(--me-text-muted); letter-spacing: 0.3px; }

.connection-dot {
  width: 6px; height: 6px; border-radius: 50%;
  display: inline-block; transition: background 0.3s;
}
.connection-dot--ok { background: var(--me-success); opacity: 0.85; box-shadow: 0 0 6px var(--me-success); }
.connection-dot--err { background: var(--me-error); opacity: 0.85; }

.sidebar-nav { flex: 1; overflow-y: auto; padding: 8px; }
.sidebar-footer { padding: 8px; border-top: 1px solid var(--me-border); display: flex; flex-direction: column; gap: 2px; }

.nav-section { display: flex; flex-direction: column; gap: 2px; margin-bottom: 18px; }
.nav-section:last-child { margin-bottom: 0; }
.nav-label {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 1.2px; color: var(--me-text-muted); padding: 8px 12px 6px;
}

.nav-item {
  position: relative;
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px; border-radius: 8px;
  border: none; background: none;
  color: var(--me-text-secondary); font-size: 13px;
  cursor: pointer; transition: all var(--me-dur-fast) var(--me-ease);
  width: 100%; text-align: left; white-space: nowrap; overflow: hidden;
  text-decoration: none;
}
.nav-active-bar {
  position: absolute;
  left: 0; top: 8px; bottom: 8px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: transparent;
  transition: background var(--me-dur-fast) var(--me-ease);
}
.sidebar--collapsed .nav-item { justify-content: center; padding: 10px; }
.nav-item:hover { background: var(--me-accent-glow); color: var(--me-text-primary); }
.nav-item--active { background: var(--me-accent-glow); color: var(--me-accent); font-weight: 600; }
.nav-item--active .nav-icon { color: var(--me-accent); }
.nav-item--active .nav-active-bar { background: var(--me-accent); }
.nav-item--back {
  color: var(--me-accent); font-weight: 600;
  background: rgba(var(--me-accent-rgb), 0.08);
  border: 1px solid var(--me-border-hover);
}
.nav-item--back:hover { background: rgba(var(--me-accent-rgb), 0.16); color: var(--me-accent); }
.nav-item--back .nav-icon { color: var(--me-accent); }
.nav-item--danger:hover { color: var(--me-error); }
.nav-item--danger:hover .nav-icon { color: var(--me-error); }

.nav-icon { font-size: 16px; flex-shrink: 0; width: 20px; text-align: center; color: var(--me-text-muted); transition: color 0.15s; }
.nav-item:hover .nav-icon { color: var(--me-text-primary); }
.nav-text { overflow: hidden; text-overflow: ellipsis; }
.nav-badge { margin-left: auto; }

.nav-item--user { gap: 10px; padding: 8px; }
.nav-avatar { width: 28px !important; height: 28px !important; font-size: 11px !important; flex-shrink: 0; }
.nav-user-info { display: flex; flex-direction: column; min-width: 0; }
.nav-user-name { font-size: 12px; font-weight: 600; color: var(--me-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav-user-role { font-size: 10px; color: var(--me-text-muted); letter-spacing: 0.3px; }

.fade-text-enter-active, .fade-text-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fade-text-enter-from, .fade-text-leave-to { opacity: 0; transform: translateX(-4px); }

@media (max-width: 768px) { .sidebar { display: none; } }
</style>
