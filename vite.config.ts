import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  // 构建优化
  build: {
    // 显式声明输出目录（Vite 默认值），确保阿里云 ESA 等平台自动检测
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // React 核心库
          if (id.includes('react-dom') || id.includes('react-router') || (id.includes('/react/') && !id.includes('react-'))) {
            return 'react-vendor';
          }
          // UI 图标库
          if (id.includes('lucide-react')) {
            return 'ui-vendor';
          }
          // 国际化（最大单文件，独立分包）
          if (id.includes('useLanguage')) {
            return 'i18n';
          }
        },
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        // 生产环境移除 console.log/warn，保留 console.error
        drop_console: true,
        pure_funcs: ['console.log', 'console.warn', 'console.info', 'console.group', 'console.groupEnd'],
        drop_debugger: true,
      },
    },
    chunkSizeWarningLimit: 1000,
    // 启用 CSS 代码分割
    cssCodeSplit: true,
  },
})