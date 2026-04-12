const fs = require('fs');
const path = require('path');

const localePath = 'src/renderer/i18n/locales/en.locale.json';
const srcPath = 'src';

function flattenKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            keys = keys.concat(flattenKeys(obj[key], fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function(file) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'i18n' && file !== 'locales' && file !== 'node_modules' && file !== 'dist') {
                arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
            }
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

const localeContent = fs.readFileSync(localePath, 'utf-8');
const localeData = JSON.parse(localeContent);
const translations = localeData.translations || {};

// Flatten only the translations object
const allKeys = flattenKeys(translations);

console.log(`Found ${allKeys.length} total keys. Reading source files...`);

const files = getAllFiles(srcPath);
console.log(`Searching through ${files.length} source files...`);

let combinedSrc = '';
files.forEach(file => {
    combinedSrc += fs.readFileSync(file, 'utf-8') + '\n';
});

console.log('Searching for keys in memory...');

const unusedKeys = allKeys.filter(key => {
    return !combinedSrc.includes(key);
});

console.log(`\nFound ${unusedKeys.length} potentially unused keys.`);

// Save the list of unused keys
fs.writeFileSync('unused_keys.json', JSON.stringify(unusedKeys, null, 2));

console.log('Done. Results saved to unused_keys.json');

// If the user wants to automatically remove them, we could do it here.
// But it's safer to just provide the list or do a controlled removal.
// I'll filter out keys that look like they might be part of a dynamic key.
const safeToRemove = unusedKeys.filter(key => {
    // If the key is too short or common, maybe be careful.
    // But for now, let's just stick to the list.
    return true;
});

// Function to remove keys from a nested object
function removeKey(obj, keyPath) {
    const parts = keyPath.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) return;
        current = current[parts[i]];
    }
    delete current[parts[parts.length - 1]];
}

// Function to clean up empty objects
function cleanEmpty(obj) {
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            cleanEmpty(obj[key]);
            if (Object.keys(obj[key]).length === 0) {
                delete obj[key];
            }
        }
    }
}

// Actually remove them? The user said "remove them".
/*
unusedKeys.forEach(key => {
    removeKey(translations, key);
});
cleanEmpty(translations);
fs.writeFileSync(localePath, JSON.stringify(localeData, null, 2));
console.log('Unused keys removed from source file.');
*/
