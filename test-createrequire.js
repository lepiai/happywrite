const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const electronExe = path.join(__dirname, 'node_modules/electron/dist/electron.exe');
console.log('Electron exe path:', electronExe);
console.log('Exists:', fs.existsSync(electronExe));
console.log('process.versions.electron:', process.versions.electron);

if (process.versions.electron) {
  try {
    console.log('Trying createRequire...');
    const electronRequire = createRequire(electronExe);
    const electronModule = electronRequire('electron');
    console.log('electronModule type:', typeof electronModule);
    console.log('electronModule:', electronModule);
    console.log('Has app?:', electronModule && electronModule.app);
  } catch (err) {
    console.error('Error:', err.message);
  }
}
