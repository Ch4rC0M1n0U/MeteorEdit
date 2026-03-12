import { app, BrowserWindow, ipcMain, Menu } from 'electron';
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

  // Hide default menu bar
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: bounds?.width ?? 1280,
    height: bounds?.height ?? 800,
    x: bounds?.x,
    y: bounds?.y,
    title: 'MeteorEdit',
    icon: path.join(__dirname, '..', 'resources', 'icon.ico'),
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f0f1a',
      symbolColor: '#e0e0e0',
      height: 36,
    },
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

  // Inject custom titlebar into remote pages
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) return;
    const currentUrl = mainWindow.webContents.getURL();
    // Only inject into remote server pages, not connect.html (which has its own titlebar)
    if (currentUrl.startsWith('http')) {
      mainWindow.webContents.insertCSS(`
        .me-desktop-titlebar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 36px;
          background: var(--me-bg-surface, #111827);
          display: flex;
          align-items: center;
          padding-left: 12px;
          gap: 10px;
          -webkit-app-region: drag;
          z-index: 99999;
          border-bottom: 1px solid var(--me-border, rgba(99,179,237,0.12));
          font-family: var(--me-font-mono, 'JetBrains Mono'), monospace;
          transition: background 0.2s, border-color 0.2s;
        }
        .me-desktop-titlebar * {
          -webkit-app-region: drag;
        }
        .me-desktop-titlebar-icon {
          width: 18px;
          height: 18px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
        }
        .me-desktop-titlebar-icon svg {
          width: 12px;
          height: 12px;
          fill: var(--me-accent, #38bdf8);
        }
        .me-desktop-titlebar-icon img {
          width: 18px;
          height: 18px;
          object-fit: contain;
          border-radius: 3px;
        }
        .me-desktop-titlebar-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--me-text-primary, #e2e8f0);
          opacity: 0.7;
          letter-spacing: 0.01em;
          transition: color 0.2s;
        }
        #app {
          margin-top: 36px !important;
          height: calc(100% - 36px) !important;
        }
      `);
      mainWindow.webContents.executeJavaScript(`
        (function() {
          if (document.querySelector('.me-desktop-titlebar')) return;

          const tb = document.createElement('div');
          tb.className = 'me-desktop-titlebar';
          tb.innerHTML = '<div class="me-desktop-titlebar-icon" id="me-tb-icon"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg></div><span class="me-desktop-titlebar-title" id="me-tb-title"></span>';
          document.body.prepend(tb);

          // Update title from document.title (set by branding store)
          function updateTitle() {
            const el = document.getElementById('me-tb-title');
            if (el) el.textContent = document.title || 'MeteorEdit';
          }
          updateTitle();
          new MutationObserver(updateTitle).observe(
            document.querySelector('title') || document.head,
            { childList: true, subtree: true, characterData: true }
          );

          // Update logo from branding (check for logo img in AppBar)
          let logoFound = false;
          function updateLogo() {
            if (logoFound) return;
            const iconEl = document.getElementById('me-tb-icon');
            if (!iconEl) return;
            const appBarLogo = document.querySelector('img.me-appbar-logo');
            if (appBarLogo && appBarLogo.src) {
              logoFound = true;
              iconEl.style.background = 'none';
              iconEl.innerHTML = '';
              const img = document.createElement('img');
              img.src = appBarLogo.src;
              iconEl.appendChild(img);
            }
          }
          setTimeout(updateLogo, 2000);
          setTimeout(updateLogo, 4000);

          // Sync titlebar overlay colors with theme
          function syncOverlayTheme() {
            const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
            const style = getComputedStyle(document.documentElement);
            const bg = style.getPropertyValue('--me-bg-surface').trim() || (isDark ? '#111827' : '#ffffff');
            const sym = isDark ? '#e2e8f0' : '#0f172a';
            if (window.electronAPI && window.electronAPI.setTitleBarOverlay) {
              window.electronAPI.setTitleBarOverlay({ color: bg, symbolColor: sym, height: 36 });
            }
          }
          syncOverlayTheme();
          new MutationObserver(syncOverlayTheme).observe(
            document.documentElement,
            { attributes: true, attributeFilter: ['data-theme'] }
          );
        })();
      `);
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

function registerIpcHandlers(): void {
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

  ipcMain.on('set-titlebar-overlay', (_event, options: { color: string; symbolColor: string; height: number }) => {
    if (mainWindow) {
      mainWindow.setTitleBarOverlay(options);
    }
  });
}

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

  app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}

export { mainWindow };
