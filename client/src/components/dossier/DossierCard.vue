<template>
  <div class="dossier-card glass-card" @click="$emit('open', dossier._id)">
    <div class="dc-header">
      <div class="dc-status">
        <span :class="['status-dot', `status-dot--${statusDot}`]" />
        <span class="dc-status-label mono">{{ statusLabel }}</span>
      </div>
      <div class="dc-actions">
        <button class="dc-fav" :class="{ 'dc-fav--active': isFav }" @click.stop="$emit('toggle-favorite', dossier._id)" :title="isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'">
          <v-icon size="16">{{ isFav ? 'mdi-star' : 'mdi-star-outline' }}</v-icon>
        </button>
        <button class="dc-delete" @click.stop="$emit('delete', dossier._id)" title="Supprimer">
          <v-icon size="16">mdi-trash-can-outline</v-icon>
        </button>
      </div>
    </div>
    <div class="dc-title-row">
      <img v-if="logoUrl" :src="logoUrl" alt="" class="dc-logo" />
      <v-icon v-else-if="dossier.icon" size="22" class="dc-icon">{{ dossier.icon }}</v-icon>
      <v-icon v-else size="22" class="dc-icon dc-icon-default">mdi-folder-outline</v-icon>
      <h3 class="dc-title">{{ dossier.title }}</h3>
      <v-icon v-if="dossier.isEncrypted" size="16" class="dc-lock" title="Chiffrement E2E actif">mdi-lock-outline</v-icon>
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

const props = defineProps<{ dossier: Dossier; isFav?: boolean }>();
defineEmits<{ open: [id: string]; delete: [id: string]; 'toggle-favorite': [id: string] }>();

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
.dc-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.dc-fav {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.15s;
}
.dc-fav--active {
  opacity: 1 !important;
  color: var(--me-accent);
}
.dossier-card:hover .dc-fav {
  opacity: 1;
}
.dc-fav:hover {
  color: var(--me-accent);
  background: rgba(var(--me-accent-rgb, 59, 130, 246), 0.1);
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
.dc-lock {
  color: var(--me-accent);
  margin-left: auto;
  flex-shrink: 0;
  opacity: 0.7;
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
