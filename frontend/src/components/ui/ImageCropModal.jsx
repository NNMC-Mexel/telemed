import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { ZoomIn, ZoomOut, RotateCw } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

/**
 * Converts cropped area pixels to a canvas blob.
 */
async function getCroppedImg(imageSrc, croppedAreaPixels) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  canvas.width = croppedAreaPixels.width
  canvas.height = croppedAreaPixels.height

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    croppedAreaPixels.width,
    croppedAreaPixels.height
  )

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob)
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
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const onCropChange = useCallback((crop) => setCrop(crop), [])
  const onZoomChange = useCallback((zoom) => setZoom(zoom), [])

  const onCropAreaComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleSave = async () => {
    if (!croppedAreaPixels) return
    setIsSaving(true)
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels)
      const file = new File([croppedBlob], 'photo.jpg', { type: 'image/jpeg' })
      await onCropComplete(file)
      onClose()
    } catch (err) {
      console.error('Error cropping image:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Обрезка фото"
      description="Выберите область, которая будет отображаться на карточке"
      size="lg"
      closeOnOverlay={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Отмена
          </Button>
          <Button onClick={handleSave} isLoading={isSaving}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Crop area */}
        <div className="relative w-full h-[400px] bg-slate-900 rounded-xl overflow-hidden">
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
        <div className="flex items-center gap-4">
          {/* Zoom */}
          <div className="flex items-center gap-3 flex-1">
            <ZoomOut className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-teal-500"
            />
            <ZoomIn className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </div>

          {/* Rotate */}
          <button
            onClick={handleRotate}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
          >
            <RotateCw className="w-4 h-4" />
            Повернуть
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ImageCropModal
