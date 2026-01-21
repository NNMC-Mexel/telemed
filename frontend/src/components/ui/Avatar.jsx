import { cn, getInitials } from '../../utils/helpers'

const sizes = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-24 h-24 text-2xl',
}

const colors = [
  'bg-teal-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-indigo-500',
  'bg-pink-500',
]

function Avatar({
  src,
  name,
  size = 'md',
  status,
  className,
  ...props
}) {
  const initials = getInitials(name)
  const colorIndex = name ? name.charCodeAt(0) % colors.length : 0
  const bgColor = colors[colorIndex]

  return (
    <div className={cn('relative inline-flex', className)} {...props}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={cn(
            'rounded-full object-cover ring-2 ring-white',
            sizes[size]
          )}
        />
      ) : (
        <div
          className={cn(
            'rounded-full flex items-center justify-center text-white font-semibold ring-2 ring-white',
            sizes[size],
            bgColor
          )}
        >
          {initials}
        </div>
      )}
      
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-white',
            size === 'xs' || size === 'sm' ? 'w-2 h-2' : 'w-3 h-3',
            status === 'online' && 'bg-emerald-500',
            status === 'offline' && 'bg-slate-400',
            status === 'busy' && 'bg-rose-500',
            status === 'away' && 'bg-amber-500'
          )}
        />
      )}
    </div>
  )
}

export function AvatarGroup({ children, max = 4, size = 'md', className }) {
  const childrenArray = Array.isArray(children) ? children : [children]
  const visible = childrenArray.slice(0, max)
  const remaining = childrenArray.length - max

  return (
    <div className={cn('flex -space-x-2', className)}>
      {visible}
      {remaining > 0 && (
        <div
          className={cn(
            'rounded-full flex items-center justify-center bg-slate-200 text-slate-600 font-medium ring-2 ring-white',
            sizes[size]
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  )
}

export default Avatar
