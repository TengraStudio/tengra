// Simple extension icon generator using pure Node.js (no dependencies)
const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 128];
const outputDir = path.join(__dirname, '..', 'extension', 'assets');

console.log('🎨 Creating simple placeholder icons...');

// 1x1 transparent PNG (base64)
const transparentPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Create simple colored squares for each size
sizes.forEach(size => {
    const outputPath = path.join(outputDir, `icon${size}.png`);
    
    // For now, just copy the 1x1 transparent PNG
    // Users can replace these with actual icons later
    fs.writeFileSync(outputPath, Buffer.from(transparentPng, 'base64'));
    
    console.log(`✅ Created placeholder icon${size}.png`);
});

console.log('\n📝 Note: These are placeholder icons (1x1 transparent PNG).');
console.log('   Replace them with actual icons using any image editor.');
console.log('   Recommended: Use the SVG file in extension/assets/icon.svg');
console.log('   and convert it to PNG at sizes: 16x16, 32x32, 48x48, 128x128\n');
console.log('🎉 Icon files created successfully!');
