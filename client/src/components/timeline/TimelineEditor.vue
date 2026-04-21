<template>
  <div class="tle-root">
    <!-- Toolbar -->
    <div class="tle-toolbar">
      <Button
        :label="$t('timeline.addEvent')"
        icon="mdi mdi-plus"
        size="small"
        @click="openAdd"
      />
      <Button
        :label="$t('timeline.sortByDate')"
        icon="mdi mdi-sort-clock-ascending-outline"
        size="small"
        text
        @click="sortEvents"
      />
      <span class="tle-spacer" />
      <span class="tle-count">
        {{ timelineData.events.length }} {{ $t('timeline.events') }}
      </span>
    </div>

    <!-- Frise -->
    <TimelineView
      :events="timelineData.events"
      :custom-categories="timelineData.customCategories"
      @edit="openEdit"
    />

    <!-- Dialog ajout/édition -->
    <TimelineEventForm
      v-model:visible="formVisible"
      :event="editingEvent"
      :custom-categories="timelineData.customCategories"
      @save="onSaveEvent"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import TimelineView from './TimelineView.vue'
import TimelineEventForm from './TimelineEventForm.vue'
import { useDossierStore } from '@/stores/dossier'
import type { DossierNode, TimelineEvent, TimelineData } from '@/types'

const props = defineProps<{ node: DossierNode }>()
const { t } = useI18n()
const dossierStore = useDossierStore()

function parseData(node: DossierNode): TimelineData {
  if (!node.content) return { events: [], customCategories: [] }
  try {
    const parsed = typeof node.content === 'string' ? JSON.parse(node.content) : node.content
    return {
      events: parsed.events ?? [],
      customCategories: parsed.customCategories ?? [],
    }
  } catch {
    return { events: [], customCategories: [] }
  }
}

const timelineData = ref<TimelineData>(parseData(props.node))

watch(() => props.node._id, () => {
  timelineData.value = parseData(props.node)
})

let saveTimeout: ReturnType<typeof setTimeout> | null = null
function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(async () => {
    await dossierStore.updateNode(props.node._id, {
      content: JSON.stringify(timelineData.value),
    })
  }, 800)
}

const formVisible = ref(false)
const editingEvent = ref<TimelineEvent | null>(null)

function openAdd() {
  editingEvent.value = null
  formVisible.value = true
}

function openEdit(event: TimelineEvent) {
  editingEvent.value = event
  formVisible.value = true
}

function onSaveEvent(event: TimelineEvent) {
  const idx = timelineData.value.events.findIndex((e) => e.id === event.id)
  if (idx >= 0) {
    timelineData.value.events[idx] = event
  } else {
    timelineData.value.events.push(event)
  }

  const isFixed = ['travel', 'transaction', 'digital', 'contact', 'legal', 'other'].includes(event.category)
  if (!isFixed && !timelineData.value.customCategories.includes(event.category)) {
    timelineData.value.customCategories.push(event.category)
  }

  scheduleSave()
}

function sortEvents() {
  timelineData.value.events.sort((a, b) => {
    if (a.dateType === 'approximate' && b.dateType === 'approximate') return 0
    if (a.dateType === 'approximate') return 1
    if (b.dateType === 'approximate') return -1
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })
  scheduleSave()
}
</script>

<style scoped>
.tle-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.tle-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--me-border, #2d3348);
  flex-shrink: 0;
}

.tle-spacer {
  flex: 1;
}

.tle-count {
  font-size: 12px;
  color: var(--me-text-muted, #94a3b8);
}
</style>
