const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/tests/main/services/system/runtime-path.service.test.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
    /getPath,[\s\n]+},/,
    "getPath,\n        getAppPath: vi.fn().mockReturnValue('/mock/appPath'),\n    },"
);

fs.writeFileSync(filePath, content);
console.log('Fixed runtime-path.service.test.ts');
