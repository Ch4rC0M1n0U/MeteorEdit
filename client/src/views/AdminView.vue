<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <div class="admin-sidebar-header">
        <h2 class="admin-sidebar-title mono">
          <v-icon size="18" class="mr-2">mdi-shield-account</v-icon>
          Administration
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
      <AdminBranding v-else-if="activeSection === 'branding'" />
      <AdminSecurity v-else-if="activeSection === 'security'" />
      <AdminAudit v-else-if="activeSection === 'audit'" />
      <AdminPlugins v-else-if="activeSection === 'plugins'" />
      <AdminAI v-else-if="activeSection === 'ai'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AdminDashboard from '../components/admin/AdminDashboard.vue';
import AdminUsers from '../components/admin/AdminUsers.vue';
import AdminBranding from '../components/admin/AdminBranding.vue';
import AdminSecurity from '../components/admin/AdminSecurity.vue';
import AdminAudit from '../components/admin/AdminAudit.vue';
import AdminPlugins from '../components/admin/AdminPlugins.vue';
import AdminAI from '../components/admin/AdminAI.vue';

const activeSection = ref('dashboard');

const navItems: Array<{ type: 'group'; label: string; id?: undefined; icon?: undefined } | { type: 'item'; id: string; label: string; icon: string }> = [
  { type: 'group', label: 'General' },
  { type: 'item', id: 'dashboard', label: 'Dashboard', icon: 'mdi-view-dashboard-outline' },
  { type: 'group', label: 'Gestion' },
  { type: 'item', id: 'users', label: 'Utilisateurs', icon: 'mdi-account-group-outline' },
  { type: 'item', id: 'audit', label: 'Audit', icon: 'mdi-shield-check' },
  { type: 'group', label: 'Configuration' },
  { type: 'item', id: 'branding', label: 'Apparence', icon: 'mdi-palette-outline' },
  { type: 'item', id: 'security', label: 'Securite', icon: 'mdi-shield-lock-outline' },
  { type: 'item', id: 'plugins', label: 'Plugins', icon: 'mdi-puzzle-outline' },
  { type: 'item', id: 'ai', label: 'Intelligence Artificielle', icon: 'mdi-robot-outline' },
];
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
