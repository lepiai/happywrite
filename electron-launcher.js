const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const electronPath = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');
const mainPath = path.join(__dirname, 'out', 'main', 'index.js');

console.log('=== Electron Launcher ===');
console.log('Electron path:', electronPath);
console.log('Main path:', mainPath);
console.log('Platform:', process.platform);
console.log('Arch:', process.arch);
console.log('Node version:', process.version);
console.log('Electron version:', process.versions.electron);

const child = spawn(electronPath, [mainPath], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_PATH: path.join(__dirname, 'node_modules'),
    ELECTRON_RUN_AS_NODE: '0'
  }
});

child.on('error', (err) => {
  console.error('Failed to start Electron:', err);
  process.exit(1);
});

child.on('close', (code) => {
  console.log('Electron exited with code:', code);
  process.exit(code || 0);
});