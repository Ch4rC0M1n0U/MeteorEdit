<!--
  CommandPalette.vue — palette Ctrl+K v3
  API publique conservée : visible (ref), open(), close(), shortcut Ctrl+K global au mount.
  Pour la liste des commandes / dossiers / nœuds / contacts, garder la logique existante du store (filteredCommands, groupedCommands).
  Ici on RESTYLE uniquement le template + scoped CSS.
-->
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
// Réutiliser le store / composable existant qui exposait staticCommands, dossierCommands, etc.
// Pour le squelette ci-dessous, on inline une structure type — adapter aux helpers existants.

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: string;
  shortcut?: string;
  action: () => void;
}

const { t } = useI18n();

const visible = ref(false);
const query = ref('');
const selectedIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);

// REMPLACER par le useCommands() / useDossierCommands() existant.
const items = ref<PaletteItem[]>([]);

const groups = computed(() => {
  const q = query.value.toLowerCase().trim();
  const filtered = !q ? items.value : items.value.filter(it =>
    it.label.toLowerCase().includes(q) || (it.hint?.toLowerCase().includes(q))
  );
  const map = new Map<string, PaletteItem[]>();
  filtered.forEach(it => {
    if (!map.has(it.group)) map.set(it.group, []);
    map.get(it.group)!.push(it);
  });
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
});

const flatItems = computed(() => groups.value.flatMap(g => g.items));

function open() {
  visible.value = true;
  query.value = '';
  selectedIndex.value = 0;
  nextTick(() => inputRef.value?.focus());
}
function close() { visible.value = false; }

function move(delta: number) {
  const n = flatItems.value.length;
  if (!n) return;
  selectedIndex.value = (selectedIndex.value + delta + n) % n;
}
function execSelected() {
  const item = flatItems.value[selectedIndex.value];
  if (item) { item.action(); close(); }
}

function onGlobalKey(e: KeyboardEvent) {
  // Ctrl+K / Cmd+K
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    visible.value ? close() : open();
  }
}

onMounted(() => document.addEventListener('keydown', onGlobalKey));
onBeforeUnmount(() => document.removeEventListener('keydown', onGlobalKey));

defineExpose({ visible, open, close });
</script>

<template>
  <Teleport to="body">
    <Transition name="cmdp">
      <div v-if="visible" class="cmdp__overlay" @click.self="close">
        <div class="cmdp__panel" role="dialog" aria-label="Command palette">
          <div class="cmdp__input-wrap">
            <i class="pi pi-search cmdp__search-icon" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="cmdp__input"
              :placeholder="t('modal.palette.placeholder')"
              @keydown.escape="close"
              @keydown.down.prevent="move(1)"
              @keydown.up.prevent="move(-1)"
              @keydown.enter.prevent="execSelected"
            />
            <kbd class="kbd">Esc</kbd>
          </div>

          <div v-if="groups.length" class="cmdp__results">
            <div v-for="g in groups" :key="g.label" class="cmdp__group">
              <div class="cmdp__group-label">{{ g.label }}</div>
              <button
                v-for="(item, idx) in g.items"
                :key="item.id"
                class="cmdp__item"
                :class="{ 'cmdp__item--active': flatItems[selectedIndex]?.id === item.id }"
                @click="item.action(); close()"
                @mouseenter="selectedIndex = flatItems.findIndex(it => it.id === item.id)"
              >
                <i class="pi cmdp__item-icon" :class="item.icon" />
                <span class="cmdp__item-label">{{ item.label }}</span>
                <span v-if="item.hint" class="cmdp__item-hint">{{ item.hint }}</span>
                <kbd v-if="item.shortcut" class="kbd">{{ item.shortcut }}</kbd>
              </button>
            </div>
          </div>

          <div v-else class="cmdp__empty">
            <i class="pi pi-inbox" />
            <span>{{ t('modal.palette.noResults') }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cmdp__overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex; justify-content: center;
  align-items: flex-start; padding-top: 14vh;
  z-index: 1000;
}
[data-theme="dark"] .cmdp__overlay { background: rgba(0, 0, 0, 0.6); }

.cmdp__panel {
  width: 100%; max-width: 640px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-3);
  display: flex; flex-direction: column;
  overflow: hidden;
  font-family: var(--font);
}

.cmdp__input-wrap {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
}
.cmdp__search-icon { font-size: 16px; color: var(--ink-3); }
.cmdp__input {
  flex: 1;
  background: transparent; border: 0; outline: 0;
  font-size: 14px;
  color: var(--ink);
  letter-spacing: -0.005em;
}
.cmdp__input::placeholder { color: var(--ink-4); }
.kbd {
  display: inline-flex; align-items: center;
  height: 18px; padding: 0 5px;
  font-size: 10.5px; font-weight: 500;
  color: var(--ink-3);
  background: var(--bg-3);
  border: 1px solid var(--line-2);
  border-radius: 4px;
}

.cmdp__results {
  max-height: 60vh;
  overflow-y: auto;
  padding: 6px;
}
.cmdp__group + .cmdp__group { margin-top: 4px; }
.cmdp__group-label {
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-3);
  padding: 8px 10px 4px;
}
.cmdp__item {
  display: grid;
  grid-template-columns: 18px 1fr auto auto;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 7px 10px;
  background: transparent;
  border: 0;
  border-radius: var(--r-sm);
  color: var(--ink);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  letter-spacing: -0.005em;
}
.cmdp__item:hover,
.cmdp__item--active { background: var(--bg-3); }
.cmdp__item-icon { font-size: 14px; color: var(--ink-3); }
.cmdp__item--active .cmdp__item-icon { color: var(--accent); }
.cmdp__item-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cmdp__item-hint {
  font-size: 11.5px;
  color: var(--ink-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.cmdp__empty {
  padding: 60px 24px;
  display: flex; flex-direction: column;
  align-items: center; gap: 10px;
  color: var(--ink-3);
}
.cmdp__empty .pi { font-size: 22px; }

.cmdp-enter-active, .cmdp-leave-active { transition: opacity 120ms ease, transform 120ms ease; }
.cmdp-enter-from { opacity: 0; transform: translateY(-8px); }
.cmdp-leave-to { opacity: 0; }
</style>
