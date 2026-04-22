<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="eep-panel"
      :style="{ top: panelY + 'px', left: panelX + 'px' }"
    >
      <!-- Header draggable -->
      <div class="eep-header" @mousedown="onDragStart">
        <span class="mdi mdi-account-multiple-plus eep-header-icon" />
        <span class="eep-header-title">{{ t('mindmap.entityPanel') }}</span>
        <Button
          icon="mdi mdi-close"
          text
          rounded
          size="small"
          class="eep-close-btn"
          @click.stop="emit('update:visible', false)"
        />
      </div>

      <!-- Tabs -->
      <TabView class="eep-tabs">
        <!-- Onglet Entités -->
        <TabPanel :header="t('mindmap.entityPanelEntities')">
          <div class="eep-list">
            <div v-if="!entities.length" class="eep-empty">
              {{ t('mindmap.noEntities') }}
            </div>
            <div
              v-for="entity in entities"
              :key="entity._id ?? entity.name"
              class="eep-item"
            >
              <span class="eep-item-icon">
                <SocialIcon :platform="normalizeType(entity.type || 'other')" :size="18" />
              </span>
              <div class="eep-item-info">
                <span class="eep-item-type">{{ entity.type }}</span>
                <span class="eep-item-name">{{ truncate(entity.name || entity.value || '—', 22) }}</span>
              </div>
              <Button
                icon="mdi mdi-plus"
                text
                rounded
                size="small"
                :loading="inserting === (entity._id ?? entity.name)"
                :title="t('mindmap.insertEntity')"
                @click="insertEntity(entity)"
              />
            </div>
          </div>
        </TabPanel>

        <!-- Onglet Notes -->
        <TabPanel :header="t('mindmap.entityPanelNotes')">
          <div class="eep-list">
            <div v-if="!notes.length" class="eep-empty">
              {{ t('mindmap.noNotes') }}
            </div>
            <div
              v-for="node in notes"
              :key="node._id"
              class="eep-item"
            >
              <span class="eep-item-icon">
                <SocialIcon platform="other" :size="18" color="#64748b" />
              </span>
              <div class="eep-item-info">
                <span class="eep-item-type">Note</span>
                <span class="eep-item-name">{{ truncate(node.title || t('mindmap.noNotes'), 22) }}</span>
              </div>
              <Button
                icon="mdi mdi-plus"
                text
                rounded
                size="small"
                :title="t('mindmap.insertEntity')"
                @click="insertNote(node)"
              />
            </div>
          </div>
        </TabPanel>

        <!-- Onglet Personnalisé -->
        <TabPanel header="＋ Custom">
          <div class="eep-custom">
            <div class="eep-custom-row">
              <label class="eep-custom-label">{{ t('mindmap.customType') }}</label>
              <div class="eep-type-grid">
                <button
                  v-for="key in Object.keys(SOCIAL_ICON_MAP)"
                  :key="key"
                  class="eep-type-btn"
                  :class="{ 'eep-type-btn--active': customType === key }"
                  :title="key"
                  @click="customType = key"
                >
                  <SocialIcon :platform="key" :size="16" />
                </button>
              </div>
            </div>
            <div class="eep-custom-row">
              <label class="eep-custom-label">{{ t('mindmap.customLabel') }}</label>
              <input
                v-model="customLabel"
                class="eep-custom-input"
                :placeholder="t('mindmap.customLabelPlaceholder')"
                maxlength="60"
                @keydown.enter="insertCustom"
              />
            </div>
            <Button
              :label="t('mindmap.insertEntity')"
              icon="mdi mdi-plus"
              size="small"
              class="eep-custom-btn"
              :disabled="!customLabel.trim()"
              @click="insertCustom"
            />
          </div>
        </TabPanel>
      </TabView>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import { useDossierStore } from '../../stores/dossier'
import { buildEntityElements, buildNoteElements } from './entityElementsBuilder'
import { renderIdentityCard } from './identityCardRenderer'
import type { IEntity } from '../../types'
import type { DossierNode } from '../../types'
import SocialIcon from '../common/SocialIcon.vue'
import { SOCIAL_ICON_MAP } from '../common/socialIconMap'

const props = defineProps<{
  visible: boolean
  getViewportCenter: () => { x: number; y: number }
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'insert-elements', elements: unknown[], files?: unknown[]): void
}>()

const { t } = useI18n()
const dossierStore = useDossierStore()

// Custom entity form state
const customType = ref<string>('other')
const customLabel = ref<string>('')

// Draggable state
const panelX = ref(window.innerWidth - 316)
const panelY = ref(60)
let dragStartX = 0
let dragStartY = 0
let panelStartX = 0
let panelStartY = 0

function onDragStart(e: MouseEvent) {
  dragStartX = e.clientX
  dragStartY = e.clientY
  panelStartX = panelX.value
  panelStartY = panelY.value

  const onMove = (ev: MouseEvent) => {
    panelX.value = panelStartX + (ev.clientX - dragStartX)
    panelY.value = panelStartY + (ev.clientY - dragStartY)
  }
  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

// Data
const entities = computed<IEntity[]>(() => {
  return (dossierStore.currentDossier?.entities as IEntity[] | undefined) ?? []
})

const notes = computed<DossierNode[]>(() => {
  return dossierStore.nodes.filter(
    (n) => n.type === 'note' && !n.isDeleted
  )
})

// Insert state
const inserting = ref<string | null>(null)

// Entity helpers
const CATEGORY_COLORS: Record<string, string> = {
  identity: '#3b82f6',
  phone: '#22c55e',
  email: '#22c55e',
  snapchat: '#a855f7',
  facebook: '#a855f7',
  instagram: '#a855f7',
  twitter: '#a855f7',
  tiktok: '#a855f7',
  discord: '#a855f7',
  telegram: '#a855f7',
  linkedin: '#a855f7',
  ip: '#f97316',
  address: '#f97316',
  vehicle: '#f97316',
  iban: '#f97316',
  pseudo: '#a855f7',
  other: '#6b7280',
}

const TYPE_ICONS: Record<string, string> = {
  identity: '👤',
  phone: '📞',
  email: '✉️',
  snapchat: '👻',
  facebook: '📘',
  instagram: '📷',
  twitter: '🐦',
  tiktok: '🎵',
  discord: '💬',
  telegram: '✈️',
  linkedin: '💼',
  ip: '🌐',
  address: '📍',
  vehicle: '🚗',
  iban: '🏦',
  pseudo: '🎭',
  other: '📌',
}

const LEGACY_TYPE_MAP: Record<string, string> = {
  'Identité': 'identity',
  'Téléphone': 'phone',
  'Email': 'email',
  'Pseudo': 'pseudo',
  'Snapchat': 'snapchat',
  'Facebook': 'facebook',
  'Instagram': 'instagram',
  'Twitter / X': 'twitter',
  'TikTok': 'tiktok',
  'Discord': 'discord',
  'Telegram': 'telegram',
  'LinkedIn': 'linkedin',
  'Adresse IP': 'ip',
  'Adresse postale': 'address',
  'Véhicule': 'vehicle',
  'IBAN': 'iban',
  'Autre': 'other',
}

function normalizeType(rawType: string): string {
  if (LEGACY_TYPE_MAP[rawType]) return LEGACY_TYPE_MAP[rawType]
  const lower = rawType.toLowerCase()
  if (CATEGORY_COLORS[lower]) return lower
  return 'other'
}

function entityColor(entity: IEntity): string {
  return CATEGORY_COLORS[normalizeType(entity.type || 'other')] ?? '#6b7280'
}

function entityIcon(entity: IEntity): string {
  return TYPE_ICONS[normalizeType(entity.type || 'other')] ?? '📌'
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

function randomOffset(): number {
  return (Math.random() - 0.5) * 60
}

async function insertEntity(entity: IEntity) {
  const key = entity._id ?? entity.name
  inserting.value = key
  try {
    const { x, y } = props.getViewportCenter()
    const cx = x + randomOffset()
    const cy = y + randomOffset()

    const type = normalizeType(entity.type || 'other')

    if (type === 'identity') {
      // Use Canvas API PNG rendering
      const photoUrl = (entity as unknown as { photos?: string[] }).photos?.[0] ?? undefined
      const card = await renderIdentityCard({
        name: entity.name || '—',
        description: entity.value || undefined,
        photoUrl,
      })

      const imageElement = {
        id: Math.random().toString(36).slice(2, 10),
        type: 'image',
        x: cx - card.width / 2,
        y: cy - card.height / 2,
        width: card.width,
        height: card.height,
        angle: 0,
        strokeColor: 'transparent',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        roundness: null,
        seed: Math.floor(Math.random() * 100000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 100000),
        isDeleted: false,
        groupIds: [],
        frameId: null,
        boundElements: [],
        updated: Date.now(),
        link: null,
        locked: false,
        fileId: card.fileId,
        status: 'saved',
        scale: [1, 1],
      }

      const file = {
        id: card.fileId,
        dataURL: card.dataURL,
        mimeType: 'image/png',
        created: Date.now(),
      }

      emit('insert-elements', [imageElement], [file])
    } else {
      const elements = buildEntityElements(entity, cx, cy)
      emit('insert-elements', elements)
    }
  } finally {
    inserting.value = null
  }
}

function insertNote(node: DossierNode) {
  const { x, y } = props.getViewportCenter()
  const cx = x + randomOffset()
  const cy = y + randomOffset()
  const elements = buildNoteElements(node.title || 'Note', cx, cy)
  emit('insert-elements', elements)
}

function insertCustom() {
  const label = customLabel.value.trim()
  if (!label) return
  const { x, y } = props.getViewportCenter()
  const cx = x + randomOffset()
  const cy = y + randomOffset()
  const fakeEntity: IEntity = {
    type: customType.value,
    name: label,
    value: label,
  }
  const elements = buildEntityElements(fakeEntity, cx, cy)
  emit('insert-elements', elements)
  customLabel.value = ''
}
</script>

<style scoped>
/* Local tokens: derived from app theme vars, with safe light/dark fallbacks */
.eep-panel {
  --eep-surface: #ffffff;
  --eep-surface-2: #f8fafc;
  --eep-border: #e2e8f0;
  --eep-text: #0f172a;
  --eep-text-soft: #475569;
  --eep-text-dim: #64748b;
  --eep-accent: #4f46e5;
  --eep-accent-soft: rgba(79, 70, 229, 0.1);
  --eep-hover: rgba(15, 23, 42, 0.04);

  position: fixed;
  z-index: 10000;
  width: 300px;
  max-height: 480px;
  background: var(--eep-surface);
  border: 1px solid var(--eep-border);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18), 0 2px 6px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
  color: var(--eep-text);
}

/* Dark mode overrides */
:global(html.dark) .eep-panel,
:global(.dark) .eep-panel {
  --eep-surface: #1a2332;
  --eep-surface-2: #111827;
  --eep-border: #334155;
  --eep-text: #f1f5f9;
  --eep-text-soft: #cbd5e1;
  --eep-text-dim: #94a3b8;
  --eep-accent: #818cf8;
  --eep-accent-soft: rgba(129, 140, 248, 0.16);
  --eep-hover: rgba(255, 255, 255, 0.05);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.25);
}

.eep-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
  cursor: grab;
  flex-shrink: 0;
}

.eep-header:active {
  cursor: grabbing;
}

.eep-header-icon {
  font-size: 16px;
  color: #ffffff;
  opacity: 0.95;
}

.eep-header-title {
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.01em;
}

.eep-close-btn {
  flex-shrink: 0;
  width: 24px !important;
  height: 24px !important;
  color: #ffffff !important;
}

.eep-close-btn:hover {
  background: rgba(255, 255, 255, 0.15) !important;
}

/* Tabs */
.eep-tabs {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.eep-tabs :deep(.p-tabview-nav) {
  padding: 0 6px;
  background: var(--eep-surface-2);
  border-bottom: 1px solid var(--eep-border);
  display: flex;
  flex-wrap: nowrap;
  overflow-x: hidden;
}

.eep-tabs :deep(.p-tabview-nav li) {
  margin: 0;
}

.eep-tabs :deep(.p-tabview-nav li .p-tabview-nav-link) {
  font-size: 11px;
  font-weight: 600;
  padding: 8px 10px;
  background: transparent;
  color: var(--eep-text-soft);
  white-space: nowrap;
  border: none;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}

.eep-tabs :deep(.p-tabview-nav li:not(.p-highlight):not(.p-disabled) .p-tabview-nav-link:hover) {
  color: var(--eep-text);
  border-bottom-color: var(--eep-border);
  background: transparent;
}

.eep-tabs :deep(.p-tabview-nav li.p-highlight .p-tabview-nav-link) {
  color: var(--eep-accent);
  border-bottom-color: var(--eep-accent);
  background: transparent;
}

.eep-tabs :deep(.p-tabview-panels) {
  padding: 0;
  overflow-y: auto;
  max-height: 370px;
  background: transparent;
  color: var(--eep-text);
}

/* List items */
.eep-list {
  padding: 6px 0;
}

.eep-empty {
  text-align: center;
  font-size: 12px;
  color: var(--eep-text-dim);
  padding: 24px 12px;
}

.eep-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  margin: 2px 6px;
  transition: background 0.15s;
}

.eep-item:hover {
  background: var(--eep-hover);
}

.eep-item-icon {
  font-size: 16px;
  flex-shrink: 0;
  width: 24px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.eep-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.eep-item-type {
  font-size: 10px;
  color: var(--eep-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}

.eep-item-name {
  font-size: 13px;
  color: var(--eep-text);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Custom tab */
.eep-custom {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.eep-custom-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.eep-custom-label {
  font-size: 10px;
  color: var(--eep-text-soft);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}

.eep-custom-select,
.eep-custom-input {
  width: 100%;
  background: var(--eep-surface-2);
  border: 1px solid var(--eep-border);
  border-radius: 6px;
  color: var(--eep-text);
  font-size: 13px;
  padding: 7px 9px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.eep-custom-select:focus,
.eep-custom-input:focus {
  border-color: var(--eep-accent);
  box-shadow: 0 0 0 3px var(--eep-accent-soft);
}

.eep-custom-input::placeholder {
  color: var(--eep-text-dim);
}

.eep-custom-btn {
  width: 100%;
  margin-top: 4px;
}

/* Type grid */
.eep-type-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.eep-type-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--eep-border);
  border-radius: 6px;
  background: var(--eep-surface-2);
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s, transform 0.1s;
}

.eep-type-btn:hover {
  border-color: var(--eep-accent);
  transform: translateY(-1px);
}

.eep-type-btn--active {
  border-color: var(--eep-accent);
  background: var(--eep-accent-soft);
}
</style>
