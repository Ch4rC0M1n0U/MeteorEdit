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
  'add-annotation': [timestamp: number];
}>();

const waveformRef = ref<HTMLElement | null>(null);
const spectrogramRef = ref<HTMLElement | null>(null);
const timelineRef = ref<HTMLElement | null>(null);

const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(0.8);
const playbackRate = ref(1);
const zoomLevel = ref(1);
const showSpectrogram = ref(false);
const loopEnabled = ref(false);
const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

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

// Annotation markers on waveform (visual indicators for existing annotations)
function addAnnotationMarker(timestamp: number, id: string) {
  if (!regionsPlugin) return;
  regionsPlugin.addRegion({
    id: `annot-${id}`,
    start: timestamp,
    end: timestamp + 0.3,
    color: 'rgba(255, 152, 0, 0.5)',
    drag: false,
    resize: false,
  });
}

function removeAnnotationMarker(id: string) {
  if (!regionsPlugin) return;
  const regions = regionsPlugin.getRegions();
  const region = regions.find((r: any) => r.id === `annot-${id}`);
  if (region) region.remove();
}

function syncAnnotationMarkers(annotations: Array<{ id: string; timestamp: number }>) {
  if (!regionsPlugin) return;
  // Remove all annotation markers
  const regions = regionsPlugin.getRegions();
  regions.filter((r: any) => r.id?.startsWith('annot-')).forEach((r: any) => r.remove());
  // Re-add from current annotations
  for (const a of annotations) {
    addAnnotationMarker(a.timestamp, a.id);
  }
}

watch(volume, (v) => { ws?.setVolume(v); });

watch(zoomLevel, (level) => {
  if (ws) ws.zoom(level);
});

// --- Keyboard shortcuts ---
function handleKeyboard(e: KeyboardEvent) {
  // Don't capture if user is typing in an input/textarea
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
  // Don't capture if Ctrl/Meta is held (avoid conflicts with editor shortcuts)
  if (e.ctrlKey || e.metaKey) return;

  switch (e.key) {
    case ' ': // Space = play/pause
      e.preventDefault();
      togglePlay();
      break;
    case 's': // S = stop
    case 'S':
      e.preventDefault();
      stop();
      break;
    case 'l': // L = toggle loop
    case 'L':
      e.preventDefault();
      toggleLoop();
      break;
    case 'g': // G = toggle spectrogram
    case 'G':
      e.preventDefault();
      showSpectrogram.value = !showSpectrogram.value;
      break;
    case 'm': // M = add annotation at current time
    case 'M':
      e.preventDefault();
      emit('add-annotation', currentTime.value);
      break;
    case 'ArrowLeft': // Left = rewind 5s, Shift+Left = 15s
      e.preventDefault();
      seekTo(Math.max(0, currentTime.value - (e.shiftKey ? 15 : 5)));
      break;
    case 'ArrowRight': // Right = forward 5s, Shift+Right = 15s
      e.preventDefault();
      seekTo(Math.min(duration.value, currentTime.value + (e.shiftKey ? 15 : 5)));
      break;
    case 'ArrowUp': // Up = volume up
      e.preventDefault();
      volume.value = Math.min(1, volume.value + 0.1);
      break;
    case 'ArrowDown': // Down = volume down
      e.preventDefault();
      volume.value = Math.max(0, volume.value - 0.1);
      break;
    case '1': setSpeed(0.5); break;
    case '2': setSpeed(0.75); break;
    case '3': setSpeed(1); break;
    case '4': setSpeed(1.25); break;
    case '5': setSpeed(1.5); break;
    case '6': setSpeed(2); break;
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyboard);
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
    waveColor: '#6b7280',
    progressColor: accent,
    cursorColor: '#ffffff',
    cursorWidth: 2,
    barWidth: 3,
    barGap: 1,
    barRadius: 3,
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

  // Double-click on waveform = request annotation at current time
  ws.on('dblclick', () => {
    emit('add-annotation', currentTime.value);
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
  document.removeEventListener('keydown', handleKeyboard);
  ws?.destroy();
  ws = null;
});

defineExpose({ seekTo, getCurrentTime: () => currentTime.value, addAnnotationMarker, removeAnnotationMarker, syncAnnotationMarkers });
</script>

<style scoped>
.aw-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  background: var(--me-bg-deep, #1a1a2e);
  border-radius: 10px;
  border: 1px solid var(--me-border);
}

.aw-waveform { width: 100%; cursor: pointer; border-radius: 6px; overflow: hidden; }
.aw-spectrogram { width: 100%; border-radius: 6px; overflow: hidden; border: 1px solid var(--me-border); }
.aw-timeline { width: 100%; opacity: 0.8; }

.aw-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 6px 0;
  border-top: 1px solid var(--me-border);
  margin-top: 2px;
}

.aw-btn {
  background: none;
  border: 1px solid transparent;
  color: var(--me-text-secondary);
  cursor: pointer;
  padding: 5px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.aw-btn:hover { background: rgba(var(--me-accent-rgb, 124,58,237), 0.1); color: var(--me-text-primary); border-color: var(--me-border); }
.aw-btn--active { color: var(--me-accent); background: rgba(var(--me-accent-rgb, 124,58,237), 0.15); border-color: var(--me-accent); }
.aw-btn--play { background: var(--me-accent); color: white; border-radius: 50%; padding: 7px; border: none; }
.aw-btn--play:hover { filter: brightness(1.15); background: var(--me-accent); color: white; border: none; }

.aw-time {
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-primary);
  min-width: 100px;
  letter-spacing: 0.5px;
}

/* Speed buttons */
.aw-speed { display: flex; gap: 3px; }
.aw-speed-btn {
  padding: 3px 8px;
  border-radius: 5px;
  border: 1px solid var(--me-border);
  background: none;
  color: var(--me-text-secondary);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.aw-speed-btn:hover { border-color: var(--me-accent); color: var(--me-text-primary); }
.aw-speed-btn--active { border-color: var(--me-accent); color: white; background: var(--me-accent); }

/* Zoom */
.aw-zoom {
  display: flex;
  align-items: center;
  gap: 4px;
}
.aw-zoom-slider {
  width: 70px;
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
  width: 60px;
  height: 4px;
  accent-color: var(--me-accent);
}

/* Hint */
.aw-hint {
  font-size: 11px;
  color: var(--me-text-muted);
  text-align: center;
  padding: 2px 0;
}
</style>
