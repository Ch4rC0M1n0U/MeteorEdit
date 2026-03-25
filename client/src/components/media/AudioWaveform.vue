<template>
  <div class="aw-container">
    <!-- Waveform -->
    <div ref="waveformRef" class="aw-waveform" />

    <!-- Spectrogram -->
    <div v-show="showSpectrogram" ref="spectrogramRef" class="aw-spectrogram" />

    <!-- Timeline -->
    <div ref="timelineRef" class="aw-timeline" />

    <!-- Controls -->
    <div class="aw-controls">
      <!-- Play/Pause -->
      <button class="aw-btn aw-btn--play" @click="togglePlay" :title="isPlaying ? 'Pause' : 'Play'">
        <v-icon size="22">{{ isPlaying ? 'mdi-pause' : 'mdi-play' }}</v-icon>
      </button>

      <!-- Stop -->
      <button class="aw-btn" @click="stop" title="Stop">
        <v-icon size="18">mdi-stop</v-icon>
      </button>

      <!-- Time -->
      <span class="aw-time mono">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>

      <!-- Speed -->
      <div class="aw-speed">
        <button
          v-for="s in speeds"
          :key="s"
          class="aw-speed-btn mono"
          :class="{ 'aw-speed-btn--active': playbackRate === s }"
          @click="setSpeed(s)"
        >
          {{ s }}x
        </button>
      </div>

      <!-- Loop toggle -->
      <button class="aw-btn" :class="{ 'aw-btn--active': loopEnabled }" @click="toggleLoop" :title="t('media.loop')">
        <v-icon size="16">mdi-repeat</v-icon>
      </button>

      <!-- Spectrogram toggle -->
      <button class="aw-btn" :class="{ 'aw-btn--active': showSpectrogram }" @click="showSpectrogram = !showSpectrogram" :title="t('media.spectrogram')">
        <v-icon size="16">mdi-chart-bar</v-icon>
      </button>

      <!-- Zoom -->
      <div class="aw-zoom">
        <v-icon size="14" color="var(--me-text-muted)">mdi-magnify</v-icon>
        <input type="range" min="1" max="200" step="1" v-model.number="zoomLevel" class="aw-zoom-slider" :title="t('media.zoom')" />
      </div>

      <!-- Volume -->
      <div class="aw-volume">
        <v-icon size="16" color="var(--me-text-muted)">{{ volume === 0 ? 'mdi-volume-off' : 'mdi-volume-high' }}</v-icon>
        <input type="range" min="0" max="1" step="0.05" v-model.number="volume" class="aw-volume-slider" />
      </div>
    </div>

    <!-- Markers list -->
    <div v-if="markers.length > 0" class="aw-markers">
      <div class="aw-markers-title">
        <v-icon size="14">mdi-map-marker-outline</v-icon>
        {{ t('media.markers') }} ({{ markers.length }})
      </div>
      <div v-for="(marker, i) in markers" :key="i" class="aw-marker" @click="seekTo(marker.time)">
        <span class="aw-marker-time mono">{{ formatTime(marker.time) }}</span>
        <span class="aw-marker-label">{{ marker.label }}</span>
        <button class="aw-marker-del" @click.stop="removeMarker(i)">
          <v-icon size="12">mdi-close</v-icon>
        </button>
      </div>
    </div>

    <!-- Add marker dialog (inline) -->
    <div v-if="showMarkerInput" class="aw-marker-add">
      <span class="mono" style="font-size: 11px; color: var(--me-text-muted);">{{ formatTime(markerTime) }}</span>
      <input
        ref="markerInputRef"
        v-model="markerLabel"
        class="aw-marker-input"
        :placeholder="t('media.markerPlaceholder')"
        @keyup.enter="confirmMarker"
        @keyup.esc="showMarkerInput = false"
      />
      <button class="aw-btn" @click="confirmMarker" style="padding: 2px;">
        <v-icon size="14">mdi-check</v-icon>
      </button>
      <button class="aw-btn" @click="showMarkerInput = false" style="padding: 2px;">
        <v-icon size="14">mdi-close</v-icon>
      </button>
    </div>

    <!-- Hint -->
    <div class="aw-hint mono">
      {{ t('media.waveformHint') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import WaveSurfer from 'wavesurfer.js';
import SpectrogramPlugin from 'wavesurfer.js/dist/plugins/spectrogram.esm.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import ZoomPlugin from 'wavesurfer.js/dist/plugins/zoom.esm.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';

const { t } = useI18n();

const props = defineProps<{
  src: string;
  accentColor?: string;
}>();

const emit = defineEmits<{
  'timeupdate': [time: number];
  'ready': [duration: number];
  'seek': [time: number];
  'markers-change': [markers: Array<{ time: number; label: string }>];
}>();

const waveformRef = ref<HTMLElement | null>(null);
const spectrogramRef = ref<HTMLElement | null>(null);
const timelineRef = ref<HTMLElement | null>(null);
const markerInputRef = ref<HTMLInputElement | null>(null);

const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(0.8);
const playbackRate = ref(1);
const zoomLevel = ref(1);
const showSpectrogram = ref(false);
const loopEnabled = ref(false);
const showMarkerInput = ref(false);
const markerLabel = ref('');
const markerTime = ref(0);

const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface Marker { time: number; label: string }
const markers = ref<Marker[]>([]);

let ws: WaveSurfer | null = null;
let regionsPlugin: any = null;
let loopRegion: any = null;

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function togglePlay() { ws?.playPause(); }

function stop() {
  ws?.stop();
  isPlaying.value = false;
  currentTime.value = 0;
}

function seekTo(time: number) {
  if (!ws || !duration.value) return;
  ws.seekTo(Math.min(time / duration.value, 1));
}

function setSpeed(speed: number) {
  playbackRate.value = speed;
  ws?.setPlaybackRate(speed);
}

function toggleLoop() {
  loopEnabled.value = !loopEnabled.value;
  if (loopEnabled.value && regionsPlugin) {
    // Create loop region from current selection or full audio
    if (!loopRegion) {
      const start = Math.max(0, currentTime.value - 2);
      const end = Math.min(duration.value, currentTime.value + 10);
      loopRegion = regionsPlugin.addRegion({
        start,
        end,
        color: 'rgba(124, 58, 237, 0.15)',
        drag: true,
        resize: true,
      });
    }
  } else if (loopRegion) {
    loopRegion.remove();
    loopRegion = null;
  }
}

// Markers
function addMarkerAtCurrentTime() {
  markerTime.value = currentTime.value;
  markerLabel.value = '';
  showMarkerInput.value = true;
  nextTick(() => markerInputRef.value?.focus());
}

function confirmMarker() {
  if (!markerLabel.value.trim()) markerLabel.value = `Marker ${markers.value.length + 1}`;
  markers.value.push({ time: markerTime.value, label: markerLabel.value.trim() });
  markers.value.sort((a, b) => a.time - b.time);
  showMarkerInput.value = false;
  emit('markers-change', markers.value);

  // Add visual marker on waveform
  if (regionsPlugin) {
    regionsPlugin.addRegion({
      start: markerTime.value,
      end: markerTime.value + 0.1,
      color: 'rgba(255, 152, 0, 0.6)',
      drag: false,
      resize: false,
    });
  }
}

function removeMarker(index: number) {
  markers.value.splice(index, 1);
  emit('markers-change', markers.value);
}

watch(volume, (v) => { ws?.setVolume(v); });

watch(zoomLevel, (level) => {
  if (ws) ws.zoom(level);
});

onMounted(() => {
  if (!waveformRef.value) return;
  const accent = props.accentColor || getComputedStyle(document.documentElement).getPropertyValue('--me-accent').trim() || '#7c3aed';

  // Initialize plugins
  regionsPlugin = RegionsPlugin.create();

  const plugins: any[] = [
    regionsPlugin,
    TimelinePlugin.create({
      container: timelineRef.value!,
      primaryLabelInterval: 10,
      secondaryLabelInterval: 5,
      style: { fontSize: '10px', color: 'var(--me-text-muted)' },
    }),
    ZoomPlugin.create({
      scale: 0.5,
      maxZoom: 200,
    }),
  ];

  ws = WaveSurfer.create({
    container: waveformRef.value,
    waveColor: 'rgba(255,255,255,0.25)',
    progressColor: accent,
    cursorColor: accent,
    cursorWidth: 2,
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    height: 100,
    normalize: true,
    url: props.src,
    plugins,
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

  // Double-click on waveform = add marker
  ws.on('dblclick', () => {
    addMarkerAtCurrentTime();
  });

  // Loop: when playback reaches end of region, loop back
  regionsPlugin.on('region-out', (region: any) => {
    if (loopEnabled.value && region === loopRegion) {
      ws?.setTime(region.start);
      ws?.play();
    }
  });
});

// Spectrogram: create/destroy when toggled
watch(showSpectrogram, (show) => {
  if (show && ws && spectrogramRef.value) {
    try {
      ws.registerPlugin(SpectrogramPlugin.create({
        container: spectrogramRef.value,
        labels: true,
        height: 128,
        splitChannels: false,
      }));
    } catch (err) {
      console.warn('Spectrogram plugin error:', err);
    }
  }
});

watch(() => props.src, (newSrc) => {
  if (ws && newSrc) {
    ws.load(newSrc);
    markers.value = [];
    loopRegion = null;
    loopEnabled.value = false;
  }
});

onBeforeUnmount(() => {
  ws?.destroy();
  ws = null;
});

defineExpose({ seekTo, getCurrentTime: () => currentTime.value, addMarkerAtCurrentTime });
</script>

<style scoped>
.aw-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
}

.aw-waveform { width: 100%; cursor: pointer; }
.aw-spectrogram { width: 100%; border-radius: 4px; overflow: hidden; }
.aw-timeline { width: 100%; }

.aw-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.aw-btn {
  background: none;
  border: none;
  color: var(--me-text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.aw-btn:hover { background: rgba(255,255,255,0.1); color: var(--me-text-primary); }
.aw-btn--active { color: var(--me-accent); background: rgba(var(--me-accent-rgb, 124,58,237), 0.15); }
.aw-btn--play { background: rgba(255,255,255,0.08); border-radius: 50%; padding: 6px; }

.aw-time {
  font-size: 12px;
  color: var(--me-text-muted);
  min-width: 90px;
}

/* Speed buttons */
.aw-speed { display: flex; gap: 2px; }
.aw-speed-btn {
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid transparent;
  background: none;
  color: var(--me-text-muted);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.aw-speed-btn:hover { border-color: var(--me-border); color: var(--me-text-primary); }
.aw-speed-btn--active { border-color: var(--me-accent); color: var(--me-accent); background: rgba(var(--me-accent-rgb, 124,58,237), 0.1); }

/* Zoom */
.aw-zoom {
  display: flex;
  align-items: center;
  gap: 4px;
}
.aw-zoom-slider {
  width: 60px;
  height: 4px;
  accent-color: var(--me-accent);
}

/* Volume */
.aw-volume {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.aw-volume-slider {
  width: 50px;
  height: 4px;
  accent-color: var(--me-accent);
}

/* Markers */
.aw-markers {
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--me-border);
  background: rgba(0,0,0,0.15);
}
.aw-markers-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--me-text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.aw-marker {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 4px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s;
}
.aw-marker:hover { background: rgba(255,255,255,0.06); }
.aw-marker-time { font-size: 10px; color: var(--me-accent); min-width: 40px; }
.aw-marker-label { flex: 1; color: var(--me-text-primary); }
.aw-marker-del { background: none; border: none; color: var(--me-text-muted); cursor: pointer; padding: 2px; }
.aw-marker-del:hover { color: #f44336; }

/* Marker input */
.aw-marker-add {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(var(--me-accent-rgb, 124,58,237), 0.08);
  border: 1px solid var(--me-accent);
}
.aw-marker-input {
  flex: 1;
  padding: 3px 6px;
  border-radius: 4px;
  border: 1px solid var(--me-border);
  background: var(--me-bg-deep);
  color: var(--me-text-primary);
  font-size: 12px;
  outline: none;
}
.aw-marker-input:focus { border-color: var(--me-accent); }

/* Hint */
.aw-hint {
  font-size: 10px;
  color: var(--me-text-muted);
  text-align: center;
  opacity: 0.6;
}
</style>
