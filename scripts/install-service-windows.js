/**
 * Windows Service Installer for Orbit Token Refresh Service
 * 
 * This script installs the token refresh service as a Windows Service using node-windows.
 * 
 * Requirements:
 *   npm install -g node-windows
 * 
 * Usage:
 *   node scripts/install-service-windows.js install   - Install service
 *   node scripts/install-service-windows.js uninstall - Uninstall service
 */

const Service = require('node-windows').Service;
const path = require('path');

const scriptPath = path.join(__dirname, 'token-refresh-service.js');
const nodePath = process.execPath;

const service = new Service({
    name: 'OrbitTokenRefresh',
    description: 'Orbit Token Refresh Service - Automatically refreshes authentication tokens',
    script: scriptPath,
    nodeOptions: [
        '--max-old-space-size=4096'
    ],
    env: [
        {
            name: 'NODE_ENV',
            value: 'production'
        }
    ]
});

const command = process.argv[2];

if (command === 'install') {
    console.log('Installing Orbit Token Refresh Service...');
    service.on('install', () => {
        console.log('Service installed successfully!');
        console.log('Starting service...');
        service.start();
    });
    
    service.on('alreadyinstalled', () => {
        console.log('Service is already installed.');
    });
    
    service.on('start', () => {
        console.log('Service started successfully!');
        console.log('');
        console.log('To manage the service:');
        console.log('  Start:   net start OrbitTokenRefresh');
        console.log('  Stop:    net stop OrbitTokenRefresh');
        console.log('  Status:  sc query OrbitTokenRefresh');
        process.exit(0);
    });
    
    service.install();
} else if (command === 'uninstall') {
    console.log('Uninstalling Orbit Token Refresh Service...');
    service.on('uninstall', () => {
        console.log('Service uninstalled successfully!');
        process.exit(0);
    });
    
    service.on('alreadyuninstalled', () => {
        console.log('Service is not installed.');
        process.exit(0);
    });
    
    service.uninstall();
} else {
    console.log('Usage:');
    console.log('  node scripts/install-service-windows.js install   - Install service');
    console.log('  node scripts/install-service-windows.js uninstall - Uninstall service');
    console.log('');
    console.log('Note: Requires node-windows package: npm install -g node-windows');
    process.exit(1);
}
