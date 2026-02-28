
const fs = require('fs');
const path = require('path');

const featuresDir = 'c:\\Users\\agnes\\Desktop\\projects\\tengra\\src\\renderer\\features';
const features = fs.readdirSync(featuresDir).filter(f => fs.statSync(path.join(featuresDir, f)).isDirectory());

const importRe = /from ['"]@\/features\/([^/'"]+)/g;

const crossImports = {};

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        const fullPath = path.join(dir, f);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath, callback);
        } else {
            callback(fullPath);
        }
    });
}

features.forEach(feature => {
    const featurePath = path.join(featuresDir, feature);
    walk(featurePath, (filePath) => {
        if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                let match;
                while ((match = importRe.exec(content)) !== null) {
                    const importedFeature = match[1];
                    if (importedFeature !== feature) {
                        if (!crossImports[importedFeature]) {
                            crossImports[importedFeature] = new Set();
                        }
                        crossImports[importedFeature].add(feature);
                        console.log(`File ${filePath} imports from ${importedFeature}`);
                    }
                }
            } catch (e) {
                console.error(`Error reading ${filePath}: ${e}`);
            }
        }
    });
});

console.log("\nCross-feature import summary:");
for (const [target, sourcers] of Object.entries(crossImports)) {
    console.log(`Feature '${target}' is imported by: ${Array.from(sourcers).join(', ')}`);
}
