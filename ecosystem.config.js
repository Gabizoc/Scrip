// ecosystem.config.js
export default {
  apps: [
    {
      name: 'scrip-backend',
      script: './backend/src/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 7001,
      },
      max_memory_restart: '300M',
      error_file: './logs/backend-error.log',
      out_file:   './logs/backend-out.log',
      merge_logs: true,
    },
  ],
};
