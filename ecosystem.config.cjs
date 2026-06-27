/**
 * PM2 — 服务器跑 backend（前端静态文件已 commit 在 internal/webui/webdist，go:embed 打进进程）
 *
 * 准备:
 *   git pull
 *   cd backend && cp .env.example .env
 *   cd backend && go build -o bin/aistock-server ./cmd/server
 *   或在仓库根: make backend-build
 *
 * 启动:
 *   pm2 start ecosystem.config.cjs
 */
'use strict';

const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname);
const backendDir = path.join(root, 'backend');
const logsDir = path.join(root, 'logs');
const binary = path.join(backendDir, 'bin', 'aistock-server');

if (!fs.existsSync(binary)) {
  console.error(
    '[aistock] 未找到 backend/bin/aistock-server，请先执行:\n' +
      '  cd backend && go build -o bin/aistock-server ./cmd/server\n' +
      '  或: make backend-build',
  );
  process.exit(1);
}

module.exports = {
  apps: [
    {
      name: 'aistock',
      script: binary,
      cwd: backendDir,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 15,
      min_uptime: '10s',
      restart_delay: 3000,
      kill_timeout: 10000,
      listen_timeout: 15000,
      time: true,
      merge_logs: true,
      error_file: path.join(logsDir, 'aistock-error.log'),
      out_file: path.join(logsDir, 'aistock-out.log'),
      env: {
        NODE_ENV: 'production',
        PORT: '7200',
        AISTOCK_SERVE_WEB: '1',
        GIN_MODE: 'release',
      },
    },
  ],
};
