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

        <!-- Search engines -->
        <div v-if="searchUrl" class="ris-engines">
          <div class="ris-engines-title">{{ t('dossier.reverseImageEngines') }}</div>
          <div class="ris-engine-grid">
            <a v-for="engine in engines" :key="engine.name" :href="engine.url" target="_blank" rel="noopener" class="ris-engine-card">
              <img :src="engine.icon" width="20" height="20" :alt="engine.name" />
              <span class="ris-engine-name">{{ engine.name }}</span>
              <span class="ris-engine-desc">{{ engine.desc }}</span>
            </a>
          </div>
        </div>

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
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const model = defineModel<boolean>({ default: false });

const imageUrl = ref('');
const previewSrc = ref('');
const dragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

// The URL used for search engines (either typed URL or uploaded image's public URL)
const searchUrl = computed(() => {
  if (imageUrl.value.trim().startsWith('http')) return imageUrl.value.trim();
  if (previewSrc.value.startsWith('http')) return previewSrc.value;
  return '';
});

interface SearchEngine { name: string; url: string; icon: string; desc: string }

const engines = computed<SearchEngine[]>(() => {
  const url = searchUrl.value;
  if (!url) return [];
  const enc = encodeURIComponent(url);
  return [
    {
      name: 'Google Lens',
      url: `https://lens.google.com/uploadbyurl?url=${enc}`,
      icon: 'https://www.google.com/favicon.ico',
      desc: t('dossier.reverseEngineGoogleDesc'),
    },
    {
      name: 'Yandex Images',
      url: `https://yandex.com/images/search?rpt=imageview&url=${enc}`,
      icon: 'https://yandex.com/favicon.ico',
      desc: t('dossier.reverseEngineYandexDesc'),
    },
    {
      name: 'Bing Visual',
      url: `https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIIRP&sbisrc=UrlPaste&q=imgurl:${enc}`,
      icon: 'https://www.bing.com/favicon.ico',
      desc: t('dossier.reverseEngineBingDesc'),
    },
    {
      name: 'TinEye',
      url: `https://tineye.com/search?url=${enc}`,
      icon: 'https://tineye.com/favicon.ico',
      desc: t('dossier.reverseEngineTineyeDesc'),
    },
    {
      name: 'PimEyes',
      url: 'https://pimeyes.com/en',
      icon: 'https://pimeyes.com/favicon.ico',
      desc: t('dossier.reverseEnginePimeyesDesc'),
    },
    {
      name: 'FaceCheck.ID',
      url: 'https://facecheck.id',
      icon: 'https://facecheck.id/favicon.ico',
      desc: t('dossier.reverseEngineFacecheckDesc'),
    },
    {
      name: 'Baidu',
      url: `https://graph.baidu.com/details?isfromtus498=1&uptpl=imgup&image=${enc}`,
      icon: 'https://www.baidu.com/favicon.ico',
      desc: t('dossier.reverseEngineBaiduDesc'),
    },
  ];
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
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) loadFile(file);
      return;
    }
  }
  // Check for URL in text
  const text = e.clipboardData?.getData('text/plain');
  if (text?.startsWith('http') && /\.(jpg|jpeg|png|gif|webp)/i.test(text)) {
    imageUrl.value = text;
    previewSrc.value = text;
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
  reader.onload = () => {
    previewSrc.value = reader.result as string;
    // For local files, we can't use reverse search by URL
    // User needs to upload to a public URL first or use engines that support upload
    imageUrl.value = '';
  };
  reader.readAsDataURL(file);
}

function loadFromUrl() {
  const url = imageUrl.value.trim();
  if (url.startsWith('http')) previewSrc.value = url;
}

function clearImage() {
  previewSrc.value = '';
  imageUrl.value = '';
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
