<!--
  AppSidebar.vue — Sidebar institutionnelle MeteorEdit v3
  ============================================================
  Largeur : 248 px expanded / 64 px collapsed (override possible via prop).
  Surface : --bg-2 (plus chaude que canvas), border-right --line.
  Wiring  : useThemeStore (toggle), useAuthStore (user), useBrandingStore (appName, organizationTag).
            Le collapse local est porté ici via localStorage 'me.sidebar.collapsed'
            — déplacer dans un store UI dédié si plusieurs vues en dépendent.
  PrimeVue : Button (toggles), Badge (compteurs), Avatar (user).
  ============================================================
-->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { useBrandingStore } from '@/stores/branding';
import Button from 'primevue/button';
import Badge from 'primevue/badge';
import Avatar from 'primevue/avatar';

interface NavItem {
  to: string;
  icon: string;      // PrimeIcons class fragment, ex: 'pi-folder-open'
  labelKey: string;  // i18n key
  count?: number;
}

interface NavGroup {
  titleKey: string;
  items: NavItem[];
}

const props = withDefaults(defineProps<{
  /** Comptes affichés à droite des items — branchés depuis le parent sur dossierStore */
  counts?: Record<string, number>;
}>(), { counts: () => ({}) });

const route = useRoute();
const { t } = useI18n();
const auth = useAuthStore();
const theme = useThemeStore();
const branding = useBrandingStore();

const collapsed = ref(localStorage.getItem('me.sidebar.collapsed') === '1');
watch(collapsed, (v) => {
  localStorage.setItem('me.sidebar.collapsed', v ? '1' : '0');
  // Émis pour que le parent <App.vue> propage data-sidebar sur .app
  emit('update:collapsed', v);
});
const emit = defineEmits<{ (e: 'update:collapsed', value: boolean): void }>();
onMounted(() => emit('update:collapsed', collapsed.value));

const groups = computed<NavGroup[]>(() => [
  {
    titleKey: 'nav.groups.work',
    items: [
      // /dossiers, /tasks n'existent pas en route MeteorEdit ; on pointe Dashboard et Dossiers
      // vers / (HomeView gère liste + ouverture via store.currentDossier).
      { to: '/',          icon: 'pi-home',          labelKey: 'nav.dashboard' },
      { to: '/',          icon: 'pi-folder-open',   labelKey: 'nav.dossiers',  count: props.counts.dossiers },
      { to: '/messages',  icon: 'pi-comments',      labelKey: 'nav.messages',  count: props.counts.messages },
    ],
  },
  {
    titleKey: 'nav.groups.library',
    items: [
      { to: '/templates',    icon: 'pi-file',          labelKey: 'nav.templates' },
      { to: '/osint-search', icon: 'pi-search',        labelKey: 'nav.osint' },
      { to: '/companies',    icon: 'pi-building',      labelKey: 'nav.companies' },
      { to: '/extension',    icon: 'pi-bookmark',      labelKey: 'nav.extension' },
    ],
  },
  {
    titleKey: 'nav.groups.system',
    items: [
      { to: '/admin',     icon: 'pi-cog',           labelKey: 'nav.admin' },
      { to: '/help',      icon: 'pi-question-circle', labelKey: 'nav.help' },
    ],
  },
]);

const userInitials = computed(() => {
  const first = auth.user?.firstName?.[0] || '';
  const last = auth.user?.lastName?.[0] || '';
  if (first || last) return (first + last).toUpperCase();
  return (auth.user?.email?.[0] || '?').toUpperCase();
});
const userFullName = computed(() => {
  if (auth.user?.firstName || auth.user?.lastName) {
    return `${auth.user.firstName || ''} ${auth.user.lastName || ''}`.trim();
  }
  return auth.user?.email || '';
});

function isActive(to: string): boolean {
  return route.path === to || (to !== '/' && route.path.startsWith(to));
}

// v3.37.3 — Cliquer Tableau de bord / Dossiers ferme le dossier courant
// (pattern MeteorEdit : currentDossier ref dans le store, pas de route /dossiers/:id)
import { useDossierStore } from '@/stores/dossier';
const dossiers = useDossierStore();
function handleNavClick(to: string, navigate: () => void) {
  if (to === '/' && dossiers.currentDossier) {
    dossiers.closeDossier();
  }
  navigate();
}
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar--collapsed': collapsed }">
    <!-- BRAND ============================================== -->
    <div class="sidebar__brand">
      <div class="sidebar__logo">
        <img v-if="branding.logoUrl" :src="branding.logoUrl" alt="" />
        <i v-else class="pi pi-bolt" />
      </div>
      <div v-if="!collapsed" class="sidebar__brand-meta">
        <div class="sidebar__brand-name">{{ branding.appName }}</div>
        <div v-if="branding.organizationTag" class="sidebar__brand-env">{{ branding.organizationTag }}</div>
      </div>
    </div>

    <!-- NAV ============================================== -->
    <nav class="sidebar__nav">
      <template v-for="group in groups" :key="group.titleKey">
        <div v-if="!collapsed" class="sidebar__group">{{ t(group.titleKey) }}</div>
        <RouterLink
          v-for="item in group.items"
          :key="item.to"
          :to="item.to"
          custom
          v-slot="{ navigate }"
        >
          <button
            class="nav-item"
            :aria-current="isActive(item.to) ? 'page' : undefined"
            :data-label="t(item.labelKey)"
            :title="collapsed ? t(item.labelKey) : undefined"
            @click="handleNavClick(item.to, navigate)"
          >
            <i class="pi" :class="item.icon" />
            <span class="nav-item__label">{{ t(item.labelKey) }}</span>
            <Badge
              v-if="item.count && !collapsed"
              :value="item.count"
              severity="secondary"
              class="nav-item__count"
            />
          </button>
        </RouterLink>
      </template>
    </nav>

    <!-- COLLAPSE TOGGLE ============================================== -->
    <Button
      class="sidebar__collapse"
      :icon="collapsed ? 'pi pi-angle-double-right' : 'pi pi-angle-double-left'"
      :label="collapsed ? undefined : t('nav.collapse')"
      text
      size="small"
      :aria-label="t('nav.collapse')"
      @click="collapsed = !collapsed"
    />

    <!-- USER FOOTER ============================================== -->
    <div class="sidebar__user">
      <Avatar
        :label="userInitials"
        shape="circle"
        size="normal"
        class="sidebar__user-avatar"
      />
      <div v-if="!collapsed" class="sidebar__user-meta">
        <div class="sidebar__user-name">{{ userFullName }}</div>
        <div class="sidebar__user-role">{{ auth.isAdmin ? 'Admin' : t('user.role.investigator') }}</div>
      </div>
      <div v-if="!collapsed" class="sidebar__user-actions">
        <Button
          :icon="theme.isDark ? 'pi pi-sun' : 'pi pi-moon'"
          text rounded size="small"
          :aria-label="t('theme.toggle')"
          @click="theme.toggle()"
        />
        <Button
          icon="pi pi-sign-out"
          text rounded size="small"
          :aria-label="t('auth.logout')"
          @click="auth.logout?.()"
        />
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* ============================================================
   STRUCTURE
   Largeur portée par le parent .app via grid-template-columns
   (cf. App.vue). On lit la largeur depuis le grid, donc :host = 100%.
   ============================================================ */
.sidebar {
  background: var(--bg-2);
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  font-family: var(--font);
  transition: background 120ms ease;
}

/* ============================================================
   BRAND
   ============================================================ */
.sidebar__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 16px 14px;
  border-bottom: 1px solid var(--line);
  min-height: 60px;
}
.sidebar__logo {
  width: 28px; height: 28px;
  flex-shrink: 0;
  border-radius: 6px;
  background: var(--ink);
  color: var(--surface);
  display: grid; place-items: center;
  overflow: hidden;
}
.sidebar__logo img { width: 100%; height: 100%; object-fit: contain; }
.sidebar__logo .pi { font-size: 14px; }
.sidebar__brand-meta { min-width: 0; flex: 1; }
.sidebar__brand-name {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sidebar__brand-env {
  font-size: 10.5px;
  color: var(--ink-3);
  letter-spacing: 0.04em;
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ============================================================
   NAV
   ============================================================ */
.sidebar__nav {
  flex: 1;
  overflow-y: auto;
  padding: 12px 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.sidebar__group {
  font-size: 10.5px;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 14px 10px 6px;
  font-weight: 600;
}
.sidebar__group:first-child { padding-top: 4px; }

/* ============================================================
   NAV ITEM
   Hauteur effective 32 px (7+18+7). Hover = bg-3, active = surface + bar.
   ============================================================ */
.nav-item {
  display: grid;
  grid-template-columns: 18px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 7px 10px;
  border-radius: var(--r-md);
  border: 0;
  background: transparent;
  color: var(--ink-2);
  font-size: 13px;
  font-weight: 450;
  text-align: left;
  letter-spacing: -0.005em;
  cursor: pointer;
  transition: background 80ms ease, color 80ms ease;
  font-family: inherit;
  width: 100%;
}
.nav-item:hover { background: var(--bg-3); color: var(--ink); }
.nav-item .pi { font-size: 16px; color: var(--ink-3); line-height: 1; }
.nav-item:hover .pi { color: var(--ink-2); }

.nav-item[aria-current="page"] {
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-1);
  border: 1px solid var(--line);
  padding: 6px 9px; /* compensation 1 px de la bordure */
}
.nav-item[aria-current="page"] .pi { color: var(--accent); }

.nav-item__label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* PrimeVue Badge override → look v3 (compteur tabulaire, pas un badge rouge) */
.nav-item__count :deep(.p-badge),
.nav-item :deep(.p-badge) {
  font-size: 11px;
  font-weight: 500;
  background: transparent;
  color: var(--ink-3);
  min-width: 0;
  height: auto;
  padding: 0;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}
.nav-item[aria-current="page"] :deep(.p-badge) { color: var(--ink-2); }

/* ============================================================
   COLLAPSED MODE (64 px)
   ============================================================ */
.sidebar--collapsed .sidebar__brand {
  padding: 14px 0;
  justify-content: center;
}
.sidebar--collapsed .sidebar__nav {
  padding: 8px 6px;
  align-items: center;
}
.sidebar--collapsed .nav-item {
  width: 40px; height: 40px;
  padding: 0;
  grid-template-columns: 1fr;
  justify-items: center;
  position: relative;
}
.sidebar--collapsed .nav-item[aria-current="page"] {
  padding: 0; width: 40px; height: 40px;
}
.sidebar--collapsed .nav-item__label { display: none; }

/* Tooltip natif en mode collapsé via data-label */
.sidebar--collapsed .nav-item::after {
  content: attr(data-label);
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%);
  background: var(--ink);
  color: var(--surface);
  font-size: 11.5px;
  padding: 5px 9px;
  border-radius: var(--r-sm);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 80ms ease;
  z-index: 100;
}
.sidebar--collapsed .nav-item:hover::after { opacity: 1; }

/* ============================================================
   COLLAPSE TOGGLE
   ============================================================ */
.sidebar__collapse :deep(.p-button) {
  margin: 8px 10px;
  height: 28px;
  width: calc(100% - 20px);
  justify-content: center;
  gap: 6px;
  color: var(--ink-3);
  background: transparent !important;
  border: 0;
  font-size: 11.5px;
  font-weight: 500;
  border-radius: var(--r-sm);
  letter-spacing: -0.005em;
}
.sidebar__collapse :deep(.p-button:hover) {
  background: var(--bg-3) !important;
  color: var(--ink);
}
.sidebar__collapse :deep(.p-button-icon) { font-size: 14px; }

.sidebar--collapsed .sidebar__collapse :deep(.p-button) {
  width: 40px;
  margin: 8px auto;
  padding: 0;
}

/* ============================================================
   USER FOOTER
   ============================================================ */
.sidebar__user {
  border-top: 1px solid var(--line);
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.sidebar__user-avatar :deep(.p-avatar) {
  width: 32px;
  height: 32px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--accent-line);
}
.sidebar__user-meta { flex: 1; min-width: 0; }
.sidebar__user-name {
  font-size: 12.5px;
  font-weight: 550;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sidebar__user-role {
  font-size: 11px;
  color: var(--ink-3);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sidebar__user-actions { display: flex; gap: 2px; }
.sidebar__user-actions :deep(.p-button) {
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--ink-3);
}
.sidebar__user-actions :deep(.p-button:hover) {
  background: var(--bg-3) !important;
  color: var(--ink);
}
.sidebar__user-actions :deep(.p-button-icon) { font-size: 14px; }

.sidebar--collapsed .sidebar__user {
  justify-content: center;
  padding: 8px;
}
.sidebar--collapsed .sidebar__user-meta,
.sidebar--collapsed .sidebar__user-actions { display: none; }

/* ============================================================
   DARK MODE — overrides explicites
   ============================================================ */
[data-theme="dark"] .sidebar {
  background: var(--bg-2); /* #1F1E1A */
  border-right-color: var(--line);
}
[data-theme="dark"] .sidebar__logo { background: var(--ink); color: var(--bg); }
[data-theme="dark"] .nav-item[aria-current="page"] {
  background: var(--surface); /* #232218 */
  border-color: var(--line-2);
}
[data-theme="dark"] .sidebar__user-avatar :deep(.p-avatar) {
  background: var(--accent-soft);
  color: var(--accent);
  border-color: var(--accent-line);
}
</style>
