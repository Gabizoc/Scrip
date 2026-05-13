// ecosystem.config.js
export default {
  apps: [
    {
      name: 'scrip-backend',
      script: './backend/src/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      max_memory_restart: '300M',
      error_file: './logs/backend-error.log',
      out_file:   './logs/backend-out.log',
      merge_logs: true,
    },
    {
      name: 'scrip-webdav',
      // dufs doit être installé sur le VPS : voir étape 4
      script: 'dufs',
      args: '/home/scrip/vault --port 5005 --allow-all --auth "gabi:CHANGE_ME_STRONG_PASSWORD"',
      interpreter: 'none',
      error_file: './logs/webdav-error.log',
      out_file:   './logs/webdav-out.log',
    },
  ],
};
