import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue'), meta: { requiresAuth: true } },
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { guest: true } },
  { path: '/register', name: 'register', component: () => import('../views/RegisterView.vue'), meta: { guest: true } },
  { path: '/setup', name: 'setup', component: () => import('../views/SetupView.vue') },
  { path: '/admin', name: 'admin', component: () => import('../views/AdminView.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue'), meta: { requiresAuth: true } },
  { path: '/templates', name: 'templates', component: () => import('../views/TemplatesView.vue'), meta: { requiresAuth: true } },
  { path: '/templates/:id/edit', name: 'template-edit', component: () => import('../views/TemplateEditView.vue'), meta: { requiresAuth: true } },
  { path: '/help', name: 'help', component: () => import('../views/HelpView.vue'), meta: { requiresAuth: true } },
  { path: '/osint-search', name: 'osint-search', component: () => import('../views/OsintSearchView.vue'), meta: { requiresAuth: true } },
  { path: '/maintenance', name: 'maintenance', component: () => import('../views/MaintenanceView.vue') },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Track setup check so we only do it once per session
let setupChecked = false;
let setupRequired = false;

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();

  if (!authStore.isAuthenticated && localStorage.getItem('accessToken')) {
    await authStore.init();
  }

  // Check if setup is needed (first visit only, skip for /setup and /setup?dev=true)
  if (!setupChecked && to.name !== 'setup') {
    try {
      const res = await fetch('/api/setup/status');
      const data = await res.json();
      setupRequired = data.setupRequired;
      setupChecked = true;
    } catch {
      setupChecked = true;
    }
  }

  // Redirect to setup if needed (but allow /setup?dev=true anytime)
  if (setupRequired && to.name !== 'setup') {
    next('/setup');
    return;
  }

  // Block /setup (normal mode) if setup already done — dev mode always allowed
  if (to.name === 'setup' && setupChecked && !setupRequired && to.query.dev !== 'true') {
    next('/login');
    return;
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login');
  } else if (to.meta.requiresAdmin && !authStore.isAdmin) {
    next('/');
  } else if (to.meta.guest && authStore.isAuthenticated) {
    next('/');
  } else {
    next();
  }
});

export default router;
