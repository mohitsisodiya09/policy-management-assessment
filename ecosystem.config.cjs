module.exports = {
  apps: [
    {
      name: 'policy-management-api',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      kill_timeout: 12_000,
      min_uptime: '30s',
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
