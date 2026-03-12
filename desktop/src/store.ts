import Store from 'electron-store';

interface StoreSchema {
  serverUrl: string;
  windowBounds: { x: number; y: number; width: number; height: number } | null;
  launchAtStartup: boolean;
  minimizeToTray: boolean;
}

const store = new Store<StoreSchema>({
  defaults: {
    serverUrl: '',
    windowBounds: null,
    launchAtStartup: false,
    minimizeToTray: true,
  },
});

export default store;
