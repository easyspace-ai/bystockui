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
 *
 * 若报错 Process N not found / pm2_env undefined（PM2 进程表与 dump 不一致）:
 *   pm2 delete aistock || true
 *   pm2 flush
 *   pm2 start ecosystem.config.cjs
 * 仍失败则: pm2 kill && rm -f ~/.pm2/dump.pm2 && pm2 start ecosystem.config.cjs
 * 勿用 pm2 resurrect 除非 pm2 save 后且 pm2 startup 已配置。
 *
 * 游资 UZI 报告需 Python 3.10+：在 backend/.env 设置 HOTMONEY_UZI_PYTHON（见 .env.example）
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
