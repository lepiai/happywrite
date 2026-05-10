const electron = require('electron');
console.log('typeof electron:', typeof electron);
console.log('electron:', electron);
console.log('Object.keys(electron):', Object.keys(electron));

if (typeof electron === 'object') {
  console.log('electron.app:', electron.app);
  console.log('electron.BrowserWindow:', electron.BrowserWindow);
}

process.exit(0);