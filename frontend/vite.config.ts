import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/auth': 'http://backend:8000',
      '/clients': 'http://backend:8000',
      '/leads': 'http://backend:8000',
      '/pipeline-stages': 'http://backend:8000',
      '/projects': 'http://backend:8000',
      '/transactions': 'http://backend:8000',
      '/invoices': 'http://backend:8000',
      '/dashboard': 'http://backend:8000',
      '/health': 'http://backend:8000',
    },
  },
})
