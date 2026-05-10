import { app, BrowserWindow, ipcMain, dialog, net } from 'electron'
import path from 'path'
import fs from 'fs'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle('fetch-url', async (_event, url: string) => {
  try {
    const response = await fetch(url)
    const html = await response.text()
    return { success: true, content: html, status: response.status }
  } catch (error) {
    return {
      success: false,
      content: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})

ipcMain.handle('get-disk-space', async () => {
  try {
    const drive = process.platform === 'win32' ? 'C:' : '/'
    const stats = await fs.promises.statfs(drive)
    const total = stats.bsize * stats.blocks
    const free = stats.bsize * stats.bfree
    return {
      success: true,
      total,
      free,
      used: total - free,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})

ipcMain.handle('save-file', async (_event, data: { name: string; buffer: ArrayBuffer; mimeType: string }) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '保存文件',
      defaultPath: data.name,
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] },
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    const buffer = Buffer.from(data.buffer)
    await fs.promises.writeFile(result.filePath, buffer)
    return { success: true, filePath: result.filePath }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})

ipcMain.handle('show-save-dialog', async (_event, options: {
  title: string;
  defaultPath: string;
  filters: Array<{ name: string; extensions: string[] }>;
}) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow!, options)
    return result
  } catch (error) {
    return {
      canceled: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

setInterval(() => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const isOnline = net.isOnline()
  mainWindow.webContents.send('network-status', isOnline)
}, 5000)
