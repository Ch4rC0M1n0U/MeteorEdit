<template>
  <header class="me-appbar">
    <div class="me-appbar-left">
      <button class="me-appbar-brand" @click="handleBack">
        <v-icon v-if="dossierStore.currentDossier" size="18" class="mr-1">mdi-arrow-left</v-icon>
        <img v-if="brandingStore.logoUrl" :src="brandingStore.logoUrl" :alt="brandingStore.appName" class="me-appbar-logo" />
        <span v-else class="logo-icon">&#9670;</span>
        <span class="mono">{{ brandingStore.appName }}</span>
      </button>
    </div>

    <div class="me-appbar-center">
      <SearchBar />
    </div>

    <div class="me-appbar-right">
      <button class="me-icon-btn" @click="themeStore.toggle()" :title="themeStore.isDark ? 'Mode clair' : 'Mode sombre'">
        <v-icon size="20">{{ themeStore.isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
      </button>

      <NotificationBell />

      <v-menu>
        <template #activator="{ props }">
          <button class="me-icon-btn me-avatar-btn" v-bind="props">
            <img v-if="avatarUrl" :src="avatarUrl" alt="Avatar" class="me-avatar me-avatar-img" />
            <span v-else class="me-avatar">{{ initials }}</span>
          </button>
        </template>
        <div class="me-dropdown glass-card">
          <router-link to="/profile" class="me-dropdown-header me-dropdown-header--clickable">
            <span class="me-dropdown-name">{{ authStore.user?.firstName }} {{ authStore.user?.lastName }}</span>
            <span class="me-dropdown-email">{{ authStore.user?.email }}</span>
          </router-link>
          <div class="me-dropdown-divider" />
          <router-link v-if="authStore.isAdmin" to="/admin" class="me-dropdown-item">
            <v-icon size="16" class="mr-2">mdi-shield-account</v-icon>
            Administration
          </router-link>
          <router-link to="/templates" class="me-dropdown-item">
            <v-icon size="16" class="mr-2">mdi-file-document-check-outline</v-icon>
            Mes modeles
          </router-link>
          <router-link to="/profile?section=preferences" class="me-dropdown-item">
            <v-icon size="16" class="mr-2">mdi-cog-outline</v-icon>
            Preferences
          </router-link>
          <button class="me-dropdown-item" @click="handleLogout">
            <v-icon size="16" class="mr-2">mdi-logout</v-icon>
            Deconnexion
          </button>
        </div>
      </v-menu>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { useThemeStore } from '../../stores/theme';
import { useDossierStore } from '../../stores/dossier';
import { useBrandingStore } from '../../stores/branding';
import { SERVER_URL } from '../../services/api';
import SearchBar from './SearchBar.vue';
import NotificationBell from './NotificationBell.vue';


const authStore = useAuthStore();
const themeStore = useThemeStore();
const dossierStore = useDossierStore();
const brandingStore = useBrandingStore();
const router = useRouter();

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
}
.me-dropdown-header {
  padding: 10px 12px;
}
.me-dropdown-name {
  display: block;
  font-weight: 600;
  color: var(--me-text-primary);
  font-size: 14px;
}
.me-dropdown-email {
  display: block;
  color: var(--me-text-muted);
  font-size: 12px;
  font-family: var(--me-font-mono);
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
.me-dropdown-header--clickable {
  text-decoration: none;
  border-radius: var(--me-radius-xs);
  transition: background 0.15s;
}
.me-dropdown-header--clickable:hover {
  background: var(--me-accent-glow);
}
</style>
