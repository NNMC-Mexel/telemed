import { useState, useCallback, useEffect } from 'react'
import Cropper from 'react-easy-crop'
import { RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Modal from './Modal'
import Button from './Button'

/**
 * Converts cropped area pixels to a canvas blob.
 */
const MAX_OUTPUT_DIMENSION = 1200

function getRadianAngle(degreeValue) {
  return (degreeValue * Math.PI) / 180
}

function getRotatedSize(width, height, rotation) {
  const rotationInRadians = getRadianAngle(rotation)

  return {
    width:
      Math.abs(Math.cos(rotationInRadians) * width) +
      Math.abs(Math.sin(rotationInRadians) * height),
    height:
      Math.abs(Math.sin(rotationInRadians) * width) +
      Math.abs(Math.cos(rotationInRadians) * height),
  }
}

async function getCroppedImg(imageSrc, croppedAreaPixels, rotation) {
  const image = await createImage(imageSrc)
  const rotationInRadians = getRadianAngle(rotation)
  const rotatedSize = getRotatedSize(image.width, image.height, rotation)
  const sourceCanvas = document.createElement('canvas')
  const sourceContext = sourceCanvas.getContext('2d')

  sourceCanvas.width = Math.round(rotatedSize.width)
  sourceCanvas.height = Math.round(rotatedSize.height)

  sourceContext.translate(sourceCanvas.width / 2, sourceCanvas.height / 2)
  sourceContext.rotate(rotationInRadians)
  sourceContext.translate(-image.width / 2, -image.height / 2)
  sourceContext.drawImage(image, 0, 0)

  const scale = Math.min(
    1,
    MAX_OUTPUT_DIMENSION / Math.max(croppedAreaPixels.width, croppedAreaPixels.height),
  )
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = Math.max(1, Math.round(croppedAreaPixels.width * scale))
  outputCanvas.height = Math.max(1, Math.round(croppedAreaPixels.height * scale))

  const outputContext = outputCanvas.getContext('2d')
  outputContext.imageSmoothingEnabled = true
  outputContext.imageSmoothingQuality = 'high'
  outputContext.drawImage(
    sourceCanvas,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    outputCanvas.width,
    outputCanvas.height,
  )

  return new Promise((resolve, reject) => {
    outputCanvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Could not create cropped image'))
      },
      'image/jpeg',
      0.92
    )
  })
}

function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })
}

function ImageCropModal({ isOpen, onClose, imageSrc, onCropComplete, aspect = 1 }) {
  const { t } = useTranslation()
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return

    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    setCroppedAreaPixels(null)
    setError('')
  }, [imageSrc, isOpen])

  const onCropChange = useCallback((crop) => setCrop(crop), [])
  const onZoomChange = useCallback((zoom) => setZoom(zoom), [])

  const onCropAreaComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleSave = async () => {
    if (!croppedAreaPixels) return
    setIsSaving(true)
    setError('')
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation)
      const file = new File([croppedBlob], 'photo.jpg', { type: 'image/jpeg' })
      await onCropComplete(file)
      onClose()
    } catch (err) {
      console.error('Error cropping image:', err)
      setError(t('image_crop.error'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const handleReset = () => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('image_crop.title')}
      description={t('image_crop.description')}
      size="lg"
      closeOnOverlay={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} isLoading={isSaving}>
            {t('image_crop.apply')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Crop area */}
        <div className="relative h-[min(400px,52vh)] min-h-72 w-full overflow-hidden rounded-xl bg-slate-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropAreaComplete}
            cropShape="rect"
            showGrid={true}
            style={{
              containerStyle: { borderRadius: '0.75rem' },
            }}
          />
        </div>

        {/* Controls */}
        <div className="space-y-3">
          {/* Zoom */}
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{t('image_crop.zoom')}</span>
              <span className="tabular-nums text-slate-500">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <ZoomOut className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                aria-label={t('image_crop.zoom')}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-teal-500"
              />
              <ZoomIn className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">{t('image_crop.move_hint')}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <RotateCcw className="w-4 h-4" />
                {t('image_crop.reset')}
              </button>
              <button
                type="button"
                onClick={handleRotate}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-teal-50 hover:text-teal-600"
              >
                <RotateCw className="w-4 h-4" />
                {t('image_crop.rotate')}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

export default ImageCropModal
