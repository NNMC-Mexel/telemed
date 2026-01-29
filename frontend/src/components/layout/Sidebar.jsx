import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home,
  Calendar,
  Users,
  MessageCircle,
  FileText,
  User,
  Settings,
  LogOut,
  LayoutDashboard,
  Stethoscope,
  Tags,
  Activity,
  X,
} from 'lucide-react'
import { cn } from '../../utils/helpers'
import useAuthStore from '../../stores/authStore'
import Avatar from '../ui/Avatar'

const iconMap = {
  home: Home,
  calendar: Calendar,
  users: Users,
  'message-circle': MessageCircle,
  'file-text': FileText,
  user: User,
  settings: Settings,
  'layout-dashboard': LayoutDashboard,
  stethoscope: Stethoscope,
  tags: Tags,
  activity: Activity,
}

function Sidebar({ navItems, onNavClick }) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="h-screen w-64 bg-white border-r border-slate-100 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-sky-500 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900">MedConnect</h1>
              <p className="text-xs text-slate-500">Телемедицина</p>
            </div>
          </div>
          <button
            onClick={onNavClick}
            className="lg:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon] || Home
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path.split('/').length <= 2}
              onClick={onNavClick}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )
              }
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <Avatar
            src={user?.avatar?.url}
            name={user?.fullName || user?.username}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {user?.fullName || user?.username}
            </p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Выйти
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
