import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  // API Strapi:
  //   - локально: http://localhost:1340
  //   - продакшен: https://medconnectserver.nnmc.kz
  const API_URL = isProduction
    ? 'https://medconnectserver.nnmc.kz'
    : (process.env.VITE_API_URL || 'http://localhost:1340')

  // Signaling server:
  //   - локально: http://localhost:1341
  const SIGNALING_URL = isProduction
    ? 'https://medconnect.nnmc.kz/server-signaling'
    : (process.env.VITE_SIGNALING_SERVER || 'http://localhost:1341')

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    server: {
      // Локальный порт фронтенда
      port: 1342,
      proxy: {
        '/api': {
          target: API_URL,
          changeOrigin: true,
        },
      },
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(API_URL),
      'import.meta.env.VITE_SIGNALING_URL': JSON.stringify(SIGNALING_URL),
    },
  }
})
