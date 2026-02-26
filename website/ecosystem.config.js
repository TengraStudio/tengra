const path = require('path');

const websiteRoot = __dirname;
const backendRoot = path.join(websiteRoot, 'tengra-backend');
const frontendRoot = path.join(websiteRoot, 'tengra-frontend');

module.exports = {
    apps: [
        {
            name: 'tengra-backend',
            script: path.join(backendRoot, 'scripts', 'pm2-backend-launcher.js'),
            cwd: backendRoot,
            instances: 1,
            exec_mode: 'fork',
            autorestart: false,
            watch: false,
            max_memory_restart: '500M',
            merge_logs: true,
            out_file: path.join(process.env.USERPROFILE || 'C:\\Users\\agnes', '.pm2', 'logs', 'tengra-backend-out.log'),
            error_file: path.join(process.env.USERPROFILE || 'C:\\Users\\agnes', '.pm2', 'logs', 'tengra-backend-error.log'),
            log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS Z',
            env: {
                NODE_ENV: 'production',
                TENGRA_BACKEND_CONFIGURATION: 'Debug',
                TENGRA_LOG_PATH: path.join(backendRoot, 'logs'),
                TENGRA_LOG_LEVEL: 'INFO',
                TENGRA_LOG_TO_PM2: '1'
            }
        },
        {
            name: 'tengra-frontend',
            script: path.join(frontendRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
            args: '--host 0.0.0.0 --port 5173',
            cwd: frontendRoot,
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            merge_logs: true,
            out_file: path.join(process.env.USERPROFILE || 'C:\\Users\\agnes', '.pm2', 'logs', 'tengra-frontend-out.log'),
            error_file: path.join(process.env.USERPROFILE || 'C:\\Users\\agnes', '.pm2', 'logs', 'tengra-frontend-error.log'),
            log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS Z',
            env: {
                NODE_ENV: 'development'
            }
        }
    ]
};
