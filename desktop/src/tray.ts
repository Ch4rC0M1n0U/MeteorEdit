import { app, Menu, Tray, BrowserWindow, shell } from 'electron';
import path from 'path';
import store from './store';

let tray: Tray | null = null;
let cachedUserInfo: { name: string; email: string } | null = null;
let cachedServerUrl: string = '';
let cachedBranding: { appName: string; logoUrl: string } = { appName: 'MeteorEdit', logoUrl: '' };
let mainWindowRef: BrowserWindow | null = null;

export function setTrayUserInfo(info: { name: string; email: string } | null): void {
  cachedUserInfo = info;
  updateTrayMenu();
}

export function setTrayServerUrl(url: string): void {
  cachedServerUrl = url;
  updateTrayMenu();
}

export function setTrayBranding(branding: { appName: string; logoUrl: string }): void {
  cachedBranding = branding;
  updateTrayMenu();
}

export function createTray(mainWindow: BrowserWindow): Tray {
  mainWindowRef = mainWindow;
  tray = new Tray(path.join(__dirname, '..', 'resources', 'icon.png'));
  cachedServerUrl = store.get('serverUrl') || '';

  updateTrayMenu();

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return tray;
}

function updateTrayMenu(): void {
  if (!tray || !mainWindowRef) return;
  const mainWindow = mainWindowRef;

  const appName = cachedBranding.appName || 'MeteorEdit';
  const isConnected = !!cachedServerUrl;
  const launchAtStartup = store.get('launchAtStartup');
  const minimizeToTray = store.get('minimizeToTray');

  const tooltip = cachedUserInfo
    ? `${appName} — ${cachedUserInfo.name}`
    : appName;
  tray.setToolTip(tooltip);

  const menuItems: Electron.MenuItemConstructorOptions[] = [
    {
      label: `Ouvrir ${appName}`,
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
  ];

  // Connection / user status
  if (isConnected && cachedUserInfo) {
    menuItems.push(
      {
        label: cachedUserInfo.name,
        enabled: false,
      },
      {
        label: cachedUserInfo.email,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Se déconnecter',
        click: () => {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.executeJavaScript(`
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            location.reload();
          `);
        },
      },
    );
  } else if (isConnected) {
    menuItems.push(
      {
        label: 'Connecté au serveur',
        enabled: false,
      },
    );
  } else {
    menuItems.push(
      {
        label: 'Non connecté',
        enabled: false,
      },
    );
  }

  menuItems.push({ type: 'separator' });

  // Server actions
  if (isConnected) {
    menuItems.push(
      {
        label: 'Ouvrir dans le navigateur',
        click: () => {
          shell.openExternal(cachedServerUrl);
        },
      },
    );
  }

  menuItems.push(
    {
      label: 'Changer de serveur',
      click: () => {
        store.set('serverUrl', '');
        cachedServerUrl = '';
        cachedUserInfo = null;
        cachedBranding = { appName: 'MeteorEdit', logoUrl: '' };
        mainWindow.loadFile(path.join(__dirname, 'connect.html'));
        mainWindow.show();
        mainWindow.focus();
        updateTrayMenu();
      },
    },
    { type: 'separator' },
  );

  // Preferences submenu
  menuItems.push(
    {
      label: 'Préférences',
      submenu: [
        {
          label: 'Lancer au démarrage',
          type: 'checkbox',
          checked: launchAtStartup,
          click: (menuItem) => {
            store.set('launchAtStartup', menuItem.checked);
            app.setLoginItemSettings({ openAtLogin: menuItem.checked });
          },
        },
        {
          label: 'Minimiser dans le tray',
          type: 'checkbox',
          checked: minimizeToTray,
          click: (menuItem) => {
            store.set('minimizeToTray', menuItem.checked);
          },
        },
      ],
    },
    { type: 'separator' },
  );

  // Version & quit
  menuItems.push(
    {
      label: `Version ${app.getVersion()}`,
      enabled: false,
    },
    {
      label: 'Quitter',
      click: () => {
        app.exit(0);
      },
    },
  );

  const contextMenu = Menu.buildFromTemplate(menuItems);
  tray.setContextMenu(contextMenu);
}
