import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../utils/helpers'

function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)

  if (currentPage <= 4) return [1, 2, 3, 4, 5, '...', totalPages]
  if (currentPage >= totalPages - 3) {
    return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }

  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
}

function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  className,
  showSummary = true,
}) {
  const { t } = useTranslation()
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  if (totalItems === 0 || totalPages <= 1) return null

  const safePage = Math.min(Math.max(currentPage, 1), totalPages)
  const from = (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, totalItems)

  return (
    <div className={cn('flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      {showSummary && (
        <span className="text-sm text-slate-500">
          {t('appointments.showing', { from, to, total: totalItems })}
        </span>
      )}

      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage === 1}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={t('appointments.page_prev')}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {getPageNumbers(safePage, totalPages).map((page, index) =>
          page === '...' ? (
            <span key={`ellipsis-${index}`} className="px-2 text-slate-400 select-none">...</span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={cn(
                'h-9 min-w-9 rounded-lg px-2 text-sm font-medium transition-colors',
                safePage === page
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              {page}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage === totalPages}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={t('appointments.page_next')}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

export default Pagination
