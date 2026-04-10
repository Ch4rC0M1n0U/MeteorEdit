<template>
  <div class="lp-split">
    <!-- Left panel: branding showcase -->
    <div class="lp-left" :class="{ 'has-bg-image': brandingStore.loginBackgroundUrl }">
      <img v-if="brandingStore.loginBackgroundUrl" :src="brandingStore.loginBackgroundUrl" alt="" class="lp-left-bg-img" />
      <div class="lp-left-overlay" />
      <div class="lp-left-content">
        <div class="lp-brand">
          <img v-if="brandingStore.logoUrl" :src="brandingStore.logoUrl" :alt="brandingStore.appName" class="lp-brand-logo" />
          <div v-else class="lp-brand-icon">
            <i class="pi pi-shield" style="font-size: 2.4rem; color: white" />
          </div>
          <h1 class="lp-brand-title mono">{{ brandingStore.appName }}</h1>
          <p class="lp-brand-tagline">{{ brandingStore.loginMessage || $t('auth.osintPlatform') }}</p>
        </div>
        <div class="lp-features">
          <div class="lp-feature">
            <i class="pi pi-folder" />
            <span>{{ $t('auth.features.dossierManagement') }}</span>
          </div>
          <div class="lp-feature">
            <i class="pi pi-users" />
            <span>{{ $t('auth.features.realTimeCollab') }}</span>
          </div>
          <div class="lp-feature">
            <i class="pi pi-map-marker" />
            <span>{{ $t('auth.features.mapping') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Right panel: login form -->
    <div class="lp-right">
      <!-- Mobile branding -->
      <div class="lp-mobile-brand">
        <img v-if="brandingStore.logoUrl" :src="brandingStore.logoUrl" :alt="brandingStore.appName" class="lp-mobile-logo" />
        <div v-else class="lp-mobile-icon">
          <i class="pi pi-shield" style="font-size: 1.4rem; color: white" />
        </div>
        <span class="lp-mobile-name mono">{{ brandingStore.appName }}</span>
      </div>

      <div class="lp-right-inner lp-fade-in">
        <div class="lp-form-header">
          <h2 class="lp-form-title">{{ $t('auth.login') }}</h2>
          <p class="lp-form-subtitle">{{ $t('auth.loginSubtitle') }}</p>
        </div>

        <Message v-if="error" severity="error" :closable="true" @close="error = ''" class="lp-alert">
          {{ error }}
        </Message>

        <!-- Remembered user card -->
        <div v-if="rememberedUser && !show2FA" class="lp-remembered">
          <div class="lp-remembered-avatar">
            <img v-if="avatarUrl && !avatarError" :src="avatarUrl" alt="" class="lp-remembered-avatar-img" @error="avatarError = true" />
            <span v-else class="lp-remembered-initials">{{ initials }}</span>
          </div>
          <p class="lp-remembered-welcome">{{ $t('auth.welcomeBack') }}</p>
          <h3 class="lp-remembered-name">{{ rememberedUser.firstName }} {{ rememberedUser.lastName }}</h3>

          <form @submit.prevent="handleLogin" class="lp-remembered-form">
            <div class="lp-field">
              <IconField>
                <InputIcon class="pi pi-lock" />
                <Password
                  v-model="password"
                  :placeholder="$t('auth.passwordPlaceholder')"
                  :feedback="false"
                  toggleMask
                  fluid
                  :disabled="authStore.loading"
                  :pt="{ pcInput: { root: { class: 'lp-input' } } }"
                />
              </IconField>
            </div>
            <Button
              type="submit"
              :label="$t('auth.loginAction')"
              icon="pi pi-sign-in"
              :loading="authStore.loading"
              class="lp-submit-btn"
              fluid
            />
          </form>

          <button class="lp-not-me" @click="clearRememberedUser">
            <i class="pi pi-user-edit" style="font-size: 0.75rem" />
            {{ $t('auth.notMe') }}
          </button>
        </div>

        <!-- Classic login form -->
        <form v-if="!show2FA && !rememberedUser" @submit.prevent="handleLogin">
          <div class="lp-field">
            <label class="lp-field-label">{{ $t('auth.email') }}</label>
            <IconField>
              <InputIcon class="pi pi-envelope" />
              <InputText
                v-model="email"
                type="email"
                :placeholder="$t('auth.emailPlaceholder')"
                :disabled="authStore.loading"
                fluid
                class="lp-input"
              />
            </IconField>
          </div>

          <div class="lp-field">
            <label class="lp-field-label">{{ $t('auth.password') }}</label>
            <IconField>
              <InputIcon class="pi pi-lock" />
              <Password
                v-model="password"
                :placeholder="$t('auth.passwordPlaceholder')"
                :feedback="false"
                toggleMask
                fluid
                :disabled="authStore.loading"
                :pt="{ pcInput: { root: { class: 'lp-input' } } }"
              />
            </IconField>
          </div>

          <div class="lp-remember-row">
            <Checkbox v-model="rememberMe" :binary="true" inputId="rememberMe" />
            <label for="rememberMe" class="lp-remember-label">{{ $t('auth.rememberMe') }}</label>
          </div>

          <Button
            type="submit"
            :label="$t('auth.loginAction')"
            icon="pi pi-sign-in"
            :loading="authStore.loading"
            class="lp-submit-btn"
            fluid
          />
        </form>

        <!-- 2FA section -->
        <div v-if="show2FA" class="lp-tfa">
          <div class="lp-tfa-icon">
            <i class="pi pi-shield" style="font-size: 2rem; color: var(--lp-accent)" />
          </div>
          <p class="lp-tfa-text mono">{{ $t('auth.twoFaPrompt') }}</p>

          <div class="lp-field">
            <IconField>
              <InputIcon class="pi pi-hashtag" />
              <InputText
                v-model="tfaCode"
                :placeholder="$t('auth.twoFaCode')"
                maxlength="8"
                autofocus
                fluid
                class="lp-input"
                @keyup.enter="handle2FA"
              />
            </IconField>
          </div>

          <Button
            :label="$t('auth.verify')"
            icon="pi pi-check-circle"
            :loading="authStore.loading"
            class="lp-submit-btn"
            fluid
            @click="handle2FA"
          />

          <button class="lp-tfa-back" @click="show2FA = false; tempToken = ''">
            <i class="pi pi-arrow-left" style="font-size: 0.75rem" />
            {{ $t('common.back') }}
          </button>
        </div>

        <div v-if="brandingStore.registrationEnabled" class="lp-footer">
          <span class="lp-text-muted">{{ $t('auth.noAccount') }}</span>
          <router-link to="/register" class="lp-link">{{ $t('auth.register') }}</router-link>
        </div>

        <!-- Prototype badge -->
        <div class="lp-prototype-badge">
          <i class="pi pi-sparkles" />
          Prototype PrimeVue 4 / Aura
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import { useBrandingStore } from '../stores/branding';
import { SERVER_URL } from '../services/api';

import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Message from 'primevue/message';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';

interface RememberedUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

const { t } = useI18n();
const authStore = useAuthStore();
const brandingStore = useBrandingStore();
const router = useRouter();

const email = ref('');
const password = ref('');
const error = ref('');
const show2FA = ref(false);
const tempToken = ref('');
const tfaCode = ref('');
const rememberMe = ref(false);
const rememberedUser = ref<RememberedUser | null>(null);
const avatarError = ref(false);

onMounted(() => {
  const stored = localStorage.getItem('rememberedUser');
  if (stored) {
    try {
      rememberedUser.value = JSON.parse(stored);
      email.value = rememberedUser.value!.email;
      rememberMe.value = true;
    } catch {
      localStorage.removeItem('rememberedUser');
    }
  }
});

watch(() => rememberedUser.value, () => { avatarError.value = false; });

const avatarUrl = computed(() => {
  if (!rememberedUser.value) return null;
  return `${SERVER_URL}/api/auth/avatar/${rememberedUser.value.userId}`;
});

const initials = computed(() => {
  if (!rememberedUser.value) return '';
  return ((rememberedUser.value.firstName?.[0] || '') + (rememberedUser.value.lastName?.[0] || '')).toUpperCase();
});

function clearRememberedUser() {
  rememberedUser.value = null;
  email.value = '';
  password.value = '';
  localStorage.removeItem('rememberedUser');
}

function saveRememberedUser() {
  if (rememberMe.value && authStore.user) {
    localStorage.setItem('rememberedUser', JSON.stringify({
      userId: authStore.user.id,
      email: authStore.user.email,
      firstName: authStore.user.firstName,
      lastName: authStore.user.lastName,
    }));
  }
}

async function handleLogin() {
  error.value = '';
  try {
    const result = await authStore.login(email.value, password.value);
    if (result?.requires2FA) {
      tempToken.value = result.tempToken!;
      show2FA.value = true;
      return;
    }
    saveRememberedUser();
    router.push('/');
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    error.value = err.response?.data?.message || t('auth.loginError');
  }
}

async function handle2FA() {
  error.value = '';
  try {
    await authStore.validate2FA(tempToken.value, tfaCode.value);
    saveRememberedUser();
    router.push('/');
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    error.value = err.response?.data?.message || t('auth.invalidCode');
  }
}
</script>

<style scoped>
/* ─── Design tokens ─── */
:root {
  --lp-accent: #3b82f6;
  --lp-accent-hover: #2563eb;
  --lp-accent-glow: rgba(59, 130, 246, 0.15);
  --lp-bg-deep: #0a0e1a;
  --lp-bg-surface: #111827;
  --lp-bg-card: rgba(255, 255, 255, 0.04);
  --lp-text-primary: #f1f5f9;
  --lp-text-secondary: #94a3b8;
  --lp-text-muted: #64748b;
  --lp-border: rgba(255, 255, 255, 0.08);
  --lp-radius: 12px;
  --lp-font-mono: 'JetBrains Mono', monospace;
}

/* ─── Layout ─── */
.lp-split {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--lp-bg-deep);
  color: var(--lp-text-primary);
}

/* ─── Left panel ─── */
.lp-left {
  position: relative;
  flex: 0 0 45%;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, transparent 60%),
    linear-gradient(225deg, rgba(59, 130, 246, 0.05) 0%, transparent 50%),
    var(--lp-bg-deep);
  overflow: hidden;
  border-right: 1px solid var(--lp-border);
}

.lp-left-bg-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}

.lp-left.has-bg-image .lp-left-overlay {
  background: rgba(0, 0, 0, 0.55);
}

.lp-left-overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 30% 70%, var(--lp-accent-glow) 0%, transparent 50%),
    radial-gradient(circle at 70% 30%, var(--lp-accent-glow) 0%, transparent 50%);
  pointer-events: none;
  z-index: 1;
}

.lp-left::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.03) 1px, transparent 0);
  background-size: 32px 32px;
  pointer-events: none;
}

.lp-left.has-bg-image::before {
  display: none;
}

.lp-left-content {
  position: relative;
  z-index: 2;
  text-align: center;
  padding: 40px;
  max-width: 400px;
}

.lp-brand-logo {
  height: 72px;
  width: auto;
  object-fit: contain;
  margin-bottom: 20px;
  filter: drop-shadow(0 4px 24px rgba(0, 0, 0, 0.3));
}

.lp-brand-icon {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: linear-gradient(135deg, var(--lp-accent), rgba(99, 102, 241, 0.8));
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  box-shadow: 0 8px 32px rgba(59, 130, 246, 0.3);
}

.lp-brand-title {
  font-size: 32px;
  font-weight: 800;
  color: var(--lp-text-primary);
  letter-spacing: -0.5px;
  margin-bottom: 8px;
}

.lp-brand-tagline {
  font-size: 13px;
  color: var(--lp-text-muted);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  font-family: var(--lp-font-mono);
  line-height: 1.6;
}

.lp-features {
  margin-top: 48px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
}

.lp-feature {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--lp-text-secondary);
  font-size: 13px;
  padding: 12px 16px;
  border-radius: var(--lp-radius);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(8px);
  transition: all 0.25s ease;
}

.lp-feature:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(59, 130, 246, 0.2);
  transform: translateX(4px);
}

.lp-feature .pi {
  color: var(--lp-accent);
  font-size: 1rem;
  flex-shrink: 0;
}

/* ─── Right panel ─── */
.lp-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 40px;
  background: var(--lp-bg-surface);
}

.lp-right-inner {
  width: 100%;
  max-width: 400px;
}

.lp-form-header {
  margin-bottom: 32px;
}

.lp-form-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--lp-text-primary);
  margin-bottom: 6px;
}

.lp-form-subtitle {
  font-size: 14px;
  color: var(--lp-text-muted);
}

/* ─── Alert ─── */
.lp-alert {
  margin-bottom: 20px;
}

/* ─── Fields ─── */
.lp-field {
  margin-bottom: 18px;
}

.lp-field-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--lp-text-secondary);
  margin-bottom: 6px;
}

/* Override PrimeVue input styles for dark theme */
:deep(.lp-input),
:deep(.p-inputtext) {
  background: var(--lp-bg-card) !important;
  border-color: var(--lp-border) !important;
  color: var(--lp-text-primary) !important;
  border-radius: 10px !important;
  height: 44px;
  font-size: 14px;
}

:deep(.p-inputtext:focus),
:deep(.p-inputtext.p-focus) {
  border-color: var(--lp-accent) !important;
  box-shadow: 0 0 0 2px var(--lp-accent-glow) !important;
}

:deep(.p-inputtext::placeholder) {
  color: var(--lp-text-muted) !important;
}

:deep(.p-password-panel) {
  display: none !important;
}

:deep(.p-icon-field) {
  width: 100%;
}

:deep(.p-input-icon) {
  color: var(--lp-text-muted) !important;
}

:deep(.p-password) {
  width: 100%;
}

:deep(.p-password .p-password-toggle-button) {
  color: var(--lp-text-muted) !important;
}

:deep(.p-password .p-password-toggle-button:hover) {
  color: var(--lp-accent) !important;
  background: transparent !important;
}

/* ─── Checkbox ─── */
:deep(.p-checkbox .p-checkbox-box) {
  background: var(--lp-bg-card) !important;
  border-color: var(--lp-border) !important;
  border-radius: 5px;
  width: 18px;
  height: 18px;
}

:deep(.p-checkbox.p-highlight .p-checkbox-box) {
  background: var(--lp-accent) !important;
  border-color: var(--lp-accent) !important;
}

.lp-remember-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 22px;
}

.lp-remember-label {
  font-size: 13px;
  color: var(--lp-text-secondary);
  cursor: pointer;
}

/* ─── Submit button ─── */
.lp-submit-btn {
  height: 48px !important;
  border-radius: 10px !important;
  font-weight: 600 !important;
  font-size: 15px !important;
  letter-spacing: 0.3px !important;
  background: linear-gradient(135deg, var(--lp-accent), #6366f1) !important;
  border: none !important;
  transition: all 0.3s ease !important;
}

.lp-submit-btn:hover {
  background: linear-gradient(135deg, var(--lp-accent-hover), #4f46e5) !important;
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3) !important;
  transform: translateY(-1px);
}

.lp-submit-btn:active {
  transform: translateY(0);
}

/* ─── Remembered user ─── */
.lp-remembered {
  text-align: center;
  padding: 32px 24px;
  border-radius: 16px;
  background: var(--lp-bg-card);
  border: 1px solid var(--lp-border);
  backdrop-filter: blur(12px);
  margin-bottom: 16px;
}

.lp-remembered-avatar {
  width: 80px;
  height: 80px;
  border-radius: 16px;
  margin: 0 auto 16px;
  overflow: hidden;
  background: var(--lp-bg-surface);
  border: 2px solid rgba(59, 130, 246, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.lp-remembered-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lp-remembered-initials {
  font-size: 28px;
  font-weight: 700;
  color: var(--lp-accent);
  font-family: var(--lp-font-mono);
}

.lp-remembered-welcome {
  font-size: 13px;
  color: var(--lp-text-muted);
  margin-bottom: 2px;
}

.lp-remembered-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--lp-text-primary);
  margin-bottom: 20px;
}

.lp-remembered-form {
  text-align: left;
}

.lp-not-me {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  background: none;
  border: none;
  color: var(--lp-text-muted);
  cursor: pointer;
  font-size: 13px;
  transition: color 0.2s;
}

.lp-not-me:hover {
  color: var(--lp-accent);
}

/* ─── 2FA ─── */
.lp-tfa {
  margin-top: 8px;
}

.lp-tfa-icon {
  text-align: center;
  margin-bottom: 16px;
}

.lp-tfa-text {
  font-size: 13px;
  color: var(--lp-text-secondary);
  margin-bottom: 16px;
  text-align: center;
  line-height: 1.5;
}

.lp-tfa-back {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  margin-top: 12px;
  background: none;
  border: none;
  color: var(--lp-text-muted);
  cursor: pointer;
  font-size: 13px;
  transition: color 0.2s;
}

.lp-tfa-back:hover {
  color: var(--lp-text-primary);
}

/* ─── Footer ─── */
.lp-footer {
  text-align: center;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--lp-border);
  font-size: 14px;
}

.lp-text-muted {
  color: var(--lp-text-muted);
}

.lp-link {
  color: var(--lp-accent);
  text-decoration: none;
  margin-left: 6px;
  font-weight: 600;
  transition: color 0.2s;
}

.lp-link:hover {
  text-decoration: underline;
}

/* ─── Mobile brand ─── */
.lp-mobile-brand {
  display: none;
  align-items: center;
  gap: 10px;
  margin-bottom: 32px;
}

.lp-mobile-logo {
  height: 36px;
  width: auto;
  object-fit: contain;
}

.lp-mobile-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--lp-accent), rgba(99, 102, 241, 0.8));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.lp-mobile-name {
  font-size: 20px;
  font-weight: 800;
  color: var(--lp-text-primary);
}

/* ─── Prototype badge ─── */
.lp-prototype-badge {
  position: fixed;
  bottom: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 24px;
  color: #a5b4fc;
  font-size: 12px;
  font-family: var(--lp-font-mono);
  backdrop-filter: blur(8px);
  z-index: 100;
}

/* ─── Animation ─── */
.lp-fade-in {
  animation: lpFadeIn 0.5s ease-out;
}

@keyframes lpFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ─── Message override ─── */
:deep(.p-message) {
  border-radius: 10px !important;
}

/* ─── Responsive ─── */
@media (max-width: 900px) {
  .lp-left {
    display: none;
  }

  .lp-right {
    padding: 24px;
    justify-content: center;
  }

  .lp-mobile-brand {
    display: flex;
  }

  .lp-form-header {
    text-align: center;
  }
}

@media (max-width: 480px) {
  .lp-right {
    padding: 16px;
  }

  .lp-right-inner {
    max-width: 100%;
  }
}
</style>
