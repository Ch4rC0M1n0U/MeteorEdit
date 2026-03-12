import Store from 'electron-store';

export interface StoreSchema {
  serverUrl: string;
  windowBounds: { x: number; y: number; width: number; height: number } | null;
  launchAtStartup: boolean;
  minimizeToTray: boolean;
}

// electron-store extends conf which is ESM-only; TypeScript with commonjs
// module resolution cannot follow the type chain. We cast to a typed interface.
export interface TypedStore {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K];
  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void;
  set(object: Partial<StoreSchema>): void;
}

const store = new Store<StoreSchema>({
  defaults: {
    serverUrl: '',
    windowBounds: null,
    launchAtStartup: false,
    minimizeToTray: true,
  },
}) as unknown as TypedStore;

export default store;
