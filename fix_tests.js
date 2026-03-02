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
            let replaced = false;
            content = content.replace(
                /vi\.mock\('@main\/utils\/ipc-wrapper\.util',\s*\(\)\s*=>\s*\(\{\s*([\s\S]*?)\}\)\);/g,
                (match, inner) => {
                    replaced = true;
                    // match will be the whole vi.mock(...)
                    const trailingComma = inner.trim().endsWith(',') ? '' : ',';
                    const inject = trailingComma + `\n    createValidatedIpcHandler: vi.fn((_config, handler) => handler),\n`;
                    return `vi.mock('@main/utils/ipc-wrapper.util', () => ({${inner}${inject}}));`;
                }
            );
            if (replaced) {
                fs.writeFileSync(file, content);
                updated++;
            }
        }
    }
}
console.log('Updated ' + updated + ' files.');
