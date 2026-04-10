import { createApp } from 'vue';
import { createPinia } from 'pinia';
import vuetify from './plugins/vuetify';
import i18n from './i18n';
import router from './router';
import App from './App.vue';
import './assets/main.css';
import '@excalidraw/excalidraw/index.css';

// PrimeVue
import PrimeVue from 'primevue/config';
import { definePreset } from '@primevue/themes';
import Aura from '@primevue/themes/aura';
import 'primeicons/primeicons.css';

const MeteorPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{sky.50}', 100: '{sky.100}', 200: '{sky.200}', 300: '{sky.300}',
      400: '{sky.400}', 500: '{sky.500}', 600: '{sky.600}', 700: '{sky.700}',
      800: '{sky.800}', 900: '{sky.900}', 950: '{sky.950}',
    },
    colorScheme: {
      dark: {
        surface: {
          0: '#ffffff', 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0',
          300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569',
          700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617',
        },
      },
    },
  },
});

const app = createApp(App);
app.use(createPinia());
app.use(vuetify);
app.use(PrimeVue, {
  theme: {
    preset: MeteorPreset,
    options: {
      darkModeSelector: ':root:not([data-theme="light"])',
    },
  },
});
app.use(i18n);
app.use(router);
app.mount('#app');
