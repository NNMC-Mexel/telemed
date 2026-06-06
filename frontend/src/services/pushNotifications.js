import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { notificationsAPI } from './api'

const PUSH_TOKEN_STORAGE_KEY = 'medconnect-push-token'
const DEVICE_ID_STORAGE_KEY = 'medconnect-device-id'

let initialized = false

const getDeviceId = () => {
  let deviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY)
  if (!deviceId) {
    deviceId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId)
  }
  return deviceId
}

const openNotificationLink = (link) => {
  if (!link || typeof window === 'undefined') return
  if (link.startsWith('/')) {
    window.location.assign(link)
    return
  }
  try {
    const url = new URL(link)
    if (url.origin === window.location.origin) {
      window.location.assign(`${url.pathname}${url.search}${url.hash}`)
    }
  } catch {
    /* ignore invalid links */
  }
}

const dispatchPushReceived = (notification) => {
  window.dispatchEvent(new CustomEvent('medconnect:push-notification-received', {
    detail: notification,
  }))
}

export const initPushNotifications = async () => {
  if (initialized || !Capacitor.isNativePlatform()) return
  initialized = true

  const permission = await PushNotifications.requestPermissions()
  if (permission.receive !== 'granted') return

  if (Capacitor.getPlatform() === 'android') {
    try {
      await PushNotifications.createChannel({
        id: 'medconnect_default',
        name: 'MedConnect',
        description: 'MedConnect notifications',
        importance: 5,
        visibility: 1,
        sound: 'default',
        vibration: true,
        lights: true,
      })
    } catch (error) {
      console.error('push notification channel create failed:', error)
    }
  }

  await PushNotifications.addListener('registration', async (token) => {
    localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token.value)
    try {
      await notificationsAPI.registerPushToken({
        token: token.value,
        platform: Capacitor.getPlatform(),
        deviceId: getDeviceId(),
      })
    } catch (error) {
      console.error('push token registration failed:', error)
    }
  })

  await PushNotifications.addListener('registrationError', (error) => {
    console.error('push registration error:', error)
  })

  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    dispatchPushReceived(notification)
  })

  await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
    const data = event?.notification?.data || {}
    dispatchPushReceived(event.notification)
    openNotificationLink(data.link)
  })

  await PushNotifications.register()
}

export const unregisterCurrentPushToken = async () => {
  if (!Capacitor.isNativePlatform()) return
  const token = localStorage.getItem(PUSH_TOKEN_STORAGE_KEY)
  if (!token) return
  try {
    await notificationsAPI.unregisterPushToken(token)
  } catch (error) {
    console.error('push token unregister failed:', error)
  } finally {
    localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY)
  }
}
