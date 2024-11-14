// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require('electron')
const qrcode = require('qrcode');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('getConfig'),
  setConfig: (config) => ipcRenderer.invoke('setConfig', config),
  onTargetPositionsUpdated: (callback) => ipcRenderer.on('target_positions', (_event, value) => callback(value)),
  onIPChange: (callback) => ipcRenderer.on('ipchange', (_event, value) => callback(value)),
  generateQRCode: async (text) => {
    return new Promise((resolve, reject) => {
      qrcode.toDataURL(text, (err, url) => {
        if (err) {
          reject(err)
        } else {
          resolve(url)
        }
      })
    })
  },
})