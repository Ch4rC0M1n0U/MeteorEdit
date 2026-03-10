<template>
  <Teleport to="body">
    <Transition name="cmd">
      <div v-if="visible" class="cmd-overlay" @click.self="close">
        <div class="cmd-modal glass-card">
          <div class="cmd-input-wrap">
            <v-icon size="18" class="cmd-search-icon">mdi-magnify</v-icon>
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="cmd-input mono"
              placeholder="Rechercher une commande, un dossier, une page..."
              @keydown.escape="close"
              @keydown.down.prevent="moveSelection(1)"
              @keydown.up.prevent="moveSelection(-1)"
              @keydown.enter.prevent="executeSelected"
            />
            <kbd class="cmd-kbd mono">Esc</kbd>
          </div>

          <div class="cmd-results" v-if="filteredCommands.length">
            <div v-for="group in groupedCommands" :key="group.label" class="cmd-group">
              <div class="cmd-group-label mono">{{ group.label }}</div>
              <button
                v-for="(cmd, i) in group.items"
                :key="cmd.id"
                :class="['cmd-item', { 'cmd-item--active': cmd._globalIndex === selectedIndex }]"
                @click="execute(cmd)"
                @mouseenter="selectedIndex = cmd._globalIndex"
              >
                <v-icon size="16" class="cmd-item-icon">{{ cmd.icon }}</v-icon>
                <span class="cmd-item-label">{{ cmd.label }}</span>
                <span v-if="cmd.shortcut" class="cmd-item-shortcut mono">{{ cmd.shortcut }}</span>
              </button>
            </div>
          </div>

          <div v-else class="cmd-empty mono">
            Aucun resultat
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useDossierStore } from '../../stores/dossier';
import { useAuthStore } from '../../stores/auth';
import { useThemeStore } from '../../stores/theme';

const router = useRouter();
const dossierStore = useDossierStore();
const authStore = useAuthStore();
const themeStore = useThemeStore();

const visible = ref(false);
const query = ref('');
const selectedIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);

interface Command {
  id: string;
  label: string;
  icon: string;
  group: string;
  shortcut?: string;
  action: () => void;
  _globalIndex: number;
}

const staticCommands = computed<Omit<Command, '_globalIndex'>[]>(() => {
  const cmds: Omit<Command, '_globalIndex'>[] = [
    // Navigation
    { id: 'nav-home', label: 'Accueil — Liste des dossiers', icon: 'mdi-home-outline', group: 'Navigation', shortcut: '', action: () => { dossierStore.closeDossier(); router.push('/'); } },
    { id: 'nav-profile', label: 'Mon profil', icon: 'mdi-account-outline', group: 'Navigation', action: () => router.push('/profile') },
    { id: 'nav-templates', label: 'Mes modeles', icon: 'mdi-file-document-check-outline', group: 'Navigation', action: () => router.push('/templates') },
    { id: 'nav-prefs', label: 'Preferences', icon: 'mdi-cog-outline', group: 'Navigation', action: () => router.push('/profile?section=preferences') },
    { id: 'nav-security', label: 'Securite (mot de passe, 2FA)', icon: 'mdi-shield-lock-outline', group: 'Navigation', action: () => router.push('/profile?section=security') },
    { id: 'nav-template', label: 'Template rapport PDF', icon: 'mdi-file-document-edit-outline', group: 'Navigation', action: () => router.push('/profile?section=template') },
    // Actions
    { id: 'act-theme', label: themeStore.isDark ? 'Passer en mode clair' : 'Passer en mode sombre', icon: themeStore.isDark ? 'mdi-weather-sunny' : 'mdi-weather-night', group: 'Actions', action: () => themeStore.toggle() },
    { id: 'act-new-dossier', label: 'Creer un nouveau dossier', icon: 'mdi-folder-plus-outline', group: 'Actions', action: () => { router.push('/'); nextTick(() => document.dispatchEvent(new CustomEvent('me:create-dossier'))); } },
    { id: 'act-logout', label: 'Deconnexion', icon: 'mdi-logout', group: 'Actions', action: () => { authStore.logout(); router.push('/login'); } },
  ];

  if (authStore.isAdmin) {
    cmds.push(
      { id: 'nav-admin', label: 'Administration', icon: 'mdi-shield-account', group: 'Navigation', action: () => router.push('/admin') },
      { id: 'nav-admin-users', label: 'Admin — Utilisateurs', icon: 'mdi-account-group-outline', group: 'Navigation', action: () => router.push('/admin?section=users') },
      { id: 'nav-admin-branding', label: 'Admin — Apparence', icon: 'mdi-palette-outline', group: 'Navigation', action: () => router.push('/admin?section=branding') },
      { id: 'nav-admin-security', label: 'Admin — Securite', icon: 'mdi-shield-lock-outline', group: 'Navigation', action: () => router.push('/admin?section=security') },
      { id: 'nav-admin-ai', label: 'Admin — Intelligence artificielle', icon: 'mdi-robot-outline', group: 'Navigation', action: () => router.push('/admin?section=ai') },
    );
  }

  // Current dossier actions
  if (dossierStore.currentDossier) {
    cmds.push(
      { id: 'act-close-dossier', label: 'Fermer le dossier actuel', icon: 'mdi-close', group: 'Dossier', action: () => { dossierStore.closeDossier(); router.push('/'); } },
      { id: 'act-new-note', label: 'Creer une note', icon: 'mdi-note-plus-outline', group: 'Dossier', action: () => { dossierStore.createNode({ title: 'Nouvelle note', type: 'note' }); } },
      { id: 'act-new-folder', label: 'Creer un dossier', icon: 'mdi-folder-plus-outline', group: 'Dossier', action: () => { dossierStore.createNode({ title: 'Nouveau dossier', type: 'folder' }); } },
      { id: 'act-new-mindmap', label: 'Creer un mindmap', icon: 'mdi-vector-polyline', group: 'Dossier', action: () => { dossierStore.createNode({ title: 'Nouveau mindmap', type: 'mindmap' }); } },
      { id: 'act-new-map', label: 'Creer une carte', icon: 'mdi-map-outline', group: 'Dossier', action: () => { dossierStore.createNode({ title: 'Nouvelle carte', type: 'map' }); } },
    );
  }

  return cmds;
});

const dossierCommands = computed<Omit<Command, '_globalIndex'>[]>(() => {
  if (!query.value || query.value.length < 1) return [];
  return dossierStore.dossiers
    .filter(d => d.title.toLowerCase().includes(query.value.toLowerCase()))
    .slice(0, 8)
    .map(d => ({
      id: `dossier-${d._id}`,
      label: d.title,
      icon: 'mdi-folder-outline',
      group: 'Dossiers',
      action: () => dossierStore.openDossier(d._id),
    }));
});

const nodeCommands = computed<Omit<Command, '_globalIndex'>[]>(() => {
  if (!query.value || query.value.length < 2 || !dossierStore.currentDossier) return [];
  const q = query.value.toLowerCase();
  return dossierStore.nodes
    .filter(n => n.title.toLowerCase().includes(q))
    .slice(0, 6)
    .map(n => ({
      id: `node-${n._id}`,
      label: n.title,
      icon: n.type === 'folder' ? 'mdi-folder-outline' : n.type === 'note' ? 'mdi-note-text-outline' : n.type === 'mindmap' ? 'mdi-vector-polyline' : n.type === 'map' ? 'mdi-map-outline' : 'mdi-file-outline',
      group: 'Noeuds',
      action: () => dossierStore.selectNode(n),
    }));
});

const filteredCommands = computed<Command[]>(() => {
  const q = query.value.toLowerCase().trim();
  let all = [
    ...staticCommands.value,
    ...dossierCommands.value,
    ...nodeCommands.value,
  ];
  if (q) {
    all = all.filter(c => c.label.toLowerCase().includes(q));
  }
  return all.map((c, i) => ({ ...c, _globalIndex: i }));
});

const groupedCommands = computed(() => {
  const groups: { label: string; items: Command[] }[] = [];
  const seen = new Set<string>();
  for (const cmd of filteredCommands.value) {
    if (!seen.has(cmd.group)) {
      seen.add(cmd.group);
      groups.push({ label: cmd.group, items: [] });
    }
    groups.find(g => g.label === cmd.group)!.items.push(cmd);
  }
  return groups;
});

function open() {
  visible.value = true;
  query.value = '';
  selectedIndex.value = 0;
  nextTick(() => inputRef.value?.focus());
}

function close() {
  visible.value = false;
}

function moveSelection(delta: number) {
  const total = filteredCommands.value.length;
  if (!total) return;
  selectedIndex.value = (selectedIndex.value + delta + total) % total;
}

function executeSelected() {
  const cmd = filteredCommands.value[selectedIndex.value];
  if (cmd) execute(cmd);
}

function execute(cmd: Command) {
  close();
  cmd.action();
}

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    if (visible.value) close();
    else open();
  }
  if (e.key === '/' && !visible.value) {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
    e.preventDefault();
    open();
  }
}

watch(query, () => {
  selectedIndex.value = 0;
});

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
});

defineExpose({ open, close });
</script>

<style scoped>
.cmd-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
  backdrop-filter: blur(4px);
}

.cmd-modal {
  width: 560px;
  max-width: 90vw;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: cmd-in 0.15s ease-out;
}

@keyframes cmd-in {
  from { opacity: 0; transform: scale(0.96) translateY(-8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.cmd-input-wrap {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--me-border);
  gap: 10px;
}

.cmd-search-icon {
  color: var(--me-text-muted);
  flex-shrink: 0;
}

.cmd-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--me-text-primary);
  font-size: 15px;
}

.cmd-input::placeholder {
  color: var(--me-text-muted);
}

.cmd-kbd {
  font-size: 10px;
  color: var(--me-text-muted);
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  border-radius: 4px;
  padding: 2px 6px;
  flex-shrink: 0;
}

.cmd-results {
  overflow-y: auto;
  padding: 6px;
}

.cmd-group {
  margin-bottom: 4px;
}

.cmd-group-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--me-text-muted);
  padding: 6px 10px 4px;
}

.cmd-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: none;
  color: var(--me-text-primary);
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  transition: background 0.1s;
  gap: 10px;
}

.cmd-item:hover,
.cmd-item--active {
  background: var(--me-accent-glow);
}

.cmd-item--active {
  color: var(--me-accent);
}

.cmd-item-icon {
  color: var(--me-text-muted);
  flex-shrink: 0;
}

.cmd-item--active .cmd-item-icon {
  color: var(--me-accent);
}

.cmd-item-label {
  flex: 1;
}

.cmd-item-shortcut {
  font-size: 10px;
  color: var(--me-text-muted);
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  border-radius: 4px;
  padding: 1px 6px;
}

.cmd-empty {
  padding: 24px;
  text-align: center;
  color: var(--me-text-muted);
  font-size: 13px;
}

/* Transitions */
.cmd-enter-active { transition: opacity 0.15s ease; }
.cmd-leave-active { transition: opacity 0.1s ease; }
.cmd-enter-from, .cmd-leave-to { opacity: 0; }
</style>
