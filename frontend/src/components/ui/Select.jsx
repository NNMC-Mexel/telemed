import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils/helpers'

const Select = forwardRef(({
  label,
  error,
  options = [],
  placeholder = 'Выберите...',
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
      
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'w-full px-4 py-2.5 pr-10 rounded-xl border bg-white transition-all duration-200 appearance-none cursor-pointer',
            'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent',
            error
              ? 'border-rose-300 focus:ring-rose-500'
              : 'border-slate-200 hover:border-slate-300',
            className
          )}
          {...props}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
      </div>
      
      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}
    </div>
  )
})

Select.displayName = 'Select'

export default Select
