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
        <span :class="['mdi', isPlaying ? 'mdi-pause' : 'mdi-play']" style="font-size: 22px"></span>
      </button>

      <!-- Stop -->
      <button class="aw-btn" @click="stop" title="Stop">
        <i class="pi pi-stop" style="font-size: 18px"></i>
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
        <span class="mdi mdi-repeat" style="font-size: 16px"></span>
      </button>

      <!-- Spectrogram toggle -->
      <button class="aw-btn" :class="{ 'aw-btn--active': showSpectrogram }" @click="showSpectrogram = !showSpectrogram" :title="t('media.spectrogram')">
        <span class="mdi mdi-chart-bar" style="font-size: 16px"></span>
      </button>

      <!-- Audio filters toggle -->
      <button class="aw-btn" :class="{ 'aw-btn--active': showFilters }" @click="showFilters = !showFilters" :title="t('media.audioFilters')">
        <span class="mdi mdi-tune-variant" style="font-size: 16px"></span>
      </button>

      <!-- Zoom -->
      <div class="aw-zoom">
        <i class="pi pi-search" style="font-size: 14px; color: var(--me-text-muted)"></i>
        <input type="range" min="1" max="200" step="1" v-model.number="zoomLevel" class="aw-zoom-slider" :title="t('media.zoom')" />
      </div>

      <!-- Volume -->
      <div class="aw-volume">
        <span :class="['mdi', volume === 0 ? 'mdi-volume-off' : 'mdi-volume-high']" style="font-size: 16px; color: var(--me-text-muted)"></span>
        <input type="range" min="0" max="1" step="0.05" v-model.number="volume" class="aw-volume-slider" />
      </div>
    </div>

    <!-- Audio Filters Panel -->
    <div v-if="showFilters" class="aw-filters">
      <div class="aw-filters-header">
        <span class="mdi mdi-tune-variant" style="font-size: 16px"></span>
        <span>{{ t('media.audioFilters') }}</span>
        <button class="aw-filters-reset" @click="resetFilters">
          <i class="pi pi-refresh" style="font-size: 14px"></i>
          {{ t('media.resetFilters') }}
        </button>
      </div>

      <!-- Presets -->
      <div class="aw-presets">
        <button class="aw-preset-btn" :class="{ 'aw-preset-btn--active': activePreset === 'voice' }" @click="applyPreset('voice')">
          <span class="mdi mdi-account-voice" style="font-size: 14px"></span>
          {{ t('media.presetVoice') }}
        </button>
        <button class="aw-preset-btn" :class="{ 'aw-preset-btn--active': activePreset === 'background' }" @click="applyPreset('background')">
          <span class="mdi mdi-music-note" style="font-size: 14px"></span>
          {{ t('media.presetBackground') }}
        </button>
        <button class="aw-preset-btn" :class="{ 'aw-preset-btn--active': activePreset === 'clarity' }" @click="applyPreset('clarity')">
          <span class="mdi mdi-ear-hearing" style="font-size: 14px"></span>
          {{ t('media.presetClarity') }}
        </button>
        <button class="aw-preset-btn" :class="{ 'aw-preset-btn--active': activePreset === 'bass' }" @click="applyPreset('bass')">
          <span class="mdi mdi-speaker" style="font-size: 14px"></span>
          {{ t('media.presetBass') }}
        </button>
      </div>

      <!-- 5-band EQ -->
      <div class="aw-eq">
        <div v-for="band in eqBands" :key="band.label" class="aw-eq-band">
          <input
            type="range"
            min="-20"
            max="20"
            step="1"
            :value="band.gain"
            class="aw-eq-slider"
            @input="setEqBand(band.index, Number(($event.target as HTMLInputElement).value))"
          />
          <span class="aw-eq-value mono">{{ band.gain > 0 ? '+' : '' }}{{ band.gain }}</span>
          <span class="aw-eq-label mono">{{ band.label }}</span>
        </div>
      </div>
    </div>

    <!-- Hint -->
    <div class="aw-hint mono">
      {{ t('media.waveformHint') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
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
const showFilters = ref(false);
const activePreset = ref('');

// 5-band EQ: Sub-bass, Bass, Mids, Presence, Brilliance
const EQ_FREQUENCIES = [80, 250, 1000, 3000, 8000];
const EQ_LABELS = ['80', '250', '1k', '3k', '8k'];
interface EqBand { index: number; label: string; freq: number; gain: number }
const eqGains = ref([0, 0, 0, 0, 0]);
const eqBands = computed<EqBand[]>(() =>
  EQ_FREQUENCIES.map((freq, i) => ({ index: i, label: EQ_LABELS[i], freq, gain: eqGains.value[i] }))
);

let audioFilters: BiquadFilterNode[] = [];

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

// --- Audio filters (Web Audio API EQ) ---
let audioCtx: AudioContext | null = null;
let mediaSource: MediaElementAudioSourceNode | null = null;

function initFilters() {
  if (!ws || audioFilters.length > 0) return;

  try {
    // Get the actual <audio> element from WaveSurfer
    const mediaEl = (ws as any).getMediaElement?.() as HTMLMediaElement | undefined;
    if (!mediaEl) {
      console.warn('Audio filter init: no media element found');
      return;
    }

    // Create AudioContext and connect media element source
    // Note: createMediaElementSource can only be called ONCE per element
    if (!audioCtx) {
      audioCtx = new AudioContext();
      mediaSource = audioCtx.createMediaElementSource(mediaEl);
    }

    // Create 5-band parametric EQ filters
    audioFilters = EQ_FREQUENCIES.map((freq, i) => {
      const filter = audioCtx!.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.4;
      filter.gain.value = eqGains.value[i];
      return filter;
    });

    // Connect chain: source → filter1 → filter2 → ... → destination
    let prev: AudioNode = mediaSource!;
    for (const filter of audioFilters) {
      prev.connect(filter);
      prev = filter;
    }
    prev.connect(audioCtx.destination);

    console.log('[AudioEQ] Filters initialized and connected');
  } catch (err) {
    console.warn('Audio filter init failed:', err);
  }
}

function setEqBand(index: number, gain: number) {
  eqGains.value[index] = gain;
  activePreset.value = '';
  if (audioFilters.length === 0) initFilters();
  if (audioFilters[index]) {
    audioFilters[index].gain.value = gain;
  }
}

function applyPreset(preset: string) {
  activePreset.value = preset;
  let gains: number[];
  switch (preset) {
    case 'voice':
      // Boost voice frequencies (250Hz-3kHz), cut sub-bass and high
      gains = [-10, 4, 8, 6, -4];
      break;
    case 'background':
      // Cut voice frequencies, boost bass and high (ambient/background sounds)
      gains = [6, -2, -12, -10, 8];
      break;
    case 'clarity':
      // Boost presence and brilliance for speech clarity
      gains = [-4, 0, 4, 8, 6];
      break;
    case 'bass':
      // Boost low frequencies
      gains = [12, 8, 0, -2, -4];
      break;
    default:
      gains = [0, 0, 0, 0, 0];
  }
  eqGains.value = gains;
  if (audioFilters.length === 0) initFilters();
  gains.forEach((g, i) => {
    if (audioFilters[i]) audioFilters[i].gain.value = g;
  });
}

function resetFilters() {
  activePreset.value = '';
  eqGains.value = [0, 0, 0, 0, 0];
  audioFilters.forEach(f => { f.gain.value = 0; });
}

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
    case 'f': // F = toggle filters
    case 'F':
      e.preventDefault();
      showFilters.value = !showFilters.value;
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
    // Reset all UI state when switching audio files
    isPlaying.value = false;
    currentTime.value = 0;
    duration.value = 0;
    playbackRate.value = 1;
    zoomLevel.value = 1;
    showSpectrogram.value = false;
    showFilters.value = false;
    loopEnabled.value = false;
    loopRegion = null;
    activePreset.value = '';
    eqGains.value = [0, 0, 0, 0, 0];
    // Reset audio filters gains (don't destroy — mediaSource can only be created once)
    audioFilters.forEach(f => { try { f.gain.value = 0; } catch {} });
    // Load new source
    ws.load(newSrc);
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

/* Audio Filters Panel */
.aw-filters {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--me-border);
  background: var(--me-bg-surface, #1e1e30);
}
.aw-filters-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-primary);
  margin-bottom: 10px;
}
.aw-filters-reset {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--me-text-muted);
  background: none;
  border: 1px solid var(--me-border);
  border-radius: 5px;
  padding: 3px 8px;
  cursor: pointer;
}
.aw-filters-reset:hover { border-color: var(--me-accent); color: var(--me-accent); }

/* Presets */
.aw-presets {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.aw-preset-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid var(--me-border);
  background: none;
  color: var(--me-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.aw-preset-btn:hover { border-color: var(--me-accent); color: var(--me-text-primary); }
.aw-preset-btn--active { border-color: var(--me-accent); color: white; background: var(--me-accent); }

/* 5-band EQ */
.aw-eq {
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: flex-end;
  padding: 8px 0;
}
.aw-eq-band {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
}
.aw-eq-slider {
  writing-mode: vertical-lr;
  direction: rtl;
  appearance: slider-vertical;
  width: 20px;
  height: 80px;
  accent-color: var(--me-accent);
  cursor: pointer;
}
.aw-eq-value {
  font-size: 10px;
  color: var(--me-text-primary);
  font-weight: 600;
  min-width: 28px;
  text-align: center;
}
.aw-eq-label {
  font-size: 10px;
  color: var(--me-text-muted);
}

/* Hint */
.aw-hint {
  font-size: 11px;
  color: var(--me-text-muted);
  text-align: center;
  padding: 2px 0;
}
</style>
