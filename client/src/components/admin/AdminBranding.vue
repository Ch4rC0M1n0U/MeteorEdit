<template>
  <div class="admin-branding">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-palette-outline</v-icon>
        Parametres du site
      </h2>
      <p class="admin-section-subtitle">{{ $t('admin.appearanceCustomization') }}</p>
    </div>

    <div class="branding-grid fade-in fade-in-delay-1">
      <!-- App Name -->
      <div class="branding-card glass-card">
        <h3 class="branding-card-title mono">{{ $t('admin.appName') }}</h3>
        <p class="branding-card-desc">{{ $t('admin.appNameDesc') }}</p>
        <v-text-field
          v-model="form.appName"
          density="compact"
          hide-details
          placeholder="MeteorEdit"
        />
      </div>

      <!-- Accent Color -->
      <div class="branding-card glass-card">
        <h3 class="branding-card-title mono">{{ $t('admin.accentColor') }}</h3>
        <p class="branding-card-desc">{{ $t('admin.accentColorDesc') }}</p>
        <div class="color-picker-row">
          <input type="color" v-model="form.accentColor" class="color-input" />
          <v-text-field
            v-model="form.accentColor"
            density="compact"
            hide-details
            placeholder="#38bdf8"
            class="color-hex-field"
          />
          <div class="color-preview" :style="{ background: form.accentColor }" />
        </div>
      </div>

      <!-- Login Message -->
      <div class="branding-card glass-card">
        <h3 class="branding-card-title mono">{{ $t('admin.loginMessage') }}</h3>
        <p class="branding-card-desc">{{ $t('admin.loginMessageDesc') }}</p>
        <v-text-field
          v-model="form.loginMessage"
          density="compact"
          hide-details
          placeholder="Plateforme d'investigation OSINT"
        />
      </div>

      <!-- Logo Upload -->
      <div class="branding-card glass-card">
        <h3 class="branding-card-title mono">{{ $t('admin.logo') }}</h3>
        <p class="branding-card-desc">{{ $t('admin.logoDesc') }}</p>
        <div class="upload-zone" @dragover.prevent @drop.prevent="dropLogo">
          <div v-if="brandingStore.logoUrl" class="upload-preview">
            <img :src="brandingStore.logoUrl" alt="Logo" class="upload-preview-img" />
            <button class="upload-remove-btn" @click="removeLogo" :title="$t('common.delete')">
              <v-icon size="14">mdi-close</v-icon>
            </button>
          </div>
          <div v-else class="upload-placeholder" @click="triggerLogoInput">
            <v-icon size="28" color="var(--me-text-muted)">mdi-cloud-upload-outline</v-icon>
            <span>{{ $t('admin.dragOrClick') }}</span>
          </div>
          <input ref="logoInput" type="file" accept="image/png,image/jpeg,image/svg+xml" hidden @change="handleLogoSelect" />
        </div>
      </div>

      <!-- Login Background Upload -->
      <div class="branding-card glass-card">
        <h3 class="branding-card-title mono">{{ $t('admin.loginBackground') }}</h3>
        <p class="branding-card-desc">{{ $t('admin.loginBackgroundDesc') }}</p>
        <div class="upload-zone upload-zone-bg" @dragover.prevent @drop.prevent="dropLoginBg">
          <div v-if="brandingStore.loginBackgroundUrl" class="upload-preview">
            <img :src="brandingStore.loginBackgroundUrl" alt="Login Background" class="upload-preview-img upload-preview-bg" />
            <button class="upload-remove-btn" @click="removeLoginBg" :title="$t('common.delete')">
              <v-icon size="14">mdi-close</v-icon>
            </button>
          </div>
          <div v-else class="upload-placeholder" @click="triggerLoginBgInput">
            <v-icon size="28" color="var(--me-text-muted)">mdi-image-outline</v-icon>
            <span>{{ $t('admin.dragOrClick') }}</span>
          </div>
          <input ref="loginBgInput" type="file" accept="image/png,image/jpeg,image/webp" hidden @change="handleLoginBgSelect" />
        </div>
      </div>

      <!-- Favicon Upload -->
      <div class="branding-card glass-card">
        <h3 class="branding-card-title mono">{{ $t('admin.favicon') }}</h3>
        <p class="branding-card-desc">{{ $t('admin.faviconDesc') }}</p>
        <div class="upload-zone" @dragover.prevent @drop.prevent="dropFavicon">
          <div v-if="brandingStore.faviconUrl" class="upload-preview">
            <img :src="brandingStore.faviconUrl" alt="Favicon" class="upload-preview-img upload-preview-favicon" />
            <button class="upload-remove-btn" @click="removeFavicon" :title="$t('common.delete')">
              <v-icon size="14">mdi-close</v-icon>
            </button>
          </div>
          <div v-else class="upload-placeholder" @click="triggerFaviconInput">
            <v-icon size="28" color="var(--me-text-muted)">mdi-emoticon-outline</v-icon>
            <span>{{ $t('admin.dragOrClick') }}</span>
          </div>
          <input ref="faviconInput" type="file" accept="image/png,image/x-icon,image/svg+xml" hidden @change="handleFaviconSelect" />
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="branding-actions fade-in fade-in-delay-2">
      <button class="me-btn-ghost" @click="resetDefaults">
        <v-icon size="14" class="mr-1">mdi-restore</v-icon>
        {{ $t('admin.resetToDefaults') }}
      </button>
      <button class="me-btn-primary" @click="saveSettings" :disabled="saving">
        <v-icon size="14" class="mr-1">mdi-content-save-outline</v-icon>
        {{ saving ? $t('admin.saving') : $t('common.save') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';
import { useBrandingStore } from '../../stores/branding';

const brandingStore = useBrandingStore();
const { t } = useI18n();

const form = reactive({
  appName: '',
  accentColor: '#38bdf8',
  loginMessage: '',
});

const saving = ref(false);
const logoInput = ref<HTMLInputElement | null>(null);
const faviconInput = ref<HTMLInputElement | null>(null);
const loginBgInput = ref<HTMLInputElement | null>(null);

onMounted(() => {
  form.appName = brandingStore.appName;
  form.accentColor = brandingStore.accentColor;
  form.loginMessage = brandingStore.loginMessage;
});

async function saveSettings() {
  saving.value = true;
  try {
    await api.put('/admin/settings', {
      appName: form.appName,
      accentColor: form.accentColor,
      loginMessage: form.loginMessage,
    });
    await brandingStore.fetchBranding();
  } finally {
    saving.value = false;
  }
}

async function resetDefaults() {
  form.appName = 'MeteorEdit';
  form.accentColor = '#38bdf8';
  form.loginMessage = '';
  await saveSettings();
}

function triggerLogoInput() { logoInput.value?.click(); }
function triggerFaviconInput() { faviconInput.value?.click(); }
function triggerLoginBgInput() { loginBgInput.value?.click(); }

const fieldNameMap: Record<string, string> = {
  logo: 'logo',
  favicon: 'favicon',
  'login-background': 'loginBackground',
};

async function uploadFile(file: File, endpoint: string) {
  const fd = new FormData();
  fd.append(fieldNameMap[endpoint] || endpoint, file);
  await api.post(`/admin/settings/${endpoint}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  await brandingStore.fetchBranding();
}

async function handleLogoSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) await uploadFile(file, 'logo');
}

async function handleFaviconSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) await uploadFile(file, 'favicon');
}

async function dropLogo(e: DragEvent) {
  const file = e.dataTransfer?.files[0];
  if (file) await uploadFile(file, 'logo');
}

async function dropFavicon(e: DragEvent) {
  const file = e.dataTransfer?.files[0];
  if (file) await uploadFile(file, 'favicon');
}

async function removeLogo() {
  await api.delete('/admin/settings/logo');
  await brandingStore.fetchBranding();
}

async function removeFavicon() {
  await api.delete('/admin/settings/favicon');
  await brandingStore.fetchBranding();
}

async function handleLoginBgSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) await uploadFile(file, 'login-background');
}

async function dropLoginBg(e: DragEvent) {
  const file = e.dataTransfer?.files[0];
  if (file) await uploadFile(file, 'login-background');
}

async function removeLoginBg() {
  await api.delete('/admin/settings/login-background');
  await brandingStore.fetchBranding();
}
</script>

<style scoped>
.admin-section-header { margin-bottom: 24px; }
.admin-section-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--me-text-primary);
  display: flex;
  align-items: center;
}
.admin-section-subtitle {
  font-size: 13px;
  color: var(--me-text-muted);
  margin-top: 4px;
  font-family: var(--me-font-mono);
}
.branding-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.branding-card { padding: 20px; }
.branding-card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--me-text-primary);
  margin-bottom: 4px;
}
.branding-card-desc {
  font-size: 12px;
  color: var(--me-text-muted);
  margin-bottom: 12px;
}
.color-picker-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.color-input {
  width: 40px;
  height: 40px;
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-xs);
  background: none;
  cursor: pointer;
  padding: 2px;
}
.color-input::-webkit-color-swatch-wrapper { padding: 0; }
.color-input::-webkit-color-swatch { border: none; border-radius: 4px; }
.color-hex-field { max-width: 140px; }
.color-preview {
  width: 40px;
  height: 40px;
  border-radius: var(--me-radius-xs);
  border: 1px solid var(--me-border);
  flex-shrink: 0;
}
.upload-zone {
  border: 2px dashed var(--me-border);
  border-radius: var(--me-radius-sm);
  padding: 16px;
  text-align: center;
  transition: all 0.15s;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.upload-zone:hover {
  border-color: var(--me-accent);
  background: var(--me-accent-glow);
}
.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: var(--me-text-muted);
  font-size: 13px;
}
.upload-preview {
  display: flex;
  align-items: center;
  gap: 12px;
}
.upload-preview-img {
  height: 48px;
  width: auto;
  object-fit: contain;
}
.upload-preview-favicon { height: 32px; }
.upload-zone-bg { min-height: 120px; }
.upload-preview-bg { height: 80px; border-radius: 6px; }
.upload-remove-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid var(--me-border);
  border-radius: 50%;
  color: var(--me-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.upload-remove-btn:hover {
  background: rgba(248, 113, 113, 0.1);
  border-color: var(--me-error);
  color: var(--me-error);
}
.branding-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--me-border);
}
.me-btn-ghost {
  padding: 8px 16px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
}
.me-btn-ghost:hover {
  border-color: var(--me-border-hover);
  color: var(--me-text-primary);
}
.me-btn-primary {
  padding: 8px 16px;
  border-radius: var(--me-radius-xs);
  background: var(--me-accent);
  border: none;
  color: var(--me-bg-deep);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
}
.me-btn-primary:hover {
  box-shadow: 0 0 16px var(--me-accent-glow);
}
.me-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.mr-1 { margin-right: 4px; }
</style>
