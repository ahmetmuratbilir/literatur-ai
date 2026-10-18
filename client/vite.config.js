import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    target: 'esnext',
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Fonksiyon biçimi ve yalnız node_modules (WO-024). Nesne biçiminde
        // Vite'ın dinamik içe aktarma yardımcısı (__vitePreload) pdfExport
        // parçasına düşüyordu; ana paket o birkaç satır için 2,9 MB'lık PDF
        // parçasını açılışta modulepreload ile çekiyordu. recharts hiçbir yerde
        // içe aktarılmıyor; girişi kaldırıldı.
        manualChunks(id) {
          // Vite/Rollup yardımcıları açılışta zaten yüklenen parçada dursun: elle
          // tanımlı bir parçanın bağımlılığı olunca onun içine çekiliyorlardı.
          if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers')) return 'react';
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'react';
          if (/[\\/]node_modules[\\/](docx|file-saver|jszip)[\\/]/.test(id)) return 'wordExport';
          if (/[\\/]node_modules[\\/](html2pdf\.js|jspdf|jspdf-autotable|html2canvas|canvg|dompurify|core-js|raf|rgbcolor|stackblur-canvas|svg-pathdata|fflate)[\\/]/.test(id)) return 'pdfExport';
          return undefined;
        },
      },
    },
  }
})
