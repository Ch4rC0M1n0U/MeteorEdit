<template>
  <div class="aw-container">
    <div ref="waveformRef" class="aw-waveform" />
    <div class="aw-controls">
      <button class="aw-btn" @click="togglePlay">
        <v-icon size="20">{{ isPlaying ? 'mdi-pause' : 'mdi-play' }}</v-icon>
      </button>
      <span class="aw-time mono">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
      <div class="aw-volume">
        <v-icon size="16">mdi-volume-high</v-icon>
        <input type="range" min="0" max="1" step="0.05" v-model.number="volume" class="aw-volume-slider" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import WaveSurfer from 'wavesurfer.js';

const props = defineProps<{
  src: string;
  accentColor?: string;
}>();

const emit = defineEmits<{
  'timeupdate': [time: number];
  'ready': [duration: number];
  'seek': [time: number];
}>();

const waveformRef = ref<HTMLElement | null>(null);
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(0.8);

let ws: WaveSurfer | null = null;

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function togglePlay() {
  ws?.playPause();
}

function seekTo(time: number) {
  if (!ws || !duration.value) return;
  ws.seekTo(time / duration.value);
}

watch(volume, (v) => {
  ws?.setVolume(v);
});

onMounted(() => {
  if (!waveformRef.value) return;
  const accent = props.accentColor || getComputedStyle(document.documentElement).getPropertyValue('--me-accent').trim() || '#7c3aed';

  ws = WaveSurfer.create({
    container: waveformRef.value,
    waveColor: 'rgba(255,255,255,0.3)',
    progressColor: accent,
    cursorColor: accent,
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    height: 80,
    normalize: true,
    url: props.src,
  });

  ws.on('ready', () => {
    duration.value = ws!.getDuration();
    emit('ready', duration.value);
  });

  ws.on('timeupdate', (time: number) => {
    currentTime.value = time;
    emit('timeupdate', time);
  });

  ws.on('play', () => { isPlaying.value = true; });
  ws.on('pause', () => { isPlaying.value = false; });
  ws.on('seeking', (time: number) => { emit('seek', time); });
});

watch(() => props.src, (newSrc) => {
  if (ws && newSrc) {
    ws.load(newSrc);
  }
});

onBeforeUnmount(() => {
  ws?.destroy();
  ws = null;
});

defineExpose({ seekTo, getCurrentTime: () => currentTime.value });
</script>

<style scoped>
.aw-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
}

.aw-waveform {
  width: 100%;
  cursor: pointer;
}

.aw-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.aw-btn {
  background: none;
  border: none;
  color: var(--me-text);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.aw-btn:hover {
  background: rgba(255,255,255,0.1);
}

.aw-time {
  font-size: 12px;
  color: var(--me-text-muted);
  min-width: 80px;
}

.aw-volume {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  color: var(--me-text-muted);
}

.aw-volume-slider {
  width: 60px;
  height: 4px;
  accent-color: var(--me-accent);
}
</style>
