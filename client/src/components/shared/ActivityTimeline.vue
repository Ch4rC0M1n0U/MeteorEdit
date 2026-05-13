<!--
  ActivityTimeline.vue — timeline "Activité de l'équipe"
  Props : items = [{ _id, author, action, target?, time (ISO), dot? ('accent'|'ok'|'warn'|'err'|'info') }]
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n';

export interface ActivityItem {
  _id: string;
  author: string;
  action: string;
  target?: string;
  time: string;
  dot?: 'accent' | 'ok' | 'warn' | 'err' | 'info';
}

defineProps<{ items: ActivityItem[] }>();
const { locale } = useI18n();

function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto', style: 'narrow' });
  if (diff < 60) return rtf.format(-Math.floor(diff), 'second');
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour');
  return rtf.format(-Math.floor(diff / 86400), 'day');
}
</script>

<template>
  <div class="activity-card">
    <div class="activity">
      <div v-for="item in items" :key="item._id" class="activity__item">
        <span class="activity__dot" :class="item.dot ? `activity__dot--${item.dot}` : null" />
        <div>
          <span class="activity__author">{{ item.author }}</span>
          <span class="activity__action"> {{ item.action }}</span>
          <span v-if="item.target" class="activity__target"> {{ item.target }}</span>
          <div class="activity__time">{{ relTime(item.time) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.activity-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  padding: 14px;
}
.activity { display: flex; flex-direction: column; gap: 14px; }
.activity__item {
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: 10px;
  font-size: 12px;
  color: var(--ink-2);
  position: relative;
  line-height: 1.45;
}
.activity__dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--ink-4);
  margin-top: 4px; margin-left: 5px;
  position: relative;
  z-index: 1;
}
.activity__dot--accent { background: var(--accent); }
.activity__dot--ok     { background: var(--ok); }
.activity__dot--warn   { background: var(--warn); }
.activity__dot--err    { background: var(--err); }
.activity__dot--info   { background: var(--info); }
.activity__item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 9px; top: 14px; bottom: -14px;
  width: 1px;
  background: var(--line);
}
.activity__author { color: var(--ink); font-weight: 550; }
.activity__target { color: var(--ink); font-weight: 500; }
.activity__time { font-size: 10.5px; color: var(--ink-3); margin-top: 1px; }
</style>
