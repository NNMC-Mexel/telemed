import { useState, useEffect } from 'react'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import SEOHead from '../components/seo/SEOHead'
import { useTranslation } from 'react-i18next'
import {
  Search,
  Filter,
  X,
  Loader2,
} from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { Card, CardContent } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import DoctorCard from '../components/doctors/DoctorCard'
import useAppointmentStore from '../stores/appointmentStore'
import useAuthStore from '../stores/authStore'
import BookingModal from '../components/appointments/BookingModal'
import { getSpecName } from '../utils/helpers'

function DoctorsPage() {
  const { t, i18n } = useTranslation()

  const sortOptions = [
    { value: 'rating', label: t('doctors_page.sort_rating') },
    { value: 'price_asc', label: t('doctors_page.sort_price_asc') },
    { value: 'price_desc', label: t('doctors_page.sort_price_desc') },
    { value: 'experience', label: t('doctors_page.sort_experience') },
  ]
  const [searchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [selectedSpec, setSelectedSpec] = useState(searchParams.get('specialization') || '')
  const [sortBy, setSortBy] = useState('rating')
  const [showFilters, setShowFilters] = useState(false)
  const [priceRange, setPriceRange] = useState({ min: '', max: '' })
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [showBookingModal, setShowBookingModal] = useState(false)

  const { 
    doctors, 
    specializations, 
    isLoading, 
    fetchDoctors, 
    fetchSpecializations 
  } = useAppointmentStore()
  
  const { isAuthenticated } = useAuthStore()
  const location = useLocation()
  
  // Определяем базовый путь (для пациентов и публичных страниц)
  const basePath = location.pathname.startsWith('/patient') ? '/patient' : ''

  // Загружаем врачей и специализации
  useEffect(() => {
    fetchSpecializations()
    fetchDoctors()
  }, [fetchDoctors, fetchSpecializations])

  // Filter and sort doctors
  const filteredDoctors = doctors
    .filter((doc) => {
      const specDisplay = getSpecName(doc.specialization, i18n.language) || doc.specialization?.name || ''
      const matchesSearch =
        doc.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        specDisplay.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesSpec = !selectedSpec || 
        doc.specialization?.name === selectedSpec ||
        doc.specialization?.id?.toString() === selectedSpec
      const matchesMinPrice = !priceRange.min || doc.price >= parseInt(priceRange.min)
      const matchesMaxPrice = !priceRange.max || doc.price <= parseInt(priceRange.max)
      return matchesSearch && matchesSpec && matchesMinPrice && matchesMaxPrice
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return (b.rating || 0) - (a.rating || 0)
        case 'price_asc':
          return (a.price || 0) - (b.price || 0)
        case 'price_desc':
          return (b.price || 0) - (a.price || 0)
        case 'experience':
          return (b.experience || 0) - (a.experience || 0)
        default:
          return 0
      }
    })

  const handleBookClick = (doctor) => {
    if (!isAuthenticated) {
      window.location.href = '/login'
      return
    }
    setSelectedDoctor(doctor)
    setShowBookingModal(true)
  }

  const isInDashboard = basePath === '/patient'

  return (
    <div className={isInDashboard ? 'animate-fadeIn' : 'pt-28 pb-16 bg-slate-50 min-h-screen'}>
      <SEOHead
        title="Каталог врачей — Онлайн-консультации"
        description="Найдите врача и запишитесь на онлайн-консультацию. Терапевт, кардиолог, невролог, педиатр, дерматолог и другие специалисты ННМЦ. Видеоконсультации из любой точки Казахстана."
        url="/doctors"
        noindex={isInDashboard}
      />
      <div className={isInDashboard ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{t('doctors_page.title')}</h1>
          <p className="text-slate-600">
            {t('doctors_page.subtitle', { count: filteredDoctors.length })}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <aside className={`lg:w-72 flex-shrink-0 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <Card className="sticky top-28">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold text-slate-900">{t('doctors_page.filter_title')}</h3>
                  <button
                    onClick={() => {
                      setSelectedSpec('')
                      setPriceRange({ min: '', max: '' })
                      setSearchQuery('')
                    }}
                    className="text-sm text-teal-600 hover:text-teal-700"
                  >
                    {t('doctors_page.reset_filters')}
                  </button>
                </div>

                {/* Specialization Filter */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    {t('doctors_page.spec_label')}
                  </label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="specialization"
                        checked={!selectedSpec}
                        onChange={() => setSelectedSpec('')}
                        className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500"
                      />
                      <span className="text-sm text-slate-700">{t('doctors_page.all_specs')}</span>
                    </label>
                    {specializations.map((spec) => (
                      <label key={spec.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="specialization"
                          checked={selectedSpec === spec.name || selectedSpec === spec.id?.toString()}
                          onChange={() => setSelectedSpec(spec.name)}
                          className="w-4 h-4 text-teal-600 border-slate-300 focus:ring-teal-500"
                        />
                        <span className="text-sm text-slate-700">{getSpecName(spec, i18n.language)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Price Filter */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    {t('doctors_page.price_label')}
                  </label>
                  <div className="flex gap-3">
                    <Input
                      type="number"
                      placeholder={t('doctors_page.price_from')}
                      value={priceRange.min}
                      onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                      className="text-sm"
                    />
                    <Input
                      type="number"
                      placeholder={t('doctors_page.price_to')}
                      value={priceRange.max}
                      onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                </div>

                <Button
                  variant="secondary"
                  className="w-full lg:hidden"
                  onClick={() => setShowFilters(false)}
                >
                  {t('doctors_page.apply_filters')}
                </Button>
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Search and Sort Bar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder={t('doctors_page.search_placeholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="lg:hidden"
                  onClick={() => setShowFilters(!showFilters)}
                  leftIcon={<Filter className="w-4 h-4" />}
                >
                  {t('doctors_page.filter_title')}
                </Button>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active Filters */}
            {(selectedSpec || priceRange.min || priceRange.max) && (
              <div className="flex flex-wrap gap-2 mb-6">
                {selectedSpec && (
                  <Badge variant="primary" className="flex items-center gap-1">
                    {getSpecName(specializations.find(s => s.name === selectedSpec), i18n.language) || selectedSpec}
                    <button onClick={() => setSelectedSpec('')}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {(priceRange.min || priceRange.max) && (
                  <Badge variant="primary" className="flex items-center gap-1">
                    {priceRange.min && t('doctors_page.price_from_badge', { price: priceRange.min })}
                    {priceRange.min && priceRange.max && ' — '}
                    {priceRange.max && t('doctors_page.price_to_badge', { price: priceRange.max })}
                    <button onClick={() => setPriceRange({ min: '', max: '' })}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}

            {/* Doctors List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
              </div>
            ) : filteredDoctors.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-slate-600 mb-4">
                    {t('doctors_page.no_results_text')}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelectedSpec('')
                      setPriceRange({ min: '', max: '' })
                      setSearchQuery('')
                    }}
                  >
                    {t('doctors_page.reset_button')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredDoctors.map((doctor) => (
                  <DoctorCard
                    key={doctor.id || doctor.documentId}
                    doctor={doctor}
                    basePath={basePath}
                    onBookClick={handleBookClick}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {selectedDoctor && (
        <BookingModal
          isOpen={showBookingModal}
          onClose={() => {
            setShowBookingModal(false)
            setSelectedDoctor(null)
          }}
          doctor={selectedDoctor}
        />
      )}
    </div>
  )
}

export default DoctorsPage
