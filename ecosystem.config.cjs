module.exports = {
  apps: [
    {
      name: 'mact6399capstone',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      max_memory_restart: '300M',
      autorestart: true,
      watch: false
    }
  ]
};
