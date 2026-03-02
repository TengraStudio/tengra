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
    let changed = false;
    
    if (content.includes("vi.mock('@main/utils/ipc-wrapper.util'") && !content.includes("vi.mock('@main/ipc/sender-validator'")) {
        // Find the place after vi.mock('@main/utils/ipc-wrapper.util'
        const idx = content.indexOf("vi.mock('@main/utils/ipc-wrapper.util'");
        const mockStr = "\nvi.mock('@main/ipc/sender-validator', () => ({\n    createMainWindowSenderValidator: vi.fn(() => vi.fn())\n}));\n";
        content = content.slice(0, idx) + mockStr + content.slice(idx);
        changed = true;
    }
    
    if (changed) {
        fs.writeFileSync(file, content);
        updated++;
    }
}
console.log('Updated ' + updated + ' files.');
