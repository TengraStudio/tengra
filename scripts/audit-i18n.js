
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Helper to flatten object keys
function flattenKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            keys = keys.concat(flattenKeys(obj[key], prefix + key + '.'));
        } else {
            keys.push(prefix + key);
        }
    }
    return keys;
}

function loadLocaleFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    // Remove imports if any (though we saw none in en/zh)
    // The file structure is: export const <lang> = { ... };
    // or sometimes includes type casting etc.

    // Simple regex to extract the object: 
    // export const (\w+) = ({[\s\S]*});
    // This might be fragile if there are comments or complex syntax.

    // A more robust way: execute the file content in a sandbox where `export` handles it.
    // But since it's TS, we might have types.
    // Let's strip simple types?
    // Actually, based on previous view_file, these files look like clean JS/TS object literals.

    // Let's try to mock the environment.
    const sandbox = {
        exports: {},
        module: { exports: {} },
        // Mock known imports if any appeared (none seen so far)
    };

    // Remove "export const en =" and replace with "const en =" or just execute.
    // But "export" keyword is invalid in normal script without module type.

    // Hack: replace "export const" with "const" and add "exports.<lang> = <lang>" at the end?
    // Or just use regex to match the object content.

    // Let's try regex first as it's cleaner if the file is simple.
    const match = content.match(/export\s+const\s+(\w+)\s*=\s*({[\s\S]*})/);
    if (match) {
        const langCode = match[1];
        let objContent = match[2];

        // Remove trailing semicolon if present
        if (objContent.trim().endsWith(';')) {
            objContent = objContent.trim().slice(0, -1);
        }

        // Evaluate the object
        try {
            // We need to be careful about unquoted keys or comments.
            // Using vm.runInNewContext is better.
            const script = `(${objContent})`;
            return vm.runInNewContext(script, {});
        } catch (e) {
            console.error(`Failed to eval content for ${filePath}:`, e.message);
            return null;
        }
    } else {
        console.error(`Could not match pattern in ${filePath}`);
        return null;
    }
}

async function audit() {
    const i18nDir = path.join(__dirname, '../src/renderer/i18n');
    const locales = ['ar', 'de', 'es', 'fr', 'ja', 'tr', 'zh', 'en'];

    console.log('Loading en.ts...');
    const en = loadLocaleFile(path.join(i18nDir, 'en.ts'));
    if (!en) {
        console.error('Failed to load en.ts. Exiting.');
        process.exit(1);
    }

    const enKeys = new Set(flattenKeys(en));
    console.log(`Base (en) has ${enKeys.size} keys.`);

    for (const lang of locales) {
        if (lang === 'en') continue;

        const filePath = path.join(i18nDir, `${lang}.ts`);
        if (!fs.existsSync(filePath)) {
            console.error(`File missing: ${filePath}`);
            continue;
        }

        const data = loadLocaleFile(filePath);
        if (!data) continue;

        const langKeys = new Set(flattenKeys(data));
        const missing = [...enKeys].filter(k => !langKeys.has(k));

        console.log(`\nLanguage: ${lang}`);
        console.log(`Total keys: ${langKeys.size}`);
        console.log(`Missing keys: ${missing.length}`);

        if (missing.length > 0) {
            allMissing[lang] = missing;
            if (missing.length > 20) {
                console.log(`First 20 missing keys:`);
                missing.slice(0, 20).forEach(k => console.log(`  - ${k}`));
                console.log(`  ... and ${missing.length - 20} more.`);
            } else {
                missing.forEach(k => console.log(`  - ${k}`));
            }
        } else {
            console.log("No missing keys.");
        }
    }

    fs.writeFileSync('missing_keys.json', JSON.stringify(allMissing, null, 2));
    console.log('Saved missing keys to missing_keys.json');
}

let allMissing = {};
audit();
