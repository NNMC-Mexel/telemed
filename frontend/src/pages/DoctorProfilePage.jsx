import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Star,
  Clock,
  Briefcase,
  GraduationCap,
  MessageCircle,
  Calendar,
  ChevronLeft,
  Video,
  MapPin,
  Award,
  Users,
  CheckCircle,
  Loader2,
  Globe,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import BookingModal from '../components/appointments/BookingModal'
import api, { normalizeResponse, getMediaUrl } from '../services/api'
import { formatPrice, formatDate } from '../utils/helpers'

function DoctorProfilePage() {
  const { id } = useParams()
  const [doctor, setDoctor] = useState(null)
  const [reviews, setReviews] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showBookingModal, setShowBookingModal] = useState(false)

  useEffect(() => {
    fetchDoctorData()
  }, [id])

  const fetchDoctorData = async () => {
    setIsLoading(true)
    try {
      // Получаем данные врача
      const response = await api.get(`/api/doctors/${id}?populate=*`)
      const doctorData = response.data?.data
      setDoctor(doctorData)

      // Получаем отзывы врача
      const reviewsRes = await api.get(`/api/reviews?populate=*`)
      const { data: allReviews } = normalizeResponse(reviewsRes)
      const doctorReviews = (allReviews || []).filter(r => r.doctor?.id === doctorData?.id)
      setReviews(doctorReviews)
    } catch (error) {
      console.error('Error fetching doctor:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
      </div>
    )
  }

  if (!doctor) {
    return (
      <div className="text-center py-24">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Врач не найден</h2>
        <Link to="/doctors">
          <Button variant="outline">Вернуться к списку врачей</Button>
        </Link>
      </div>
    )
  }

  const specialization = typeof doctor.specialization === 'object' 
    ? doctor.specialization?.name 
    : doctor.specialization || 'Специалист'

  // Рейтинг от 0 до 5 (не 10)
  const averageRating = Math.min(doctor.rating || 0, 5)
  const reviewsCount = reviews.length || 0
  const totalPatients = doctor.appointmentsCount || reviewsCount || 0

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Back Button */}
      <Link to="/doctors" className="inline-flex items-center gap-2 text-slate-600 hover:text-teal-600 transition-colors">
        <ChevronLeft className="w-5 h-5" />
        <span>Назад к списку врачей</span>
      </Link>

      {/* Main Profile Card */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Photo & Quick Info */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="overflow-hidden">
            <CardContent className="text-center pt-8">
              {/* Photo */}
              <div className="flex justify-center mb-6">
                {doctor.photo ? (
                  <div className="relative">
                    <img
                      src={getMediaUrl(doctor.photo)}
                      alt={doctor.fullName}
                      className="w-32 h-32 rounded-full object-cover shadow-lg"
                    />
                    {doctor.isActive !== false && (
                      <span className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full bg-teal-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                      {doctor.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'DR'}
                    </div>
                    {doctor.isActive !== false && (
                      <span className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                )}
              </div>

              {/* Name & Specialization */}
              <h1 className="text-2xl font-bold text-slate-900 mb-1">{doctor.fullName}</h1>
              <p className="text-teal-600 font-medium text-lg mb-4">{specialization}</p>

              {/* Rating */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-5 h-5 ${i < Math.round(averageRating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`}
                    />
                  ))}
                </div>
                <span className="font-bold text-slate-900">{averageRating.toFixed(1)}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500">{reviewsCount} отзывов</span>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl">
                  <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <Briefcase className="w-5 h-5 text-teal-600" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{doctor.experience || 0}</p>
                  <p className="text-sm text-slate-500">лет опыта</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl">
                  <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <Users className="w-5 h-5 text-sky-600" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{totalPatients}+</p>
                  <p className="text-sm text-slate-500">пациентов</p>
                </div>
              </div>

              {/* Price & Book Button */}
              <div className="p-4 bg-gradient-to-br from-teal-50 to-sky-50 rounded-2xl mb-4 text-teal-800 border border-teal-100">
                <p className="text-xs uppercase tracking-wide text-teal-500 mb-1">
                  Стоимость консультации
                </p>
                <p className="text-2xl md:text-3xl font-bold leading-tight">
                  {formatPrice(doctor.price || 0)}
                </p>
                <p className="text-sm text-slate-600 mt-1 flex items-center justify-center gap-1">
                  <Clock className="w-4 h-4 text-teal-500" />
                  <span>{doctor.consultationDuration || doctor.slotDuration || 30} минут</span>
                </p>
              </div>

              <Button 
                className="w-full" 
                size="lg"
                onClick={() => setShowBookingModal(true)}
                leftIcon={<Calendar className="w-5 h-5" />}
              >
                Записаться на приём
              </Button>
            </CardContent>
          </Card>

          {/* Working Hours */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="w-5 h-5 text-teal-600" />
                Расписание
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600 text-sm">Приём</span>
                <span className="font-semibold text-slate-900">
                  {doctor.workStartTime || '09:00'} — {doctor.workEndTime || '18:00'}
                </span>
              </div>
              {(doctor.breakStart && doctor.breakEnd) && (
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-600 text-sm">Перерыв</span>
                  <span className="font-semibold text-slate-900">
                    {doctor.breakStart} — {doctor.breakEnd}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600 text-sm">Дни приёма</span>
                <span className="font-semibold text-slate-900 text-right">
                  {doctor.workingDays 
                    ? doctor.workingDays.split(',').map(d => ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][parseInt(d)]).join(', ')
                    : 'Пн — Пт'
                  }
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* About */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">О враче</CardTitle>
            </CardHeader>
            <CardContent>
              {doctor.bio ? (
                <p className="text-slate-600 leading-relaxed whitespace-pre-line">{doctor.bio}</p>
              ) : (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-slate-400">Врач пока не добавил информацию о себе</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Education & Certificates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <GraduationCap className="w-5 h-5 text-teal-600" />
                Образование и квалификация
              </CardTitle>
            </CardHeader>
            <CardContent>
              {doctor.education ? (
                <div className="space-y-3">
                  {doctor.education.split('\n').filter(item => item.trim()).map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <CheckCircle className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-700">{item}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <GraduationCap className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-slate-400">Информация об образовании будет добавлена позже</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Languages - показываем только если есть */}
          {doctor.languages && Array.isArray(doctor.languages) && doctor.languages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Globe className="w-5 h-5 text-teal-600" />
                  Языки консультаций
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {doctor.languages.map((lang, i) => (
                    <span key={i} className="px-4 py-2 bg-teal-50 text-teal-700 rounded-full text-sm font-medium">
                      {lang}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Services */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Award className="w-5 h-5 text-teal-600" />
                Услуги
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-teal-50 to-sky-50 rounded-2xl border border-teal-100">
                  <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                    <Video className="w-6 h-6 text-teal-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Видеоконсультация</p>
                    <p className="text-lg font-bold text-teal-600">{formatPrice(doctor.price || 0)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-100">
                  <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-violet-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Чат-консультация</p>
                    <p className="text-lg font-bold text-violet-600">{formatPrice(Math.round((doctor.price || 8000) * 0.7))}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reviews */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                Отзывы пациентов
              </CardTitle>
              {reviews.length > 0 && (
                <Badge variant="default">{reviews.length} отзывов</Badge>
              )}
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-medium mb-1">Пока нет отзывов</p>
                  <p className="text-sm text-slate-400">Станьте первым, кто оценит работу врача!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.slice(0, 5).map((review) => (
                    <div key={review.id} className="p-4 bg-slate-50 rounded-2xl">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={getMediaUrl(review.patient?.avatar)}
                            name={review.patient?.fullName || 'Пациент'}
                            size="md"
                          />
                          <div>
                            <p className="font-semibold text-slate-900">
                              {review.patient?.fullName?.split(' ').slice(0, 2).join(' ') || 'Пациент'}
                            </p>
                            <p className="text-xs text-slate-500">{formatDate(review.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 bg-amber-50 px-2 py-1 rounded-lg">
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                          <span className="font-semibold text-amber-700 text-sm">{review.rating || 5}</span>
                        </div>
                      </div>
                      <p className="text-slate-600">{review.comment || review.text}</p>
                    </div>
                  ))}
                  
                  {reviews.length > 5 && (
                    <button className="w-full py-3 text-teal-600 hover:text-teal-700 font-medium text-sm border border-teal-200 rounded-xl hover:bg-teal-50 transition-colors">
                      Показать все отзывы ({reviews.length})
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Booking Modal */}
      <BookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        doctor={doctor}
      />
    </div>
  )
}

export default DoctorProfilePage
