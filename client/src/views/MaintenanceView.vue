<template>
  <div class="maintenance-page">
    <div class="maintenance-card glass-card">
      <v-icon size="64" color="var(--me-accent)" class="mb-4">mdi-wrench-clock</v-icon>
      <h1 class="maintenance-title mono">Maintenance</h1>
      <p class="maintenance-msg">{{ message }}</p>
      <button class="maintenance-retry" @click="retry">
        <v-icon size="16" class="mr-1">mdi-refresh</v-icon>
        Reessayer
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const message = ref(
  sessionStorage.getItem('maintenanceMessage') || 'Le site est en maintenance. Veuillez reessayer plus tard.'
);

function retry() {
  sessionStorage.removeItem('maintenanceMessage');
  window.location.href = '/';
}
</script>

<style scoped>
.maintenance-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--me-bg-deep);
  padding: 20px;
}
.maintenance-card {
  text-align: center;
  padding: 48px 40px;
  max-width: 440px;
  width: 100%;
}
.maintenance-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--me-text-primary);
  margin-bottom: 12px;
}
.maintenance-msg {
  font-size: 14px;
  color: var(--me-text-secondary);
  line-height: 1.6;
  margin-bottom: 28px;
}
.maintenance-retry {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 10px 24px;
  border-radius: var(--me-radius-xs);
  background: var(--me-accent);
  color: var(--me-bg-deep);
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.maintenance-retry:hover {
  opacity: 0.85;
}
</style>
