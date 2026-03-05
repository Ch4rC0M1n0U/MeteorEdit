import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

const meteorDark = {
  dark: true,
  colors: {
    background: '#0a0e17',
    surface: '#111827',
    'surface-variant': '#1a2332',
    primary: '#38bdf8',
    'primary-darken-1': '#0ea5e9',
    secondary: '#f59e0b',
    'secondary-darken-1': '#d97706',
    error: '#f87171',
    info: '#38bdf8',
    success: '#34d399',
    warning: '#fbbf24',
    'on-background': '#e2e8f0',
    'on-surface': '#e2e8f0',
  },
};

const meteorLight = {
  dark: false,
  colors: {
    background: '#f1f5f9',
    surface: '#ffffff',
    'surface-variant': '#f8fafc',
    primary: '#2563eb',
    'primary-darken-1': '#1d4ed8',
    secondary: '#d97706',
    'secondary-darken-1': '#b45309',
    error: '#dc2626',
    info: '#2563eb',
    success: '#059669',
    warning: '#d97706',
    'on-background': '#0f172a',
    'on-surface': '#0f172a',
  },
};

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'meteorDark',
    themes: {
      meteorDark,
      meteorLight,
    },
  },
  defaults: {
    VCard: {
      rounded: 'lg',
    },
    VBtn: {
      rounded: 'lg',
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',
      rounded: 'lg',
    },
    VTextarea: {
      variant: 'outlined',
      density: 'comfortable',
      rounded: 'lg',
    },
    VSelect: {
      variant: 'outlined',
      density: 'comfortable',
      rounded: 'lg',
    },
  },
});
