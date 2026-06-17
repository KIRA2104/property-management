import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/users': 'http://127.0.0.1:8000',
      '/properties': 'http://127.0.0.1:8000',
      '/tenants': 'http://127.0.0.1:8000',
      '/agreements': 'http://127.0.0.1:8000',
      '/payments': 'http://127.0.0.1:8000'
    }
  }
})
