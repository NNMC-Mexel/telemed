import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleAlert, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Modal from './Modal'
import Button from './Button'
import { cn } from '../../utils/helpers'

const DialogContext = createContext(null)

const icons = {
  error: CircleAlert,
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
}

const iconStyles = {
  error: 'bg-rose-50 text-rose-600 ring-rose-100',
  success: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-600 ring-amber-100',
  info: 'bg-sky-50 text-sky-600 ring-sky-100',
}

export function DialogProvider({ children }) {
  const { t } = useTranslation()
  const [dialog, setDialog] = useState(null)
  const resolverRef = useRef(null)

  const resolveDialog = useCallback((result) => {
    resolverRef.current?.(result)
    resolverRef.current = null
    setDialog(null)
  }, [])

  const openDialog = useCallback((kind, message, options = {}) => {
    resolverRef.current?.(false)

    return new Promise((resolve) => {
      resolverRef.current = resolve
      setDialog({ kind, message, ...options })
    })
  }, [])

  useEffect(() => () => resolverRef.current?.(false), [])

  const value = useMemo(() => ({
    alert: (message, options) => openDialog('alert', message, options),
    confirm: (message, options) => openDialog('confirm', message, options),
  }), [openDialog])

  const variant = dialog?.variant || (dialog?.kind === 'confirm' ? 'warning' : 'error')
  const Icon = icons[variant] || icons.info
  const title = dialog?.title || t(`dialog.${variant}_title`)
  const actionVariant = variant === 'error'
    ? 'danger'
    : variant === 'success'
      ? 'success'
      : 'primary'

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Modal
        isOpen={Boolean(dialog)}
        onClose={() => resolveDialog(false)}
        title={title}
        size='sm'
        closeOnOverlay={!dialog?.blocking}
        footer={dialog && (
          <div className='flex w-full flex-col-reverse justify-end gap-2 sm:flex-row'>
            {dialog.kind === 'confirm' && (
              <Button
                variant='secondary'
                data-modal-autofocus='true'
                onClick={() => resolveDialog(false)}>
                {dialog.cancelText || t('common.cancel')}
              </Button>
            )}
            <Button
              variant={dialog.kind === 'confirm' ? (dialog.confirmVariant || 'danger') : actionVariant}
              data-modal-autofocus={dialog.kind === 'alert' ? 'true' : undefined}
              onClick={() => resolveDialog(true)}>
              {dialog.kind === 'confirm'
                ? (dialog.confirmText || t('common.confirm'))
                : (dialog.confirmText || t('dialog.ok'))}
            </Button>
          </div>
        )}>
        {dialog && (
          <div className='flex items-start gap-4'>
            <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-4', iconStyles[variant])}>
              <Icon className='h-6 w-6' />
            </div>
            <p className='whitespace-pre-line pt-1 text-[15px] leading-6 text-slate-600'>
              {dialog.message}
            </p>
          </div>
        )}
      </Modal>
    </DialogContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDialog() {
  const context = useContext(DialogContext)
  if (!context) throw new Error('useDialog must be used within DialogProvider')
  return context
}
