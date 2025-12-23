import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'import.meta.env.VITE_IMG_WORKER_API_TOKEN': JSON.stringify(env.IMG_WORKER_API_TOKEN || env.VITE_IMG_WORKER_API_TOKEN)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        minify: 'esbuild', // 使用 esbuild 進行最小化（預設值，但明確指定）
        esbuild: {
          // 生產模式時移除 console 和 debugger
          drop: isProduction ? ['console', 'debugger'] : [],
        },
        // 啟用 sourcemap（可選，用於除錯）
        sourcemap: false,
        // 優化構建輸出
        rollupOptions: {
          output: {
            // 手動分割代碼塊（可選）
            manualChunks: undefined,
          },
        },
      },
    };
});
