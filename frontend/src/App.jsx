import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ToastProvider } from './components/ui/Toast'

// Layouts
import { PublicLayout, DashboardLayout } from './components/layout'

// Public Pages
import LandingPage from './pages/LandingPage'
import DoctorsPage from './pages/DoctorsPage'
import DoctorProfilePage from './pages/DoctorProfilePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import EmailConfirmationPage from './pages/EmailConfirmationPage'

// Patient Pages
import PatientDashboard from './pages/patient/PatientDashboard'
import PatientAppointments from './pages/patient/PatientAppointments'
import PatientProfile from './pages/patient/PatientProfile'
import PatientChat from './pages/patient/PatientChat'
import PatientDocuments from './pages/patient/PatientDocuments'
import AppointmentDetail from './pages/AppointmentDetail'

// Doctor Pages
import DoctorDashboard from './pages/doctor/DoctorDashboard'
import DoctorSchedule from './pages/doctor/DoctorSchedule'
import DoctorPatients from './pages/doctor/DoctorPatients'
import DoctorProfile from './pages/doctor/DoctorProfile'
import PatientHistory from './pages/doctor/PatientHistory'

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminDoctors from './pages/admin/AdminDoctors'
import AdminAppointments from './pages/admin/AdminAppointments'
import AdminSpecializations from './pages/admin/AdminSpecializations'
import AdminContent from './pages/admin/AdminContent'

// Support Pages
import SupportInbox from './pages/support/SupportInbox'

// Other Pages
import VideoConsultation from './pages/VideoConsultation'
import NotificationsPage from './pages/NotificationsPage'
import PaymentSuccess from './pages/PaymentSuccess'
import PaymentFailure from './pages/PaymentFailure'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'

// Stores
import useAuthStore from './stores/authStore'
import { initPushNotifications } from './services/pushNotifications'
import { SplashScreen } from '@capacitor/splash-screen'

// Utils
import { PATIENT_NAV_ITEMS, DOCTOR_NAV_ITEMS, ADMIN_NAV_ITEMS, MANAGER_NAV_ITEMS } from './utils/constants'
import { isNativeMobileApp } from './utils/platform'

// Loading component
function LoadingScreen() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600">{t('common.loading')}</p>
      </div>
    </div>
  )
}

// Protected Route Component
function ProtectedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, user, _hasHydrated } = useAuthStore()
  
  // Ждём пока zustand загрузит данные из localStorage
  if (!_hasHydrated) {
    return <LoadingScreen />
  }
  
  // Получаем роль из userRole (так называется в Strapi)
  const userRole = user?.userRole || 'patient'

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    // Redirect to appropriate dashboard based on role
    if (userRole === 'doctor') return <Navigate to="/doctor" replace />
    if (userRole === 'admin') return <Navigate to="/admin" replace />
    if (userRole === 'manager') return <Navigate to="/manager" replace />
    return <Navigate to="/patient" replace />
  }

  return children
}

// Public Route (redirect if authenticated)
function PublicRoute({ children }) {
  const { isAuthenticated, user, _hasHydrated } = useAuthStore()
  
  // Ждём пока zustand загрузит данные из localStorage
  if (!_hasHydrated) {
    return <LoadingScreen />
  }
  
  // Получаем роль из userRole (так называется в Strapi)
  const userRole = user?.userRole || 'patient'

  if (isAuthenticated) {
    if (userRole === 'doctor') return <Navigate to="/doctor" replace />
    if (userRole === 'admin') return <Navigate to="/admin" replace />
    if (userRole === 'manager') return <Navigate to="/manager" replace />
    return <Navigate to="/patient" replace />
  }

  return children
}

function getDashboardPath(user) {
  const userRole = user?.userRole || 'patient'
  if (userRole === 'doctor') return '/doctor'
  if (userRole === 'admin') return '/admin'
  if (userRole === 'manager') return '/manager'
  return '/patient'
}

function AppHomeRoute() {
  const { isAuthenticated, user, _hasHydrated } = useAuthStore()

  if (!_hasHydrated) {
    return <LoadingScreen />
  }

  if (!isNativeMobileApp()) {
    return (
      <PublicLayout>
        <LandingPage />
      </PublicLayout>
    )
  }

  return <Navigate to={isAuthenticated ? getDashboardPath(user) : '/login'} replace />
}

function App() {
  const { fetchUser, token, isAuthenticated, _hasHydrated } = useAuthStore()

  useEffect(() => {
    // Приложение готово: даём лого один цикл пульсации, затем плавно убираем
    // нативный splash и веб-оверлей из index.html
    const timer = setTimeout(() => {
      SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {})
      const overlay = document.getElementById('splash-screen')
      if (overlay) {
        overlay.classList.add('splash-screen--hide')
        setTimeout(() => overlay.remove(), 500)
      }
    }, 1300)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (_hasHydrated && token) {
      fetchUser()
    }
  }, [token, fetchUser, _hasHydrated])

  useEffect(() => {
    if (_hasHydrated && isAuthenticated && token) {
      initPushNotifications().catch((error) => {
        console.error('push notifications init failed:', error)
      })
    }
  }, [_hasHydrated, isAuthenticated, token])

  return (
    <ToastProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppHomeRoute />} />

        {/* Public Routes */}
        <Route element={<PublicLayout />}>
          <Route path="/doctors" element={<DoctorsPage />} />
          <Route path="/doctors/:id" element={<DoctorProfilePage />} />
          <Route path="/specializations" element={<DoctorsPage />} />
          <Route path="/about" element={<LandingPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
        </Route>

        {/* Auth Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/email-confirmation" element={<EmailConfirmationPage />} />

        {/* Patient Routes */}
        <Route
          path="/patient"
          element={
            <ProtectedRoute allowedRoles={['patient']}>
              <DashboardLayout navItems={PATIENT_NAV_ITEMS} />
            </ProtectedRoute>
          }
        >
          <Route index element={<PatientDashboard />} />
          <Route path="appointments" element={<PatientAppointments />} />
          <Route path="appointments/:id" element={<AppointmentDetail />} />
          <Route path="doctors" element={<DoctorsPage />} />
          <Route path="doctors/:id" element={<DoctorProfilePage />} />
          <Route path="chat" element={<PatientChat />} />
          <Route path="documents" element={<PatientDocuments />} />
          <Route path="profile" element={<PatientProfile />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        {/* Doctor Routes */}
        <Route
          path="/doctor"
          element={
            <ProtectedRoute allowedRoles={['doctor']}>
              <DashboardLayout navItems={DOCTOR_NAV_ITEMS} />
            </ProtectedRoute>
          }
        >
          <Route index element={<DoctorDashboard />} />
          <Route path="appointments/:id" element={<AppointmentDetail />} />
          <Route path="schedule" element={<DoctorSchedule />} />
          <Route path="patients" element={<DoctorPatients />} />
          <Route path="patients/:patientId" element={<PatientHistory />} />
          <Route path="chat" element={<PatientChat />} />
          <Route path="profile" element={<DoctorProfile />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DashboardLayout navItems={ADMIN_NAV_ITEMS} />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="doctors" element={<AdminDoctors />} />
          <Route path="appointments" element={<AdminAppointments />} />
          <Route path="specializations" element={<AdminSpecializations />} />
          <Route path="settings" element={<AdminContent />} />
          <Route path="support" element={<SupportInbox />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        {/* Manager Routes */}
        <Route
          path="/manager"
          element={
            <ProtectedRoute allowedRoles={['manager']}>
              <DashboardLayout navItems={MANAGER_NAV_ITEMS} />
            </ProtectedRoute>
          }
        >
          <Route index element={<SupportInbox />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        {/* Video Consultation */}
        <Route
          path="/consultation/:roomId"
          element={
            <ProtectedRoute>
              <VideoConsultation />
            </ProtectedRoute>
          }
        />

        {/* Payment Callbacks (ePay redirect) */}
        <Route
          path="/payment/success"
          element={
            <ProtectedRoute>
              <PaymentSuccess />
            </ProtectedRoute>
          }
        />
        <Route path="/payment/failure" element={<PaymentFailure />} />

        {/* 404 */}
        <Route path="*" element={<Navigate to={isNativeMobileApp() ? '/login' : '/'} replace />} />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  )
}

export default App
