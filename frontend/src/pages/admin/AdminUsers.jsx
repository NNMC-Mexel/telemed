import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Search,
  Trash2,
  UserPlus,
  ShieldPlus,
  Loader2,
  AlertCircle,
  Check,
  X,
} from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Pagination from '../../components/ui/Pagination'
import AdminCreateUserModal from '../../components/admin/AdminCreateUserModal'
import api, { getMediaUrl } from '../../services/api'
import { formatDate } from '../../utils/helpers'

const USERS_PER_PAGE = 10

const roleVariants = {
  patient: 'default',
  doctor: 'primary',
  admin: 'danger',
}

function AdminUsers() {
  const { t } = useTranslation()
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [createRole, setCreateRole] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const roleLabels = {
    patient: t('admin_users.role_patient'),
    doctor: t('admin_users.role_doctor'),
    admin: t('admin_users.role_admin'),
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const response = await api.get('/api/users?populate=*&pagination[limit]=1000')
      setUsers(response.data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredUsers = users.filter(user => {
    if (roleFilter !== 'all' && user.userRole !== roleFilter) {
      return false
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        user.username?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.fullName?.toLowerCase().includes(query)
      )
    }
    return true
  })

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, roleFilter])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedUsers = filteredUsers.slice(
    (safeCurrentPage - 1) * USERS_PER_PAGE,
    safeCurrentPage * USERS_PER_PAGE
  )

  const handleDeleteUser = async () => {
    if (!selectedUser) return
    setIsDeleting(true)
    try {
      await api.delete(`/api/users/${selectedUser.id}`)
      setUsers(prev => prev.filter(u => u.id !== selectedUser.id))
      setShowDeleteModal(false)
      setSelectedUser(null)
    } catch (error) {
      console.error('Error deleting user:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBlockUser = async (userId, blocked) => {
    try {
      await api.put(`/api/users/${userId}`, { blocked })
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, blocked } : u
      ))
    } catch (error) {
      console.error('Error blocking user:', error)
    }
  }

  const openDeleteModal = (user) => {
    setSelectedUser(user)
    setShowDeleteModal(true)
  }

  const handleUserCreated = () => {
    fetchUsers()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('admin_users.title')}</h1>
          <p className="text-slate-600">{t('admin_users.subtitle')}</p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
          <Button
            variant="outline"
            className="w-full"
            leftIcon={<UserPlus className="w-4 h-4" />}
            onClick={() => setCreateRole('patient')}
          >
            {t('admin_users.add_patient')}
          </Button>
          <Button
            className="w-full"
            leftIcon={<ShieldPlus className="w-4 h-4" />}
            onClick={() => setCreateRole('admin')}
          >
            {t('admin_users.add_admin')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder={t('admin_users.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:max-w-full sm:overflow-x-auto sm:pb-1">
          {[
            { value: 'all', label: t('admin_users.filter_all') },
            { value: 'patient', label: t('admin_users.filter_patient') },
            { value: 'doctor', label: t('admin_users.filter_doctor') },
            { value: 'admin', label: t('admin_users.filter_admin') },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setRoleFilter(value)}
              className={`px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                roleFilter === value
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Users */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 md:hidden">
            {filteredUsers.length === 0 ? (
              <div className="px-4 py-12 text-center text-slate-500">
                {t('admin.no_users')}
              </div>
            ) : (
              paginatedUsers.map((user) => (
                <div key={user.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={getMediaUrl(user.avatar)}
                      name={user.fullName || user.username}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 break-words">
                        {user.fullName || user.username}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-500 break-all">{user.email}</p>
                      <p className="text-sm text-slate-500">{user.phone || t('admin_users.no_phone')}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant={roleVariants[user.userRole] || 'default'}>
                      {roleLabels[user.userRole] || user.userRole}
                    </Badge>
                    {user.blocked ? (
                      <Badge variant="danger">{t('admin_users.blocked')}</Badge>
                    ) : user.confirmed ? (
                      <Badge variant="success">{t('admin_users.active')}</Badge>
                    ) : (
                      <Badge variant="default">{t('admin_users.not_confirmed')}</Badge>
                    )}
                    <span className="basis-full text-xs text-slate-400 sm:basis-auto">{formatDate(user.createdAt)}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-[minmax(0,1fr)_44px] gap-2">
                    {user.blocked ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full min-w-0"
                        onClick={() => handleBlockUser(user.id, false)}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        {t('admin_users.unblock_action')}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full min-w-0"
                        onClick={() => handleBlockUser(user.id, true)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        {t('admin_users.block_action')}
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => openDeleteModal(user)}
                      aria-label={t('documents.delete_action')}
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-4 px-6 font-medium text-slate-500">{t('admin_users.col_user')}</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-500">Email</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-500">{t('admin_users.col_role')}</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-500">{t('admin_users.col_status')}</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-500">{t('admin_users.col_registered')}</th>
                  <th className="text-right py-4 px-6 font-medium text-slate-500">{t('admin_users.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500">
                      {t('admin_users.filter_all')}
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={getMediaUrl(user.avatar)}
                            name={user.fullName || user.username}
                            size="md"
                          />
                          <div>
                            <p className="font-medium text-slate-900">
                              {user.fullName || user.username}
                            </p>
                            <p className="text-sm text-slate-500">
                              {user.phone || t('admin_users.no_phone')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 break-all">{user.email}</td>
                      <td className="py-4 px-6">
                        <Badge variant={roleVariants[user.userRole] || 'default'}>
                          {roleLabels[user.userRole] || user.userRole}
                        </Badge>
                      </td>
                      <td className="py-4 px-6">
                        {user.blocked ? (
                          <Badge variant="danger">{t('admin_users.blocked')}</Badge>
                        ) : user.confirmed ? (
                          <Badge variant="success">{t('admin_users.active')}</Badge>
                        ) : (
                          <Badge variant="default">{t('admin_users.not_confirmed')}</Badge>
                        )}
                      </td>
                      <td className="py-4 px-6 text-slate-600">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2">
                          {user.blocked ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleBlockUser(user.id, false)}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              {t('admin_users.unblock_action')}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleBlockUser(user.id, true)}
                            >
                              <X className="w-4 h-4 mr-1" />
                              {t('admin_users.block_action')}
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="icon"
                            onClick={() => openDeleteModal(user)}
                          >
                            <Trash2 className="w-4 h-4 text-rose-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={safeCurrentPage}
            totalItems={filteredUsers.length}
            pageSize={USERS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Card>
          <CardContent className="p-4 text-center sm:p-6">
            <p className="text-2xl font-bold text-slate-900 sm:text-3xl">
              {users.filter(u => u.userRole === 'patient').length}
            </p>
            <p className="text-sm text-slate-500 sm:text-base">{t('admin_users.stat_patients')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center sm:p-6">
            <p className="text-2xl font-bold text-slate-900 sm:text-3xl">
              {users.filter(u => u.userRole === 'doctor').length}
            </p>
            <p className="text-sm text-slate-500 sm:text-base">{t('admin_users.stat_doctors')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center sm:p-6">
            <p className="text-2xl font-bold text-slate-900 sm:text-3xl">
              {users.filter(u => u.blocked).length}
            </p>
            <p className="text-sm text-slate-500 sm:text-base">{t('admin_users.stat_blocked')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t('admin_users.delete_title')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteUser}
              isLoading={isDeleting}
            >
              {t('documents.delete_action')}
            </Button>
          </>
        }
      >
        <div className="text-center py-4">
          <AlertCircle className="w-12 h-12 mx-auto text-rose-500 mb-4" />
          <p className="text-slate-600">
            {t('appointments.cancel_question')}{' '}
            <span className="font-semibold">{selectedUser?.fullName || selectedUser?.username}</span>?
          </p>
          <p className="text-sm text-slate-500 mt-2">
            {t('documents.delete_desc')}
          </p>
        </div>
      </Modal>

      <AdminCreateUserModal
        isOpen={Boolean(createRole)}
        role={createRole || 'patient'}
        onClose={() => setCreateRole(null)}
        onCreated={handleUserCreated}
      />
    </div>
  )
}

export default AdminUsers
