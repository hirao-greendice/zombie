import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // host: true で同じWi-Fi内のタブレットから http://<PCのIP>:5173 で開ける
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
})
