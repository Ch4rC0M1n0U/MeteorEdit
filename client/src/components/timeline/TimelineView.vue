<template>
  <div class="tlv-root">
    <div v-if="!sortedEvents.length" class="tlv-empty">
      <span class="mdi mdi-timeline-clock-outline tlv-empty-icon" />
      <p>{{ $t('timeline.noEvents') }}</p>
    </div>

    <div v-else class="tlv-track">
      <div
        v-for="(event, idx) in sortedEvents"
        :key="event.id"
        class="tlv-row"
        :class="idx % 2 === 0 ? 'tlv-row--right' : 'tlv-row--left'"
      >
        <!-- Côté gauche -->
        <div class="tlv-side tlv-side--left">
          <div
            v-if="idx % 2 === 1"
            class="tlv-card"
            :style="{ borderColor: eventColor(event) }"
            @click="emit('edit', event)"
          >
            <div class="tlv-card-inner">
              <div class="tlv-card-header">
                <span :class="`mdi ${eventIcon(event)} tlv-card-icon`" :style="{ color: eventColor(event) }" />
                <span class="tlv-card-category" :style="{ color: eventColor(event) }">{{ categoryLabel(event) }}</span>
                <span class="tlv-card-date">{{ formatDate(event) }}</span>
              </div>
              <div class="tlv-card-title">{{ event.title }}</div>
              <div v-if="event.description" class="tlv-card-desc">{{ event.description }}</div>
              <div v-if="event.source" class="tlv-card-source">🔗 {{ event.source }}</div>
            </div>
          </div>
        </div>

        <!-- Axe central -->
        <div class="tlv-axis">
          <div class="tlv-axis-line" />
          <div
            class="tlv-dot"
            :style="{ background: eventColor(event), boxShadow: `0 0 0 3px ${eventColor(event)}33` }"
          />
        </div>

        <!-- Côté droit -->
        <div class="tlv-side tlv-side--right">
          <div
            v-if="idx % 2 === 0"
            class="tlv-card"
            :style="{ borderColor: eventColor(event) }"
            @click="emit('edit', event)"
          >
            <div class="tlv-card-inner">
              <div class="tlv-card-header">
                <span :class="`mdi ${eventIcon(event)} tlv-card-icon`" :style="{ color: eventColor(event) }" />
                <span class="tlv-card-category" :style="{ color: eventColor(event) }">{{ categoryLabel(event) }}</span>
                <span class="tlv-card-date">{{ formatDate(event) }}</span>
              </div>
              <div class="tlv-card-title">{{ event.title }}</div>
              <div v-if="event.description" class="tlv-card-desc">{{ event.description }}</div>
              <div v-if="event.source" class="tlv-card-source">🔗 {{ event.source }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TIMELINE_CATEGORIES } from '../../types'
import type { TimelineEvent } from '../../types'

const props = defineProps<{
  events: TimelineEvent[]
  customCategories: string[]
}>()

const emit = defineEmits<{
  (e: 'edit', event: TimelineEvent): void
}>()

function eventColor(event: TimelineEvent): string {
  const fixed = TIMELINE_CATEGORIES.find((c) => c.key === event.category)
  return fixed ? fixed.color : '#6366f1'
}

function eventIcon(event: TimelineEvent): string {
  const fixed = TIMELINE_CATEGORIES.find((c) => c.key === event.category)
  return fixed ? fixed.icon : 'mdi-tag-outline'
}

function formatDate(event: TimelineEvent): string {
  if (event.dateType === 'approximate') return event.date
  const d = new Date(event.date)
  if (isNaN(d.getTime())) return event.date
  const dateStr = d.toLocaleDateString('fr-FR')
  return event.time ? `${dateStr} ${event.time}` : dateStr
}

function categoryLabel(event: TimelineEvent): string {
  const fixed = TIMELINE_CATEGORIES.find((c) => c.key === event.category)
  return fixed ? fixed.label : event.category
}

const sortedEvents = computed(() => {
  return [...props.events].sort((a, b) => {
    if (a.dateType === 'approximate' && b.dateType === 'approximate') return 0
    if (a.dateType === 'approximate') return 1
    if (b.dateType === 'approximate') return -1
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })
})
</script>

<style scoped>
.tlv-root {
  padding: 24px 16px;
  min-height: 200px;
  overflow-y: auto;
  flex: 1;
}

.tlv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 200px;
  color: var(--me-text-muted, #94a3b8);
}

.tlv-empty-icon {
  font-size: 48px;
  opacity: 0.4;
}

.tlv-track {
  display: flex;
  flex-direction: column;
}

.tlv-row {
  display: grid;
  grid-template-columns: 1fr 32px 1fr;
  align-items: center;
  min-height: 80px;
}

.tlv-side {
  padding: 10px 16px;
}

.tlv-axis {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  height: 100%;
  min-height: 80px;
}

.tlv-axis-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  background: var(--me-border, #2d3348);
}

.tlv-dot {
  position: relative;
  z-index: 1;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  margin-top: 33px;
  flex-shrink: 0;
}

.tlv-card {
  background: var(--me-bg-elevated, #1e2330);
  border: 1px solid var(--me-border, #2d3348);
  border-left-width: 3px;
  border-radius: 8px;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
}

.tlv-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  transform: translateY(-1px);
}

.tlv-row--left .tlv-card {
  border-left-width: 1px;
  border-right-width: 3px;
}

.tlv-card-inner {
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tlv-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.tlv-card-icon {
  font-size: 14px;
}

.tlv-card-category {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tlv-card-date {
  margin-left: auto;
  font-size: 11px;
  color: var(--me-text-muted, #94a3b8);
  font-variant-numeric: tabular-nums;
}

.tlv-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--me-text, #e2e8f0);
}

.tlv-card-desc {
  font-size: 12px;
  color: var(--me-text-muted, #94a3b8);
  white-space: pre-wrap;
}

.tlv-card-source {
  font-size: 11px;
  color: var(--me-text-muted, #94a3b8);
  font-style: italic;
}
</style>
