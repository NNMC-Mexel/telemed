import { useState, useEffect, useRef, useMemo } from 'react'
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
  ChevronRight,
  ArrowLeft,
  FolderOpen,
  Stethoscope,
  ArrowUpDown,
} from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { formatDate, cn } from '../../utils/helpers'
import useDocumentStore from '../../stores/documentStore'
import useAuthStore from '../../stores/authStore'
import api, { getMediaUrl } from '../../services/api'

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

  // View state
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortNewest, setSortNewest] = useState(true)
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewError, setPreviewError] = useState(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  // Upload form state
  const [uploadFileState, setUploadFileState] = useState(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadType, setUploadType] = useState('other')
  const [uploadDescription, setUploadDescription] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (user?.id) {
      fetchDocuments({ userId: user.id })
    }
  }, [user?.id, fetchDocuments])

  // Preview logic
  useEffect(() => {
    let isActive = true
    let objectUrl = null

    const file = selectedDocument?.file
    const mime = file?.mime || ''
    const isPdf = mime.includes('pdf')

    setPreviewUrl(null)
    setPreviewError(null)
    setIsPreviewLoading(false)

    if (!selectedDocument || !file?.url || !isPdf) return undefined

    const fileUrl = getMediaUrl(file)
    if (!fileUrl) {
      setPreviewError('Не удалось получить ссылку на файл')
      return undefined
    }

    setIsPreviewLoading(true)
    api
      .get(fileUrl, { responseType: 'blob' })
      .then((response) => {
        if (!isActive) return
        objectUrl = URL.createObjectURL(response.data)
        setPreviewUrl(objectUrl)
      })
      .catch(() => {
        if (!isActive) return
        setPreviewError('Предпросмотр недоступен')
      })
      .finally(() => {
        if (!isActive) return
        setIsPreviewLoading(false)
      })

    return () => {
      isActive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [selectedDocument?.file?.url, selectedDocument?.file?.mime, selectedDocument?.id])

  // Group documents by appointment (consultation folders)
  const { folders, ungroupedDocs } = useMemo(() => {
    const grouped = {}
    const ungrouped = []

    for (const doc of documents) {
      const apt = doc.appointment
      if (apt) {
        const aptKey = apt.documentId || apt.id
        if (!grouped[aptKey]) {
          grouped[aptKey] = {
            id: aptKey,
            dateTime: apt.dateTime,
            doctor: apt.doctor || doc.doctor,
            docs: [],
          }
        }
        grouped[aptKey].docs.push(doc)
        if (apt.doctor && !grouped[aptKey].doctor) {
          grouped[aptKey].doctor = apt.doctor
        }
      } else {
        ungrouped.push(doc)
      }
    }

    let folderList = Object.values(grouped)
    folderList.sort((a, b) => {
      const dateA = new Date(a.dateTime || 0)
      const dateB = new Date(b.dateTime || 0)
      return sortNewest ? dateB - dateA : dateA - dateB
    })

    return { folders: folderList, ungroupedDocs: ungrouped }
  }, [documents, sortNewest])

  // Filter folders by search query (doctor name)
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return folders
    const q = searchQuery.toLowerCase()
    return folders.filter(f => {
      const doctorName = f.doctor?.fullName || ''
      const specName = typeof f.doctor?.specialization === 'object'
        ? f.doctor.specialization?.name || ''
        : f.doctor?.specialization || ''
      return doctorName.toLowerCase().includes(q) || specName.toLowerCase().includes(q)
    })
  }, [folders, searchQuery])

  // Documents inside selected folder, filtered by type
  const folderDocuments = useMemo(() => {
    if (!selectedFolder) return []
    const docs = selectedFolder.id === '__uploads__'
      ? ungroupedDocs
      : (folders.find(f => f.id === selectedFolder.id)?.docs || [])

    if (filter === 'all') return docs
    return docs.filter(d => d.type === filter)
  }, [selectedFolder, folders, ungroupedDocs, filter])

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
      if (!uploadTitle) setUploadTitle(file.name.replace(/\.[^/.]+$/, ''))
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setUploadFileState(file)
      if (!uploadTitle) setUploadTitle(file.name.replace(/\.[^/.]+$/, ''))
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
    if (result.success) setShowDeleteConfirm(null)
  }

  const handleDownload = (doc) => {
    const url = getMediaUrl(doc.file)
    if (url) window.open(url, '_blank')
  }

  const getFileSize = (file) => {
    if (!file?.size) return 'N/A'
    const kb = file.size / 1024
    if (kb < 1024) return `${Math.round(kb)} KB`
    return `${(kb / 1024).toFixed(1)} MB`
  }

  const getDocTypeBadges = (docs) => {
    const types = [...new Set(docs.map(d => d.type).filter(Boolean))]
    return types.map(t => documentTypes[t] || documentTypes.other)
  }

  const getDoctorInfo = (folder) => {
    const doctor = folder.doctor
    if (!doctor) return null
    const specName = typeof doctor.specialization === 'object'
      ? doctor.specialization?.name
      : doctor.specialization
    return { name: doctor.fullName, spec: specName }
  }

  const getDocCountWord = (count) => {
    if (count === 1) return 'документ'
    if (count >= 2 && count <= 4) return 'документа'
    return 'документов'
  }

  const openFolder = (folder) => {
    setSelectedFolder(folder)
    setFilter('all')
  }

  const closeFolder = () => {
    setSelectedFolder(null)
    setFilter('all')
  }

  const isImagePreview = selectedDocument?.file?.mime?.startsWith('image/')
  const isPdfPreview = selectedDocument?.file?.mime?.includes('pdf')

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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">{error}</div>
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

      {/* Content Area */}
      {isLoading ? (
        <Card>
          <CardContent className="text-center py-12">
            <Loader2 className="w-8 h-8 mx-auto text-teal-600 animate-spin mb-4" />
            <p className="text-slate-600">Загрузка документов...</p>
          </CardContent>
        </Card>
      ) : !selectedFolder ? (
        /* ========== FOLDER VIEW ========== */
        <>
          {/* Search & Sort */}
          <Card>
            <CardContent className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Поиск по врачу..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <button
                onClick={() => setSortNewest(prev => !prev)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <ArrowUpDown className="w-4 h-4" />
                {sortNewest ? 'Сначала новые' : 'Сначала старые'}
              </button>
            </CardContent>
          </Card>

          {/* Consultation Folders */}
          <div className="space-y-3">
            {filteredFolders.length === 0 && ungroupedDocs.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <FolderOpen className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">Документы не найдены</h3>
                  <p className="text-slate-600">
                    {searchQuery ? 'Попробуйте изменить параметры поиска' : 'У вас пока нет документов'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {filteredFolders.map((folder) => {
                  const doctorInfo = getDoctorInfo(folder)
                  const typeBadges = getDocTypeBadges(folder.docs)
                  return (
                    <Card
                      key={folder.id}
                      hover
                      className="cursor-pointer"
                      onClick={() => openFolder(folder)}
                    >
                      <CardContent>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
                            <Stethoscope className="w-6 h-6 text-teal-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-900">
                              Консультация — {formatDate(folder.dateTime)}
                            </h3>
                            {doctorInfo && (
                              <p className="text-sm text-slate-600 mt-0.5">
                                {doctorInfo.name}
                                {doctorInfo.spec && <span className="text-slate-400"> · {doctorInfo.spec}</span>}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span className="text-xs text-slate-500">
                                {folder.docs.length} {getDocCountWord(folder.docs.length)}
                              </span>
                              {typeBadges.map((badge, i) => (
                                <Badge key={i} className={cn('text-xs', badge.color)}>{badge.label}</Badge>
                              ))}
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}

                {/* Ungrouped docs folder */}
                {ungroupedDocs.length > 0 && (
                  <Card
                    hover
                    className="cursor-pointer"
                    onClick={() => openFolder({ id: '__uploads__', label: 'Мои загрузки' })}
                  >
                    <CardContent>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                          <FolderOpen className="w-6 h-6 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900">Мои загрузки</h3>
                          <p className="text-sm text-slate-500 mt-1">
                            {ungroupedDocs.length} {getDocCountWord(ungroupedDocs.length)}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        /* ========== INSIDE FOLDER VIEW ========== */
        <>
          {/* Back button & folder header */}
          <div>
            <button
              onClick={closeFolder}
              className="flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium mb-3 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Назад к консультациям
            </button>
            <Card>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                    selectedFolder.id === '__uploads__' ? 'bg-amber-50' : 'bg-teal-50'
                  )}>
                    {selectedFolder.id === '__uploads__'
                      ? <FolderOpen className="w-6 h-6 text-amber-600" />
                      : <Stethoscope className="w-6 h-6 text-teal-600" />
                    }
                  </div>
                  <div>
                    {selectedFolder.id === '__uploads__' ? (
                      <h2 className="text-lg font-semibold text-slate-900">Мои загрузки</h2>
                    ) : (
                      <>
                        <h2 className="text-lg font-semibold text-slate-900">
                          Консультация — {formatDate(selectedFolder.dateTime)}
                        </h2>
                        {getDoctorInfo(selectedFolder) && (
                          <p className="text-slate-600 mt-0.5">
                            {getDoctorInfo(selectedFolder).name}
                            {getDoctorInfo(selectedFolder).spec && (
                              <span className="text-slate-400"> · {getDoctorInfo(selectedFolder).spec}</span>
                            )}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Type filter */}
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

          {/* Documents list */}
          <div className="space-y-3">
            {folderDocuments.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">Нет документов</h3>
                  <p className="text-slate-600">В этой категории пока нет документов</p>
                </CardContent>
              </Card>
            ) : (
              folderDocuments.map((doc) => {
                const typeConfig = documentTypes[doc.type] || documentTypes.other
                return (
                  <Card key={doc.id} hover className="cursor-pointer" onClick={() => setSelectedDocument(doc)}>
                    <CardContent>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl ${typeConfig.color} flex items-center justify-center flex-shrink-0`}>
                          <typeConfig.icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-slate-900">{doc.title}</h3>
                          <div className="flex items-center gap-4 mt-1 flex-wrap">
                            {doc.doctor?.fullName && (
                              <>
                                <span className="text-sm text-slate-500">{doc.doctor.fullName}</span>
                                <span className="text-sm text-slate-400">&middot;</span>
                              </>
                            )}
                            <span className="text-sm text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(doc.createdAt)}
                            </span>
                            <span className="text-sm text-slate-400">&middot;</span>
                            <span className="text-sm text-slate-500">{getFileSize(doc.file)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
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
        </>
      )}

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

            {isImagePreview ? (
              <img src={getMediaUrl(selectedDocument.file)} alt={selectedDocument.title} className="w-full rounded-xl" />
            ) : isPdfPreview ? (
              <div className="bg-slate-100 rounded-xl aspect-[3/4] overflow-hidden">
                {isPreviewLoading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Загрузка предпросмотра...
                    </div>
                  </div>
                ) : previewUrl ? (
                  <object
                    data={previewUrl}
                    type="application/pdf"
                    className="w-full h-full"
                    aria-label="Предпросмотр PDF"
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <FileText className="w-16 h-16 mx-auto text-slate-400 mb-3" />
                        <p className="text-slate-500">Предпросмотр недоступен</p>
                        <p className="text-sm text-slate-400 mt-1">Скачайте файл для просмотра</p>
                      </div>
                    </div>
                  </object>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <FileText className="w-16 h-16 mx-auto text-slate-400 mb-3" />
                      <p className="text-slate-500">{previewError || 'Предпросмотр недоступен'}</p>
                      <p className="text-sm text-slate-400 mt-1">Скачайте файл для просмотра</p>
                    </div>
                  </div>
                )}
              </div>
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
