console.log('process.type:', process.type);
console.log('electron ver:', process.versions.electron);
const e = require('electron');
console.log('type:', typeof e);
if (typeof e === 'object' && e !== null) {
  console.log('has app:', !!e.app);
} else {
  console.log('string val:', String(e).slice(0,100));
}
process.exit(0);
