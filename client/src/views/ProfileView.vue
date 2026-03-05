<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <div class="admin-sidebar-header">
        <h2 class="admin-sidebar-title mono">
          <v-icon size="18" class="mr-2">mdi-account-cog-outline</v-icon>
          Mon compte
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
      <ProfileInfo v-if="activeSection === 'info'" />
      <ProfileSecurity v-else-if="activeSection === 'security'" />
      <ProfilePreferences v-else-if="activeSection === 'preferences'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import ProfileInfo from '../components/profile/ProfileInfo.vue';
import ProfileSecurity from '../components/profile/ProfileSecurity.vue';
import ProfilePreferences from '../components/profile/ProfilePreferences.vue';

const route = useRoute();
const activeSection = ref('info');

const sections = [
  { id: 'info', label: 'Mon profil', icon: 'mdi-account-outline' },
  { id: 'security', label: 'Securite', icon: 'mdi-shield-lock-outline' },
  { id: 'preferences', label: 'Preferences', icon: 'mdi-cog-outline' },
];

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
.admin-nav { padding: 8px; display: flex; flex-direction: column; gap: 2px; }
.admin-nav-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border-radius: var(--me-radius-xs); background: none; border: none; color: var(--me-text-secondary); font-size: 14px; cursor: pointer; transition: all 0.15s; text-align: left; }
.admin-nav-item:hover { background: var(--me-accent-glow); color: var(--me-text-primary); }
.admin-nav-item--active { background: var(--me-accent-glow); color: var(--me-accent); font-weight: 600; }
.admin-content { flex: 1; overflow-y: auto; padding: 32px 24px; max-width: 800px; }
</style>
