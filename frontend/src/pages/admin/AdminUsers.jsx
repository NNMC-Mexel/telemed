import { useState, useEffect } from 'react'
import {
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  UserPlus,
  Loader2,
  AlertCircle,
  Check,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import api, { getMediaUrl } from '../../services/api'
import { formatDate } from '../../utils/helpers'

const roleLabels = {
  patient: 'Пациент',
  doctor: 'Врач',
  admin: 'Админ',
}

const roleVariants = {
  patient: 'default',
  doctor: 'primary',
  admin: 'danger',
}

function AdminUsers() {
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const response = await api.get('/api/users?populate=*')
      setUsers(response.data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredUsers = users.filter(user => {
    // Фильтр по роли
    if (roleFilter !== 'all' && user.userRole !== roleFilter) {
      return false
    }
    
    // Поиск
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

  const openEditModal = (user) => {
    setSelectedUser(user)
    setShowEditModal(true)
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
          <h1 className="text-2xl font-bold text-slate-900">Пользователи</h1>
          <p className="text-slate-600">Управление пользователями системы</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по имени или email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'Все' },
            { value: 'patient', label: 'Пациенты' },
            { value: 'doctor', label: 'Врачи' },
            { value: 'admin', label: 'Админы' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setRoleFilter(value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
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

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-4 px-6 font-medium text-slate-500">Пользователь</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-500">Email</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-500">Роль</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-500">Статус</th>
                  <th className="text-left py-4 px-6 font-medium text-slate-500">Регистрация</th>
                  <th className="text-right py-4 px-6 font-medium text-slate-500">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500">
                      Пользователи не найдены
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
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
                              {user.phone || 'Нет телефона'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600">{user.email}</td>
                      <td className="py-4 px-6">
                        <Badge variant={roleVariants[user.userRole] || 'default'}>
                          {roleLabels[user.userRole] || user.userRole}
                        </Badge>
                      </td>
                      <td className="py-4 px-6">
                        {user.blocked ? (
                          <Badge variant="danger">Заблокирован</Badge>
                        ) : user.confirmed ? (
                          <Badge variant="success">Активен</Badge>
                        ) : (
                          <Badge variant="default">Не подтверждён</Badge>
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
                              Разблокировать
                            </Button>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleBlockUser(user.id, true)}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Заблокировать
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
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-slate-900">
              {users.filter(u => u.userRole === 'patient').length}
            </p>
            <p className="text-slate-500">Пациентов</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-slate-900">
              {users.filter(u => u.userRole === 'doctor').length}
            </p>
            <p className="text-slate-500">Врачей</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center">
            <p className="text-3xl font-bold text-slate-900">
              {users.filter(u => u.blocked).length}
            </p>
            <p className="text-slate-500">Заблокировано</p>
          </CardContent>
        </Card>
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Удаление пользователя"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Отмена
            </Button>
            <Button 
              variant="danger" 
              onClick={handleDeleteUser}
              isLoading={isDeleting}
            >
              Удалить
            </Button>
          </>
        }
      >
        <div className="text-center py-4">
          <AlertCircle className="w-12 h-12 mx-auto text-rose-500 mb-4" />
          <p className="text-slate-600">
            Вы уверены, что хотите удалить пользователя{' '}
            <span className="font-semibold">{selectedUser?.fullName || selectedUser?.username}</span>?
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Это действие нельзя отменить.
          </p>
        </div>
      </Modal>
    </div>
  )
}

export default AdminUsers
