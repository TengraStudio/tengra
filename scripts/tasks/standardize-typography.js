const fs = require('fs');
const path = require('path');

const walk = (dir, callback) => {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
        const filepath = path.join(dir, file);
        const stats = fs.statSync(filepath);
        if (stats.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                walk(filepath, callback);
            }
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            callback(filepath);
        }
    });
};

const replacements = [
    // Headings (Size + Weight combinations)
    { from: /text-4xl\s+font-bold/g, to: 'typo-h1' },
    { from: /font-bold\s+text-4xl/g, to: 'typo-h1' },
    { from: /text-3xl\s+font-bold/g, to: 'typo-h2' },
    { from: /font-bold\s+text-3xl/g, to: 'typo-h2' },
    { from: /text-2xl\s+font-semibold/g, to: 'typo-h3' },
    { from: /font-semibold\s+text-2xl/g, to: 'typo-h3' },
    { from: /text-2xl\s+font-bold/g, to: 'typo-h3 font-bold' },
    { from: /font-bold\s+text-2xl/g, to: 'typo-h3 font-bold' },
    
    // Individual sizes
    { from: /\btext-xxxs\b/g, to: 'typo-overline' },
    { from: /\btext-xxs\b/g, to: 'status-text' },
    { from: /\btext-xs\b/g, to: 'typo-caption' },
    { from: /\btext-sm\b/g, to: 'typo-body-sm' },
    { from: /\btext-base\b/g, to: 'typo-body' },
    { from: /\btext-lg\b/g, to: 'typo-body-lg' },
    { from: /\btext-xl\b/g, to: 'typo-h3' }, // Approximate
    { from: /\btext-2xl\b/g, to: 'typo-h3' },
    { from: /\btext-3xl\b/g, to: 'typo-h2' },
    { from: /\btext-4xl\b/g, to: 'typo-h1' },

    // Spacing (Widths)
    { from: /w-\[100px\]/g, to: 'w-100' },
    { from: /w-\[120px\]/g, to: 'w-120' },
    { from: /w-\[140px\]/g, to: 'w-140' },
    { from: /w-\[160px\]/g, to: 'w-160' },
    { from: /w-\[180px\]/g, to: 'w-180' },
    { from: /w-\[200px\]/g, to: 'w-200' },
    { from: /w-\[240px\]/g, to: 'w-240' },
    { from: /w-\[280px\]/g, to: 'w-280' },
    { from: /w-\[320px\]/g, to: 'w-320' },
    { from: /w-\[400px\]/g, to: 'w-400' },
    { from: /w-\[420px\]/g, to: 'w-420' },
    { from: /w-\[460px\]/g, to: 'w-460' },
    { from: /w-\[520px\]/g, to: 'w-520' },

    // Spacing (Max Widths)
    { from: /max-w-\[100px\]/g, to: 'max-w-100' },
    { from: /max-w-\[120px\]/g, to: 'max-w-120' },
    { from: /max-w-\[140px\]/g, to: 'max-w-140' },
    { from: /max-w-\[160px\]/g, to: 'max-w-160' },
    { from: /max-w-\[180px\]/g, to: 'max-w-180' },
    { from: /max-w-\[200px\]/g, to: 'max-w-200' },
    { from: /max-w-\[240px\]/g, to: 'max-w-240' },
    { from: /max-w-\[280px\]/g, to: 'max-w-280' },
    { from: /max-w-\[320px\]/g, to: 'max-w-320' },
    { from: /max-w-\[400px\]/g, to: 'max-w-400' },
    { from: /max-w-\[420px\]/g, to: 'max-w-420' },
    { from: /max-w-\[460px\]/g, to: 'max-w-460' },
    { from: /max-w-\[520px\]/g, to: 'max-w-520' },

    // Spacing (Heights)
    { from: /h-\[100px\]/g, to: 'h-100' },
    { from: /h-\[120px\]/g, to: 'h-120' },
    { from: /h-\[140px\]/g, to: 'h-140' },
    { from: /h-\[160px\]/g, to: 'h-160' },
    { from: /h-\[180px\]/g, to: 'h-180' },
    { from: /h-\[200px\]/g, to: 'h-200' },
    { from: /h-\[240px\]/g, to: 'h-240' },
    { from: /h-\[280px\]/g, to: 'h-280' },
    { from: /h-\[320px\]/g, to: 'h-320' },
    { from: /h-\[400px\]/g, to: 'h-400' },
    { from: /h-\[420px\]/g, to: 'h-420' },
    { from: /h-\[460px\]/g, to: 'h-460' },
    { from: /h-\[520px\]/g, to: 'h-520' },

    { from: /h-1\.5 w-1\.5 shrink-0 rounded-full bg-success shadow-\[0_0_8px_rgba\(34,197,94,0.5\)\]/g, to: 'h-1.5 w-1.5 shrink-0 rounded-full bg-success shadow-premium-success' },
    { from: /h-2 w-2 shrink-0 rounded-full bg-destructive shadow-\[0_0_8px_rgba\(var\(--destructive-rgb\),0.5\)\]/g, to: 'h-2 w-2 shrink-0 rounded-full bg-destructive shadow-premium-destructive' },
    { from: /h-4 w-4 rounded-full bg-success border-2 border-background shadow-\[0_0_10px_rgba\(34,197,94,0.6\)\]/g, to: 'h-4 w-4 rounded-full bg-success border-2 border-background shadow-premium-success' },
    { from: /shadow-\[0_32px_64px_-16px_rgba\(0,0,0,0.3\)\]/g, to: 'shadow-premium-lg' },
    
    // Smooth scaling
    { from: /hover:scale-\[1\.02\]/g, to: 'tw-hover-scale-102' },
    { from: /hover:scale-105/g, to: 'tw-hover-scale-105' },

    // Cleaning up redundant weights if they are now baked into typo-*
    // (Note: typo-h1/h2/h3 already have weights, but body classes don't)
];

const targetDir = path.join(__dirname, '..', 'src', 'renderer');

walk(targetDir, (file) => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    replacements.forEach(({ from, to }) => {
        if (from.test(content)) {
            content = content.replace(from, to);
            changed = true;
        }
    });

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated: ${file}`);
    }
});
