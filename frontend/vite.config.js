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
  //   - продакшен: https://medconnectrtc.nnmc.kz
  const SIGNALING_SERVER = isProduction
    ? 'https://medconnectrtc.nnmc.kz'
    : (process.env.VITE_SIGNALING_SERVER || 'http://localhost:1341')

  const TURN_URL = isProduction
    ? 'turn:medconnect.nnmc.kz:3478'
    : (process.env.VITE_TURN_URL || 'turn:localhost:3478')

  const TURN_URL_TCP = isProduction
    ? 'turns:medconnect.nnmc.kz:5349'
    : (process.env.VITE_TURN_URL_TCP || '')

  const TURN_USERNAME = isProduction
    ? 'medconnect'
    : (process.env.VITE_TURN_USERNAME || 'medconnect')

  const TURN_CREDENTIAL = isProduction
    ? 'medconnect2026'
    : (process.env.VITE_TURN_CREDENTIAL || 'medconnect2026')

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
      'import.meta.env.VITE_SIGNALING_SERVER': JSON.stringify(SIGNALING_SERVER),
      'import.meta.env.VITE_TURN_URL': JSON.stringify(TURN_URL),
      'import.meta.env.VITE_TURN_URL_TCP': JSON.stringify(TURN_URL_TCP),
      'import.meta.env.VITE_TURN_USERNAME': JSON.stringify(TURN_USERNAME),
      'import.meta.env.VITE_TURN_CREDENTIAL': JSON.stringify(TURN_CREDENTIAL),
    },
  }
})
