import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      // En desarrollo, /api se redirige al backend Django
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
