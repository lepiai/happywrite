const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const Module = require('module');

const electronPath = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');
const mainPath = path.join(__dirname, 'out', 'main', 'index.js');
const tempMainPath = path.join(__dirname, 'out', 'main', 'index.temp.js');

console.log('Creating wrapper script...');

let originalMain = fs.readFileSync(mainPath, 'utf-8');

const wrappedMain = `"use strict";
const path = require("path");
const fs = require("fs");
const Module = require("module");
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  if (id === "electron") {
    const electronPath = require.resolve("electron");
    const distDir = path.dirname(electronPath);
    const asarPath = path.join(distDir, "resources", "electron.asar");

    try {
      if (fs.existsSync(asarPath)) {
        const electronModule = require(asarPath);
        if (electronModule && electronModule.app) {
          Module.prototype.require = originalRequire;
          return electronModule;
        }
      }
    } catch (err) {
      console.log("Error loading electron from asar:", err.message);
    }

    Module.prototype.require = originalRequire;
    return originalRequire.call(this, id);
  }
  return originalRequire.call(this, id);
};

${originalMain.replace('"use strict";', '').replace(/const path = require\("path"\);?/, '').replace(/const fs = require\("fs"\);?/, '').replace(/const Module = require\("module"\);?/, '')}
`;

fs.writeFileSync(tempMainPath, wrappedMain);

console.log('Starting Electron with wrapper...');
console.log('Electron:', electronPath);
console.log('Main:', tempMainPath);

const child = spawn(electronPath, [tempMainPath], {
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
  try {
    fs.unlinkSync(tempMainPath);
  } catch (err) {}
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('Failed to start Electron:', err);
  try {
    fs.unlinkSync(tempMainPath);
  } catch (e) {}
  process.exit(1);
});