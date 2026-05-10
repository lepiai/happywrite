const electron = require('electron');
console.log('Type of require("electron"):', typeof electron);
console.log('Electron:', electron);
console.log('Has app?:', electron && electron.app);
console.log('Has BrowserWindow?:', electron && electron.BrowserWindow);
