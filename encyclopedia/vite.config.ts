import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { apiPlugin } from './src/server/vite-plugin'

const isGhPages = process.env.VITE_DEPLOY_MODE === 'ghpages'

export default defineConfig({
  plugins: isGhPages ? [react()] : [react(), apiPlugin()],
  base: isGhPages ? (process.env.VITE_BASE_PATH || '/') : '/',
})
