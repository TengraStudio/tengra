#!/usr/bin/env node

/**
 * Service Lifecycle Audit Script
 * Checks which services properly implement initialize() and cleanup() methods
 */

const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, '..', 'src', 'main', 'services');
const results = {
    properly_implemented: [],
    missing_initialize: [],
    missing_cleanup: [],
    missing_both: [],
    has_legacy_init: []
};

function checkServiceFile(filePath, relativePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Skip base.service.ts and non-service files
        if (relativePath.includes('base.service.ts') || !content.includes('extends BaseService')) {
            return;
        }

        const serviceName = path.basename(relativePath, '.ts');
        
        // Check for proper lifecycle methods
        const hasInitialize = /override\s+async\s+initialize\s*\(\s*\)\s*:\s*Promise<void>|async\s+initialize\s*\(\s*\)\s*:\s*Promise<void>/.test(content);
        const hasCleanup = /override\s+async\s+cleanup\s*\(\s*\)\s*:\s*Promise<void>|async\s+cleanup\s*\(\s*\)\s*:\s*Promise<void>/.test(content);
        const hasLegacyInit = /async\s+init\s*\(/.test(content) && !hasInitialize;
        
        const serviceInfo = {
            name: serviceName,
            path: relativePath,
            hasInitialize,
            hasCleanup,
            hasLegacyInit
        };

        if (hasLegacyInit) {
            results.has_legacy_init.push(serviceInfo);
        } else if (hasInitialize && hasCleanup) {
            results.properly_implemented.push(serviceInfo);
        } else if (!hasInitialize && !hasCleanup) {
            results.missing_both.push(serviceInfo);
        } else if (!hasInitialize) {
            results.missing_initialize.push(serviceInfo);
        } else if (!hasCleanup) {
            results.missing_cleanup.push(serviceInfo);
        }
        
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
    }
}

function walkDirectory(dir, baseDir = dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            walkDirectory(fullPath, baseDir);
        } else if (file.endsWith('.service.ts')) {
            const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
            checkServiceFile(fullPath, relativePath);
        }
    }
}

console.log('🔍 Auditing Service Lifecycle Implementation...\n');
walkDirectory(servicesDir);

console.log('📊 SERVICE LIFECYCLE AUDIT RESULTS');
console.log('=' * 50);

console.log(`\n✅ PROPERLY IMPLEMENTED (${results.properly_implemented.length}):`);
results.properly_implemented.forEach(s => {
    console.log(`  - ${s.name}`);
});

console.log(`\n🔄 LEGACY INIT METHOD (${results.has_legacy_init.length}) - NEEDS FIXING:`);
results.has_legacy_init.forEach(s => {
    console.log(`  - ${s.name} (${s.path})`);
});

console.log(`\n❌ MISSING INITIALIZE (${results.missing_initialize.length}):`);
results.missing_initialize.forEach(s => {
    console.log(`  - ${s.name} (${s.path})`);
});

console.log(`\n❌ MISSING CLEANUP (${results.missing_cleanup.length}):`);
results.missing_cleanup.forEach(s => {
    console.log(`  - ${s.name} (${s.path})`);
});

console.log(`\n❌ MISSING BOTH (${results.missing_both.length}):`);
results.missing_both.forEach(s => {
    console.log(`  - ${s.name} (${s.path})`);
});

const needsWork = results.has_legacy_init.length + results.missing_initialize.length + 
                 results.missing_cleanup.length + results.missing_both.length;
const totalServices = needsWork + results.properly_implemented.length;

console.log(`\n📈 SUMMARY:`);
console.log(`Total Services: ${totalServices}`);
console.log(`Properly Implemented: ${results.properly_implemented.length} (${Math.round(results.properly_implemented.length / totalServices * 100)}%)`);
console.log(`Need Lifecycle Work: ${needsWork} (${Math.round(needsWork / totalServices * 100)}%)`);

if (needsWork > 0) {
    console.log(`\n🚨 ACTION REQUIRED: ${needsWork} services need lifecycle method implementation.`);
} else {
    console.log(`\n🎉 ALL SERVICES PROPERLY IMPLEMENT LIFECYCLE METHODS!`);
}