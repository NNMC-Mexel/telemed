import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
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

const sortOptions = [
  { value: 'rating', label: 'По рейтингу' },
  { value: 'price_asc', label: 'Цена: по возрастанию' },
  { value: 'price_desc', label: 'Цена: по убыванию' },
  { value: 'experience', label: 'По стажу' },
]

function DoctorsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
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
  const navigate = useNavigate()
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
      const matchesSearch = 
        doc.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.specialization?.name?.toLowerCase().includes(searchQuery.toLowerCase())
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

  return (
    <div className="pt-28 pb-16 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Найти врача</h1>
          <p className="text-slate-600">
            {filteredDoctors.length} врачей доступно для онлайн-консультации
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <aside className={`lg:w-72 flex-shrink-0 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <Card className="sticky top-28">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold text-slate-900">Фильтры</h3>
                  <button
                    onClick={() => {
                      setSelectedSpec('')
                      setPriceRange({ min: '', max: '' })
                      setSearchQuery('')
                    }}
                    className="text-sm text-teal-600 hover:text-teal-700"
                  >
                    Сбросить
                  </button>
                </div>

                {/* Specialization Filter */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Специализация
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
                      <span className="text-sm text-slate-700">Все специализации</span>
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
                        <span className="text-sm text-slate-700">{spec.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Price Filter */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Цена консультации (₸)
                  </label>
                  <div className="flex gap-3">
                    <Input
                      type="number"
                      placeholder="От"
                      value={priceRange.min}
                      onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                      className="text-sm"
                    />
                    <Input
                      type="number"
                      placeholder="До"
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
                  Применить фильтры
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
                  placeholder="Поиск по имени или специализации..."
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
                  Фильтры
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
                    {selectedSpec}
                    <button onClick={() => setSelectedSpec('')}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {(priceRange.min || priceRange.max) && (
                  <Badge variant="primary" className="flex items-center gap-1">
                    {priceRange.min && `от ${priceRange.min}₸`}
                    {priceRange.min && priceRange.max && ' — '}
                    {priceRange.max && `до ${priceRange.max}₸`}
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
                    Врачи не найдены по заданным критериям
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelectedSpec('')
                      setPriceRange({ min: '', max: '' })
                      setSearchQuery('')
                    }}
                  >
                    Сбросить фильтры
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
