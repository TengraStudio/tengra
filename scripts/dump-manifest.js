const fs = require('fs');
const path = require('path');

const tsPath = path.join(__dirname, '..', 'src', 'main', 'services', 'system', 'runtime-manifest.service.ts');
const tsContent = fs.readFileSync(tsPath, 'utf8');

const match = tsContent.match(/BUILTIN_COMPONENTS:\s*RuntimeManifestComponent\[\]\s*=\s*(\[[\s\S]*?\]);\s*constructor/);
if (!match) {
    throw new Error("Could not find BUILTIN_COMPONENTS in runtime-manifest.service.ts");
}

let arrayStr = match[1];
// Mock the translation function since the array contains t('...') calls
arrayStr = arrayStr.replace(/t\((['"`].*?['"`])\)/g, '$1');

// Extract the components using eval
const components = eval('(' + arrayStr + ')');

const manifest = {
    schemaVersion: 1,
    releaseTag: "latest",
    generatedAt: new Date().toISOString(),
    components: components
};

const outPath = path.join(__dirname, '..', 'runtime-manifest.json');
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log('Manifest written to runtime-manifest.json');
