import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // 🟢 ここを追加！（必ず自分のリポジトリ名と同じにしてください）
  base: './', 
  plugins: [
    react(),
    tailwindcss(),
  ],
})