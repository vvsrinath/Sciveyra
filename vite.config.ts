import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxies = {
  '/api/crossref': {
    target: 'https://api.crossref.org',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/crossref/, '')
  },
  '/api/europepmc': {
    target: 'https://www.ebi.ac.uk',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/europepmc/, '')
  },
  '/api/arxiv': {
    target: 'https://export.arxiv.org',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/arxiv/, '')
  },
  '/api/unpaywall': {
    target: 'https://api.unpaywall.org',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/unpaywall/, '')
  }
}

export default defineConfig({
  plugins: [react()],
  server: { proxy: apiProxies },
  preview: { proxy: apiProxies },
  build: {
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks: {
          plotly: ['plotly.js-dist-min'],
          excel: ['exceljs'],
          pdf: ['jspdf']
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{js,ts,tsx}']
  }
})
