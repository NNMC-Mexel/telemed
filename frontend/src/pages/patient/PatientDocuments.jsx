import { useState, useEffect, useRef } from 'react'
import {
  FileText,
  Download,
  Upload,
  Search,
  Calendar,
  Pill,
  TestTube,
  FileCheck,
  Trash2,
  X,
  Loader2,
} from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { formatDate } from '../../utils/helpers'
import useDocumentStore from '../../stores/documentStore'
import useAuthStore from '../../stores/authStore'
import { getMediaUrl } from '../../services/api'

const documentTypes = {
  analysis: { label: 'Анализы', icon: TestTube, color: 'bg-blue-100 text-blue-700' },
  prescription: { label: 'Рецепты', icon: Pill, color: 'bg-green-100 text-green-700' },
  certificate: { label: 'Справки', icon: FileCheck, color: 'bg-amber-100 text-amber-700' },
  other: { label: 'Другое', icon: FileText, color: 'bg-slate-100 text-slate-700' },
}

function PatientDocuments() {
  const { user } = useAuthStore()
  const { 
    documents, 
    isLoading, 
    isUploading, 
    error,
    fetchDocuments, 
    uploadDocument,
    deleteDocument,
  } = useDocumentStore()
  
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  
  // Upload form state
  const [uploadFileState, setUploadFileState] = useState(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadType, setUploadType] = useState('other')
  const [uploadDescription, setUploadDescription] = useState('')
  const fileInputRef = useRef(null)

  // Загружаем документы при монтировании
  useEffect(() => {
    if (user?.id) {
      fetchDocuments({ userId: user.id })
    }
  }, [user?.id, fetchDocuments])

  const filteredDocuments = documents.filter(doc => {
    const matchesFilter = filter === 'all' || doc.type === filter
    const matchesSearch = 
      doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.doctor?.fullName?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const stats = {
    total: documents.length,
    analysis: documents.filter(d => d.type === 'analysis').length,
    prescription: documents.filter(d => d.type === 'prescription').length,
    certificate: documents.filter(d => d.type === 'certificate').length,
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadFileState(file)
      if (!uploadTitle) {
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setUploadFileState(file)
      if (!uploadTitle) {
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  const handleUpload = async () => {
    if (!uploadFileState || !uploadTitle) return
    
    const result = await uploadDocument(uploadFileState, {
      title: uploadTitle,
      type: uploadType,
      description: uploadDescription,
      userId: user.id,
    })
    
    if (result.success) {
      setShowUploadModal(false)
      resetUploadForm()
    }
  }

  const resetUploadForm = () => {
    setUploadFileState(null)
    setUploadTitle('')
    setUploadType('other')
    setUploadDescription('')
  }

  const handleDelete = async (id) => {
    const result = await deleteDocument(id)
    if (result.success) {
      setShowDeleteConfirm(null)
    }
  }

  const handleDownload = (doc) => {
    const url = getMediaUrl(doc.file)
    if (url) {
      window.open(url, '_blank')
    }
  }

  const getFileSize = (file) => {
    if (!file?.size) return 'N/A'
    const kb = file.size / 1024
    if (kb < 1024) return `${Math.round(kb)} KB`
    return `${(kb / 1024).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Мои документы</h1>
          <p className="text-slate-600">Медицинские документы и результаты анализов</p>
        </div>
        <Button onClick={() => setShowUploadModal(true)} leftIcon={<Upload className="w-4 h-4" />}>
          Загрузить документ
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-sm text-slate-500">Всего документов</p>
            </div>
          </CardContent>
        </Card>
        {Object.entries(documentTypes).slice(0, 3).map(([key, config]) => (
          <Card key={key}>
            <CardContent className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${config.color} flex items-center justify-center`}>
                <config.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats[key] || 0}</p>
                <p className="text-sm text-slate-500">{config.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск документов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === 'all' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Все
            </button>
            {Object.entries(documentTypes).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filter === key ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {config.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <div className="space-y-3">
        {isLoading ? (
          <Card>
            <CardContent className="text-center py-12">
              <Loader2 className="w-8 h-8 mx-auto text-teal-600 animate-spin mb-4" />
              <p className="text-slate-600">Загрузка документов...</p>
            </CardContent>
          </Card>
        ) : filteredDocuments.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Документы не найдены</h3>
              <p className="text-slate-600">
                {searchQuery ? 'Попробуйте изменить параметры поиска' : 'У вас пока нет документов'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredDocuments.map((doc) => {
            const typeConfig = documentTypes[doc.type] || documentTypes.other
            return (
              <Card key={doc.id} hover className="cursor-pointer" onClick={() => setSelectedDocument(doc)}>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${typeConfig.color} flex items-center justify-center`}>
                      <typeConfig.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900">{doc.title}</h3>
                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        {doc.doctor?.fullName && (
                          <>
                            <span className="text-sm text-slate-500">{doc.doctor.fullName}</span>
                            <span className="text-sm text-slate-400">•</span>
                          </>
                        )}
                        <span className="text-sm text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(doc.createdAt)}
                        </span>
                        <span className="text-sm text-slate-400">•</span>
                        <span className="text-sm text-slate-500">{getFileSize(doc.file)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(doc) }}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                        title="Скачать"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(doc.id) }}
                        className="p-2 hover:bg-red-100 rounded-lg text-slate-500 hover:text-red-600"
                        title="Удалить"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Document Preview Modal */}
      <Modal
        isOpen={!!selectedDocument}
        onClose={() => setSelectedDocument(null)}
        title={selectedDocument?.title}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedDocument(null)}>Закрыть</Button>
            <Button leftIcon={<Download className="w-4 h-4" />} onClick={() => handleDownload(selectedDocument)}>
              Скачать
            </Button>
          </>
        }
      >
        {selectedDocument && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-600">Тип документа</span>
                <Badge className={(documentTypes[selectedDocument.type] || documentTypes.other).color}>
                  {(documentTypes[selectedDocument.type] || documentTypes.other).label}
                </Badge>
              </div>
              {selectedDocument.doctor?.fullName && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Врач</span>
                  <span className="font-medium text-slate-900">{selectedDocument.doctor.fullName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">Дата</span>
                <span className="font-medium text-slate-900">{formatDate(selectedDocument.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Размер файла</span>
                <span className="font-medium text-slate-900">{getFileSize(selectedDocument.file)}</span>
              </div>
              {selectedDocument.description && (
                <div className="pt-2 border-t">
                  <span className="text-slate-600 block mb-1">Описание</span>
                  <p className="text-slate-900">{selectedDocument.description}</p>
                </div>
              )}
            </div>

            {selectedDocument.file?.mime?.startsWith('image/') ? (
              <img src={getMediaUrl(selectedDocument.file)} alt={selectedDocument.title} className="w-full rounded-xl" />
            ) : (
              <div className="bg-slate-100 rounded-xl aspect-[3/4] flex items-center justify-center">
                <div className="text-center">
                  <FileText className="w-16 h-16 mx-auto text-slate-400 mb-3" />
                  <p className="text-slate-500">Предпросмотр недоступен</p>
                  <p className="text-sm text-slate-400 mt-1">Скачайте файл для просмотра</p>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => { setShowUploadModal(false); resetUploadForm() }}
        title="Загрузить документ"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowUploadModal(false); resetUploadForm() }}>
              Отмена
            </Button>
            <Button onClick={handleUpload} disabled={!uploadFileState || !uploadTitle || isUploading} isLoading={isUploading}>
              Загрузить
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              uploadFileState ? 'border-teal-500 bg-teal-50' : 'border-slate-300 hover:border-teal-500 hover:bg-teal-50/50'
            }`}
          >
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileSelect} />
            {uploadFileState ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-teal-600" />
                <div className="text-left">
                  <p className="font-medium text-slate-900">{uploadFileState.name}</p>
                  <p className="text-sm text-slate-500">{getFileSize(uploadFileState)}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setUploadFileState(null) }} className="p-1 hover:bg-slate-200 rounded">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                <p className="font-medium text-slate-900 mb-1">Перетащите файл сюда или нажмите для выбора</p>
                <p className="text-sm text-slate-500">PDF, JPG, PNG, DOC до 10 МБ</p>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Название документа *</label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Например: Общий анализ крови"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Тип документа</label>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {Object.entries(documentTypes).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Описание (необязательно)</label>
            <textarea
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Дополнительная информация о документе..."
            />
          </div>

          <p className="text-sm text-slate-500">💡 Загруженные документы будут доступны вашим врачам для просмотра</p>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Удалить документ?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>Отмена</Button>
            <Button variant="danger" onClick={() => handleDelete(showDeleteConfirm)} isLoading={isLoading}>
              Удалить
            </Button>
          </>
        }
      >
        <p className="text-slate-600">Вы уверены, что хотите удалить этот документ? Это действие нельзя отменить.</p>
      </Modal>
    </div>
  )
}

export default PatientDocuments
