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
        <button
          v-for="section in sections"
          :key="section.id"
          :class="['admin-nav-item', { 'admin-nav-item--active': activeSection === section.id }]"
          @click="activeSection = section.id"
        >
          <v-icon size="18">{{ section.icon }}</v-icon>
          <span>{{ section.label }}</span>
        </button>
      </nav>
    </aside>

    <main class="admin-content">
      <AdminDashboard v-if="activeSection === 'dashboard'" />
      <AdminUsers v-else-if="activeSection === 'users'" />
      <AdminBranding v-else-if="activeSection === 'branding'" />
      <AdminSecurity v-else-if="activeSection === 'security'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AdminDashboard from '../components/admin/AdminDashboard.vue';
import AdminUsers from '../components/admin/AdminUsers.vue';
import AdminBranding from '../components/admin/AdminBranding.vue';
import AdminSecurity from '../components/admin/AdminSecurity.vue';

const activeSection = ref('dashboard');

const sections = [
  { id: 'dashboard', label: 'Dashboard', icon: 'mdi-view-dashboard-outline' },
  { id: 'users', label: 'Utilisateurs', icon: 'mdi-account-group-outline' },
  { id: 'branding', label: 'Parametres du site', icon: 'mdi-palette-outline' },
  { id: 'security', label: 'Securite', icon: 'mdi-shield-lock-outline' },
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
