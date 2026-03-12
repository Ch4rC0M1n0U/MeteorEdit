import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import store from './store';
import { createTray } from './tray';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width: bounds?.width ?? 1280,
    height: bounds?.height ?? 800,
    x: bounds?.x,
    y: bounds?.y,
    title: 'MeteorEdit',
    icon: path.join(__dirname, '..', 'resources', 'icon.ico'),
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

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (store.get('minimizeToTray') && mainWindow) {
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

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    app.quit();
  });
}

export { mainWindow };
