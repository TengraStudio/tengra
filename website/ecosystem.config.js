module.exports = {
    apps: [
        {
            name: 'tengra-backend',
            script: './tengra-backend/build/tengra_backend', // Assuming binary name
            cwd: './tengra-backend',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'production',
            },
        },
        {
            name: 'tengra-frontend',
            script: 'npm',
            args: 'run dev', // Or 'run serve' for production
            cwd: './tengra-frontend',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'development',
            },
        }
    ],
};
