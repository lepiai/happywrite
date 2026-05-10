const path = require('path');
const { spawn } = require('child_process');

const electronPath = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');
const mainPath = path.join(__dirname, 'out', 'main', 'index.js');

console.log('Starting Electron with:');
console.log('Electron:', electronPath);
console.log('Main:', mainPath);

const child = spawn(electronPath, [mainPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

child.stdout.on('data', (data) => {
  console.log(data.toString());
});

child.stderr.on('data', (data) => {
  console.error(data.toString());
});

child.on('close', (code) => {
  console.log('Electron exited with code:', code);
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('Failed to start Electron:', err);
  process.exit(1);
});