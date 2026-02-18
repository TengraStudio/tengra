
import * as fs from 'fs';
import * as path from 'path';

console.log('Debug script started');
console.log('Current directory:', process.cwd());
console.log('Dirname:', __dirname);

const i18nPath = path.join(__dirname, '../src/renderer/i18n/en.ts');
console.log('Looking for:', i18nPath);

if (fs.existsSync(i18nPath)) {
    console.log('File exists.');
} else {
    console.error('File does not exist.');
}

try {
    const en = require('../src/renderer/i18n/en');
    console.log('Require successful. Keys:', Object.keys(en));
} catch (e) {
    console.error('Require failed:', e);
}
