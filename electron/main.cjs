const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { Leaderboard } = require('./leaderboard.cjs');
const testMode = process.argv.includes('--test-mode') && !app.isPackaged;
const root = process.env.PARKING_TEST_DATA && testMode ? process.env.PARKING_TEST_DATA : process.env.PORTABLE_EXECUTABLE_DIR || (app.isPackaged ? path.dirname(process.execPath) : path.resolve(__dirname, '..'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'parking-runtime-'));
app.setPath('userData', profile);
app.setPath('sessionData', profile);
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-background-networking');
let win, board;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    board = new Leaderboard(root);
    const pageURL = pathToFileURL(path.resolve(__dirname, '../dist/index.html')).href;
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: /^https?:|^wss?:/i.test(details.url) }));
    session.defaultSession.setPermissionRequestHandler((_web, _permission, callback) => callback(false));
    win = new BrowserWindow({ width: 1920, height: 1080, minWidth: 960, minHeight: 540,
      fullscreen: !testMode, autoHideMenuBar: true, backgroundColor: '#10271e', title: 'PARKING MANAGER',
      icon: path.join(__dirname, '../dist/assets/icon.png'),
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: testMode, backgroundThrottling: false } });
    win.setMenu(null);
    const valid = e => e.sender === win.webContents && e.senderFrame?.url.startsWith(pageURL);
    ipcMain.handle('ranking:read', e => { if (!valid(e)) throw new Error('Invalid sender'); return board.snapshot(); });
    ipcMain.handle('ranking:add', (e, name, score) => { if (!valid(e)) throw new Error('Invalid sender'); return board.add(name, score); });
    ipcMain.handle('app:quit', e => { if (valid(e)) app.quit(); });
    ipcMain.handle('app:fullscreen', e => { if (valid(e)) win.setFullScreen(!win.isFullScreen()); });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', e => e.preventDefault());
    win.webContents.on('before-input-event', (event, input) => { if (input.type === 'keyDown' && input.key === 'F11') { event.preventDefault(); win.setFullScreen(!win.isFullScreen()); } });
    win.loadFile(path.resolve(__dirname, '../dist/index.html'), { query: testMode ? { test: '1' } : {} });
  });
}
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} });
