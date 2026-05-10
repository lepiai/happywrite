import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  fetchUrl: (url: string) => ipcRenderer.invoke('fetch-url', url),
  getDiskSpace: () => ipcRenderer.invoke('get-disk-space'),
  saveFile: (data: { name: string; buffer: ArrayBuffer; mimeType: string }) =>
    ipcRenderer.invoke('save-file', data),
  showSaveDialog: (options: { title: string; defaultPath: string; filters: Array<{ name: string; extensions: string[] }> }) =>
    ipcRenderer.invoke('show-save-dialog', options),
})

export {}
