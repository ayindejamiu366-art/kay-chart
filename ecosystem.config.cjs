module.exports = {
  apps: [{
    name: 'nocturne',
    script: 'server/index.cjs',
    cwd: 'C:\\Users\\jam kay\\nocturne-app',
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
