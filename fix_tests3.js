const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/tests/renderer/features/models/ModelSelectorModal.test.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix TypeScript strict null checks for closest('button')
content = content.replace(/\.closest\('button'\)(?!\!)/g, ".closest('button')!");

// Fix wait very long model test
content = content.replace(/screen\.getByTestId\('model-very-long-model-id'\)/g, "screen.getByText(/AAAA+/).closest('button')!");

// Save
fs.writeFileSync(filePath, content);
console.log('Fixed typescript closest button assertions');
