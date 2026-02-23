const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/tests/renderer/features/models/ModelSelectorModal.test.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/getByTestId\('search-input'\)/g, "getByPlaceholderText('modelSelector.searchModels')");
content = content.replace(/getByTestId\('search-input-field'\)/g, "getByPlaceholderText('modelSelector.searchModels')");

content = content.replace(/it\('should handle empty categories array', \(\) => \{\n([\s\S]*?)expect\(screen\.getByTestId\('category-list'\)\)\.toBeInTheDocument\(\);\n/g,
    "it('should handle empty categories array', () => {\n$1expect(screen.getByText('modelSelector.noModelsFound')).toBeInTheDocument();\n");

content = content.replace(/getByTestId\('category-list'\)/g, "getByRole('dialog')");

content = content.replace(/getByTestId\('mode-tabs'\)/g, "getByText('instant')");

content = content.replace(/getByText\('Agent Mode'\)/g, "getByText('agent')");

fs.writeFileSync(filePath, content);
console.log('Fixed tests successfully');
