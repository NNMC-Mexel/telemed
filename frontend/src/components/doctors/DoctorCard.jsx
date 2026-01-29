import { Star, Clock, ThumbsUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../ui/Button'
import { getMediaUrl } from '../../services/api'
import { cn, getInitials } from '../../utils/helpers'

const colors = [
  'bg-gradient-to-br from-teal-400 to-teal-600',
  'bg-gradient-to-br from-sky-400 to-sky-600',
  'bg-gradient-to-br from-violet-400 to-violet-600',
  'bg-gradient-to-br from-rose-400 to-rose-600',
  'bg-gradient-to-br from-amber-400 to-amber-600',
  'bg-gradient-to-br from-emerald-400 to-emerald-600',
  'bg-gradient-to-br from-indigo-400 to-indigo-600',
  'bg-gradient-to-br from-pink-400 to-pink-600',
]

function DoctorCard({ doctor, onBookClick, basePath = '' }) {
  const navigate = useNavigate()

  const photoUrl = getMediaUrl(doctor.photo)
  const initials = getInitials(doctor.fullName)
  const colorIndex = doctor.fullName ? doctor.fullName.charCodeAt(0) % colors.length : 0
  const bgColor = colors[colorIndex]

  const rating = Math.min(doctor.rating || 0, 5)
  const reviewsCount = doctor.reviewsCount || 0
  const experience = doctor.experience || 0
  const price = doctor.price || 0
  const specialization = doctor.specialization?.name || 'Специалист'
  const isOnline = doctor.isActive !== false

  // Calculate recommendation percentage
  const recommendPercent = reviewsCount > 0 ? Math.min(95 + Math.floor(rating), 100) : null

  // Pluralize years
  const getYearWord = (years) => {
    if (years === 1) return 'год'
    if (years >= 2 && years <= 4) return 'года'
    return 'лет'
  }

  const handleCardClick = () => {
    navigate(`${basePath}/doctors/${doctor.documentId}`)
  }

  const handleBookClick = (e) => {
    e.stopPropagation()
    onBookClick?.(doctor)
  }

  return (
    <div
      onClick={handleCardClick}
      className="group bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-slate-200 hover:-translate-y-0.5"
    >
      {/* Mobile Layout (stacked) */}
      <div className="flex flex-col sm:hidden gap-4">
        {/* Top row: Photo + Basic Info */}
        <div className="flex gap-4">
          {/* Photo */}
          <div className="relative flex-shrink-0">
            <div className="w-28 h-28 rounded-xl overflow-hidden bg-slate-100 shadow-sm">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={doctor.fullName}
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <div className={cn('w-full h-full flex items-center justify-center text-white text-2xl font-bold', bgColor)}>
                  {initials}
                </div>
              )}
            </div>
            {isOnline && (
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full ring-3 ring-white flex items-center justify-center">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900 group-hover:text-teal-600 transition-colors line-clamp-2 leading-tight">
              {doctor.fullName}
            </h3>
            <p className="text-teal-600 font-medium text-sm mt-0.5">{specialization}</p>

            <div className="flex items-center gap-2 mt-2 text-sm">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="font-semibold text-slate-900">{rating.toFixed(1)}</span>
              </div>
              <span className="text-slate-300">•</span>
              <span className="text-slate-600">{experience} {getYearWord(experience)}</span>
            </div>
          </div>
        </div>

        {/* Bottom row: Price + Button */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div>
            <p className="text-xl font-bold text-slate-900">{price.toLocaleString('ru-RU')} ₸</p>
            <p className="text-xs text-slate-500">за консультацию</p>
          </div>
          <Button onClick={handleBookClick} size="md">
            Записаться
          </Button>
        </div>
      </div>

      {/* Desktop Layout (horizontal) */}
      <div className="hidden sm:flex gap-5">
        {/* Photo Section */}
        <div className="relative flex-shrink-0">
          <div className="w-40 h-40 rounded-2xl overflow-hidden bg-slate-100 shadow-sm">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={doctor.fullName}
                className="w-full h-full object-cover object-top"
              />
            ) : (
              <div className={cn('w-full h-full flex items-center justify-center text-white text-3xl font-bold', bgColor)}>
                {initials}
              </div>
            )}
          </div>
          {isOnline && (
            <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full ring-3 ring-white flex items-center justify-center">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            </span>
          )}
        </div>

        {/* Info Section */}
        <div className="flex-1 min-w-0 py-1">
          {/* Name and Specialization */}
          <div className="mb-2">
            <h3 className="text-lg font-semibold text-slate-900 group-hover:text-teal-600 transition-colors">
              {doctor.fullName}
            </h3>
            <p className="text-teal-600 font-medium text-sm">{specialization}</p>
          </div>

          {/* Stats Row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="font-semibold text-slate-900">{rating.toFixed(1)}</span>
              <span className="text-slate-500 text-sm">({reviewsCount} отзывов)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 text-sm">
              <Clock className="w-4 h-4" />
              <span>Стаж {experience} {getYearWord(experience)}</span>
            </div>
          </div>

          {/* Recommendation Badge */}
          {recommendPercent && (
            <div className="flex items-center gap-1.5">
              <ThumbsUp className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-emerald-600 font-medium">
                {recommendPercent}% рекомендуют
              </span>
            </div>
          )}

          {/* Short Bio (only show if exists) */}
          {doctor.bio && (
            <p className="text-slate-500 text-sm line-clamp-1 mt-2">
              {doctor.bio}
            </p>
          )}
        </div>

        {/* Price and Action Section */}
        <div className="flex-shrink-0 flex flex-col items-end justify-between py-1">
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900">
              {price.toLocaleString('ru-RU')} ₸
            </p>
            <p className="text-xs text-slate-500">за консультацию</p>
          </div>

          <Button onClick={handleBookClick} size="md">
            Записаться
          </Button>
        </div>
      </div>
    </div>
  )
}

// Mini variant for sidebars and suggestions
export function DoctorCardMini({ doctor, onClick }) {
  const photoUrl = getMediaUrl(doctor.photo)
  const initials = getInitials(doctor.fullName)
  const colorIndex = doctor.fullName ? doctor.fullName.charCodeAt(0) % colors.length : 0
  const bgColor = colors[colorIndex]
  const rating = Math.min(doctor.rating || 0, 5)
  const specialization = doctor.specialization?.name || 'Специалист'

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100 cursor-pointer hover:border-slate-200 hover:shadow-sm transition-all"
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
        {photoUrl ? (
          <img src={photoUrl} alt={doctor.fullName} className="w-full h-full object-cover object-top" />
        ) : (
          <div className={cn('w-full h-full flex items-center justify-center text-white text-sm font-semibold', bgColor)}>
            {initials}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 text-sm truncate">{doctor.fullName}</p>
        <p className="text-xs text-slate-500 truncate">{specialization}</p>
      </div>
      <div className="flex items-center gap-1 text-sm">
        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
        <span className="font-medium">{rating.toFixed(1)}</span>
      </div>
    </div>
  )
}

export default DoctorCard
