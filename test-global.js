console.log('Process versions:', process.versions);
console.log('Has electron:', process.versions.electron ? 'Yes' : 'No');
console.log('Global keys:', Object.keys(global).filter(k => k.includes('electron')));
console.log('App:', typeof app);
console.log('BrowserWindow:', typeof BrowserWindow);