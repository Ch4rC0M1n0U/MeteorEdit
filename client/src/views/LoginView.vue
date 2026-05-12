<template>
  <div class="login-split">
    <!-- Environment / theme toggle bar (top-right, always above split) -->
    <div class="login-topbar">
      <span v-if="brandingStore.environmentLabel" class="login-env-badge mono" :title="brandingStore.environmentLabel">
        <span class="login-env-dot" aria-hidden="true" />
        {{ brandingStore.environmentLabel }}
      </span>
      <button class="login-theme-toggle" type="button" @click="themeStore.toggle()" :title="themeStore.isDark ? $t('nav.lightMode') : $t('nav.darkMode')">
        <i :class="themeStore.isDark ? 'pi pi-sun' : 'pi pi-moon'" />
      </button>
    </div>
    <!-- Left panel: branding showcase (v3.29.1 — institutional layout) -->
    <div class="login-left" :class="{ 'has-bg-image': brandingStore.loginBackgroundUrl }">
      <img v-if="brandingStore.loginBackgroundUrl" :src="brandingStore.loginBackgroundUrl" alt="" class="login-left-bg-img" />
      <div class="login-left-overlay" />

      <!-- Top-left brand header : logo + app name + organization tag -->
      <header class="login-left-header">
        <img v-if="brandingStore.logoUrl" :src="brandingStore.logoUrl" :alt="brandingStore.appName" class="login-left-header-logo" />
        <img v-else :src="themeStore.isDark ? '/logo-me-red.png' : '/logo-me-blue.png'" alt="MeteorEdit" class="login-left-header-logo" />
        <div class="login-left-header-text">
          <strong>{{ brandingStore.appName }}</strong>
          <span v-if="brandingStore.organizationTag" class="login-left-header-org">{{ brandingStore.organizationTag }}</span>
        </div>
      </header>

      <!-- Centered-bottom content : version tag, h1 hero, paragraph, 2x2 grid of features -->
      <div class="login-left-content">
        <p class="login-version-tag mono">{{ versionTag }}</p>
        <h1 class="login-hero-title">{{ heroTitle }}</h1>
        <p class="login-hero-desc">{{ heroDesc }}</p>

        <div class="login-left-features login-left-features--grid">
          <article class="login-feature-card">
            <span class="login-feature-iconwrap"><i class="pi pi-folder-open" /></span>
            <div class="login-feature-text">
              <strong>{{ $t('auth.features.structuredDossiers') }}</strong>
              <p>{{ $t('auth.features.structuredDossiersDesc') }}</p>
            </div>
          </article>
          <article class="login-feature-card">
            <span class="login-feature-iconwrap"><i class="pi pi-shield" /></span>
            <div class="login-feature-text">
              <strong>{{ $t('auth.features.chainOfCustody') }}</strong>
              <p>{{ $t('auth.features.chainOfCustodyDesc') }}</p>
            </div>
          </article>
          <article class="login-feature-card">
            <span class="login-feature-iconwrap"><i class="pi pi-search" /></span>
            <div class="login-feature-text">
              <strong>{{ $t('auth.features.osintTools') }}</strong>
              <p>{{ $t('auth.features.osintToolsDesc') }}</p>
            </div>
          </article>
          <article class="login-feature-card">
            <span class="login-feature-iconwrap"><i class="pi pi-users" /></span>
            <div class="login-feature-text">
              <strong>{{ $t('auth.features.teamWork') }}</strong>
              <p>{{ $t('auth.features.teamWorkDesc') }}</p>
            </div>
          </article>
        </div>
      </div>
      <!-- Institutional footer (visible only when no custom bg image) -->
      <footer v-if="!brandingStore.loginBackgroundUrl" class="login-left-footer mono">
        <span class="login-left-footer-text">{{ footerLabel }}</span>
        <span class="login-left-footer-version">v{{ appVersion }}</span>
      </footer>
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

        <!-- Remembered user — avatar inlined into the main form (no nested card) -->
        <form v-if="rememberedUser && !show2FA" @submit.prevent="handleLogin" class="remembered-form-inline">
          <div class="remembered-identity">
            <div class="remembered-avatar">
              <img v-if="avatarUrl && !avatarError" :src="avatarUrl" alt="" class="remembered-avatar-img" @error="avatarError = true" />
              <span v-else class="remembered-initials">{{ initials }}</span>
            </div>
            <div class="remembered-identity-text">
              <span class="remembered-welcome">{{ $t('auth.welcomeBack') }}</span>
              <strong class="remembered-name">{{ rememberedUser.firstName }} {{ rememberedUser.lastName }}</strong>
            </div>
          </div>

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
            autofocus
          />

          <Button
            type="submit"
            :label="$t('auth.loginAction')"
            icon="pi pi-sign-in"
            :loading="authStore.loading"
            class="login-submit-btn"
          />

          <button type="button" class="remembered-not-me" @click="clearRememberedUser">
            <i class="pi pi-user-edit" style="font-size: 12px" />
            {{ $t('auth.notMe') }}
          </button>
        </form>

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

        <!-- SSO institutionnel — visible quand un endpoint OIDC est configuré
             dans le branding admin. Le bouton renvoie sur l'URL d'autorisation. -->
        <template v-if="brandingStore.ssoUrl && !show2FA">
          <div class="login-sep" aria-hidden="true">
            <span class="login-sep-line" />
            <span class="login-sep-label mono">{{ $t('auth.orSeparator') }}</span>
            <span class="login-sep-line" />
          </div>
          <a :href="brandingStore.ssoUrl" class="login-sso-btn">
            <i class="pi pi-shield" />
            <span>{{ brandingStore.ssoLabel || $t('auth.ssoInstitutional') }}</span>
          </a>
          <p v-if="!brandingStore.ssoUrl" class="login-sso-hint mono">{{ $t('auth.ssoHint') }}</p>
        </template>

        <!-- Encart d'information traçabilité / habilitations -->
        <aside v-if="!show2FA" class="login-info-card">
          <i class="pi pi-info-circle" />
          <p>{{ brandingStore.loginNotice || $t('auth.tracingNotice') }}</p>
        </aside>

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

const { t, locale } = useI18n();
const authStore = useAuthStore();
const brandingStore = useBrandingStore();
const themeStore = useThemeStore();
const router = useRouter();

// Version tag shown above the login title — replaces the static "VERSION 3.0 · MAI 2026"
// placeholder from the design mockups with the actual app version, formatted as
// "VERSION 3.28 · MAI 2026" (major.minor, current month/year in the user's locale).
const versionTag = computed(() => {
  const [major, minor] = __APP_VERSION__.split('.');
  const monthYear = new Date().toLocaleDateString(locale.value, { month: 'long', year: 'numeric' }).toUpperCase();
  return `VERSION ${major}.${minor} · ${monthYear}`;
});

// Full version string for the institutional footer.
const appVersion = __APP_VERSION__;
// Footer text — admin can override via brandingStore.organizationTag,
// otherwise we fall back to a neutral label derived from appName.
const footerLabel = computed(() => brandingStore.organizationTag || brandingStore.appName);

// Hero title + description shown on the left panel. Admin overrides via
// brandingStore.loginMessage (title) and brandingStore.loginNotice is reserved
// for the bottom info card. Defaults come from i18n.
const heroTitle = computed(() => brandingStore.loginMessage || t('auth.heroTitle'));
const heroDesc = computed(() => t('auth.heroDesc'));

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
/* ─── v3.32.4 — Local design system tokens (scoped to LoginView) ───
   Ces variables permettent une refonte visuelle « v3 institutionnel »
   sans toucher aux --me-* globaux. */
.login-split {
  /* Cream warm bg (light) + ink blue accent + grille subtile */
  --login-bg: var(--me-bg-deep);
  --login-bg-panel: var(--me-bg-deep);
  --login-ink: var(--me-text-primary);
  --login-ink-2: var(--me-text-secondary);
  --login-ink-3: var(--me-text-muted);
  --login-line: var(--me-border);
  --login-accent: var(--me-accent);

  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--login-bg);
}

/* Light theme override : ton cream/warm institutionnel */
:global([data-theme='light']) .login-split {
  --login-bg: #FAFAF7;
  --login-bg-panel: #F5F4EF;
  --login-ink: #1C1B18;
  --login-ink-2: #45433D;
  --login-ink-3: #6F6C63;
  --login-line: #E7E5DD;
  --login-accent: #2E4FA8;
}

/* ─── Left panel — v3.32.4 institutional « outil métier calme » ─── */
.login-left {
  position: relative;
  flex: 0 0 44%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;  /* content sits at the bottom, header is absolute */
  background: var(--login-bg-panel);
  overflow: hidden;
  border-right: 1px solid var(--login-line);
}
/* v3 tweak : grille carrée régulière (au lieu des dots) — pattern subtil masqué en bas-droite */
.login-left::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  background-image:
    linear-gradient(var(--login-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--login-line) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
  opacity: 0.5;
  -webkit-mask-image: radial-gradient(ellipse 70% 50% at 80% 100%, black 30%, transparent 80%);
  mask-image: radial-gradient(ellipse 70% 50% at 80% 100%, black 30%, transparent 80%);
}
.login-left.has-bg-image::before { display: none; }

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

.login-left-overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 30% 70%, rgba(var(--me-accent-rgb), 0.12) 0%, transparent 50%),
    radial-gradient(circle at 70% 30%, rgba(224, 175, 104, 0.08) 0%, transparent 50%);
  pointer-events: none;
  z-index: 1;
}

/* Constellation SVG decoration — replaces the old dotted grid */
.login-constellation {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
  opacity: 0.85;
}
.login-left.has-bg-image .login-constellation { display: none; }
/* Use CSS for SVG colors so var() works reliably on every browser
   (var() in stroke/fill SVG attributes is unreliable on Safari iOS < 15). */
.login-constellation-lines { stroke: rgba(var(--me-accent-rgb), 0.18); }
.login-constellation-stars { fill: rgba(var(--me-accent-rgb), 0.7); }
.login-constellation-dust  { fill: rgba(255, 255, 255, 0.18); }

/* Top-left brand header (logo + appName + organization tag) */
.login-left-header {
  position: absolute;
  top: 24px;
  left: 40px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 10px;
}
.login-left-header-logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
  border-radius: 6px;
}
.login-left-header-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.login-left-header-text strong {
  /* v3 tweak : nom app moins gras (institutionnel) */
  font-size: 15px;
  font-weight: 600;
  color: var(--login-ink);
  letter-spacing: -0.3px;
}
.login-left-header-org {
  font-size: 11px;
  color: var(--login-ink-3);
  letter-spacing: 0.4px;
  margin-top: 1px;
}

/* Bottom-left content stack — sits naturally at the bottom of the column */
.login-left-content {
  position: relative;
  z-index: 2;
  padding: 0 56px 96px;
  max-width: 560px;
  text-align: left;
}

/* Hero title (big, multi-line) */
.login-hero-title {
  /* v3 tweak : titre institutionnel — encre noire, poids 650, tracking serré */
  font-size: 40px;
  font-weight: 650;
  color: var(--login-ink);
  letter-spacing: -1.2px;
  line-height: 1.12;
  margin: 12px 0 18px;
  max-width: 14em;
  text-wrap: pretty;
}
.login-hero-desc {
  font-size: 14px;
  color: var(--login-ink-2);
  line-height: 1.6;
  margin: 0 0 28px;
  max-width: 38em;
}

.login-brand-logo {
  height: 72px;
  width: auto;
  object-fit: contain;
  margin-bottom: 20px;
  filter: drop-shadow(0 4px 24px rgba(0, 0, 0, 0.3));
}

.login-version-tag {
  /* v3 tweak : eyebrow couleur accent institutionnelle (encre bleue) */
  font-size: 11px;
  letter-spacing: 1.1px;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--login-accent);
  margin: 0 0 14px;
  opacity: 1;
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

/* Features list — kept for backwards compat; the v3.29 layout uses the
   grid variant below. */
.login-left-features {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
}

/* Mini-cards 2×2 grid — flat, no card background, just icon + 2 lines of text */
.login-left-features--grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 32px;
}

/* Legacy single-line feature (kept in case other views import it) */
.login-feature {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--me-text-secondary);
  font-size: 13px;
  padding: 8px 0;
}

/* v3.29 flat card — icon + heading + 2-line description */
.login-feature-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 0;
  background: transparent;
  border: none;
}
.login-feature-text { min-width: 0; }
.login-feature-text strong {
  /* v3 tweak : poids 550 (institutionnel, pas trop gras) */
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--login-ink);
  line-height: 1.3;
  letter-spacing: -0.1px;
}
.login-feature-text p {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--login-ink-3);
  line-height: 1.55;
}

/* v3 tweak : icône à plat (plus de carré tinted), inspiré du brief v3 */
.login-feature-iconwrap {
  width: 20px;
  height: 20px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--login-accent);
  flex-shrink: 0;
  font-size: 16px;
  margin-top: 1px;
}

/* ─── Right panel — v3.32.4 cream warm bg ─── */
.login-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 40px;
  background: var(--login-bg);
}

.login-right-inner {
  width: 100%;
  max-width: 400px;
}

.login-form-header {
  margin-bottom: 32px;
}

.login-form-title {
  /* v3 tweak : titre form plus institutionnel, poids 650, tracking serré */
  font-size: 22px;
  font-weight: 650;
  color: var(--login-ink);
  margin-bottom: 4px;
  letter-spacing: -0.4px;
}

.login-form-subtitle {
  font-size: 13px;
  color: var(--login-ink-3);
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
  border-color: var(--me-accent);
  box-shadow: 0 0 0 3px var(--me-accent-glow), inset 0 1px 2px rgba(0, 0, 0, 0.05);
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
  border-color: var(--me-accent);
  box-shadow: 0 0 0 3px var(--me-accent-glow), inset 0 1px 2px rgba(0, 0, 0, 0.05);
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
  /* v3 tweak : encre bleue institutionnelle, radius discret, poids 550 */
  width: 100%;
  height: 44px;
  border-radius: 7px;
  font-weight: 550;
  font-size: 14px;
  letter-spacing: 0;
  background: var(--login-accent);
  border: 1px solid var(--login-accent);
  color: #fff;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-top: 4px;
}

.login-submit-btn:hover:not(:disabled) {
  background: var(--me-accent-hover);
  border-color: var(--me-accent-hover);
  box-shadow: 0 1px 0 rgba(28, 27, 24, 0.04), 0 4px 12px rgba(28, 27, 24, 0.06);
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
  background: var(--me-accent);
  border-color: var(--me-accent);
}

.remember-me-inner :deep(.p-checkbox .p-checkbox-input) {
  cursor: pointer;
  z-index: 1;
}

/* ─── Remembered user — inline in the main form (no nested card) ─── */
.remembered-form-inline {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Identity row : avatar + welcome/name in a horizontal layout, integrated into the form flow */
.remembered-identity {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 12px;
  border-radius: var(--me-radius-sm);
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  margin-bottom: 12px;
}
.remembered-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--me-bg-surface);
  border: 2px solid rgba(var(--me-accent-rgb), 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.remembered-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.remembered-initials {
  font-size: 16px;
  font-weight: 700;
  color: var(--me-accent);
  font-family: var(--me-font-mono);
}
.remembered-identity-text {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
  min-width: 0;
}
.remembered-welcome {
  font-size: 11px;
  color: var(--me-text-muted);
  letter-spacing: 0.3px;
}
.remembered-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--me-text-primary);
}

.remembered-not-me {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  font-size: 12px;
  transition: color 0.2s;
}
.remembered-not-me:hover {
  color: var(--me-accent);
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
  color: var(--me-accent-warm);
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
  color: var(--me-accent);
  text-decoration: none;
  margin-left: 6px;
  font-weight: 600;
  transition: color 0.2s ease;
}

.login-link:hover {
  text-decoration: underline;
  color: var(--me-accent-hover);
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

/* ─── v3.29 institutional additions ─── */

/* Top-right bar with environment badge + dark mode toggle */
.login-topbar {
  position: absolute;
  top: 12px;
  right: 16px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 10px;
}
.login-env-badge {
  /* v3 tweak : badge env theme-aware via --login-* */
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--me-bg-surface);
  border: 1px solid var(--login-line);
  color: var(--login-ink-3);
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 0.3px;
}
.login-env-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--me-success);
  box-shadow: 0 0 6px var(--me-success);
  flex-shrink: 0;
}
.login-theme-toggle {
  /* v3 tweak : toggle theme-aware */
  width: 30px;
  height: 30px;
  border-radius: 7px;
  border: 1px solid var(--login-line);
  background: var(--me-bg-surface);
  color: var(--login-ink-3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 13px;
  transition: background var(--me-dur-fast) var(--me-ease), color var(--me-dur-fast) var(--me-ease);
}
.login-theme-toggle:hover {
  background: var(--me-bg-elevated);
  color: var(--login-ink);
}

/* Institutional footer at the bottom of the left panel */
.login-left-footer {
  position: absolute;
  bottom: 18px;
  left: 40px;
  right: 40px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--login-ink-3);
  letter-spacing: 0.4px;
}
.login-left-footer-version { opacity: 0.7; }

/* "OU" separator between native login and SSO */
.login-sep {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0 14px;
  color: var(--me-text-muted);
}
.login-sep-line {
  flex: 1;
  height: 1px;
  background: var(--me-border);
}
.login-sep-label {
  font-size: 11px;
  letter-spacing: 1.2px;
  text-transform: uppercase;
}

/* SSO institutional button */
.login-sso-btn {
  /* v3 tweak : radius discret, poids 550 (institutionnel) */
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 11px 16px;
  border-radius: 7px;
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  color: var(--me-text-primary);
  font-size: 13px;
  font-weight: 550;
  text-decoration: none;
  cursor: pointer;
  transition: border-color var(--me-dur-fast) var(--me-ease), background var(--me-dur-fast) var(--me-ease);
}
.login-sso-btn:hover {
  border-color: var(--me-accent);
  background: var(--me-accent-glow);
}
.login-sso-btn i { color: var(--me-accent); font-size: 14px; }
.login-sso-hint {
  margin: 6px 0 0;
  font-size: 11px;
  color: var(--me-text-muted);
  text-align: center;
}

/* Traceability / habilités info card */
.login-info-card {
  /* v3 tweak : encart institutionnel encre bleue */
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-top: 18px;
  padding: 12px 14px;
  border-radius: 7px;
  background: var(--me-bg-surface);
  border: 1px solid var(--login-line);
  color: var(--login-ink-2);
  font-size: 11.5px;
  line-height: 1.5;
}
.login-info-card i {
  font-size: 14px;
  color: var(--login-accent);
  flex-shrink: 0;
  margin-top: 2px;
}
.login-info-card p { margin: 0; }
</style>
