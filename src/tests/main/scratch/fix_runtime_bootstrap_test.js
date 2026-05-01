const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/tests/main/services/system/runtime-bootstrap.service.test.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix path expectations
content = content.replace(/'Tengra', 'runtime', 'bin'/g, "'runtime', 'managed', 'bin'");
content = content.replace(/'Tengra', 'runtime', 'downloads'/g, "'runtime', 'cache', 'downloads'");
content = content.replace(/'Tengra', 'runtime', 'manifests'/g, "'runtime', 'cache', 'manifests'");

fs.writeFileSync(filePath, content);
console.log('Fixed runtime-bootstrap.service.test.ts');
