import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarCheck, CalendarPlus, FileText, Home, MessageCircle } from 'lucide-react'
import { cn } from '../../utils/helpers'
import useSupportStore from '../../stores/supportStore'

const items = [
  {
    path: '/patient',
    label: 'nav.home',
    icon: Home,
    match: (pathname) => pathname === '/patient',
  },
  {
    path: '/patient/doctors',
    label: 'bottom_nav.book',
    icon: CalendarPlus,
    match: (pathname) => pathname.startsWith('/patient/doctors'),
  },
  {
    path: '/patient/appointments',
    label: 'patient.quick_appointments',
    icon: CalendarCheck,
    match: (pathname) => pathname.startsWith('/patient/appointments'),
  },
  {
    path: '/patient/chat',
    label: 'patient.quick_messages',
    icon: MessageCircle,
    match: (pathname) => pathname.startsWith('/patient/chat'),
  },
  {
    path: '/patient/documents',
    label: 'patient.quick_documents',
    icon: FileText,
    match: (pathname) => pathname.startsWith('/patient/documents'),
  },
]

function MobileBottomNav() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const supportUnreadCount = useSupportStore((state) => state.unreadCount)

  if (!pathname.startsWith('/patient')) return null

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[35] lg:hidden border-t border-slate-200 bg-white/95 px-2 pt-2 pb-[max(0.5rem,calc(var(--safe-bottom)+0.5rem))] shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {items.map(({ path, label, icon: Icon, match }) => {
          const isActive = match(pathname)

          return (
            <NavLink
              key={path}
              to={path}
              className={cn(
                'relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium leading-tight transition-colors',
                isActive
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              )}
            >
              <span className="relative">
                <Icon className="h-5 w-5 shrink-0" />
                {path === '/patient/chat' && supportUnreadCount > 0 && !isActive && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                    {supportUnreadCount > 9 ? '9+' : supportUnreadCount}
                  </span>
                )}
              </span>
              <span className="line-clamp-2 text-center">{t(label)}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

export default MobileBottomNav
