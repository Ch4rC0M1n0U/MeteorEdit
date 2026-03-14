<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <div class="admin-sidebar-header">
        <h2 class="admin-sidebar-title mono">
          <v-icon size="18" class="mr-2">mdi-account-cog-outline</v-icon>
          {{ t('profile.myAccount') }}
        </h2>
      </div>
      <nav class="admin-nav">
        <div v-for="(item, index) in navItems" :key="index">
          <div v-if="item.type === 'group'" class="nav-group-label">{{ item.label }}</div>
          <button
            v-else
            :class="['admin-nav-item', { 'admin-nav-item--active': activeSection === item.id }]"
            @click="activeSection = item.id ?? ''"
          >
            <v-icon size="18">{{ item.icon }}</v-icon>
            <span>{{ item.label }}</span>
          </button>
        </div>
      </nav>
    </aside>
    <main class="admin-content">
      <ProfileInfo v-if="activeSection === 'info'" />
      <ProfileSecurity v-else-if="activeSection === 'security'" />
      <ProfileSecurityAdvanced v-else-if="activeSection === 'security-advanced'" />
      <ProfileTemplate v-else-if="activeSection === 'template'" />
      <ProfilePreferences v-else-if="activeSection === 'preferences'" />
      <NotificationPreferences v-else-if="activeSection === 'notifications'" />
      <ProfileData v-else-if="activeSection === 'data'" />
      <ProfileShortcuts v-else-if="activeSection === 'shortcuts'" />
      <ProfileActivity v-else-if="activeSection === 'activity'" />
      <ProfileEncryption v-else-if="activeSection === 'encryption'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ProfileInfo from '../components/profile/ProfileInfo.vue';
import ProfileSecurity from '../components/profile/ProfileSecurity.vue';
import ProfileSecurityAdvanced from '../components/profile/ProfileSecurityAdvanced.vue';
import ProfilePreferences from '../components/profile/ProfilePreferences.vue';
import ProfileTemplate from '../components/profile/ProfileTemplate.vue';
import NotificationPreferences from '../components/profile/NotificationPreferences.vue';
import ProfileData from '../components/profile/ProfileData.vue';
import ProfileShortcuts from '../components/profile/ProfileShortcuts.vue';
import ProfileActivity from '../components/profile/ProfileActivity.vue';
import ProfileEncryption from '../components/profile/ProfileEncryption.vue';

const route = useRoute();
const { t } = useI18n();
const activeSection = ref('info');

interface NavItem {
  type?: 'group';
  id?: string;
  label: string;
  icon?: string;
}

const navItems = computed<NavItem[]>(() => [
  { type: 'group', label: t('profile.myProfile') },
  { id: 'info', label: t('profile.myProfile'), icon: 'mdi-account-outline' },
  { id: 'template', label: t('profile.templateReport'), icon: 'mdi-file-document-edit-outline' },

  { type: 'group', label: t('profile.security') },
  { id: 'security', label: t('profile.passwordAnd2FA'), icon: 'mdi-shield-lock-outline' },
  { id: 'security-advanced', label: t('profile.sessionsAndScore'), icon: 'mdi-shield-check-outline' },
  { id: 'encryption', label: t('profile.encryption.title'), icon: 'mdi-shield-key-outline' },

  { type: 'group', label: t('profile.settings') },
  { id: 'preferences', label: t('profile.preferences'), icon: 'mdi-cog-outline' },
  { id: 'notifications', label: t('profile.notifications'), icon: 'mdi-bell-cog-outline' },
  { id: 'shortcuts', label: t('profile.keyboardShortcuts'), icon: 'mdi-keyboard-outline' },

  { type: 'group', label: t('profile.data') },
  { id: 'activity', label: t('profile.activityLog'), icon: 'mdi-history' },
  { id: 'data', label: t('profile.myData'), icon: 'mdi-database-outline' },
]);

onMounted(() => {
  if (route.query.section && typeof route.query.section === 'string') {
    activeSection.value = route.query.section;
  }
});
</script>

<style scoped>
.admin-layout { display: flex; height: calc(100vh - 56px); }
.admin-sidebar { width: 240px; flex-shrink: 0; border-right: 1px solid var(--me-border); display: flex; flex-direction: column; background: var(--me-bg-surface); }
.admin-sidebar-header { padding: 20px 16px 16px; border-bottom: 1px solid var(--me-border); }
.admin-sidebar-title { font-size: 15px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.admin-nav { padding: 8px; display: flex; flex-direction: column; gap: 1px; overflow-y: auto; }
.nav-group-label { font-size: 11px; font-weight: 700; color: var(--me-text-muted); text-transform: uppercase; letter-spacing: 0.05em; padding: 12px 12px 4px; margin-top: 4px; }
.nav-group-label:first-child { margin-top: 0; }
.admin-nav-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border-radius: var(--me-radius-xs); background: none; border: none; color: var(--me-text-secondary); font-size: 14px; cursor: pointer; transition: all 0.15s; text-align: left; }
.admin-nav-item:hover { background: var(--me-accent-glow); color: var(--me-text-primary); }
.admin-nav-item--active { background: var(--me-accent-glow); color: var(--me-accent); font-weight: 600; }
.admin-content { flex: 1; overflow-y: auto; padding: 32px 24px; max-width: 1100px; }
</style>
