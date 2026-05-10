const electron = require('electron');
console.log('typeof electron:', typeof electron);
console.log('electron:', electron);

if (typeof electron === 'object') {
  console.log('electron.app:', electron.app);
  console.log('electron.BrowserWindow:', electron.BrowserWindow);
} else {
  console.log('electron is not an object!');
  console.log('electron.toString():', electron.toString());
}

setTimeout(() => {
  process.exit(0);
}, 3000);