import { useEffect, useCallback, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../utils/helpers'
import Button from './Button'

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[90vw]',
}

let modalScrollLocks = 0
let originalBodyOverflow = ''

function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showClose = true,
  closeOnOverlay = true,
  footer,
  className,
}) {
  const { t } = useTranslation()
  const rootRef = useRef(null)
  const previousFocusRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  const handleModalKeyDown = useCallback((e) => {
    const openModals = document.querySelectorAll('[data-modal-root="true"]')
    if (openModals[openModals.length - 1] !== rootRef.current) return

    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }

    if (e.key === 'Tab') {
      const focusable = [...rootRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement
      if (modalScrollLocks === 0) {
        originalBodyOverflow = document.body.style.overflow
      }
      modalScrollLocks += 1
      document.addEventListener('keydown', handleModalKeyDown)
      document.body.style.overflow = 'hidden'

      const focusFrame = requestAnimationFrame(() => {
        const focusTarget = rootRef.current?.querySelector('[data-modal-autofocus="true"]') || rootRef.current?.querySelector(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        focusTarget?.focus()
      })

      return () => {
        cancelAnimationFrame(focusFrame)
        document.removeEventListener('keydown', handleModalKeyDown)
        modalScrollLocks = Math.max(0, modalScrollLocks - 1)
        if (modalScrollLocks === 0) {
          document.body.style.overflow = originalBodyOverflow
        }
        previousFocusRef.current?.focus?.()
      }
    }
  }, [isOpen, handleModalKeyDown])

  if (!isOpen) return null

  return (
    <div
      ref={rootRef}
      data-modal-root='true'
      className="safe-modal-viewport fixed inset-0 z-[100] flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fadeIn"
        onClick={closeOnOverlay ? onClose : undefined}
      />

      {/* Modal */}
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'relative w-full bg-white rounded-2xl shadow-2xl animate-scaleIn flex flex-col',
          'safe-modal-panel',
          sizes[size],
          className
        )}
      >
        {/* Header */}
        {(title || showClose) && (
          <div className="flex items-start justify-between p-5 sm:p-6 border-b border-slate-100 shrink-0">
            <div>
              {title && (
                <h2 id={titleId} className="text-xl font-semibold text-slate-900">{title}</h2>
              )}
              {description && (
                <p id={descriptionId} className="mt-1 text-sm text-slate-500">{description}</p>
              )}
            </div>
            {showClose && (
              <button
                onClick={onClose}
                aria-label={t('common.close')}
                className="p-2 -m-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 scroll-smooth">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="safe-modal-footer flex items-center gap-3 px-4 sm:px-6 pt-3 sm:pt-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// Confirm Modal
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'danger',
  isLoading = false,
}) {
  const { t } = useTranslation()
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title ?? t('common.confirm_title')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelText ?? t('common.cancel')}
          </Button>
          <Button variant={variant} onClick={onConfirm} isLoading={isLoading}>
            {confirmText ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      <p className="text-slate-600">{message}</p>
    </Modal>
  )
}

export default Modal
