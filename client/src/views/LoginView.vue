<template>
  <div class="login-split">
    <!-- Left panel: branding showcase -->
    <div class="login-left" :class="{ 'has-bg-image': brandingStore.loginBackgroundUrl }">
      <img v-if="brandingStore.loginBackgroundUrl" :src="brandingStore.loginBackgroundUrl" alt="" class="login-left-bg-img" />
      <div class="login-left-overlay" />
      <div class="login-left-content">
        <div class="login-brand">
          <img v-if="brandingStore.logoUrl" :src="brandingStore.logoUrl" :alt="brandingStore.appName" class="login-brand-logo" />
          <div v-else class="login-brand-icon">
            <v-icon size="48" color="white">mdi-shield-search</v-icon>
          </div>
          <h1 class="login-brand-title mono">{{ brandingStore.appName }}</h1>
          <p class="login-brand-tagline">{{ brandingStore.loginMessage || $t('auth.osintPlatform') }}</p>
        </div>
        <div class="login-left-features">
          <div class="login-feature">
            <v-icon size="20">mdi-folder-search-outline</v-icon>
            <span>{{ $t('auth.features.dossierManagement') }}</span>
          </div>
          <div class="login-feature">
            <v-icon size="20">mdi-account-group-outline</v-icon>
            <span>{{ $t('auth.features.realTimeCollab') }}</span>
          </div>
          <div class="login-feature">
            <v-icon size="20">mdi-map-marker-radius-outline</v-icon>
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
        <div v-else class="login-mobile-icon">
          <v-icon size="28" color="white">mdi-shield-search</v-icon>
        </div>
        <span class="login-mobile-name mono">{{ brandingStore.appName }}</span>
      </div>

      <div class="login-right-inner fade-in">
        <div class="login-form-header">
          <h2 class="login-form-title">{{ $t('auth.login') }}</h2>
          <p class="login-form-subtitle">{{ $t('auth.loginSubtitle') }}</p>
        </div>

        <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = ''">
          {{ error }}
        </v-alert>

        <v-form v-if="!show2FA" @submit.prevent="handleLogin" :disabled="authStore.loading">
          <label class="login-field-label">{{ $t('auth.email') }}</label>
          <v-text-field
            v-model="email"
            type="email"
            :placeholder="$t('auth.emailPlaceholder')"
            prepend-inner-icon="mdi-email-outline"
            variant="outlined"
            density="comfortable"
            required
            class="mb-3"
          />
          <label class="login-field-label">{{ $t('auth.password') }}</label>
          <v-text-field
            v-model="password"
            :placeholder="$t('auth.passwordPlaceholder')"
            :type="showPassword ? 'text' : 'password'"
            prepend-inner-icon="mdi-lock-outline"
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showPassword = !showPassword"
            variant="outlined"
            density="comfortable"
            required
            class="mb-5"
          />
          <v-btn
            type="submit"
            block
            size="large"
            :loading="authStore.loading"
            class="btn-accent login-submit-btn"
          >
            <v-icon start size="18">mdi-login-variant</v-icon>
            {{ $t('auth.loginAction') }}
          </v-btn>
        </v-form>

        <div v-if="show2FA" class="tfa-login-section">
          <div class="tfa-icon-wrap">
            <v-icon size="32" color="var(--me-accent)">mdi-shield-key-outline</v-icon>
          </div>
          <p class="tfa-login-text mono">{{ $t('auth.twoFaPrompt') }}</p>
          <v-text-field
            v-model="tfaCode"
            :label="$t('auth.twoFaCode')"
            maxlength="8"
            autofocus
            variant="outlined"
            density="comfortable"
            prepend-inner-icon="mdi-numeric"
            @keyup.enter="handle2FA"
            class="mb-4"
          />
          <v-btn type="button" block size="large" :loading="authStore.loading" class="btn-accent login-submit-btn" @click="handle2FA">
            {{ $t('auth.verify') }}
          </v-btn>
          <button class="tfa-back-btn" @click="show2FA = false; tempToken = ''">
            <v-icon size="14" class="mr-1">mdi-arrow-left</v-icon>
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
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import { useBrandingStore } from '../stores/branding';

const { t } = useI18n();
const authStore = useAuthStore();
const brandingStore = useBrandingStore();
const router = useRouter();

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const error = ref('');
const show2FA = ref(false);
const tempToken = ref('');
const tfaCode = ref('');

async function handleLogin() {
  error.value = '';
  try {
    const result = await authStore.login(email.value, password.value);
    if (result?.requires2FA) {
      tempToken.value = result.tempToken!;
      show2FA.value = true;
      return;
    }
    router.push('/');
  } catch (e: any) {
    error.value = e.response?.data?.message || t('auth.loginError');
  }
}

async function handle2FA() {
  error.value = '';
  try {
    await authStore.validate2FA(tempToken.value, tfaCode.value);
    router.push('/');
  } catch (e: any) {
    error.value = e.response?.data?.message || t('auth.invalidCode');
  }
}
</script>

<style scoped>
.login-split {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--me-bg-deep);
}

/* ─── Left panel ─── */
.login-left {
  position: relative;
  flex: 0 0 45%;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, transparent 60%),
    linear-gradient(225deg, rgba(56, 189, 248, 0.06) 0%, transparent 50%),
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
  background: rgba(0, 0, 0, 0.55);
}

.login-left.has-bg-image::before {
  display: none;
}

.login-left-overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 30% 70%, var(--me-accent-glow) 0%, transparent 50%),
    radial-gradient(circle at 70% 30%, var(--me-accent-glow) 0%, transparent 50%);
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

.login-brand-icon {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: linear-gradient(135deg, var(--me-accent), rgba(56, 189, 248, 0.7));
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  box-shadow: 0 8px 32px rgba(56, 189, 248, 0.25);
}

.login-brand-title {
  font-size: 32px;
  font-weight: 800;
  color: var(--me-text-primary);
  letter-spacing: -0.5px;
  margin-bottom: 8px;
}

.login-brand-tagline {
  font-size: 13px;
  color: var(--me-text-muted);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  font-family: var(--me-font-mono);
  line-height: 1.6;
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
  color: var(--me-text-secondary);
  font-size: 13px;
  padding: 10px 16px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(4px);
  transition: all 0.2s ease;
}

.login-feature:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--me-accent-glow);
}

.login-feature .v-icon {
  color: var(--me-accent);
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

.login-field-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-secondary);
  margin-bottom: 6px;
}

.login-submit-btn {
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: none;
  border-radius: 10px;
  height: 48px;
}

/* ─── 2FA ─── */
.tfa-login-section {
  margin-top: 8px;
}

.tfa-icon-wrap {
  text-align: center;
  margin-bottom: 16px;
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
  color: var(--me-accent);
  text-decoration: none;
  margin-left: 6px;
  font-weight: 600;
}

.login-link:hover {
  text-decoration: underline;
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

.login-mobile-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--me-accent), rgba(56, 189, 248, 0.7));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
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
