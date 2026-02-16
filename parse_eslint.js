const fs = require('fs');
const report = JSON.parse(fs.readFileSync('eslint_report.json', 'utf8'));
report.forEach(file => {
    if (file.warningCount > 0 || file.errorCount > 0) {
        console.log(`FILE: ${file.filePath}`);
        file.messages.forEach(msg => {
            console.log(`  [${msg.severity === 2 ? 'ERROR' : 'WARN'}] ${msg.line}:${msg.column} - ${msg.message} (${msg.ruleId})`);
        });
        console.log('---');
    }
});
