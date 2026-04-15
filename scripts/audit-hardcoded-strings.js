const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(file => {
        const filepath = path.join(dir, file);
        const stats = fs.statSync(filepath);
        if (stats.isDirectory()) {
            walk(filepath, callback);
        } else if (stats.isFile() && (filepath.endsWith('.tsx') || filepath.endsWith('.ts'))) {
            callback(filepath);
        }
    });
}

const hardcodedRegex = [
    // Matches text between tags: <span>Text</span>
    { regex: />([A-Z][a-z0-9\s!.,?'-]{2,})</g, type: 'tag' },
    // Matches attributes: placeholder="Text"
    { regex: /(placeholder|title|label)="([A-Z][a-z0-9\s!.,?'-]{2,})"/g, type: 'attr' }
];

const ignoreList = [
    'node_modules',
    '.git',
    'dist',
    'tests',
    'i18n',
    'lucide'
];

const results = [];

walk(path.join(__dirname, '..', 'src', 'renderer'), (file) => {
    if (ignoreList.some(ignore => file.includes(ignore))) return;
    
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
        // Skip lines that already have {t('...')}
        if (line.includes('{t(') || line.includes('t("')) return;
        
        hardcodedRegex.forEach(({ regex, type }) => {
            let match;
            while ((match = regex.exec(line)) !== null) {
                const text = type === 'tag' ? match[1] : match[2];
                // Further filter to avoid common false positives (CSS classes, etc.)
                if (text.trim().length > 0 && !line.includes('className=')) {
                   results.push({ file, line: index + 1, text, type });
                }
            }
        });
    });
});

console.log(JSON.stringify(results, null, 2));
