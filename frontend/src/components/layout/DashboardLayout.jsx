import { useState, useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { cn } from '../../utils/helpers'

const pageTitles = {
  '/patient': { title: 'Главная', subtitle: 'Добро пожаловать в личный кабинет' },
  '/patient/appointments': { title: 'Мои записи', subtitle: 'Управление записями к врачам' },
  '/patient/doctors': { title: 'Врачи', subtitle: 'Найдите нужного специалиста' },
  '/patient/chat': { title: 'Сообщения', subtitle: 'Чат с врачами' },
  '/patient/documents': { title: 'Документы', subtitle: 'Медицинские документы' },
  '/patient/profile': { title: 'Профиль', subtitle: 'Личные данные' },
  '/doctor': { title: 'Главная', subtitle: 'Рабочий кабинет врача' },
  '/doctor/schedule': { title: 'Расписание', subtitle: 'Управление рабочим временем' },
  '/doctor/patients': { title: 'Пациенты', subtitle: 'Список пациентов' },
  '/doctor/chat': { title: 'Сообщения', subtitle: 'Чат с пациентами' },
  '/doctor/profile': { title: 'Профиль', subtitle: 'Личные и профессиональные данные' },
  '/admin': { title: 'Дашборд', subtitle: 'Обзор системы' },
  '/admin/users': { title: 'Пользователи', subtitle: 'Управление пользователями' },
  '/admin/doctors': { title: 'Врачи', subtitle: 'Управление врачами' },
  '/admin/appointments': { title: 'Записи', subtitle: 'Все записи на приём' },
  '/admin/specializations': { title: 'Специализации', subtitle: 'Направления врачей' },
  '/admin/settings': { title: 'Настройки', subtitle: 'Настройки системы' },
}

function DashboardLayout({ navItems }) {
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const sidebarTouchStartX = useRef(null)

  const pageInfo = pageTitles[location.pathname] || { title: 'Страница', subtitle: '' }

  // Auto-close sidebar on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  const closeMobileMenu = () => setIsMobileMenuOpen(false)

  return (
    <div className="min-h-[var(--app-height)] bg-gradient-to-br from-slate-50 via-teal-50/30 to-sky-50/30">
      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-0 bg-slate-900/50 z-40 lg:hidden transition-opacity duration-300',
          isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={closeMobileMenu}
      />
      <div
        className={cn(
          'fixed left-0 top-0 h-[var(--app-height)] z-50 transition-transform duration-300 lg:translate-x-0',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        onTouchStart={(e) => { sidebarTouchStartX.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          if (sidebarTouchStartX.current === null) return
          const diff = sidebarTouchStartX.current - e.changedTouches[0].clientX
          if (diff > 60) closeMobileMenu()
          sidebarTouchStartX.current = null
        }}
      >
        <Sidebar navItems={navItems} onNavClick={closeMobileMenu} />
      </div>

      {/* Main Content */}
      <div className="lg:ml-64 min-h-[var(--app-height)] flex flex-col">
        <Header
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
          onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMobileMenuOpen={isMobileMenuOpen}
        />
        <main className="flex-1 min-h-0 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
