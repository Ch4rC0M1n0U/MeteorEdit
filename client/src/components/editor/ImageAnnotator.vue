<template>
  <div class="ia-container" ref="containerRef">
    <!-- Toolbar -->
    <div class="ia-toolbar">
      <div class="ia-tool-group">
        <button
          v-for="tool in tools"
          :key="tool.id"
          class="ia-tool-btn"
          :class="{ active: activeTool === tool.id }"
          @click="activeTool = tool.id"
          :title="tool.label"
        >
          <v-icon size="16">{{ tool.icon }}</v-icon>
        </button>
      </div>
      <div class="ia-separator" />
      <div class="ia-tool-group">
        <button
          v-for="c in colors"
          :key="c"
          class="ia-color-btn"
          :class="{ active: activeColor === c }"
          :style="{ background: c }"
          @click="activeColor = c"
        />
      </div>
      <div class="ia-separator" />
      <div class="ia-tool-group">
        <select v-model.number="strokeWidth" class="ia-stroke-select">
          <option :value="2">Fine</option>
          <option :value="3">Normal</option>
          <option :value="5">Epais</option>
        </select>
      </div>
      <div class="ia-separator" />
      <div class="ia-tool-group">
        <button class="ia-tool-btn" @click="undo" :disabled="!annotations.length" title="Annuler">
          <v-icon size="16">mdi-undo</v-icon>
        </button>
        <button class="ia-tool-btn" @click="clearAll" :disabled="!annotations.length" title="Tout effacer">
          <v-icon size="16">mdi-delete-outline</v-icon>
        </button>
      </div>
      <div class="ia-separator" />
      <!-- Zoom controls -->
      <div class="ia-tool-group">
        <button class="ia-tool-btn" @click="zoomOut" :disabled="zoomLevel <= 0.25" title="Zoom -">
          <v-icon size="16">mdi-magnify-minus-outline</v-icon>
        </button>
        <span class="ia-zoom-label mono">{{ Math.round(zoomLevel * 100) }}%</span>
        <button class="ia-tool-btn" @click="zoomIn" :disabled="zoomLevel >= 5" title="Zoom +">
          <v-icon size="16">mdi-magnify-plus-outline</v-icon>
        </button>
        <button class="ia-tool-btn" @click="zoomReset" title="Ajuster">
          <v-icon size="16">mdi-fit-to-screen-outline</v-icon>
        </button>
      </div>
      <div class="ia-spacer" />
      <div class="ia-tool-group">
        <button class="ia-tool-btn ia-save-btn" @click="save" title="Sauvegarder">
          <v-icon size="16">mdi-content-save-outline</v-icon>
          <span class="ia-save-label">Sauvegarder</span>
        </button>
      </div>
    </div>

    <!-- Canvas area with scroll -->
    <div class="ia-canvas-wrap" ref="canvasWrapRef" @wheel.prevent="onWheel">
      <div
        class="ia-canvas-inner"
        ref="canvasInnerRef"
        :style="{ transform: `scale(${zoomLevel})`, transformOrigin: '0 0' }"
      >
        <img
          ref="imageRef"
          :src="imageSrc"
          class="ia-image"
          @load="onImageLoad"
          crossorigin="anonymous"
        />
        <canvas
          ref="canvasRef"
          class="ia-canvas"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
        />
      </div>
      <!-- Text input overlay with drag handle -->
      <div
        v-if="textInput.visible"
        class="ia-text-box"
        :style="{ left: textInput.x + 'px', top: textInput.y + 'px' }"
        @pointerdown.stop
      >
        <div
          class="ia-text-drag-handle"
          @pointerdown.prevent="startTextDrag"
          title="Deplacer"
        >
          <v-icon size="12">mdi-cursor-move</v-icon>
        </div>
        <input
          ref="textInputRef"
          v-model="textInput.value"
          class="ia-text-input"
          :style="{ color: activeColor }"
          @keyup.enter="commitText"
          @keyup.escape="cancelText"
          @blur="onTextBlur"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';

interface Annotation {
  type: 'rect' | 'circle' | 'arrow' | 'freehand' | 'text' | 'blur';
  color: string;
  strokeWidth: number;
  // rect/circle/blur
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  // arrow
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  // freehand
  points?: { x: number; y: number }[];
  // text
  text?: string;
  fontSize?: number;
}

const props = defineProps<{
  imageSrc: string;
  initialAnnotations?: Annotation[];
}>();

const emit = defineEmits<{
  save: [annotations: Annotation[]];
}>();

const tools = [
  { id: 'rect', icon: 'mdi-rectangle-outline', label: 'Rectangle' },
  { id: 'circle', icon: 'mdi-circle-outline', label: 'Cercle' },
  { id: 'arrow', icon: 'mdi-arrow-top-right', label: 'Fleche' },
  { id: 'freehand', icon: 'mdi-draw', label: 'Dessin libre' },
  { id: 'text', icon: 'mdi-format-text', label: 'Texte' },
  { id: 'blur', icon: 'mdi-blur', label: 'Flou' },
];

const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff', '#000000'];

const containerRef = ref<HTMLDivElement | null>(null);
const canvasWrapRef = ref<HTMLDivElement | null>(null);
const canvasInnerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const imageRef = ref<HTMLImageElement | null>(null);
const textInputRef = ref<HTMLInputElement | null>(null);

const activeTool = ref<string>('rect');
const activeColor = ref('#ef4444');
const strokeWidth = ref(3);
const annotations = ref<Annotation[]>([]);
const drawing = ref(false);
const currentAnnotation = ref<Annotation | null>(null);
const zoomLevel = ref(1);

const textInput = reactive({
  visible: false,
  x: 0,
  y: 0,
  value: '',
});

// Scale factor for canvas coords (canvas display px -> natural image px)
let scaleX = 1;
let scaleY = 1;

// Offscreen canvas holding the original image pixels (for blur rendering)
let sourceCanvas: HTMLCanvasElement | null = null;

function onImageLoad() {
  buildSourceCanvas();
  resizeCanvas();
}

function buildSourceCanvas() {
  const img = imageRef.value;
  if (!img) return;
  sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = img.naturalWidth;
  sourceCanvas.height = img.naturalHeight;
  const ctx = sourceCanvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
}

function resizeCanvas() {
  const img = imageRef.value;
  const canvas = canvasRef.value;
  if (!img || !canvas) return;

  canvas.width = img.clientWidth;
  canvas.height = img.clientHeight;
  scaleX = img.naturalWidth / img.clientWidth;
  scaleY = img.naturalHeight / img.clientHeight;
  redraw();
}

onMounted(() => {
  if (props.initialAnnotations?.length) {
    annotations.value = [...props.initialAnnotations];
  }
  window.addEventListener('resize', resizeCanvas);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas);
});

watch(() => props.initialAnnotations, (val) => {
  if (val) {
    annotations.value = [...val];
    nextTick(redraw);
  }
});

// --- Zoom ---
function zoomIn() {
  zoomLevel.value = Math.min(5, +(zoomLevel.value * 1.25).toFixed(2));
  nextTick(updateScrollSize);
}

function zoomOut() {
  zoomLevel.value = Math.max(0.25, +(zoomLevel.value / 1.25).toFixed(2));
  nextTick(updateScrollSize);
}

function zoomReset() {
  zoomLevel.value = 1;
  nextTick(updateScrollSize);
}

function onWheel(e: WheelEvent) {
  if (!e.ctrlKey) return;
  if (e.deltaY < 0) {
    zoomIn();
  } else {
    zoomOut();
  }
}

function updateScrollSize() {
  // The CSS transform doesn't affect layout, so we set min-width/min-height
  // on the inner container to force scroll area
  const inner = canvasInnerRef.value;
  const img = imageRef.value;
  if (!inner || !img) return;
  inner.style.minWidth = `${img.clientWidth * zoomLevel.value}px`;
  inner.style.minHeight = `${img.clientHeight * zoomLevel.value}px`;
}

// --- Coordinates ---
function getCanvasCoords(e: PointerEvent) {
  const canvas = canvasRef.value!;
  const rect = canvas.getBoundingClientRect();
  // getBoundingClientRect accounts for CSS scale, so divide by zoom to get logical canvas px
  return {
    x: ((e.clientX - rect.left) * canvas.width / rect.width) * scaleX,
    y: ((e.clientY - rect.top) * canvas.height / rect.height) * scaleY,
  };
}

// --- Drawing ---
function onPointerDown(e: PointerEvent) {
  if (activeTool.value === 'text') {
    if (textInput.visible) {
      commitText();
    }
    e.preventDefault();
    e.stopPropagation();
    const wrap = canvasWrapRef.value!;
    const wrapRect = wrap.getBoundingClientRect();
    textInput.x = e.clientX - wrapRect.left + wrap.scrollLeft;
    textInput.y = e.clientY - wrapRect.top + wrap.scrollTop;
    textInput.value = '';
    textInput.visible = true;
    setTimeout(() => textInputRef.value?.focus(), 50);
    return;
  }

  drawing.value = true;
  const { x, y } = getCanvasCoords(e);
  const tool = activeTool.value;

  if (tool === 'rect') {
    currentAnnotation.value = { type: 'rect', color: activeColor.value, strokeWidth: strokeWidth.value, x, y, w: 0, h: 0 };
  } else if (tool === 'circle') {
    currentAnnotation.value = { type: 'circle', color: activeColor.value, strokeWidth: strokeWidth.value, x, y, w: 0, h: 0 };
  } else if (tool === 'arrow') {
    currentAnnotation.value = { type: 'arrow', color: activeColor.value, strokeWidth: strokeWidth.value, x1: x, y1: y, x2: x, y2: y };
  } else if (tool === 'freehand') {
    currentAnnotation.value = { type: 'freehand', color: activeColor.value, strokeWidth: strokeWidth.value, points: [{ x, y }] };
  } else if (tool === 'blur') {
    currentAnnotation.value = { type: 'blur', color: '', strokeWidth: 0, x, y, w: 0, h: 0 };
  }
}

function onPointerMove(e: PointerEvent) {
  if (!drawing.value || !currentAnnotation.value) return;
  const { x, y } = getCanvasCoords(e);
  const a = currentAnnotation.value;

  if (a.type === 'rect' || a.type === 'circle' || a.type === 'blur') {
    a.w = x - a.x!;
    a.h = y - a.y!;
  } else if (a.type === 'arrow') {
    a.x2 = x;
    a.y2 = y;
  } else if (a.type === 'freehand') {
    a.points!.push({ x, y });
  }

  redraw();
}

function onPointerUp() {
  if (!drawing.value || !currentAnnotation.value) return;
  drawing.value = false;

  const a = currentAnnotation.value;
  let valid = true;
  if (a.type === 'rect' || a.type === 'circle' || a.type === 'blur') {
    valid = Math.abs(a.w || 0) > 3 || Math.abs(a.h || 0) > 3;
  } else if (a.type === 'arrow') {
    valid = Math.abs((a.x2 || 0) - (a.x1 || 0)) > 3 || Math.abs((a.y2 || 0) - (a.y1 || 0)) > 3;
  } else if (a.type === 'freehand') {
    valid = (a.points?.length || 0) > 2;
  }

  if (valid) {
    // Normalize blur rects to positive w/h
    if (a.type === 'blur' && (a.w! < 0 || a.h! < 0)) {
      if (a.w! < 0) { a.x = a.x! + a.w!; a.w = -a.w!; }
      if (a.h! < 0) { a.y = a.y! + a.h!; a.h = -a.h!; }
    }
    annotations.value.push(a);
  }
  currentAnnotation.value = null;
  redraw();
}

// --- Text ---
function commitText() {
  if (!textInput.visible) return;
  textInput.visible = false;
  const val = textInput.value.trim();
  if (!val) return;

  const canvas = canvasRef.value!;
  const wrap = canvasWrapRef.value!;
  const canvasRect = canvas.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  const canvasX = textInput.x - (canvasRect.left - wrapRect.left + wrap.scrollLeft);
  const canvasY = textInput.y - (canvasRect.top - wrapRect.top + wrap.scrollTop);
  // Convert display coords to natural coords (account for zoom via rect ratio)
  const rx = canvas.width / canvasRect.width;
  const ry = canvas.height / canvasRect.height;
  const x = canvasX * rx * scaleX;
  const y = canvasY * ry * scaleY;

  annotations.value.push({
    type: 'text',
    color: activeColor.value,
    strokeWidth: strokeWidth.value,
    x,
    y,
    text: val,
    fontSize: 16 * scaleX,
  });
  redraw();
}

let textDragging = false;
let textDragStartX = 0;
let textDragStartY = 0;
let textDragOriginX = 0;
let textDragOriginY = 0;

function startTextDrag(e: PointerEvent) {
  textDragging = true;
  textDragStartX = e.clientX;
  textDragStartY = e.clientY;
  textDragOriginX = textInput.x;
  textDragOriginY = textInput.y;
  document.addEventListener('pointermove', onTextDrag);
  document.addEventListener('pointerup', stopTextDrag);
}

function onTextDrag(e: PointerEvent) {
  if (!textDragging) return;
  textInput.x = textDragOriginX + (e.clientX - textDragStartX);
  textInput.y = textDragOriginY + (e.clientY - textDragStartY);
}

function stopTextDrag() {
  textDragging = false;
  document.removeEventListener('pointermove', onTextDrag);
  document.removeEventListener('pointerup', stopTextDrag);
  setTimeout(() => textInputRef.value?.focus(), 50);
}

function onTextBlur() {
  if (textDragging) return;
  setTimeout(() => commitText(), 100);
}

function cancelText() {
  textInput.visible = false;
  textInput.value = '';
}

// --- Actions ---
function undo() {
  annotations.value.pop();
  redraw();
}

function clearAll() {
  annotations.value = [];
  redraw();
}

function save() {
  emit('save', [...annotations.value]);
}

// --- Render ---
function drawBlurRegion(ctx: CanvasRenderingContext2D, a: Annotation, displayScale: boolean) {
  if (!sourceCanvas) return;
  // Natural image coordinates
  const nx = a.x!;
  const ny = a.y!;
  const nw = Math.abs(a.w!);
  const nh = Math.abs(a.h!);
  if (nw < 2 || nh < 2) return;

  // Pixelation block size in natural pixels
  const blockSize = 12;
  const tilesX = Math.max(1, Math.ceil(nw / blockSize));
  const tilesY = Math.max(1, Math.ceil(nh / blockSize));

  // Offscreen: draw source region scaled down to tiny size (pixelation)
  const off = document.createElement('canvas');
  off.width = tilesX;
  off.height = tilesY;
  const offCtx = off.getContext('2d')!;
  offCtx.imageSmoothingEnabled = true;
  offCtx.drawImage(sourceCanvas, nx, ny, nw, nh, 0, 0, tilesX, tilesY);

  // Draw back onto main canvas, scaled up with no smoothing (blocky)
  ctx.imageSmoothingEnabled = false;
  if (displayScale) {
    // Drawing on preview canvas (display coords)
    const dx = nx / scaleX;
    const dy = ny / scaleY;
    const dw = nw / scaleX;
    const dh = nh / scaleY;
    ctx.drawImage(off, 0, 0, tilesX, tilesY, dx, dy, dw, dh);
  } else {
    // Drawing at natural resolution (for save)
    ctx.drawImage(off, 0, 0, tilesX, tilesY, nx, ny, nw, nh);
  }
  ctx.imageSmoothingEnabled = true;
}

function redraw() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const allAnnotations = [...annotations.value];
  if (currentAnnotation.value) allAnnotations.push(currentAnnotation.value);

  for (const a of allAnnotations) {
    if (a.type === 'blur') {
      drawBlurRegion(ctx, a, true);
      // Draw dashed border for visibility
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      const bx = a.x! / scaleX, by = a.y! / scaleY;
      const bw = a.w! / scaleX, bh = a.h! / scaleY;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);
      continue;
    }

    ctx.strokeStyle = a.color;
    ctx.fillStyle = a.color;
    ctx.lineWidth = a.strokeWidth / scaleX;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (a.type === 'rect') {
      ctx.strokeRect(a.x! / scaleX, a.y! / scaleY, a.w! / scaleX, a.h! / scaleY);
    } else if (a.type === 'circle') {
      ctx.beginPath();
      const cx = (a.x! + a.w! / 2) / scaleX;
      const cy = (a.y! + a.h! / 2) / scaleY;
      const rx = Math.abs(a.w! / 2) / scaleX;
      const ry = Math.abs(a.h! / 2) / scaleY;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (a.type === 'arrow') {
      const x1 = a.x1! / scaleX, y1 = a.y1! / scaleY;
      const x2 = a.x2! / scaleX, y2 = a.y2! / scaleY;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLen = 12;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    } else if (a.type === 'freehand' && a.points?.length) {
      ctx.beginPath();
      ctx.moveTo(a.points[0].x / scaleX, a.points[0].y / scaleY);
      for (let i = 1; i < a.points.length; i++) {
        ctx.lineTo(a.points[i].x / scaleX, a.points[i].y / scaleY);
      }
      ctx.stroke();
    } else if (a.type === 'text' && a.text) {
      ctx.font = `bold ${(a.fontSize || 16) / scaleX}px sans-serif`;
      ctx.fillText(a.text, a.x! / scaleX, a.y! / scaleY);
    }
  }
}
</script>

<style scoped>
.ia-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--me-bg-base);
}
.ia-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--me-bg-surface);
  border-bottom: 1px solid var(--me-border);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.ia-tool-group {
  display: flex;
  align-items: center;
  gap: 2px;
}
.ia-separator {
  width: 1px;
  height: 20px;
  background: var(--me-border);
  margin: 0 4px;
}
.ia-spacer {
  flex: 1;
}
.ia-tool-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: none;
  border: none;
  color: var(--me-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.ia-tool-btn:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
.ia-tool-btn.active {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.ia-tool-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.ia-save-btn {
  width: auto;
  padding: 0 10px;
  gap: 4px;
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.ia-save-btn:hover {
  background: var(--me-accent);
  color: #fff;
}
.ia-save-label {
  font-size: 12px;
  font-weight: 600;
}
.ia-zoom-label {
  font-size: 11px;
  color: var(--me-text-muted);
  min-width: 38px;
  text-align: center;
  user-select: none;
}
.ia-color-btn {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.ia-color-btn.active {
  border-color: var(--me-accent);
  box-shadow: 0 0 0 2px var(--me-accent-glow);
}
.ia-stroke-select {
  background: var(--me-bg-elevated);
  color: var(--me-text-secondary);
  border: 1px solid var(--me-border);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
}
.ia-canvas-wrap {
  flex: 1;
  position: relative;
  overflow: auto;
  padding: 16px;
}
.ia-canvas-inner {
  position: relative;
  display: inline-block;
  line-height: 0;
}
.ia-image {
  display: block;
  max-width: 100%;
  user-select: none;
  pointer-events: none;
}
.ia-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}
.ia-text-box {
  position: absolute;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0;
}
.ia-text-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 28px;
  background: var(--me-accent);
  color: #fff;
  border-radius: 4px 0 0 4px;
  cursor: grab;
  flex-shrink: 0;
}
.ia-text-drag-handle:active {
  cursor: grabbing;
}
.ia-text-input {
  background: rgba(0, 0, 0, 0.15);
  border: 1px dashed var(--me-accent);
  border-left: none;
  border-radius: 0 4px 4px 0;
  font-size: 16px;
  font-weight: bold;
  padding: 2px 6px;
  outline: none;
  min-width: 80px;
  font-family: sans-serif;
}
</style>
