import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import store from './store';
import { createTray } from './tray';
import { showNativeNotification } from './notifications';
import { registerShortcuts, unregisterShortcuts } from './shortcuts';
import { handleDeepLink } from './deeplinks';
import { setupAutoUpdater } from './updater';
import { autoUpdater } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

function createWindow(): void {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width: bounds?.width ?? 1280,
    height: bounds?.height ?? 800,
    x: bounds?.x,
    y: bounds?.y,
    title: 'MeteorEdit',
    icon: path.join(__dirname, '..', 'resources', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  // Save window bounds on resize/move
  const saveBounds = (): void => {
    if (mainWindow && !mainWindow.isMinimized() && !mainWindow.isMaximized()) {
      store.set('windowBounds', mainWindow.getBounds());
    }
  };
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  createTray(mainWindow);
  registerShortcuts(mainWindow);
  setupAutoUpdater(mainWindow);

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting && store.get('minimizeToTray') && mainWindow) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Load the server URL or show the connect screen
  const serverUrl = store.get('serverUrl');
  if (serverUrl) {
    mainWindow.loadURL(serverUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'connect.html'));
  }
}

// IPC Handlers
ipcMain.handle('get-server-url', () => store.get('serverUrl'));

ipcMain.handle('set-server-url', (_event, url: string) => {
  store.set('serverUrl', url);
  if (mainWindow) {
    mainWindow.loadURL(url);
  }
});

ipcMain.handle('test-server-connection', async (_event, url: string): Promise<boolean> => {
  try {
    const response = await fetch(`${url}/api/settings/branding`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
});

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.on('show-notification', (_event, title: string, body: string) => {
  showNativeNotification(title, body, mainWindow);
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

// Register deep link protocol
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('meteoredit', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('meteoredit');
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const deepLinkUrl = commandLine.find(arg => arg.startsWith('meteoredit://'));
    if (deepLinkUrl && mainWindow) {
      handleDeepLink(deepLinkUrl, mainWindow);
    }
  });

  app.on('will-quit', () => {
    unregisterShortcuts();
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    app.quit();
  });
}

export { mainWindow };
