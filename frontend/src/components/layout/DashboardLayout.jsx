import { useState, useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Sidebar from './Sidebar'
import Header from './Header'
import { cn } from '../../utils/helpers'

function DashboardLayout({ navItems }) {
  const { t } = useTranslation()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const sidebarTouchStartX = useRef(null)

  const path = location.pathname
  const title = path.startsWith('/patient/doctors/')
    ? t('nav.doctors')
    : path.endsWith('/notifications')
      ? t('notifications.title')
    : t(`dashboard.page_titles.${path}`, t('dashboard.page_titles.default'))
  const subtitle = path.startsWith('/patient/doctors/')
    ? ''
    : path.endsWith('/notifications')
      ? ''
    : t(`dashboard.page_titles.${path}_sub`, '')

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  const closeMobileMenu = () => setIsMobileMenuOpen(false)

  return (
    <div className="min-h-[var(--app-height)] overflow-x-hidden bg-gradient-to-br from-slate-50 via-teal-50/30 to-sky-50/30">
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
          title={title}
          subtitle={subtitle}
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
