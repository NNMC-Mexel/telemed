// Generates web/PWA and native application icons from the approved NNMC logo.
// Usage: node scripts/generate-brand-assets.mjs [path-to-source-png]
import sharp from 'sharp'
import { access, copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.resolve(process.argv[2] || path.join(root, 'public/brand/nnmc-logo.png'))
const publicBrand = path.join(root, 'public/brand')
const canonicalLogo = path.join(publicBrand, 'nnmc-logo.png')
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }

await access(source)
await mkdir(publicBrand, { recursive: true })

if (source !== canonicalLogo) {
  await copyFile(source, canonicalLogo)
}

const sourceBuffer = await sharp(canonicalLogo).rotate().png().toBuffer()

async function squareIcon(file, size, logoRatio, background = WHITE) {
  const logoSize = Math.round(size * logoRatio)
  const logo = await sharp(sourceBuffer)
    .resize(logoSize, logoSize, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer()

  await mkdir(path.dirname(file), { recursive: true })
  let output = sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: logo, gravity: 'centre' }])

  // Apple rejects app icons with an alpha channel. Keep alpha only for the
  // Android adaptive foreground, where the platform mask requires it.
  if (background.alpha === 1) output = output.removeAlpha()

  await output.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(file)
}

await squareIcon(path.join(publicBrand, 'nnmc-icon-192.png'), 192, 0.84)
await squareIcon(path.join(publicBrand, 'nnmc-icon-512.png'), 512, 0.84)
await squareIcon(path.join(publicBrand, 'nnmc-icon-maskable-512.png'), 512, 0.66)
await squareIcon(path.join(root, 'public/apple-touch-icon.png'), 180, 0.82)
await squareIcon(path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'), 1024, 0.82)

const androidRes = path.join(root, 'android/app/src/main/res')
const densities = {
  mdpi: { legacy: 48, foreground: 108 },
  hdpi: { legacy: 72, foreground: 162 },
  xhdpi: { legacy: 96, foreground: 216 },
  xxhdpi: { legacy: 144, foreground: 324 },
  xxxhdpi: { legacy: 192, foreground: 432 },
}

for (const [density, sizes] of Object.entries(densities)) {
  const dir = path.join(androidRes, `mipmap-${density}`)
  await squareIcon(path.join(dir, 'ic_launcher.png'), sizes.legacy, 0.82)
  await squareIcon(path.join(dir, 'ic_launcher_round.png'), sizes.legacy, 0.74)
  await squareIcon(path.join(dir, 'ic_launcher_foreground.png'), sizes.foreground, 0.62, TRANSPARENT)
}

console.log(`Brand assets generated from ${path.relative(root, source)}`)
