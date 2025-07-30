const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startPython: () => ipcRenderer.send('start-python'),
  loadGestures: () => ipcRenderer.invoke('load-gestures'),
  getWeather: () => ipcRenderer.invoke("get-weather"),
});
