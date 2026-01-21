import { forwardRef } from 'react'
import { cn } from '../../utils/helpers'

const Textarea = forwardRef(({
  label,
  error,
  hint,
  className,
  containerClassName,
  ...props
}, ref) => {
  return (
    <div className={cn('space-y-1.5', containerClassName)}>
      {label && (
        <label className="block text-sm font-medium text-slate-700">
          {label}
          {props.required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      
      <textarea
        ref={ref}
        className={cn(
          'w-full px-4 py-3 rounded-xl border bg-white transition-all duration-200 resize-none',
          'placeholder:text-slate-400',
          'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent',
          error
            ? 'border-rose-300 focus:ring-rose-500'
            : 'border-slate-200 hover:border-slate-300',
          className
        )}
        rows={4}
        {...props}
      />
      
      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}
      
      {hint && !error && (
        <p className="text-sm text-slate-500">{hint}</p>
      )}
    </div>
  )
})

Textarea.displayName = 'Textarea'

export default Textarea
