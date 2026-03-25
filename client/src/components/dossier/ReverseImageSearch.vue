<template>
  <v-dialog v-model="model" max-width="560" persistent>
    <div class="ris-dialog glass-card">
      <div class="ris-header">
        <v-icon size="20" class="ris-header-icon">mdi-image-search-outline</v-icon>
        <span class="mono">{{ t('dossier.reverseImageTitle') }}</span>
        <button class="ris-close" @click="model = false">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>

      <div class="ris-body">
        <!-- Image input: URL, paste or upload -->
        <div class="ris-input-section">
          <!-- Drop zone / preview -->
          <div
            class="ris-dropzone"
            :class="{ 'ris-dropzone--active': dragging, 'ris-dropzone--has-image': previewSrc }"
            @dragover.prevent="dragging = true"
            @dragleave="dragging = false"
            @drop.prevent="onDrop"
            @paste="onPaste"
            @click="triggerFileInput"
            tabindex="0"
          >
            <img v-if="previewSrc" :src="previewSrc" class="ris-preview" />
            <div v-else class="ris-dropzone-text">
              <v-icon size="32" color="var(--me-text-muted)">mdi-image-plus-outline</v-icon>
              <span>{{ t('dossier.reverseImageDrop') }}</span>
              <span class="ris-dropzone-hint">{{ t('dossier.reverseImageDropHint') }}</span>
            </div>
          </div>
          <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFileSelect" />

          <!-- URL input -->
          <div class="ris-url-row">
            <input
              v-model="imageUrl"
              class="ris-url-input"
              :placeholder="t('dossier.reverseImageUrlPlaceholder')"
              @keyup.enter="loadFromUrl"
              @paste="onUrlPaste"
            />
            <button class="ris-url-btn" @click="loadFromUrl" :disabled="!imageUrl.trim()">
              <v-icon size="14">mdi-arrow-right</v-icon>
            </button>
          </div>

          <button v-if="previewSrc" class="ris-clear-btn" @click="clearImage">
            <v-icon size="14">mdi-close</v-icon> {{ t('dossier.reverseImageClear') }}
          </button>
        </div>

        <!-- Uploading indicator -->
        <div v-if="uploading" class="ris-uploading">
          <v-icon size="14" class="me-spin">mdi-loading</v-icon>
          {{ t('dossier.reverseImageUploading') }}
        </div>

        <!-- Search engines -->
        <div v-if="previewSrc" class="ris-engines">
          <div class="ris-engines-title">{{ t('dossier.reverseImageEngines') }}</div>
          <div v-if="isPublicUrl" class="ris-mode-hint ris-mode-direct">
            <v-icon size="14">mdi-link-variant</v-icon>
            {{ t('dossier.reverseImageDirectMode') }}
          </div>
          <div v-else class="ris-mode-hint ris-mode-clipboard">
            <v-icon size="14">mdi-content-paste</v-icon>
            {{ t('dossier.reverseImageClipboardMode') }}
          </div>
          <div class="ris-engine-grid">
            <button
              v-for="engine in engines"
              :key="engine.name"
              class="ris-engine-card"
              @click="openEngine(engine)"
            >
              <img :src="engine.icon" width="20" height="20" :alt="engine.name" />
              <span class="ris-engine-name">{{ engine.name }}</span>
              <span class="ris-engine-desc">{{ engine.desc }}</span>
            </button>
          </div>
        </div>

        <!-- Toast -->
        <v-snackbar v-model="toastVisible" :timeout="3000" color="success" location="bottom right">
          {{ t('dossier.reverseImageCopied') }}
        </v-snackbar>

        <!-- Tips -->
        <div class="ris-tips">
          <div class="ris-tips-title">
            <v-icon size="14">mdi-lightbulb-outline</v-icon>
            {{ t('dossier.dorkTips') }}
          </div>
          <ul class="ris-tips-list">
            <li>{{ t('dossier.dorkTipImage1') }}</li>
            <li>{{ t('dossier.dorkTipImage2') }}</li>
            <li>{{ t('dossier.dorkTipImage3') }}</li>
            <li>{{ t('dossier.dorkTipImage4') }}</li>
          </ul>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const model = defineModel<boolean>({ default: false });

const imageUrl = ref('');
const previewSrc = ref('');
const dragging = ref(false);
const uploading = ref(false);
const toastVisible = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
// Track if we have a public URL (externally accessible) vs local blob
const isPublicUrl = computed(() => {
  const url = imageUrl.value.trim();
  // A URL is "public" if it's not a local/private IP
  if (!url.startsWith('http')) return false;
  try {
    const host = new URL(url).hostname;
    // Private/local IPs
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(host)) return false;
    if (host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('172.')) return false;
    if (host.startsWith('100.64.') || host.startsWith('100.65.')) return false; // Tailscale
    return true;
  } catch { return false; }
});

// Public URL for direct engine links
const searchUrl = computed(() => {
  if (isPublicUrl.value) return imageUrl.value.trim();
  return '';
});

interface SearchEngine { name: string; directUrl: string; uploadUrl: string; icon: string; desc: string }

const engines = computed<SearchEngine[]>(() => {
  const url = searchUrl.value;
  const enc = url ? encodeURIComponent(url) : '';
  return [
    {
      name: 'Google Lens',
      directUrl: enc ? `https://lens.google.com/uploadbyurl?url=${enc}` : '',
      uploadUrl: 'https://lens.google.com/',
      icon: 'https://www.google.com/favicon.ico',
      desc: t('dossier.reverseEngineGoogleDesc'),
    },
    {
      name: 'Yandex Images',
      directUrl: enc ? `https://yandex.com/images/search?rpt=imageview&url=${enc}` : '',
      uploadUrl: 'https://yandex.com/images/',
      icon: 'https://yandex.com/favicon.ico',
      desc: t('dossier.reverseEngineYandexDesc'),
    },
    {
      name: 'Bing Visual',
      directUrl: enc ? `https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIIRP&sbisrc=UrlPaste&q=imgurl:${enc}` : '',
      uploadUrl: 'https://www.bing.com/visualsearch',
      icon: 'https://www.bing.com/favicon.ico',
      desc: t('dossier.reverseEngineBingDesc'),
    },
    {
      name: 'TinEye',
      directUrl: enc ? `https://tineye.com/search?url=${enc}` : '',
      uploadUrl: 'https://tineye.com/',
      icon: 'https://tineye.com/favicon.ico',
      desc: t('dossier.reverseEngineTineyeDesc'),
    },
    {
      name: 'PimEyes',
      directUrl: '',
      uploadUrl: 'https://pimeyes.com/en',
      icon: 'https://pimeyes.com/favicon.ico',
      desc: t('dossier.reverseEnginePimeyesDesc'),
    },
    {
      name: 'FaceCheck.ID',
      directUrl: '',
      uploadUrl: 'https://facecheck.id',
      icon: 'https://facecheck.id/favicon.ico',
      desc: t('dossier.reverseEngineFacecheckDesc'),
    },
    {
      name: 'Baidu',
      directUrl: enc ? `https://graph.baidu.com/details?isfromtus498=1&uptpl=imgup&image=${enc}` : '',
      uploadUrl: 'https://graph.baidu.com/pcpage/index?tpl_from=pc',
      icon: 'https://www.baidu.com/favicon.ico',
      desc: t('dossier.reverseEngineBaiduDesc'),
    },
  ];
});

/**
 * Open a search engine. For public URLs, use direct link.
 * For local images, copy image to clipboard first, then open upload page.
 */
async function openEngine(engine: SearchEngine) {
  if (isPublicUrl.value && engine.directUrl) {
    // Public URL: direct link works
    window.open(engine.directUrl, '_blank');
    return;
  }

  // Local image: copy to clipboard, then open engine's upload page
  try {
    const src = previewSrc.value;
    if (src) {
      // Convert to PNG blob for clipboard
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = src;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png');
      });
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      toastVisible.value = true;
    }
  } catch (err) {
    console.warn('Could not copy image to clipboard:', err);
  }

  // Open engine's upload page
  window.open(engine.uploadUrl, '_blank');
}

// Listen for paste globally when dialog is open
function globalPaste(e: ClipboardEvent) {
  if (!model.value) return;
  onPaste(e);
}

watch(model, (open) => {
  if (open) {
    document.addEventListener('paste', globalPaste);
  } else {
    document.removeEventListener('paste', globalPaste);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('paste', globalPaste);
});

function triggerFileInput() {
  if (!previewSrc.value) fileInput.value?.click();
}

function onFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) loadFile(file);
}

function onDrop(e: DragEvent) {
  dragging.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file?.type.startsWith('image/')) loadFile(file);
  // Check for URL drop
  const text = e.dataTransfer?.getData('text/plain');
  if (text?.startsWith('http')) {
    imageUrl.value = text;
    previewSrc.value = text;
  }
}

function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items;
  if (!items) return;
  // Check for image blob first (copy image from browser, screenshot, etc.)
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) loadFile(file);
      return;
    }
  }
  // Check for URL in text (any image URL, with or without extension)
  const text = e.clipboardData?.getData('text/plain');
  if (text?.trim().startsWith('http')) {
    e.preventDefault();
    imageUrl.value = text.trim();
    previewSrc.value = text.trim();
  }
}

function onUrlPaste(e: ClipboardEvent) {
  setTimeout(() => {
    const val = imageUrl.value.trim();
    if (val.startsWith('http')) previewSrc.value = val;
  }, 50);
}

function loadFile(file: File) {
  const reader = new FileReader();
  reader.onload = () => { previewSrc.value = reader.result as string; };
  reader.readAsDataURL(file);
  imageUrl.value = '';
}

function loadFromUrl() {
  const url = imageUrl.value.trim();
  if (url.startsWith('http')) previewSrc.value = url;
}

function clearImage() {
  previewSrc.value = '';
  imageUrl.value = '';
  uploadedPublicUrl.value = '';
  if (fileInput.value) fileInput.value.value = '';
}
</script>

<style scoped>
.ris-dialog { padding: 0; border-radius: 12px; overflow: hidden; background: var(--me-bg-surface); border: 1px solid var(--me-border); }
.ris-header { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--me-border); font-size: 14px; font-weight: 600; color: var(--me-text-primary); }
.ris-header-icon { color: var(--me-accent); }
.ris-close { margin-left: auto; background: none; border: none; color: var(--me-text-muted); cursor: pointer; padding: 4px; border-radius: 6px; display: flex; }
.ris-close:hover { color: var(--me-text-primary); }
.ris-body { padding: 16px 18px; max-height: 520px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }

/* Dropzone */
.ris-dropzone { display: flex; align-items: center; justify-content: center; min-height: 140px; border: 2px dashed var(--me-border); border-radius: 8px; cursor: pointer; transition: all 0.15s; position: relative; overflow: hidden; outline: none; }
.ris-dropzone:hover, .ris-dropzone:focus { border-color: var(--me-accent); }
.ris-dropzone--active { border-color: var(--me-accent); background: rgba(var(--me-accent-rgb, 59, 130, 246), 0.06); }
.ris-dropzone--has-image { border-style: solid; cursor: default; }
.ris-dropzone-text { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 20px; text-align: center; }
.ris-dropzone-text span { font-size: 13px; color: var(--me-text-muted); }
.ris-dropzone-hint { font-size: 11px !important; }
.ris-preview { max-width: 100%; max-height: 200px; object-fit: contain; border-radius: 4px; }

/* URL input */
.ris-url-row { display: flex; gap: 6px; }
.ris-url-input { flex: 1; padding: 7px 10px; border-radius: 6px; border: 1px solid var(--me-border); background: var(--me-bg-deep); color: var(--me-text-primary); font-size: 12px; font-family: var(--me-font-mono); outline: none; }
.ris-url-input:focus { border-color: var(--me-accent); }
.ris-url-btn { padding: 6px 12px; border-radius: 6px; border: 1px solid var(--me-border); background: var(--me-bg-deep); color: var(--me-text-secondary); cursor: pointer; display: flex; align-items: center; }
.ris-url-btn:hover:not(:disabled) { border-color: var(--me-accent); color: var(--me-accent); }
.ris-url-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ris-clear-btn { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--me-text-muted); background: none; border: none; cursor: pointer; padding: 0; align-self: flex-start; }
.ris-clear-btn:hover { color: var(--me-accent); }

/* Uploading */
.ris-uploading { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--me-accent); padding: 8px 10px; border-radius: 6px; background: rgba(var(--me-accent-rgb, 59, 130, 246), 0.06); }

/* Mode hints */
.ris-mode-hint { display: flex; align-items: center; gap: 6px; font-size: 11px; padding: 6px 10px; border-radius: 6px; margin-bottom: 8px; }
.ris-mode-direct { color: #4caf50; background: rgba(76, 175, 80, 0.08); border: 1px solid rgba(76, 175, 80, 0.2); }
.ris-mode-clipboard { color: var(--me-accent); background: rgba(var(--me-accent-rgb, 59, 130, 246), 0.06); border: 1px solid rgba(var(--me-accent-rgb, 59, 130, 246), 0.2); }

/* Engines */
.ris-engines-title { font-size: 12px; font-weight: 600; color: var(--me-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
.ris-engine-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.ris-engine-card { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 8px; border-radius: 8px; border: 1px solid var(--me-border); background: var(--me-bg-deep); text-decoration: none; transition: all 0.15s; text-align: center; }
.ris-engine-card:hover { border-color: var(--me-accent); background: rgba(var(--me-accent-rgb, 59, 130, 246), 0.06); }
.ris-engine-card img { border-radius: 4px; }
.ris-engine-name { font-size: 12px; font-weight: 600; color: var(--me-text-primary); }
.ris-engine-desc { font-size: 10px; color: var(--me-text-muted); line-height: 1.3; }

/* Tips */
.ris-tips { padding: 10px 12px; border-radius: 6px; border: 1px solid rgba(var(--me-accent-rgb, 59, 130, 246), 0.2); background: rgba(var(--me-accent-rgb, 59, 130, 246), 0.05); }
.ris-tips-title { font-size: 12px; font-weight: 600; color: var(--me-accent); display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
.ris-tips-list { margin: 0; padding-left: 16px; font-size: 11px; color: var(--me-text-secondary); line-height: 1.6; }
</style>
