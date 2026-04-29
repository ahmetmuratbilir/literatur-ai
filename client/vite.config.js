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
        manualChunks: {
          react: ['react', 'react-dom', 'framer-motion'],
          charts: ['recharts'],
          wordExport: ['docx', 'file-saver'],
          pdfExport: ['html2pdf.js', 'jspdf', 'jspdf-autotable', 'html2canvas'],
        },
      },
    },
  }
})
