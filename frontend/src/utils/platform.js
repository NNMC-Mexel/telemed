import { Capacitor } from '@capacitor/core'

export const isNativeMobileApp = () => Capacitor.isNativePlatform()
