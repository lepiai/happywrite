const fs = require('fs');

const output = [];
output.push('Process versions: ' + JSON.stringify(process.versions));
output.push('Has electron: ' + (process.versions.electron ? 'Yes' : 'No'));
output.push('Has app: ' + (typeof app !== 'undefined' ? 'Yes (' + typeof app + ')' : 'No'));
output.push('Has BrowserWindow: ' + (typeof BrowserWindow !== 'undefined' ? 'Yes' : 'No'));
output.push('Has require: ' + (typeof require !== 'undefined' ? 'Yes' : 'No'));

if (typeof require !== 'undefined') {
  try {
    const electron = require('electron');
    output.push('require("electron") type: ' + typeof electron);
    output.push('require("electron") value: ' + String(electron));
    output.push('require("electron") keys: ' + (typeof electron === 'object' ? Object.keys(electron).join(', ') : 'N/A'));
  } catch (err) {
    output.push('require("electron") error: ' + err.message);
  }
}

fs.writeFileSync('test-result.txt', output.join('\n'));
console.log('Test completed, results written to test-result.txt');