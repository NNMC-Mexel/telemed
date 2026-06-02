import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'kz.nnmc.medconnect',
  appName: 'MedConnect',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
