import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '../../utils/helpers'

function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  noResultsText,
  ariaLabel,
  className,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const searchRef = useRef(null)
  const listboxId = useId()

  const selectedOption = options.find((option) => option.value === value)
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return options
    return options.filter((option) => option.label.toLocaleLowerCase().includes(normalizedQuery))
  }, [options, query])

  useEffect(() => {
    if (!isOpen) return

    const handleOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false)
    }

    document.addEventListener('pointerdown', handleOutsideClick)
    const focusFrame = requestAnimationFrame(() => searchRef.current?.focus())

    return () => {
      cancelAnimationFrame(focusFrame)
      document.removeEventListener('pointerdown', handleOutsideClick)
    }
  }, [isOpen])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const closeDropdown = () => {
    setIsOpen(false)
    setQuery('')
  }

  const selectOption = (option) => {
    onChange(option.value)
    closeDropdown()
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeDropdown()
      requestAnimationFrame(() => triggerRef.current?.focus())
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (filteredOptions.length === 0) return
      setActiveIndex((current) => Math.min(current + 1, filteredOptions.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (filteredOptions.length === 0) return
      setActiveIndex((current) => Math.max(current - 1, 0))
      return
    }

    if (event.key === 'Enter' && filteredOptions[activeIndex]) {
      event.preventDefault()
      selectOption(filteredOptions[activeIndex])
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type='button'
        role='combobox'
        aria-label={ariaLabel || placeholder}
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-haspopup='listbox'
        onClick={() => {
          setIsOpen((current) => !current)
          setQuery('')
        }}
        className='flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm text-slate-700 transition-all hover:border-slate-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500'>
        <span className={cn('truncate', !selectedOption && 'text-slate-400')}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className='absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-scaleIn'>
          <div className='border-b border-slate-100 p-2'>
            <div className='relative'>
              <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className='w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-500/20'
              />
            </div>
          </div>

          <div id={listboxId} role='listbox' className='max-h-64 overflow-y-auto p-1.5'>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value
                const isActive = index === activeIndex
                return (
                  <button
                    key={option.value}
                    type='button'
                    role='option'
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectOption(option)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                      isSelected ? 'bg-teal-50 font-medium text-teal-700' : 'text-slate-700',
                      isActive && !isSelected && 'bg-slate-50',
                    )}>
                    <span className='truncate'>{option.label}</span>
                    {isSelected && <Check className='h-4 w-4 shrink-0 text-teal-600' />}
                  </button>
                )
              })
            ) : (
              <p className='px-3 py-6 text-center text-sm text-slate-500'>{noResultsText}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchableSelect
