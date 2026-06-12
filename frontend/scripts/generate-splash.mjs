// Generates native splash screens for iOS/Android from src/assets/mobile-app-logo.svg
// Usage: node scripts/generate-splash.mjs
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LOGO = path.join(root, 'src/assets/mobile-app-logo.svg')
const BG = '#ffffff'

// Render the logo once at high resolution and trim transparent padding
const logoBuf = await sharp(LOGO, { density: 600 })
  .resize(2048, 2048, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .trim()
  .png()
  .toBuffer()

async function splash(file, width, height) {
  // Logo occupies ~42% of the smaller dimension
  const logoW = Math.round(Math.min(width, height) * 0.42)
  const logo = await sharp(logoBuf)
    .resize(logoW, logoW, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  await mkdir(path.dirname(file), { recursive: true })
  await sharp({ create: { width, height, channels: 3, background: BG } })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(file)
  console.log('wrote', path.relative(root, file), `${width}x${height}`)
}

// iOS — same universal image for 1x/2x/3x
const iosSet = path.join(root, 'ios/App/App/Assets.xcassets/Splash.imageset')
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  await splash(path.join(iosSet, name), 2732, 2732)
}

// Android
const res = path.join(root, 'android/app/src/main/res')
await splash(path.join(res, 'drawable/splash.png'), 480, 320)

const port = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] }
for (const [dpi, [w, h]] of Object.entries(port)) {
  await splash(path.join(res, `drawable-port-${dpi}/splash.png`), w, h)
  await splash(path.join(res, `drawable-land-${dpi}/splash.png`), h, w)
}
