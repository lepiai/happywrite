const fs = require('fs');
const path = require('path');

const electronDir = path.join(__dirname, 'node_modules', 'electron');

async function deleteDir(dir) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        await deleteDir(filePath);
      } else {
        try {
          fs.unlinkSync(filePath);
          console.log(`Deleted: ${filePath}`);
        } catch (e) {
          console.log(`Failed to delete: ${filePath} - ${e.message}`);
        }
      }
    }
    try {
      fs.rmdirSync(dir);
      console.log(`Deleted dir: ${dir}`);
    } catch (e) {
      console.log(`Failed to delete dir: ${dir} - ${e.message}`);
    }
  } catch (e) {
    console.log(`Error reading dir: ${dir} - ${e.message}`);
  }
}

deleteDir(electronDir).then(() => {
  console.log('Done');
}).catch(err => {
  console.error('Error:', err);
});