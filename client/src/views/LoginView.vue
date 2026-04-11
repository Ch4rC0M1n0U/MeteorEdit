<template>
  <div class="login-split">
    <!-- Left panel: branding showcase -->
    <div class="login-left" :class="{ 'has-bg-image': brandingStore.loginBackgroundUrl }">
      <img v-if="brandingStore.loginBackgroundUrl" :src="brandingStore.loginBackgroundUrl" alt="" class="login-left-bg-img" />
      <div class="login-left-overlay" />
      <div class="login-left-content">
        <div class="login-brand">
          <img v-if="brandingStore.logoUrl" :src="brandingStore.logoUrl" :alt="brandingStore.appName" class="login-brand-logo" />
          <img v-else :src="themeStore.isDark ? '/logo-me-red.png' : '/logo-me-blue.png'" alt="MeteorEdit" class="login-brand-logo" />
          <h1 class="login-brand-title mono">{{ brandingStore.appName }}</h1>
          <p class="login-brand-tagline">{{ brandingStore.loginMessage || $t('auth.osintPlatform') }}</p>
        </div>
        <div class="login-left-features">
          <div class="login-feature">
            <i class="pi pi-folder-open login-feature-icon" />
            <span>{{ $t('auth.features.dossierManagement') }}</span>
          </div>
          <div class="login-feature">
            <i class="pi pi-users login-feature-icon" />
            <span>{{ $t('auth.features.realTimeCollab') }}</span>
          </div>
          <div class="login-feature">
            <i class="pi pi-map-marker login-feature-icon" />
            <span>{{ $t('auth.features.mapping') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Right panel: login form -->
    <div class="login-right">
      <!-- Mobile branding (shown only on small screens) -->
      <div class="login-mobile-brand">
        <img v-if="brandingStore.logoUrl" :src="brandingStore.logoUrl" :alt="brandingStore.appName" class="login-mobile-logo" />
        <img v-else :src="themeStore.isDark ? '/logo-me-red.png' : '/logo-me-blue.png'" alt="MeteorEdit" class="login-mobile-logo" />
        <span class="login-mobile-name mono">{{ brandingStore.appName }}</span>
      </div>

      <div class="login-right-inner fade-in">
        <div class="login-form-header">
          <h2 class="login-form-title">{{ $t('auth.login') }}</h2>
          <p class="login-form-subtitle">{{ $t('auth.loginSubtitle') }}</p>
        </div>

        <Message v-if="error" severity="error" :closable="true" @close="error = ''" class="login-message">
          {{ error }}
        </Message>

        <!-- Remembered user card -->
        <div v-if="rememberedUser && !show2FA" class="remembered-card glass-card">
          <div class="remembered-avatar">
            <img v-if="avatarUrl && !avatarError" :src="avatarUrl" alt="" class="remembered-avatar-img" @error="avatarError = true" />
            <span v-else class="remembered-initials">{{ initials }}</span>
          </div>
          <p class="remembered-welcome">{{ $t('auth.welcomeBack') }}</p>
          <h3 class="remembered-name">{{ rememberedUser.firstName }} {{ rememberedUser.lastName }}</h3>

          <form @submit.prevent="handleLogin" class="remembered-form">
            <Password
              v-model="password"
              :placeholder="$t('auth.passwordPlaceholder')"
              :feedback="false"
              toggleMask
              :disabled="authStore.loading"
              inputClass="login-input"
              class="login-password-field"
              :pt="{ root: { style: 'width: 100%' }, pcInput: { style: 'width: 100%' } }"
              autofocus
            />
            <Button
              type="submit"
              :label="$t('auth.loginAction')"
              icon="pi pi-sign-in"
              :loading="authStore.loading"
              class="login-submit-btn"
            />
          </form>

          <button class="remembered-not-me" @click="clearRememberedUser">
            <i class="pi pi-user-edit" style="font-size: 12px" />
            {{ $t('auth.notMe') }}
          </button>
        </div>

        <!-- Classic login form -->
        <form v-if="!show2FA && !rememberedUser" @submit.prevent="handleLogin">
          <label class="login-field-label">{{ $t('auth.email') }}</label>
          <IconField class="login-iconfield">
            <InputIcon class="pi pi-envelope" />
            <InputText
              v-model="email"
              type="email"
              :placeholder="$t('auth.emailPlaceholder')"
              :disabled="authStore.loading"
              class="login-input"
              required
            />
          </IconField>

          <label class="login-field-label">{{ $t('auth.password') }}</label>
          <Password
            v-model="password"
            :placeholder="$t('auth.passwordPlaceholder')"
            :feedback="false"
            toggleMask
            :disabled="authStore.loading"
            inputClass="login-input"
            class="login-password-field"
            :pt="{ root: { style: 'width: 100%' }, pcInput: { style: 'width: 100%' } }"
          />

          <div class="remember-me-row">
            <div class="remember-me-inner">
              <Checkbox v-model="rememberMe" :binary="true" inputId="rememberMe" />
              <label for="rememberMe" class="remember-me-label">{{ $t('auth.rememberMe') }}</label>
            </div>
          </div>

          <Button
            type="submit"
            :label="$t('auth.loginAction')"
            icon="pi pi-sign-in"
            :loading="authStore.loading"
            class="login-submit-btn"
          />
        </form>

        <!-- 2FA section -->
        <div v-if="show2FA" class="tfa-login-section">
          <div class="tfa-icon-wrap">
            <i class="pi pi-shield tfa-icon" />
          </div>
          <p class="tfa-login-text mono">{{ $t('auth.twoFaPrompt') }}</p>

          <IconField class="login-iconfield">
            <InputIcon class="pi pi-key" />
            <InputText
              v-model="tfaCode"
              :placeholder="$t('auth.twoFaCode')"
              maxlength="8"
              :disabled="authStore.loading"
              class="login-input"
              autofocus
              @keyup.enter="handle2FA"
            />
          </IconField>

          <Button
            type="button"
            :label="$t('auth.verify')"
            icon="pi pi-check-circle"
            :loading="authStore.loading"
            class="login-submit-btn"
            @click="handle2FA"
          />
          <button class="tfa-back-btn" @click="show2FA = false; tempToken = ''">
            <i class="pi pi-arrow-left" style="font-size: 12px" />
            {{ $t('common.back') }}
          </button>
        </div>

        <div v-if="brandingStore.registrationEnabled" class="login-footer">
          <span class="text-muted">{{ $t('auth.noAccount') }}</span>
          <router-link to="/register" class="login-link">{{ $t('auth.register') }}</router-link>
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
import { useThemeStore } from '../stores/theme';
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
const themeStore = useThemeStore();
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
  } catch (e: any) {
    error.value = e.response?.data?.message || t('auth.loginError');
  }
}

async function handle2FA() {
  error.value = '';
  try {
    await authStore.validate2FA(tempToken.value, tfaCode.value);
    saveRememberedUser();
    router.push('/');
  } catch (e: any) {
    error.value = e.response?.data?.message || t('auth.invalidCode');
  }
}
</script>

<style scoped>
/* ─── Layout ─── */
.login-split {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--me-bg-deep);
}

/* ─── Left panel ─── */
.login-left {
  position: relative;
  flex: 0 0 44%;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    linear-gradient(135deg, rgba(99, 145, 214, 0.14) 0%, transparent 60%),
    linear-gradient(225deg, rgba(129, 178, 154, 0.08) 0%, transparent 50%),
    var(--me-bg-deep);
  overflow: hidden;
  border-right: 1px solid var(--me-border);
}

.login-left-bg-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}

.login-left.has-bg-image .login-left-overlay {
  background: rgba(0, 0, 0, 0.7);
}

.login-left.has-bg-image::before {
  display: none;
}

.login-left-overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 30% 70%, rgba(99, 145, 214, 0.12) 0%, transparent 50%),
    radial-gradient(circle at 70% 30%, rgba(224, 175, 104, 0.08) 0%, transparent 50%);
  pointer-events: none;
  z-index: 1;
}

.login-left::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.03) 1px, transparent 0);
  background-size: 32px 32px;
  pointer-events: none;
}

.login-left-content {
  position: relative;
  z-index: 2;
  text-align: center;
  padding: 40px;
  max-width: 400px;
}

.login-brand-logo {
  height: 72px;
  width: auto;
  object-fit: contain;
  margin-bottom: 20px;
  filter: drop-shadow(0 4px 24px rgba(0, 0, 0, 0.3));
}

.login-brand-title {
  font-size: 32px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.5px;
  margin-bottom: 8px;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
}

.login-brand-tagline {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  font-family: var(--me-font-mono);
  line-height: 1.6;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.4);
}

.login-left-features {
  margin-top: 48px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
}

.login-feature {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  padding: 10px 16px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  transition: all 0.2s ease;
}

.login-feature:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(99, 145, 214, 0.25);
}

.login-feature-icon {
  color: #6391d6;
  font-size: 16px;
  flex-shrink: 0;
}

/* ─── Right panel ─── */
.login-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 40px;
}

.login-right-inner {
  width: 100%;
  max-width: 400px;
}

.login-form-header {
  margin-bottom: 32px;
}

.login-form-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--me-text-primary);
  margin-bottom: 6px;
}

.login-form-subtitle {
  font-size: 14px;
  color: var(--me-text-muted);
}

/* ─── Form fields ─── */
.login-field-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-secondary);
  margin-bottom: 6px;
}

.login-iconfield {
  width: 100%;
  margin-bottom: 16px;
}

.login-iconfield :deep(.p-inputtext) {
  width: 100%;
  border-radius: 8px;
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  color: var(--me-text-primary);
  font-family: var(--me-font-body);
  font-size: 14px;
  padding: 12px 12px 12px 40px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.login-iconfield :deep(.p-inputtext:focus) {
  border-color: #6391d6;
  box-shadow: 0 0 0 3px rgba(99, 145, 214, 0.15);
  outline: none;
}

.login-iconfield :deep(.p-inputtext::placeholder) {
  color: var(--me-text-muted);
}

.login-iconfield :deep(.p-inputicon) {
  color: var(--me-text-muted);
}

/* Password field */
.login-password-field {
  width: 100%;
  margin-bottom: 16px;
}

.login-password-field :deep(.p-password) {
  width: 100%;
}

.login-password-field :deep(.p-inputtext),
:deep(.login-input) {
  width: 100%;
  border-radius: 8px;
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  color: var(--me-text-primary);
  font-family: var(--me-font-body);
  font-size: 14px;
  padding: 12px 40px 12px 14px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.login-password-field :deep(.p-inputtext:focus),
:deep(.login-input:focus) {
  border-color: #6391d6;
  box-shadow: 0 0 0 3px rgba(99, 145, 214, 0.15);
  outline: none;
}

.login-password-field :deep(.p-inputtext::placeholder),
:deep(.login-input::placeholder) {
  color: var(--me-text-muted);
}

.login-password-field :deep(.p-password-toggle-mask-icon) {
  color: var(--me-text-muted);
  right: 12px;
}

/* ─── Submit button ─── */
.login-submit-btn {
  width: 100%;
  height: 48px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 15px;
  letter-spacing: 0.3px;
  background: #6391d6;
  border: none;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 4px;
}

.login-submit-btn:hover:not(:disabled) {
  background: #5580c4;
  box-shadow: 0 0 20px rgba(99, 145, 214, 0.25), 0 4px 12px rgba(0, 0, 0, 0.2);
  transform: translateY(-1px);
}

.login-submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.login-submit-btn :deep(.p-button-icon) {
  font-size: 14px;
}

/* ─── Message / Alert ─── */
.login-message {
  margin-bottom: 20px;
  border-radius: 10px;
}

.login-message :deep(.p-message-content) {
  font-size: 14px;
}

/* ─── Remember me ─── */
.remember-me-row {
  margin-bottom: 20px;
  margin-top: -4px;
}

.remember-me-inner {
  display: flex;
  align-items: center;
  gap: 8px;
}

.remember-me-label {
  font-size: 13px;
  color: var(--me-text-secondary);
  cursor: pointer;
  user-select: none;
}

.remember-me-inner :deep(.p-checkbox) {
  width: 18px;
  height: 18px;
  position: relative;
  z-index: 1;
  cursor: pointer;
}

.remember-me-inner :deep(.p-checkbox .p-checkbox-box) {
  border-radius: 4px;
  border: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.remember-me-inner :deep(.p-checkbox.p-highlight .p-checkbox-box) {
  background: #6391d6;
  border-color: #6391d6;
}

.remember-me-inner :deep(.p-checkbox .p-checkbox-input) {
  cursor: pointer;
  z-index: 1;
}

/* ─── Remembered user card ─── */
.remembered-card {
  text-align: center;
  padding: 32px 24px;
  border-radius: 10px;
  margin-bottom: 16px;
}

.remembered-avatar {
  width: 80px;
  height: 80px;
  border-radius: 16px;
  margin: 0 auto 16px;
  overflow: hidden;
  background: var(--me-bg-card, var(--me-bg-surface));
  border: 2px solid rgba(99, 145, 214, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.remembered-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remembered-initials {
  font-size: 28px;
  font-weight: 700;
  color: #6391d6;
  font-family: var(--me-font-mono);
}

.remembered-welcome {
  font-size: 13px;
  color: var(--me-text-muted);
  margin-bottom: 2px;
}

.remembered-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--me-text-primary);
  margin-bottom: 20px;
}

.remembered-form {
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.remembered-not-me {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  font-size: 13px;
  transition: color 0.2s;
}

.remembered-not-me:hover {
  color: #6391d6;
}

/* ─── 2FA ─── */
.tfa-login-section {
  margin-top: 8px;
}

.tfa-icon-wrap {
  text-align: center;
  margin-bottom: 16px;
}

.tfa-icon {
  font-size: 32px;
  color: #e0af68;
}

.tfa-login-text {
  font-size: 13px;
  color: var(--me-text-secondary);
  margin-bottom: 16px;
  text-align: center;
}

.tfa-back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  margin-top: 12px;
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  font-size: 13px;
  transition: color 0.2s;
}

.tfa-back-btn:hover {
  color: var(--me-text-primary);
}

/* ─── Footer ─── */
.login-footer {
  text-align: center;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--me-border);
  font-size: 14px;
}

.text-muted {
  color: var(--me-text-muted);
}

.login-link {
  color: #6391d6;
  text-decoration: none;
  margin-left: 6px;
  font-weight: 600;
  transition: color 0.2s ease;
}

.login-link:hover {
  text-decoration: underline;
  color: #5580c4;
}

/* ─── Mobile branding ─── */
.login-mobile-brand {
  display: none;
  align-items: center;
  gap: 10px;
  margin-bottom: 32px;
}

.login-mobile-logo {
  height: 36px;
  width: auto;
  object-fit: contain;
}

.login-mobile-name {
  font-size: 20px;
  font-weight: 800;
  color: var(--me-text-primary);
}

/* ─── Responsive ─── */
@media (max-width: 900px) {
  .login-left {
    display: none;
  }

  .login-right {
    padding: 24px;
    justify-content: center;
  }

  .login-mobile-brand {
    display: flex;
  }

  .login-form-header {
    text-align: center;
  }
}

@media (max-width: 480px) {
  .login-right {
    padding: 16px;
  }

  .login-right-inner {
    max-width: 100%;
  }
}
</style>
