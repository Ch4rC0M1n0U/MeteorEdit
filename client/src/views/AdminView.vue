<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <div class="admin-sidebar-header">
        <h2 class="admin-sidebar-title mono">
          <v-icon size="18" class="mr-2">mdi-shield-account</v-icon>
          {{ $t('admin.title') }}
        </h2>
      </div>
      <nav class="admin-nav">
        <template v-for="(item, idx) in navItems">
          <div v-if="item.type === 'group'" :key="'g-' + idx" :class="['admin-nav-group', { 'admin-nav-group--first': idx === 0 }]">
            {{ item.label }}
          </div>
          <button
            v-else
            :key="item.id"
            :class="['admin-nav-item', { 'admin-nav-item--active': activeSection === item.id }]"
            @click="activeSection = item.id || ''"
          >
            <v-icon size="18">{{ item.icon }}</v-icon>
            <span>{{ item.label }}</span>
          </button>
        </template>
      </nav>
    </aside>

    <main class="admin-content">
      <AdminDashboard v-if="activeSection === 'dashboard'" />
      <AdminUsers v-else-if="activeSection === 'users'" />
      <AdminAudit v-else-if="activeSection === 'audit'" />
      <AdminBranding v-else-if="activeSection === 'branding'" />
      <AdminSecurity v-else-if="activeSection === 'security'" />
      <AdminStorage v-else-if="activeSection === 'storage'" />
      <AdminEmail v-else-if="activeSection === 'email'" />
      <AdminClipper v-else-if="activeSection === 'clipper'" />
      <AdminDefaults v-else-if="activeSection === 'defaults'" />
      <AdminNetwork v-else-if="activeSection === 'network'" />
      <AdminBackup v-else-if="activeSection === 'backup'" />
      <AdminAI v-else-if="activeSection === 'ai'" />
      <AdminPlugins v-else-if="activeSection === 'plugins'" />
      <AdminEncryptionStatus v-else-if="activeSection === 'encryption'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AdminDashboard from '../components/admin/AdminDashboard.vue';
import AdminUsers from '../components/admin/AdminUsers.vue';
import AdminBranding from '../components/admin/AdminBranding.vue';
import AdminSecurity from '../components/admin/AdminSecurity.vue';
import AdminStorage from '../components/admin/AdminStorage.vue';
import AdminEmail from '../components/admin/AdminEmail.vue';
import AdminClipper from '../components/admin/AdminClipper.vue';
import AdminDefaults from '../components/admin/AdminDefaults.vue';
import AdminNetwork from '../components/admin/AdminNetwork.vue';
import AdminBackup from '../components/admin/AdminBackup.vue';
import AdminAudit from '../components/admin/AdminAudit.vue';
import AdminPlugins from '../components/admin/AdminPlugins.vue';
import AdminAI from '../components/admin/AdminAI.vue';
import AdminEncryptionStatus from '../components/admin/AdminEncryptionStatus.vue';

const { t } = useI18n();

const activeSection = ref('dashboard');

const navItems = computed(() => [
  { type: 'group' as const, label: t('admin.general') },
  { type: 'item' as const, id: 'dashboard', label: t('admin.dashboard'), icon: 'mdi-view-dashboard-outline' },
  { type: 'item' as const, id: 'users', label: t('admin.users'), icon: 'mdi-account-group-outline' },
  { type: 'item' as const, id: 'audit', label: t('admin.auditLog'), icon: 'mdi-shield-check' },
  { type: 'group' as const, label: t('admin.configuration') },
  { type: 'item' as const, id: 'branding', label: t('admin.appearance'), icon: 'mdi-palette-outline' },
  { type: 'item' as const, id: 'security', label: t('admin.security'), icon: 'mdi-shield-lock-outline' },
  { type: 'item' as const, id: 'encryption', label: t('admin.encryption.title'), icon: 'mdi-shield-key-outline' },
  { type: 'item' as const, id: 'storage', label: t('admin.storage'), icon: 'mdi-harddisk' },
  { type: 'item' as const, id: 'defaults', label: t('admin.defaults'), icon: 'mdi-cog-outline' },
  { type: 'item' as const, id: 'network', label: t('admin.networkAnnouncements'), icon: 'mdi-lan' },
  { type: 'group' as const, label: t('admin.services') },
  { type: 'item' as const, id: 'email', label: t('admin.emailSmtp'), icon: 'mdi-email-outline' },
  { type: 'item' as const, id: 'clipper', label: t('admin.webClipper'), icon: 'mdi-scissors-cutting' },
  { type: 'item' as const, id: 'ai', label: t('admin.ai'), icon: 'mdi-robot-outline' },
  { type: 'item' as const, id: 'plugins', label: t('admin.plugins'), icon: 'mdi-puzzle-outline' },
  { type: 'group' as const, label: t('admin.maintenance') },
  { type: 'item' as const, id: 'backup', label: t('admin.backup'), icon: 'mdi-backup-restore' },
]);
</script>

<style scoped>
.admin-layout {
  display: flex;
  height: calc(100vh - 56px);
}
.admin-sidebar {
  width: 240px;
  flex-shrink: 0;
  border-right: 1px solid var(--me-border);
  display: flex;
  flex-direction: column;
  background: var(--me-bg-surface);
}
.admin-sidebar-header {
  padding: 20px 16px 16px;
  border-bottom: 1px solid var(--me-border);
}
.admin-sidebar-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--me-text-primary);
  display: flex;
  align-items: center;
}
.admin-nav {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.admin-nav-group {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--me-text-muted);
  padding: 12px 12px 4px;
  font-family: var(--me-font-mono);
}
.admin-nav-group--first {
  padding-top: 4px;
}
.admin-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: none;
  color: var(--me-text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}
.admin-nav-item:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
.admin-nav-item--active {
  background: var(--me-accent-glow);
  color: var(--me-accent);
  font-weight: 600;
}
.admin-content {
  flex: 1;
  overflow-y: auto;
  padding: 32px 24px;
}
</style>
