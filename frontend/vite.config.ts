import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      // frontend-openui 子目录自有 node_modules；不复用同一 React 会触发 Invalid hook call
      dedupe: ['react', 'react-dom', 'zustand', 'lightweight-charts'],
      alias: {
        '@': path.resolve(__dirname, './src'),
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      },
    },
    server: {
      port: 3000,
      host: true,
      proxy: {
        /** 须与 backend/.env 的 PORT 一致；Go 默认见 cmd/server main.go（未设 PORT 时为 8787） */
        '/api': {
          target: env.VITE_BACKEND_PROXY_TARGET?.trim() || 'http://127.0.0.1:7200',
          changeOrigin: true,
        },
        /** 与生产一致：经主后端 /daily-api 代理至 DailyAPI，勿直连 7220 */
        '/daily-api': {
          target: env.VITE_BACKEND_PROXY_TARGET?.trim() || 'http://127.0.0.1:7200',
          changeOrigin: true,
        },
        '/ws': {
          target: (() => {
            const t = env.VITE_BACKEND_PROXY_TARGET?.trim() || 'http://127.0.0.1:7200';
            return t.startsWith('http') ? t.replace(/^http/, 'ws') : `ws://${t}`;
          })(),
          ws: true,
        },
      },
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
