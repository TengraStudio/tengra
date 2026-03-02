const fs = require('fs');
const path = require('path');

function walk(dir) {
    let files = [];
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
            files = files.concat(walk(p));
        } else if (p.endsWith('.test.ts')) {
            files.push(p);
        }
    }
    return files;
}

const files = walk('src/tests/');
let updated = 0;
for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes("vi.mock('@main/utils/ipc-wrapper.util'")) {
        if (!content.includes('createValidatedIpcHandler')) {
            // we look for "vi.mock('@main/utils/ipc-wrapper.util', () => ({"
            // or without () around {}
            content = content.replace(
                /vi\.mock\('@main\/utils\/ipc-wrapper\.util',\s*\(\)\s*=>\s*\(?\{/g,
                "vi.mock('@main/utils/ipc-wrapper.util', () => ({\n    createValidatedIpcHandler: (_config, handler) => handler,"
            );
            fs.writeFileSync(file, content);
            updated++;
        }
    }
}
console.log('Updated ' + updated + ' files.');
