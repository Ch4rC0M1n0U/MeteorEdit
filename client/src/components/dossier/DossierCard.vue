<template>
  <div class="dossier-card glass-card" @click="$emit('open', dossier._id)">
    <div class="dc-header">
      <div class="dc-status">
        <span :class="['status-dot', `status-dot--${statusDot}`]" />
        <span class="dc-status-label mono">{{ statusLabel }}</span>
      </div>
      <button class="dc-delete" @click.stop="$emit('delete', dossier._id)" title="Supprimer">
        <v-icon size="16">mdi-trash-can-outline</v-icon>
      </button>
    </div>
    <div class="dc-title-row">
      <img v-if="logoUrl" :src="logoUrl" alt="" class="dc-logo" />
      <v-icon v-else-if="dossier.icon" size="22" class="dc-icon">{{ dossier.icon }}</v-icon>
      <v-icon v-else size="22" class="dc-icon dc-icon-default">mdi-folder-outline</v-icon>
      <h3 class="dc-title">{{ dossier.title }}</h3>
    </div>
    <div v-if="dossier.tags?.length" class="dc-tags">
      <span v-for="tag in dossier.tags" :key="tag" class="dc-tag mono">{{ tag }}</span>
    </div>
    <p v-if="dossier.description" class="dc-desc">{{ dossier.description }}</p>
    <div class="dc-footer mono">
      <span>{{ new Date(dossier.updatedAt).toLocaleDateString('fr-FR') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Dossier } from '../../types';
import { SERVER_URL } from '../../services/api';

const props = defineProps<{ dossier: Dossier }>();
defineEmits<{ open: [id: string]; delete: [id: string] }>();

const logoUrl = computed(() => {
  return props.dossier.logoPath ? `${SERVER_URL}/${props.dossier.logoPath}` : null;
});

const statusDot = computed(() => {
  switch (props.dossier.status) {
    case 'open': return 'active';
    case 'in_progress': return 'warning';
    case 'closed': return 'error';
    default: return 'active';
  }
});

const statusLabel = computed(() => {
  switch (props.dossier.status) {
    case 'open': return 'Ouvert';
    case 'in_progress': return 'En cours';
    case 'closed': return 'Clos';
    default: return props.dossier.status;
  }
});
</script>

<style scoped>
.dossier-card {
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dossier-card:hover {
  transform: translateY(-2px);
}
.dc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dc-status {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dc-status-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--me-text-muted);
}
.dc-delete {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.15s;
}
.dossier-card:hover .dc-delete {
  opacity: 1;
}
.dc-delete:hover {
  color: var(--me-error);
  background: rgba(248, 113, 113, 0.1);
}
.dc-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dc-logo {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}
.dc-icon {
  color: var(--me-accent);
  flex-shrink: 0;
}
.dc-icon-default {
  color: var(--me-text-muted);
}
.dc-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--me-text-primary);
  line-height: 1.3;
}
.dc-desc {
  font-size: 13px;
  color: var(--me-text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.dc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.dc-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--me-accent-glow);
  color: var(--me-accent);
  text-transform: lowercase;
}
.dc-footer {
  font-size: 11px;
  color: var(--me-text-muted);
  margin-top: auto;
}
</style>
