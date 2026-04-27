declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module 'vuetify/styles' {
  const styles: string;
  export default styles;
}

declare const __APP_VERSION__: string;
