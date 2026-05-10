"use strict";
const { app, BrowserWindow } = require('electron');
const path = require('path');

console.log('Starting test script...');
console.log('Electron app:', typeof app);
console.log('Electron BrowserWindow:', typeof BrowserWindow);

function createWindow() {
  console.log('Creating window...');
  const win = new BrowserWindow({
    width: 800,
    height: 600,
  });
  win.loadFile(path.join(__dirname, 'test.html'));
}

console.log('App ready event...');
app.whenReady().then(() => {
  console.log('App is ready');
  createWindow();
});

app.on('window-all-closed', () => {
  console.log('Window all closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

console.log('Script loaded');