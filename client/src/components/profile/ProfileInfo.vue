<template>
  <div class="profile-info">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-account-outline</v-icon>
        Mon profil
      </h2>
    </div>

    <!-- Avatar -->
    <div class="branding-card glass-card fade-in fade-in-delay-1">
      <h3 class="branding-card-title mono">Avatar</h3>
      <div class="avatar-section">
        <div class="avatar-preview">
          <img v-if="avatarUrl" :src="avatarUrl" alt="Avatar" class="avatar-img" />
          <span v-else class="avatar-initials">{{ initials }}</span>
        </div>
        <div class="avatar-actions">
          <button class="me-btn-primary" @click="triggerAvatarInput">
            <v-icon size="14" class="mr-1">mdi-camera-outline</v-icon>
            Changer
          </button>
          <button v-if="avatarUrl" class="me-btn-ghost" @click="removeAvatar">
            <v-icon size="14" class="mr-1">mdi-delete-outline</v-icon>
            Supprimer
          </button>
        </div>
        <input ref="avatarInput" type="file" accept="image/png,image/jpeg" hidden @change="handleAvatarSelect" />
      </div>
    </div>

    <!-- Info form -->
    <div class="branding-card glass-card fade-in fade-in-delay-2">
      <h3 class="branding-card-title mono">Informations personnelles</h3>
      <div class="form-grid">
        <v-text-field v-model="form.firstName" label="Prenom" density="compact" hide-details />
        <v-text-field v-model="form.lastName" label="Nom" density="compact" hide-details />
      </div>
      <v-text-field v-model="form.email" label="Email" type="email" density="compact" hide-details class="mt-4" />
      <div class="branding-actions mt-4">
        <button class="me-btn-primary" @click="saveProfile" :disabled="saving">
          {{ saving ? 'Sauvegarde...' : 'Sauvegarder' }}
        </button>
      </div>
    </div>

    <!-- Signature textuelle -->
    <div class="branding-card glass-card fade-in fade-in-delay-3">
      <h3 class="branding-card-title mono">
        <v-icon size="16" class="mr-1">mdi-pen</v-icon>
        Signature de rapport
      </h3>
      <p class="sig-desc">Ces informations seront utilisees pour signer les rapports OSINT generes.</p>

      <div class="sig-form">
        <v-text-field v-model="sigForm.title" label="Grade / Titre" density="compact" hide-details placeholder="ex: 1INP/APJ" />
        <v-text-field v-model="sigForm.name" label="Nom complet" density="compact" hide-details placeholder="ex: DUPONT Jean" />
        <v-text-field v-model="sigForm.service" label="Service" density="compact" hide-details placeholder="ex: PJF - DJF/Bru" />
        <v-text-field v-model="sigForm.unit" label="Unite" density="compact" hide-details placeholder="ex: OA-DR5" />
        <v-text-field v-model="sigForm.email" label="Email professionnel" density="compact" hide-details placeholder="ex: service@police.belgium.eu" />
      </div>

      <div class="branding-actions mt-4">
        <button class="me-btn-primary" @click="saveSignature" :disabled="savingSig">
          {{ savingSig ? 'Sauvegarde...' : 'Sauvegarder' }}
        </button>
      </div>
    </div>

    <!-- Signature manuscrite -->
    <div class="branding-card glass-card fade-in fade-in-delay-4">
      <h3 class="branding-card-title mono">
        <v-icon size="16" class="mr-1">mdi-draw</v-icon>
        Signature manuscrite
      </h3>
      <p class="sig-desc">Dessinez votre signature ou importez une image. Elle sera integree aux rapports PDF.</p>

      <!-- Tabs: Draw / Upload -->
      <div class="sig-tabs">
        <button
          :class="['sig-tab', sigMode === 'draw' && 'sig-tab--active']"
          @click="sigMode = 'draw'"
        >
          <v-icon size="14" class="mr-1">mdi-draw</v-icon>
          Dessiner
        </button>
        <button
          :class="['sig-tab', sigMode === 'upload' && 'sig-tab--active']"
          @click="sigMode = 'upload'"
        >
          <v-icon size="14" class="mr-1">mdi-image-outline</v-icon>
          Importer une image
        </button>
      </div>

      <!-- Draw mode -->
      <div v-if="sigMode === 'draw'" class="sig-draw-section">
        <div class="sig-draw-container" @contextmenu.prevent>
          <canvas
            ref="drawCanvas"
            class="sig-draw-canvas"
            @pointerdown="startDraw"
            @pointermove="draw"
            @pointerup="endDraw"
            @pointerleave="endDraw"
          />
        </div>
        <div class="sig-draw-actions">
          <button class="me-btn-ghost" @click="clearDrawCanvas">
            <v-icon size="14" class="mr-1">mdi-eraser</v-icon>
            Effacer
          </button>
          <button class="me-btn-primary" @click="saveDrawnSignature" :disabled="savingSigImg">
            <v-icon size="14" class="mr-1">mdi-content-save-outline</v-icon>
            {{ savingSigImg ? 'Sauvegarde...' : 'Sauvegarder' }}
          </button>
        </div>
      </div>

      <!-- Upload mode -->
      <div v-if="sigMode === 'upload'" class="sig-upload-section">
        <div class="sig-upload-zone" @click="triggerSigImageInput" @dragover.prevent @drop.prevent="handleSigImageDrop">
          <v-icon size="32" color="var(--me-text-muted)">mdi-cloud-upload-outline</v-icon>
          <p>Cliquez ou glissez une image ici</p>
          <p class="sig-upload-hint">PNG ou JPG, fond transparent recommande</p>
        </div>
        <input ref="sigImageInput" type="file" accept="image/png,image/jpeg" hidden @change="handleSigImageSelect" />
      </div>

      <!-- Current signature image preview -->
      <div v-if="signatureImageUrl" class="sig-image-preview-section">
        <h4 class="sig-preview-title mono">Signature actuelle</h4>
        <div class="sig-protected" @contextmenu.prevent @dragstart.prevent @selectstart.prevent>
          <img :src="signatureImageUrl" alt="Signature" class="sig-image-preview" draggable="false" />
          <div class="sig-watermark">
            <span v-for="i in 6" :key="i">CONFIDENTIEL</span>
          </div>
        </div>
        <div class="sig-image-actions">
          <button class="me-btn-ghost-danger" @click="deleteSignatureImage">
            <v-icon size="14" class="mr-1">mdi-delete-outline</v-icon>
            Supprimer la signature manuscrite
          </button>
        </div>
        <p class="sig-protected-hint">
          <v-icon size="12" class="mr-1">mdi-shield-lock-outline</v-icon>
          Signature protegee contre la capture d'ecran
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue';
import api, { SERVER_URL } from '../../services/api';
import { useAuthStore } from '../../stores/auth';

const authStore = useAuthStore();
const avatarInput = ref<HTMLInputElement | null>(null);
const sigImageInput = ref<HTMLInputElement | null>(null);
const drawCanvas = ref<HTMLCanvasElement | null>(null);
const saving = ref(false);
const savingSig = ref(false);
const savingSigImg = ref(false);
const sigMode = ref<'draw' | 'upload'>('draw');

let isDrawing = false;
let drawCtx: CanvasRenderingContext2D | null = null;

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
});

const sigForm = reactive({
  title: '',
  name: '',
  service: '',
  unit: '',
  email: '',
});

const initials = computed(() => {
  const f = authStore.user?.firstName?.[0] || '';
  const l = authStore.user?.lastName?.[0] || '';
  return (f + l).toUpperCase();
});

const avatarUrl = computed(() => {
  return authStore.user?.avatarPath ? `${SERVER_URL}/${authStore.user.avatarPath}` : null;
});

const signatureImageUrl = computed(() => {
  const p = (authStore.user as any)?.signatureImagePath;
  return p ? `${SERVER_URL}/${p}` : null;
});

function initDrawCanvas() {
  const canvas = drawCanvas.value;
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement!.getBoundingClientRect();
  const w = rect.width - 2; // account for border
  const h = 150;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  drawCtx = canvas.getContext('2d');
  if (drawCtx) {
    drawCtx.scale(dpr, dpr);
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';
    drawCtx.lineWidth = 2;
    drawCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--me-text-primary').trim() || '#e0e0e0';
  }
}

function getCanvasPos(e: PointerEvent) {
  const canvas = drawCanvas.value!;
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

function startDraw(e: PointerEvent) {
  if (!drawCtx) return;
  isDrawing = true;
  const pos = getCanvasPos(e);
  drawCtx.beginPath();
  drawCtx.moveTo(pos.x, pos.y);
  (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
}

function draw(e: PointerEvent) {
  if (!isDrawing || !drawCtx) return;
  const pos = getCanvasPos(e);
  drawCtx.lineTo(pos.x, pos.y);
  drawCtx.stroke();
}

function endDraw() {
  isDrawing = false;
}

function clearDrawCanvas() {
  if (!drawCtx || !drawCanvas.value) return;
  const dpr = window.devicePixelRatio || 1;
  drawCtx.clearRect(0, 0, drawCanvas.value.width / dpr, drawCanvas.value.height / dpr);
}

async function saveDrawnSignature() {
  if (!drawCanvas.value) return;
  savingSigImg.value = true;
  try {
    const dataUrl = drawCanvas.value.toDataURL('image/png');
    await api.post('/auth/signature/draw', { dataUrl });
    await authStore.fetchMe();
  } catch (err) {
    console.error('Failed to save drawn signature:', err);
  } finally {
    savingSigImg.value = false;
  }
}

function triggerSigImageInput() { sigImageInput.value?.click(); }

async function handleSigImageSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  await uploadSigImage(file);
}

function handleSigImageDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0];
  if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
    uploadSigImage(file);
  }
}

async function uploadSigImage(file: File) {
  savingSigImg.value = true;
  try {
    const fd = new FormData();
    fd.append('signatureImage', file);
    await api.post('/auth/signature/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    await authStore.fetchMe();
  } catch (err) {
    console.error('Failed to upload signature image:', err);
  } finally {
    savingSigImg.value = false;
  }
}

async function deleteSignatureImage() {
  try {
    await api.delete('/auth/signature/image');
    await authStore.fetchMe();
  } catch (err) {
    console.error('Failed to delete signature image:', err);
  }
}

onMounted(() => {
  if (authStore.user) {
    form.firstName = authStore.user.firstName;
    form.lastName = authStore.user.lastName;
    form.email = authStore.user.email;

    const sig = (authStore.user as any).signature;
    if (sig) {
      sigForm.title = sig.title || '';
      sigForm.name = sig.name || '';
      sigForm.service = sig.service || '';
      sigForm.unit = sig.unit || '';
      sigForm.email = sig.email || '';
    }
  }
  nextTick(() => initDrawCanvas());
});

function triggerAvatarInput() { avatarInput.value?.click(); }

async function handleAvatarSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('avatar', file);
  await api.post('/auth/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  await authStore.fetchMe();
}

async function removeAvatar() {
  await api.delete('/auth/avatar');
  await authStore.fetchMe();
}

async function saveProfile() {
  saving.value = true;
  try {
    await api.put('/auth/profile', { ...form });
    await authStore.fetchMe();
  } finally {
    saving.value = false;
  }
}

async function saveSignature() {
  savingSig.value = true;
  try {
    await api.put('/auth/signature', { ...sigForm });
    await authStore.fetchMe();
  } finally {
    savingSig.value = false;
  }
}
</script>

<style scoped>
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.branding-card { padding: 20px; margin-bottom: 16px; }
.branding-card-title { font-size: 14px; font-weight: 700; color: var(--me-text-primary); margin-bottom: 12px; display: flex; align-items: center; }
.avatar-section { display: flex; align-items: center; gap: 20px; }
.avatar-preview {
  width: 80px; height: 80px; border-radius: 50%;
  background: var(--me-bg-elevated); border: 2px solid var(--me-border);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; flex-shrink: 0;
}
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-initials {
  font-size: 24px; font-weight: 700; font-family: var(--me-font-mono);
  color: var(--me-accent);
}
.avatar-actions { display: flex; gap: 8px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.branding-actions { display: flex; justify-content: flex-end; }
.mt-4 { margin-top: 16px; }
.me-btn-primary { padding: 8px 16px; border-radius: var(--me-radius-xs); background: var(--me-accent); border: none; color: var(--me-bg-deep); cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; }
.me-btn-primary:hover { box-shadow: 0 0 16px var(--me-accent-glow); }
.me-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.me-btn-ghost { padding: 8px 16px; border-radius: var(--me-radius-xs); background: none; border: 1px solid var(--me-border); color: var(--me-text-secondary); cursor: pointer; font-size: 13px; display: flex; align-items: center; }
.me-btn-ghost:hover { border-color: var(--me-border-hover); color: var(--me-text-primary); }
.me-btn-ghost-danger { padding: 8px 16px; border-radius: var(--me-radius-xs); background: none; border: 1px solid rgba(248, 113, 113, 0.4); color: #f87171; cursor: pointer; font-size: 12px; display: flex; align-items: center; }
.me-btn-ghost-danger:hover { background: rgba(248, 113, 113, 0.1); border-color: #f87171; }
.mr-1 { margin-right: 4px; }

/* Signature text section */
.sig-desc {
  font-size: 12px;
  color: var(--me-text-muted);
  margin-bottom: 16px;
}
.sig-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Signature tabs */
.sig-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--me-border);
  padding-bottom: 0;
}
.sig-tab {
  padding: 8px 16px;
  border: none;
  background: none;
  color: var(--me-text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all 0.15s;
}
.sig-tab:hover {
  color: var(--me-text-primary);
}
.sig-tab--active {
  color: var(--me-accent);
  border-bottom-color: var(--me-accent);
}

/* Draw canvas */
.sig-draw-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sig-draw-container {
  border-radius: var(--me-radius-xs);
  border: 1px solid var(--me-border);
  background: var(--me-bg-elevated);
  overflow: hidden;
  cursor: crosshair;
}
.sig-draw-canvas {
  display: block;
  touch-action: none;
}
.sig-draw-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Upload zone */
.sig-upload-section {
  margin-bottom: 12px;
}
.sig-upload-zone {
  border: 2px dashed var(--me-border);
  border-radius: var(--me-radius-xs);
  padding: 30px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
  color: var(--me-text-muted);
}
.sig-upload-zone:hover {
  border-color: var(--me-accent);
  background: var(--me-accent-glow);
}
.sig-upload-zone p {
  font-size: 13px;
  margin-top: 8px;
}
.sig-upload-hint {
  font-size: 11px !important;
  color: var(--me-text-muted);
}

/* Signature image preview (protected) */
.sig-image-preview-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--me-border);
}
.sig-preview-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--me-text-secondary);
  margin-bottom: 10px;
}
.sig-protected {
  position: relative;
  display: inline-block;
  border-radius: var(--me-radius-xs);
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  padding: 12px;
  user-select: none;
  -webkit-user-select: none;
  overflow: hidden;
}
.sig-image-preview {
  max-width: 400px;
  max-height: 150px;
  display: block;
  pointer-events: none;
}
.sig-watermark {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 20px;
  transform: rotate(-25deg);
  pointer-events: none;
  user-select: none;
  opacity: 0.06;
}
.sig-watermark span {
  font-size: 16px;
  font-weight: 900;
  color: var(--me-text-primary);
  letter-spacing: 4px;
  white-space: nowrap;
}
.sig-image-actions {
  margin-top: 10px;
}
.sig-protected-hint {
  font-size: 11px;
  color: var(--me-text-muted);
  margin-top: 6px;
  display: flex;
  align-items: center;
}
</style>
