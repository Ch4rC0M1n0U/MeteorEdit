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
      <div class="ia-spacer" />
      <div class="ia-tool-group">
        <button class="ia-tool-btn ia-save-btn" @click="save" title="Sauvegarder">
          <v-icon size="16">mdi-content-save-outline</v-icon>
          <span class="ia-save-label">Sauvegarder</span>
        </button>
      </div>
    </div>

    <!-- Canvas area -->
    <div class="ia-canvas-wrap" ref="canvasWrapRef">
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
import { ref, reactive, onMounted, nextTick, watch } from 'vue';

interface Annotation {
  type: 'rect' | 'circle' | 'arrow' | 'freehand' | 'text';
  color: string;
  strokeWidth: number;
  // rect/circle
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
] as const;

const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff', '#000000'];

const containerRef = ref<HTMLDivElement | null>(null);
const canvasWrapRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const imageRef = ref<HTMLImageElement | null>(null);
const textInputRef = ref<HTMLInputElement | null>(null);

const activeTool = ref<string>('rect');
const activeColor = ref('#ef4444');
const strokeWidth = ref(3);
const annotations = ref<Annotation[]>([]);
const drawing = ref(false);
const currentAnnotation = ref<Annotation | null>(null);

const textInput = reactive({
  visible: false,
  x: 0,
  y: 0,
  value: '',
});

// Scale factor for canvas coords
let scaleX = 1;
let scaleY = 1;

function onImageLoad() {
  resizeCanvas();
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

watch(() => props.initialAnnotations, (val) => {
  if (val) {
    annotations.value = [...val];
    nextTick(redraw);
  }
});

function getCanvasCoords(e: PointerEvent) {
  const canvas = canvasRef.value!;
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

function onPointerDown(e: PointerEvent) {
  if (activeTool.value === 'text') {
    // Commit any existing text input first
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
    // Use setTimeout to ensure DOM is updated and focus isn't stolen by pointer events
    setTimeout(() => textInputRef.value?.focus(), 50);
    return;
  }

  drawing.value = true;
  const { x, y } = getCanvasCoords(e);

  if (activeTool.value === 'rect') {
    currentAnnotation.value = { type: 'rect', color: activeColor.value, strokeWidth: strokeWidth.value, x, y, w: 0, h: 0 };
  } else if (activeTool.value === 'circle') {
    currentAnnotation.value = { type: 'circle', color: activeColor.value, strokeWidth: strokeWidth.value, x, y, w: 0, h: 0 };
  } else if (activeTool.value === 'arrow') {
    currentAnnotation.value = { type: 'arrow', color: activeColor.value, strokeWidth: strokeWidth.value, x1: x, y1: y, x2: x, y2: y };
  } else if (activeTool.value === 'freehand') {
    currentAnnotation.value = { type: 'freehand', color: activeColor.value, strokeWidth: strokeWidth.value, points: [{ x, y }] };
  }
}

function onPointerMove(e: PointerEvent) {
  if (!drawing.value || !currentAnnotation.value) return;
  const { x, y } = getCanvasCoords(e);
  const a = currentAnnotation.value;

  if (a.type === 'rect' || a.type === 'circle') {
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

  // Only add non-trivial annotations
  const a = currentAnnotation.value;
  let valid = true;
  if (a.type === 'rect' || a.type === 'circle') {
    valid = Math.abs(a.w || 0) > 3 || Math.abs(a.h || 0) > 3;
  } else if (a.type === 'arrow') {
    valid = Math.abs((a.x2 || 0) - (a.x1 || 0)) > 3 || Math.abs((a.y2 || 0) - (a.y1 || 0)) > 3;
  } else if (a.type === 'freehand') {
    valid = (a.points?.length || 0) > 2;
  }

  if (valid) {
    annotations.value.push(a);
  }
  currentAnnotation.value = null;
  redraw();
}

function commitText() {
  if (!textInput.visible) return;
  textInput.visible = false;
  const val = textInput.value.trim();
  if (!val) return;

  const canvas = canvasRef.value!;
  const wrap = canvasWrapRef.value!;
  const canvasRect = canvas.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  // Convert wrap-relative coords to canvas-relative, then to natural image coords
  const canvasX = textInput.x - (canvasRect.left - wrapRect.left + wrap.scrollLeft);
  const canvasY = textInput.y - (canvasRect.top - wrapRect.top + wrap.scrollTop);
  const x = canvasX * scaleX;
  const y = canvasY * scaleY;

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
  // Re-focus the input after dragging
  setTimeout(() => textInputRef.value?.focus(), 50);
}

function onTextBlur() {
  // Don't commit while dragging
  if (textDragging) return;
  // Delay to avoid conflict with canvas pointerdown creating a new text input
  setTimeout(() => commitText(), 100);
}

function cancelText() {
  textInput.visible = false;
  textInput.value = '';
}

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

function redraw() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Use display pixel ratio
  const displayW = canvas.width;
  const displayH = canvas.height;
  ctx.clearRect(0, 0, displayW, displayH);

  const allAnnotations = [...annotations.value];
  if (currentAnnotation.value) allAnnotations.push(currentAnnotation.value);

  for (const a of allAnnotations) {
    ctx.strokeStyle = a.color;
    ctx.fillStyle = a.color;
    ctx.lineWidth = a.strokeWidth / scaleX; // Scale stroke to display
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
      // Arrowhead
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
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 16px;
}
.ia-image {
  max-width: 100%;
  max-height: 100%;
  display: block;
  user-select: none;
  pointer-events: none;
}
.ia-canvas {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
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
