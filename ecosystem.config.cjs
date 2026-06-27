/**
 * PM2 进程配置 — 单进程托管 aistock-server（前端已 embed 进二进制）
 *
 * 准备:
 *   make release
 *   cp release/.env.example release/.env   # 填写 AI_DATA_DIR、API Key 等
 *
 * 启动:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup   # 可选：开机自启
 *
 * 说明:
 *   - cwd 为 release/，Go 进程通过 godotenv 读取 release/.env
 *   - 日志写入仓库根 logs/（与 release 目录同级）
 *   - 仅需本进程即可提供 API + 静态前端（默认 PORT=8787）
 */
'use strict';

const path = require('path');

const root = path.resolve(__dirname);
const releaseDir = path.join(root, 'release');
const logsDir = path.join(root, 'logs');

module.exports = {
  apps: [
    {
      name: 'aistock',
      script: path.join(releaseDir, 'aistock-server'),
      cwd: releaseDir,
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
      // 以下可被 release/.env 覆盖（应用内 godotenv.Load）
      env: {
        NODE_ENV: 'production',
        PORT: '8787',
        AISTOCK_SERVE_WEB: '1',
        GIN_MODE: 'release',
      },
    },
  ],
};
