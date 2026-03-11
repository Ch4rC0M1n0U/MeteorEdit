<template>
  <div class="profile-shortcuts">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-keyboard-outline</v-icon>
        {{ $t('shortcuts.title') }}
      </h2>
    </div>

    <div
      v-for="(section, idx) in sections"
      :key="section.titleKey"
      class="branding-card glass-card fade-in"
      :class="`fade-in-delay-${idx + 1}`"
    >
      <h3 class="branding-card-title mono">
        <v-icon size="16" class="mr-1">{{ section.icon }}</v-icon>
        {{ section.title }}
      </h3>

      <div class="shortcuts-grid">
        <div v-for="shortcut in section.shortcuts" :key="shortcut.keys" class="shortcut-row">
          <div class="shortcut-keys">
            <kbd v-for="(key, ki) in shortcut.keys.split('+')" :key="ki">
              {{ key.trim() }}
            </kbd>
          </div>
          <span class="shortcut-desc">{{ shortcut.desc }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const sections = computed(() => [
  {
    titleKey: 'navigation',
    title: t('shortcuts.navigation'),
    icon: 'mdi-compass-outline',
    shortcuts: [
      { keys: 'Ctrl + K', desc: t('shortcuts.quickSearch') },
      { keys: 'Ctrl + B', desc: t('shortcuts.toggleSidebar') },
      { keys: 'Ctrl + H', desc: t('shortcuts.home') },
    ],
  },
  {
    titleKey: 'editor',
    title: t('shortcuts.editor'),
    icon: 'mdi-file-edit-outline',
    shortcuts: [
      { keys: 'Ctrl + S', desc: t('shortcuts.save') },
      { keys: 'Ctrl + Z', desc: t('shortcuts.undo') },
      { keys: 'Ctrl + Shift + Z', desc: t('shortcuts.redo') },
      { keys: 'Ctrl + B', desc: t('shortcuts.bold') },
      { keys: 'Ctrl + I', desc: t('shortcuts.italic') },
      { keys: 'Ctrl + U', desc: t('shortcuts.underline') },
      { keys: 'Ctrl + Shift + 1', desc: t('shortcuts.heading1') },
      { keys: 'Ctrl + Shift + 2', desc: t('shortcuts.heading2') },
      { keys: 'Ctrl + Shift + 3', desc: t('shortcuts.heading3') },
    ],
  },
  {
    titleKey: 'dossiers',
    title: t('shortcuts.dossiers'),
    icon: 'mdi-folder-outline',
    shortcuts: [
      { keys: 'Ctrl + N', desc: t('shortcuts.newNode') },
      { keys: 'Delete', desc: t('shortcuts.deleteSelection') },
      { keys: 'F2', desc: t('shortcuts.rename') },
    ],
  },
  {
    titleKey: 'general',
    title: t('shortcuts.general'),
    icon: 'mdi-cog-outline',
    shortcuts: [
      { keys: 'Ctrl + ,', desc: t('shortcuts.openPreferences') },
      { keys: 'Escape', desc: t('shortcuts.closeDialog') },
    ],
  },
])
</script>

<style scoped>
/* Shared profile styles */
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.branding-card { padding: 20px; margin-bottom: 0; }
.branding-card-title { font-size: 14px; font-weight: 700; color: var(--me-text-primary); margin-bottom: 4px; display: flex; align-items: center; }

.profile-shortcuts {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 24px;
  margin-top: 12px;
}

.shortcut-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
}

.shortcut-keys {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.shortcut-keys kbd {
  display: inline-block;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  padding: 4px 7px;
  border-radius: 4px;
  background: var(--me-bg-deep, rgba(0, 0, 0, 0.25));
  border: 1px solid var(--me-border, rgba(255, 255, 255, 0.1));
  color: var(--me-text-primary, rgba(255, 255, 255, 0.9));
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  white-space: nowrap;
}

.shortcut-desc {
  font-size: 13px;
  color: var(--me-text-secondary, rgba(255, 255, 255, 0.6));
}

@media (max-width: 700px) {
  .shortcuts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
