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
/* ─── v3.33 — Tokens locaux scopés à AppSidebar (light + dark warm) ─── */
.sidebar {
  --v3-bg-2: var(--me-bg-surface);
  --v3-bg-3: var(--me-bg-elevated);
  --v3-ink: var(--me-text-primary);
  --v3-ink-2: var(--me-text-secondary);
  --v3-ink-3: var(--me-text-muted);
  --v3-line: var(--me-border);
  --v3-accent: var(--me-accent);
  --v3-accent-soft: rgba(99, 145, 214, 0.10);
}
:global([data-theme='light']) .sidebar {
  --v3-bg-2: #F5F4EF;
  --v3-bg-3: #EFEEE8;
  --v3-ink: #1C1B18;
  --v3-ink-2: #45433D;
  --v3-ink-3: #6F6C63;
  --v3-line: #E7E5DD;
  --v3-accent: #2E4FA8;
  --v3-accent-soft: rgba(46, 79, 168, 0.08);
}

.sidebar {
  width: var(--me-sidebar-w, 240px);
  background: var(--v3-bg-2);
  border-right: 1px solid var(--v3-line);
  display: flex;
  flex-direction: column;
  transition: width var(--me-dur) var(--me-ease);
  flex-shrink: 0;
  z-index: 50;
}
.sidebar--collapsed { width: var(--me-sidebar-w-collapsed, 64px); }

.sidebar-header {
  padding: 16px 14px;
  border-bottom: 1px solid var(--v3-line);
}
.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
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
.sidebar-brand:hover { background: var(--v3-bg-3); }
.brand-icon {
  width: 32px; height: 32px;
  border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
  background: var(--v3-ink);
}
.brand-logo { width: 32px; height: 32px; object-fit: contain; }
.brand-text { display: flex; flex-direction: column; min-width: 0; }
.brand-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--v3-ink);
  white-space: nowrap;
  letter-spacing: -0.2px;
}
.brand-meta { display: flex; align-items: center; gap: 6px; margin-top: 1px; }
.brand-version {
  font-size: 10px;
  color: var(--v3-ink-3);
  letter-spacing: 0.4px;
  font-variant-numeric: tabular-nums;
}

.connection-dot {
  width: 6px; height: 6px; border-radius: 50%;
  display: inline-block; transition: background 0.3s;
}
.connection-dot--ok { background: var(--me-success); opacity: 0.85; box-shadow: 0 0 6px var(--me-success); }
.connection-dot--err { background: var(--me-error); opacity: 0.85; }

.sidebar-nav { flex: 1; overflow-y: auto; padding: 10px 8px; }
.sidebar-footer { padding: 8px; border-top: 1px solid var(--v3-line); display: flex; flex-direction: column; gap: 2px; }

.nav-section { display: flex; flex-direction: column; gap: 1px; margin-bottom: 20px; }
.nav-section:last-child { margin-bottom: 0; }
.nav-label {
  /* v3 : group header plus institutionnel (tracking moins exagéré, weight 600) */
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--v3-ink-3);
  padding: 10px 12px 8px;
}

.nav-item {
  position: relative;
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border-radius: 6px;
  border: none; background: none;
  color: var(--v3-ink-2); font-size: 13px;
  font-weight: 500;
  cursor: pointer; transition: all var(--me-dur-fast) var(--me-ease);
  width: 100%; text-align: left; white-space: nowrap; overflow: hidden;
  text-decoration: none;
}
.nav-active-bar {
  position: absolute;
  left: 0; top: 7px; bottom: 7px;
  width: 2px;
  border-radius: 0 2px 2px 0;
  background: transparent;
  transition: background var(--me-dur-fast) var(--me-ease);
}
.sidebar--collapsed .nav-item { justify-content: center; padding: 10px; }
.nav-item:hover {
  background: var(--v3-bg-3);
  color: var(--v3-ink);
}
.nav-item--active {
  background: var(--v3-accent-soft);
  color: var(--v3-accent);
  font-weight: 600;
}
.nav-item--active .nav-icon { color: var(--v3-accent); }
.nav-item--active .nav-active-bar { background: var(--v3-accent); }
.nav-item--back {
  color: var(--v3-accent);
  font-weight: 600;
  background: var(--v3-accent-soft);
  border: 1px solid var(--v3-line);
}
.nav-item--back:hover { background: var(--v3-accent-soft); color: var(--v3-accent); }
.nav-item--back .nav-icon { color: var(--v3-accent); }
.nav-item--danger:hover { color: var(--me-error); }
.nav-item--danger:hover .nav-icon { color: var(--me-error); }

.nav-icon { font-size: 16px; flex-shrink: 0; width: 20px; text-align: center; color: var(--v3-ink-3); transition: color 0.15s; }
.nav-item:hover .nav-icon { color: var(--v3-ink); }
.nav-text { overflow: hidden; text-overflow: ellipsis; }
.nav-badge { margin-left: auto; }

.nav-item--user { gap: 10px; padding: 8px; }
.nav-avatar { width: 28px !important; height: 28px !important; font-size: 11px !important; flex-shrink: 0; }
.nav-user-info { display: flex; flex-direction: column; min-width: 0; }
.nav-user-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--v3-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.1px;
}
.nav-user-role { font-size: 10px; color: var(--v3-ink-3); letter-spacing: 0.4px; }

.fade-text-enter-active, .fade-text-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fade-text-enter-from, .fade-text-leave-to { opacity: 0; transform: translateX(-4px); }

@media (max-width: 768px) { .sidebar { display: none; } }
</style>
