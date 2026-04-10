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
import Aura from '@primevue/themes/aura';
import 'primeicons/primeicons.css';

const app = createApp(App);
app.use(createPinia());
app.use(vuetify);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.dark-theme',
    },
  },
});
app.use(i18n);
app.use(router);
app.mount('#app');
