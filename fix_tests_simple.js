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
    if (content.includes("createIpcHandler: vi.fn(")) {
        if (!content.includes('createValidatedIpcHandler:')) {
            content = content.replace(
                /createIpcHandler:\s*vi\.fn\(\(_name,?\s*handler\)\s*=>\s*handler\)/g,
                "createIpcHandler: vi.fn((_name, handler) => handler),\n    createValidatedIpcHandler: vi.fn((_config, handler) => handler)"
            );
            fs.writeFileSync(file, content);
            updated++;
        }
    }
}
console.log('Updated ' + updated + ' files.');
