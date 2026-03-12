import { app, Menu, Tray, BrowserWindow } from 'electron';
import path from 'path';
import store from './store';

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow): Tray {
  tray = new Tray(path.join(__dirname, '..', 'resources', 'icon.ico'));
  tray.setToolTip('MeteorEdit');

  const updateMenu = (): void => {
    const launchAtStartup = store.get('launchAtStartup');
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Ouvrir MeteorEdit',
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        },
      },
      { type: 'separator' },
      {
        label: 'Changer de serveur',
        click: () => {
          store.set('serverUrl', '');
          mainWindow.loadFile(path.join(__dirname, 'connect.html'));
          mainWindow.show();
          mainWindow.focus();
        },
      },
      { type: 'separator' },
      {
        label: 'Lancer au démarrage',
        type: 'checkbox',
        checked: launchAtStartup,
        click: (menuItem) => {
          store.set('launchAtStartup', menuItem.checked);
          app.setLoginItemSettings({ openAtLogin: menuItem.checked });
        },
      },
      { type: 'separator' },
      {
        label: 'Quitter',
        click: () => {
          app.exit(0);
        },
      },
    ]);
    tray?.setContextMenu(contextMenu);
  };

  updateMenu();

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return tray;
}
