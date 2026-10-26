import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 相対パスで出力する。GitHub Pages(https://<user>.github.io/zombie/)でもローカルでも同じビルドで動く
  base: './',
  // host: true で同じWi-Fi内のタブレットから http://<PCのIP>:5173 で開ける
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
})
