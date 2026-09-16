const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('parking', {
  ranking: () => ipcRenderer.invoke('ranking:read'),
  save: (name, score) => ipcRenderer.invoke('ranking:add', name, score),
  quit: () => ipcRenderer.invoke('app:quit'),
  fullscreen: () => ipcRenderer.invoke('app:fullscreen')
});
