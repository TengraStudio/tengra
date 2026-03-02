const fs = require('fs');
const path = require('path');

function walk(dir) {
    let files = [];
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
            files = files.concat(walk(p));
        } else if (p.endsWith('.test.ts') || p.endsWith('.spec.ts')) {
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

    // Remove sender-validator mock
    const senderMockRegex = /vi\.mock\('@main\/ipc\/sender-validator'[\s\S]*?\}\)\);\n/g;
    if (senderMockRegex.test(content)) {
        content = content.replace(senderMockRegex, '');
        changed = true;
    }

    // Remove ipc-wrapper.util mock. It could be multiline.
    // It usually looks like vi.mock('@main/utils/ipc-wrapper.util', ...));
    // Since they can be complex, let's just find "vi.mock('@main/utils/ipc-wrapper.util'" and remove until the next empty line or vi.mock or describe.
    const ipcMockStart = content.indexOf("vi.mock('@main/utils/ipc-wrapper.util'");
    if (ipcMockStart !== -1) {
        // Find the balanced closing '));'
        let openCount = 0;
        let p = ipcMockStart;
        let started = false;
        while (p < content.length) {
            if (content[p] === '(') { openCount++; started = true; }
            else if (content[p] === ')') { openCount--; }

            p++;
            if (started && openCount === 0 && content.substring(p).trimStart().startsWith(';')) {
                p = content.indexOf(';', p) + 1;
                break;
            } else if (started && openCount === 0) {
                break;
            }
        }

        // Include following newlines
        while (p < content.length && (content[p] === '\n' || content[p] === '\r')) {
            p++;
        }

        content = content.slice(0, ipcMockStart) + content.slice(p);
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content);
        updated++;
    }
}
console.log('Removed manual mocks from ' + updated + ' files.');
