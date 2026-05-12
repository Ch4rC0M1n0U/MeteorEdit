<template>
  <div class="login-v3">
    <!-- Classification ribbon (top of screen) -->
    <div class="login__class">{{ $t('auth.classificationBanner') }}</div>

    <div class="login">
      <!-- ============================================================
           BRAND PANEL (left)
           ============================================================ -->
      <section class="login__brand">
        <div class="login__brand-pattern" aria-hidden="true" />

        <div class="login__brand-top">
          <div class="login__brand-logo">
            <img
              v-if="brandingStore.logoUrl"
              :src="brandingStore.logoUrl"
              :alt="brandingStore.appName"
            />
            <img
              v-else
              :src="themeStore.isDark ? '/logo-me-red.png' : '/logo-me-blue.png'"
              alt="MeteorEdit"
            />
          </div>
          <div>
            <div class="login__brand-name">{{ brandingStore.appName }}</div>
            <div v-if="brandingStore.organizationTag" class="login__brand-tag">
              {{ brandingStore.organizationTag }}
            </div>
          </div>
        </div>

        <div class="login__brand-body">
          <div class="login__brand-eyebrow">{{ versionTag }}</div>
          <h1 class="login__brand-title">{{ heroTitle }}</h1>
          <p class="login__brand-lede">{{ heroDesc }}</p>

          <div class="login__features">
            <div class="login__feat">
              <span class="mdi mdi-folder-multiple-outline" style="color: var(--accent)" />
              <div>
                <strong>{{ $t('auth.features.structuredDossiers') }}</strong>
                {{ $t('auth.features.structuredDossiersDesc') }}
              </div>
            </div>
            <div class="login__feat">
              <span class="mdi mdi-shield-lock-outline" style="color: var(--cat-map)" />
              <div>
                <strong>{{ $t('auth.features.chainOfCustody') }}</strong>
                {{ $t('auth.features.chainOfCustodyDesc') }}
              </div>
            </div>
            <div class="login__feat">
              <span class="mdi mdi-magnify-scan" style="color: var(--cat-clipper)" />
              <div>
                <strong>{{ $t('auth.features.osintTools') }}</strong>
                {{ $t('auth.features.osintToolsDesc') }}
              </div>
            </div>
            <div class="login__feat">
              <span class="mdi mdi-account-multiple-outline" style="color: var(--cat-note)" />
              <div>
                <strong>{{ $t('auth.features.teamWork') }}</strong>
                {{ $t('auth.features.teamWorkDesc') }}
              </div>
            </div>
          </div>
        </div>

        <div class="login__brand-foot">
          <span><strong>{{ footerLabel }}</strong></span>
          <span>v{{ appVersion }}</span>
        </div>
      </section>

      <!-- ============================================================
           FORM PANEL (right)
           ============================================================ -->
      <section class="login__form">
        <div class="login__top">
          <span v-if="brandingStore.environmentLabel" class="login__env">
            <span class="dot" aria-hidden="true" />
            {{ brandingStore.environmentLabel }}
          </span>
          <button
            class="theme-toggle"
            type="button"
            :title="themeStore.isDark ? $t('nav.lightMode') : $t('nav.darkMode')"
            @click="themeStore.toggle()"
          >
            <span class="mdi mdi-weather-night theme-toggle__moon" />
            <span class="mdi mdi-white-balance-sunny theme-toggle__sun" />
          </button>
        </div>

        <div class="login__form-inner">
          <!-- =============== 2FA ================ -->
          <template v-if="show2FA">
            <h2>{{ $t('auth.verify') }}</h2>
            <p>{{ $t('auth.twoFaPrompt') }}</p>

            <form @submit.prevent="handle2FA">
              <div v-if="error" class="login__error">
                <span class="mdi mdi-alert-circle-outline" />
                <span>{{ error }}</span>
              </div>

              <div class="field">
                <label class="field__label">{{ $t('auth.twoFaCode') }}</label>
                <div class="field__input">
                  <span class="mdi mdi-key-outline" />
                  <input
                    v-model="tfaCode"
                    type="text"
                    inputmode="numeric"
                    maxlength="8"
                    :placeholder="$t('auth.twoFaCode')"
                    :disabled="authStore.loading"
                    autofocus
                  />
                </div>
              </div>

              <button
                class="btn btn--primary btn--block"
                type="submit"
                :disabled="authStore.loading || !tfaCode"
              >
                {{ $t('auth.verify') }}
                <span class="mdi mdi-check-circle-outline" />
              </button>
            </form>

            <button
              class="btn btn--block login__back"
              type="button"
              @click="cancel2FA"
            >
              <span class="mdi mdi-arrow-left" />
              {{ $t('common.back') }}
            </button>
          </template>

          <!-- =============== LOGIN (classic or remembered) ================ -->
          <template v-else>
            <h2>{{ $t('auth.login') }}</h2>
            <p>{{ $t('auth.loginSubtitle') }}</p>

            <!-- Error banner -->
            <div v-if="error" class="login__error">
              <span class="mdi mdi-alert-circle-outline" />
              <span>{{ error }}</span>
              <button
                class="login__error-close"
                type="button"
                :aria-label="$t('common.close')"
                @click="error = ''"
              >
                <span class="mdi mdi-close" />
              </button>
            </div>

            <!-- Remembered user (inline avatar + password only) -->
            <form
              v-if="rememberedUser"
              class="login__form-body"
              @submit.prevent="handleLogin"
            >
              <div class="login__remembered">
                <div class="login__remembered-avatar">
                  <img
                    v-if="avatarUrl && !avatarError"
                    :src="avatarUrl"
                    alt=""
                    @error="avatarError = true"
                  />
                  <span v-else>{{ initials }}</span>
                </div>
                <div class="login__remembered-text">
                  <span>{{ $t('auth.welcomeBack') }}</span>
                  <strong>{{ rememberedUser.firstName }} {{ rememberedUser.lastName }}</strong>
                </div>
              </div>

              <div class="field">
                <label class="field__label">{{ $t('auth.password') }}</label>
                <div class="field__input">
                  <span class="mdi mdi-lock-outline" />
                  <input
                    v-model="password"
                    :type="showPwd ? 'text' : 'password'"
                    :placeholder="$t('auth.passwordPlaceholder')"
                    :disabled="authStore.loading"
                    autofocus
                    required
                  />
                  <span
                    class="mdi login__eye"
                    :class="showPwd ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                    role="button"
                    tabindex="0"
                    :aria-label="$t('auth.password')"
                    @click="showPwd = !showPwd"
                    @keyup.enter="showPwd = !showPwd"
                  />
                </div>
              </div>

              <button
                class="btn btn--primary btn--block"
                type="submit"
                :disabled="authStore.loading || !password"
              >
                {{ $t('auth.loginAction') }}
                <span class="mdi mdi-arrow-right" />
              </button>

              <button
                type="button"
                class="login__not-me"
                @click="clearRememberedUser"
              >
                <span class="mdi mdi-account-edit-outline" />
                {{ $t('auth.notMe') }}
              </button>
            </form>

            <!-- Classic form -->
            <form
              v-else
              class="login__form-body"
              @submit.prevent="handleLogin"
            >
              <div class="field">
                <label class="field__label">{{ $t('auth.email') }}</label>
                <div class="field__input">
                  <span class="mdi mdi-account-circle-outline" />
                  <input
                    v-model="email"
                    type="email"
                    :placeholder="$t('auth.emailPlaceholder')"
                    :disabled="authStore.loading"
                    autocomplete="username"
                    required
                  />
                </div>
              </div>

              <div class="field">
                <label class="field__label">{{ $t('auth.password') }}</label>
                <div class="field__input">
                  <span class="mdi mdi-lock-outline" />
                  <input
                    v-model="password"
                    :type="showPwd ? 'text' : 'password'"
                    :placeholder="$t('auth.passwordPlaceholder')"
                    :disabled="authStore.loading"
                    autocomplete="current-password"
                    required
                  />
                  <span
                    class="mdi login__eye"
                    :class="showPwd ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                    role="button"
                    tabindex="0"
                    :aria-label="$t('auth.password')"
                    @click="showPwd = !showPwd"
                    @keyup.enter="showPwd = !showPwd"
                  />
                </div>
              </div>

              <div class="field__row">
                <label>
                  <input v-model="rememberMe" type="checkbox" />
                  {{ $t('auth.rememberMe') }}
                </label>
              </div>

              <button
                class="btn btn--primary btn--block"
                type="submit"
                :disabled="authStore.loading || !email || !password"
              >
                {{ $t('auth.loginAction') }}
                <span class="mdi mdi-arrow-right" />
              </button>
            </form>

            <!-- SSO -->
            <template v-if="brandingStore.ssoUrl">
              <div class="login__divider">{{ $t('auth.orSeparator') }}</div>
              <a :href="brandingStore.ssoUrl" class="btn btn--block">
                <span class="mdi mdi-shield-key-outline" style="color: var(--accent)" />
                {{ brandingStore.ssoLabel || $t('auth.ssoInstitutional') }}
              </a>
            </template>

            <!-- Traceability notice -->
            <div class="login__notice">
              <span class="mdi mdi-information-outline" />
              <div>{{ brandingStore.loginNotice || $t('auth.tracingNotice') }}</div>
            </div>

            <!-- Register link (admin-controlled) -->
            <div v-if="brandingStore.registrationEnabled" class="login__register">
              <span>{{ $t('auth.noAccount') }}</span>
              <router-link to="/register">{{ $t('auth.register') }}</router-link>
            </div>
          </template>
        </div>
      </section>
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

interface RememberedUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

const { t, locale } = useI18n();
const authStore = useAuthStore();
const brandingStore = useBrandingStore();
const themeStore = useThemeStore();
const router = useRouter();

// Version tag shown above the hero title.
// Format: "VERSION 3.32 · MAI 2026"
const versionTag = computed(() => {
  const [major, minor] = __APP_VERSION__.split('.');
  const monthYear = new Date()
    .toLocaleDateString(locale.value, { month: 'long', year: 'numeric' })
    .toUpperCase();
  return `VERSION ${major}.${minor} · ${monthYear}`;
});

const appVersion = __APP_VERSION__;

const footerLabel = computed(() => brandingStore.organizationTag || brandingStore.appName);

const heroTitle = computed(() => brandingStore.loginMessage || t('auth.heroTitle'));
const heroDesc = computed(() => t('auth.heroDesc'));

const email = ref('');
const password = ref('');
const showPwd = ref(false);
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

watch(() => rememberedUser.value, () => {
  avatarError.value = false;
});

const avatarUrl = computed(() => {
  if (!rememberedUser.value) return null;
  return `${SERVER_URL}/api/auth/avatar/${rememberedUser.value.userId}`;
});

const initials = computed(() => {
  if (!rememberedUser.value) return '';
  return (
    (rememberedUser.value.firstName?.[0] || '') + (rememberedUser.value.lastName?.[0] || '')
  ).toUpperCase();
});

function clearRememberedUser() {
  rememberedUser.value = null;
  email.value = '';
  password.value = '';
  localStorage.removeItem('rememberedUser');
}

function saveRememberedUser() {
  if (rememberMe.value && authStore.user) {
    localStorage.setItem(
      'rememberedUser',
      JSON.stringify({
        userId: authStore.user.id,
        email: authStore.user.email,
        firstName: authStore.user.firstName,
        lastName: authStore.user.lastName,
      }),
    );
  }
}

function cancel2FA() {
  show2FA.value = false;
  tempToken.value = '';
  tfaCode.value = '';
  error.value = '';
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
/* ============================================================
   LoginView v3.32 — markup BEM scoped, tokens v3 (--bg, --ink, --accent…)
   Hérite des tokens définis dans assets/tokens-v3.css.
   Force la typographie Inter sur tout le scope login uniquement.
   ============================================================ */

.login-v3 {
  position: fixed;
  inset: 0;
  z-index: 1;
  overflow: auto;
  font-family: var(--font);
  font-feature-settings: 'ss01', 'cv11';
  font-optical-sizing: auto;
  letter-spacing: -0.005em;
  color: var(--ink);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.login-v3 * { box-sizing: border-box; }

/* --- CLASSIFICATION RIBBON --- */
.login__class {
  position: absolute;
  top: 0; left: 0; right: 0;
  text-align: center;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.16em;
  color: var(--ink-3);
  background: var(--bg-3);
  border-bottom: 1px solid var(--line);
  padding: 4px 0;
  text-transform: uppercase;
  z-index: 3;
}

/* --- ROOT GRID --- */
.login {
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  width: 100%;
  min-height: 100vh;
  background: var(--bg);
}

/* --- BRAND PANEL --- */
.login__brand {
  position: relative;
  padding: 40px 48px;
  display: flex;
  flex-direction: column;
  background: var(--bg-2);
  border-right: 1px solid var(--line);
  overflow: hidden;
}

.login__brand-top {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 2;
}

.login__brand-logo {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--ink);
  display: grid;
  place-items: center;
  overflow: hidden;
  box-shadow: var(--shadow-1);
}
.login__brand-logo img { width: 100%; height: 100%; object-fit: contain; }

.login__brand-name {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--ink);
}
.login__brand-tag {
  font-size: 11px;
  color: var(--ink-3);
  margin-top: 1px;
  letter-spacing: 0.04em;
}

.login__brand-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  z-index: 2;
  max-width: 460px;
}

.login__brand-eyebrow {
  font-size: 11px;
  color: var(--accent);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 14px;
}

.login__brand-title {
  font-size: 32px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.18;
  margin: 0 0 16px;
  text-wrap: pretty;
  color: var(--ink);
}

.login__brand-lede {
  font-size: 14px;
  line-height: 1.6;
  color: var(--ink-2);
  margin: 0 0 24px;
  text-wrap: pretty;
}

.login__features {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 12px;
}

.login__feat {
  display: flex;
  gap: 10px;
  font-size: 12.5px;
  color: var(--ink-2);
  line-height: 1.5;
}
.login__feat .mdi { font-size: 17px; flex-shrink: 0; margin-top: 1px; }
.login__feat strong {
  color: var(--ink);
  font-weight: 600;
  display: block;
  margin-bottom: 1px;
}

/* Decorative grid pattern */
.login__brand-pattern {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 32px 32px;
  opacity: 0.5;
  mask-image: radial-gradient(ellipse 70% 50% at 80% 100%, black 30%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse 70% 50% at 80% 100%, black 30%, transparent 80%);
  pointer-events: none;
}

.login__brand-foot {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--ink-3);
  letter-spacing: 0.04em;
}
.login__brand-foot strong { color: var(--ink-2); font-weight: 550; }

/* --- FORM PANEL --- */
.login__form {
  display: grid;
  place-items: center;
  padding: 40px;
  position: relative;
  background: var(--bg);
}
.login__form-inner {
  width: 100%;
  max-width: 380px;
}
.login__form-inner h2 {
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.014em;
  margin: 0 0 4px;
  color: var(--ink);
}
.login__form-inner > p {
  font-size: 13px;
  color: var(--ink-3);
  margin: 0 0 28px;
}

/* --- FIELDS --- */
.field { margin-bottom: 16px; }
.field__label {
  display: block;
  font-size: 11px;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
  margin-bottom: 6px;
}
.field__input {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 38px;
  padding: 0 12px;
  background: var(--surface);
  border: 1px solid var(--line-2);
  border-radius: var(--r-md);
  transition: border-color 80ms ease, box-shadow 80ms ease;
}
.field__input:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.field__input .mdi { color: var(--ink-3); font-size: 16px; }
.field__input input {
  flex: 1;
  background: transparent;
  border: 0;
  outline: 0;
  font-family: inherit;
  font-size: 13.5px;
  color: var(--ink);
  letter-spacing: -0.005em;
  min-width: 0;
}
.field__input input::placeholder { color: var(--ink-3); }
.field__input input:disabled { opacity: 0.6; cursor: not-allowed; }

.login__eye { cursor: pointer; }
.login__eye:hover { color: var(--ink-2); }

.field__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: -4px;
  margin-bottom: 18px;
  font-size: 12px;
}
.field__row label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-2);
  cursor: pointer;
}
.field__row label input { accent-color: var(--accent); }
.field__row a {
  color: var(--accent);
  text-decoration: none;
}
.field__row a:hover { text-decoration: underline; }

/* --- BUTTONS --- */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--ink-2);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  cursor: pointer;
  transition: all 80ms ease;
  letter-spacing: -0.005em;
  text-decoration: none;
}
.btn:hover { background: var(--bg); border-color: var(--line-2); color: var(--ink); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn .mdi { font-size: 14px; color: var(--ink-3); }
.btn:hover .mdi { color: var(--ink-2); }

.btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}
.btn--primary:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
  color: var(--on-accent);
}
.btn--primary .mdi { color: var(--on-accent); }

.btn--block {
  width: 100%;
  height: 38px;
  justify-content: center;
  font-size: 13.5px;
  font-weight: 550;
}

/* --- THEME TOGGLE BUTTON --- */
.theme-toggle {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink-3);
  border-radius: var(--r-md);
  cursor: pointer;
  transition: all 80ms ease;
  font-family: inherit;
}
.theme-toggle:hover {
  background: var(--bg-3);
  color: var(--ink);
  border-color: var(--line-2);
}
.theme-toggle .mdi { font-size: 14px; }
:global([data-theme='light']) .theme-toggle__moon,
:global([data-theme='dark']) .theme-toggle__sun { display: none; }

/* --- TOP-RIGHT ENV + TOGGLE --- */
.login__top {
  position: absolute;
  top: 36px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 2;
}
.login__env {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 11px;
  color: var(--ink-3);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 11px;
  letter-spacing: 0.04em;
}
.login__env .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ok);
}

/* --- NOTICE / INFO --- */
.login__notice {
  margin-top: 22px;
  padding: 12px 14px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  background: var(--info-soft);
  border: 1px solid var(--cat-map-line);
  border-radius: var(--r-md);
  font-size: 11.5px;
  color: var(--ink-2);
  line-height: 1.5;
}
.login__notice .mdi {
  color: var(--info);
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 1px;
}

/* --- DIVIDER --- */
.login__divider {
  position: relative;
  text-align: center;
  margin: 22px 0;
  font-size: 11px;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.login__divider::before,
.login__divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: calc(50% - 28px);
  height: 1px;
  background: var(--line);
}
.login__divider::before { left: 0; }
.login__divider::after { right: 0; }

/* --- ERROR BANNER --- */
.login__error {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 16px;
  background: var(--err-soft);
  border: 1px solid var(--err);
  border-radius: var(--r-md);
  font-size: 12.5px;
  color: var(--err);
  line-height: 1.45;
}
.login__error > span:first-child { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
.login__error > span:nth-child(2) { flex: 1; }
.login__error-close {
  background: transparent;
  border: 0;
  color: var(--err);
  cursor: pointer;
  padding: 0;
  display: grid;
  place-items: center;
  font-family: inherit;
}
.login__error-close .mdi { font-size: 14px; }

/* --- REMEMBERED USER (inline avatar block above password) --- */
.login__remembered {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin-bottom: 16px;
  background: var(--accent-soft);
  border: 1px solid var(--accent-line);
  border-radius: var(--r-md);
}
.login__remembered-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--on-accent);
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  overflow: hidden;
  flex-shrink: 0;
}
.login__remembered-avatar img { width: 100%; height: 100%; object-fit: cover; }
.login__remembered-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.login__remembered-text span {
  font-size: 11px;
  color: var(--ink-3);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.login__remembered-text strong {
  font-size: 14px;
  color: var(--ink);
  font-weight: 600;
  letter-spacing: -0.01em;
}

.login__not-me {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 10px auto 0;
  background: transparent;
  border: 0;
  color: var(--ink-3);
  font-family: inherit;
  font-size: 11.5px;
  cursor: pointer;
  width: 100%;
  justify-content: center;
}
.login__not-me:hover { color: var(--accent); }
.login__not-me .mdi { font-size: 12px; }

/* --- BACK BUTTON (2FA) --- */
.login__back { margin-top: 10px; color: var(--ink-3); }

/* --- REGISTER LINK --- */
.login__register {
  margin-top: 18px;
  text-align: center;
  font-size: 12.5px;
  color: var(--ink-3);
}
.login__register span { margin-right: 4px; }
.login__register a {
  color: var(--accent);
  text-decoration: none;
  font-weight: 550;
}
.login__register a:hover { text-decoration: underline; }

/* --- RESPONSIVE --- */
@media (max-width: 900px) {
  .login {
    grid-template-columns: 1fr;
    height: auto;
    min-height: 100vh;
  }
  .login__brand {
    padding: 56px 28px 32px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .login__brand-body { max-width: none; }
  .login__features { grid-template-columns: 1fr; }
  .login__form { padding: 32px 24px 48px; }
  .login__top { top: 32px; }
}
</style>
