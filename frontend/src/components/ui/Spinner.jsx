import { cn } from '../../utils/helpers'

const sizes = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
}

function Spinner({ size = 'md', className }) {
  return (
    <svg
      className={cn('animate-spin text-teal-600', sizes[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

export function LoadingScreen({ message = 'Загрузка...' }) {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center">
        <Spinner size="xl" className="mx-auto" />
        <p className="mt-4 text-slate-600 font-medium">{message}</p>
      </div>
    </div>
  )
}

export function LoadingOverlay({ message }) {
  return (
    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center rounded-2xl z-10">
      <div className="text-center">
        <Spinner size="lg" className="mx-auto" />
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
      </div>
    </div>
  )
}

export function LoadingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="w-2 h-2 bg-teal-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
      <span className="w-2 h-2 bg-teal-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
      <span className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" />
    </div>
  )
}

export default Spinner
