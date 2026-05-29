import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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
  Share2,
  UserCheck,
  Scan,
  Radio,
} from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { formatDate, cn } from '../../utils/helpers'
import useDocumentStore from '../../stores/documentStore'
import useAuthStore from '../../stores/authStore'
import api, { downloadMedia, getMediaUrl } from '../../services/api'

function PatientDocuments() {
  const { t, i18n } = useTranslation()

  const documentTypes = {
    analysis: { label: t('documents.type_analysis'), icon: TestTube, color: 'bg-blue-100 text-blue-700' },
    prescription: { label: t('documents.type_prescription'), icon: Pill, color: 'bg-green-100 text-green-700' },
    certificate: { label: t('documents.type_certificate'), icon: FileCheck, color: 'bg-amber-100 text-amber-700' },
    mrt: { label: t('documents.type_mrt'), icon: Scan, color: 'bg-purple-100 text-purple-700' },
    xray: { label: t('documents.type_xray'), icon: Radio, color: 'bg-rose-100 text-rose-700' },
    ultrasound: { label: t('documents.type_ultrasound'), icon: Radio, color: 'bg-cyan-100 text-cyan-700' },
    other: { label: t('documents.type_other'), icon: FileText, color: 'bg-slate-100 text-slate-700' },
  }
  const { user } = useAuthStore()
  const {
    documents,
    myDoctors,
    isLoading,
    isUploading,
    error,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
    shareDocument,
    fetchMyDoctors,
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

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(null) // document to share
  const [selectedDoctorIds, setSelectedDoctorIds] = useState([])
  const [isSaving, setIsSaving] = useState(false)

  // Upload form state
  const [uploadFileState, setUploadFileState] = useState(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadType, setUploadType] = useState('other')
  const [uploadDescription, setUploadDescription] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (user?.id) {
      fetchDocuments({ userId: user.id })
      fetchMyDoctors()
    }
  }, [user?.id, fetchDocuments, fetchMyDoctors])

  // Preview logic
  useEffect(() => {
    let isActive = true
    let objectUrl = null

    const file = selectedDocument?.file
    const mime = file?.mime || ''
    const isPdf = mime.includes('pdf')
    const isImage = mime.startsWith('image/')

    setPreviewUrl(null)
    setPreviewError(null)
    setIsPreviewLoading(false)

    if (!selectedDocument || !file?.url || (!isPdf && !isImage)) return undefined

    const fileUrl = getMediaUrl(file)
    if (!fileUrl) {
      setPreviewError(t('documents.link_error'))
      return undefined
    }

    setIsPreviewLoading(true)
    api
      .get(fileUrl, { responseType: 'blob' })
      .then((response) => {
        if (!isActive) return
        const typedBlob = new Blob([response.data], { type: mime || response.data?.type || 'application/octet-stream' })
        objectUrl = URL.createObjectURL(typedBlob)
        setPreviewUrl(objectUrl)
      })
      .catch(() => {
        if (!isActive) return
        setPreviewError(t('documents.preview_unavailable'))
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
  // "Мои загрузки" = all docs uploaded by the patient (no doctor field = patient uploaded it)
  // A doc can appear in BOTH a consultation folder AND "Мои загрузки"
  const { folders, ungroupedDocs } = useMemo(() => {
    const grouped = {}
    const myUploads = []

    for (const doc of documents) {
      const apt = doc.appointment
      // Patient-uploaded doc: no doctor relation (doctor uploads have doctor set)
      const isPatientUploaded = !doc.doctor

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
      }

      // Patient's own uploads go to "Мои загрузки" regardless of appointment link
      if (isPatientUploaded) {
        myUploads.push(doc)
      }
    }

    let folderList = Object.values(grouped)
    folderList.sort((a, b) => {
      const dateA = new Date(a.dateTime || 0)
      const dateB = new Date(b.dateTime || 0)
      return sortNewest ? dateB - dateA : dateA - dateB
    })

    return { folders: folderList, ungroupedDocs: myUploads }
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
    mrt: documents.filter(d => d.type === 'mrt').length,
    xray: documents.filter(d => d.type === 'xray').length,
    ultrasound: documents.filter(d => d.type === 'ultrasound').length,
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

  const handleDownload = async (doc) => {
    if (doc?.file) await downloadMedia(doc.file, doc.title || 'document')
  }

  const openShareModal = (doc) => {
    const currentShared = (doc.sharedWithDoctors || []).map(d => d.documentId)
    setSelectedDoctorIds(currentShared)
    setShowShareModal(doc)
  }

  const handleShare = async () => {
    if (!showShareModal) return
    setIsSaving(true)
    const result = await shareDocument(showShareModal.documentId, selectedDoctorIds)
    setIsSaving(false)
    if (result.success) {
      setShowShareModal(null)
      // Re-fetch to update UI
      fetchDocuments({ userId: user.id })
    }
  }

  const toggleDoctorSelection = (doctorDocId) => {
    setSelectedDoctorIds(prev =>
      prev.includes(doctorDocId)
        ? prev.filter(id => id !== doctorDocId)
        : [...prev, doctorDocId]
    )
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
    if (count === 1) return t('documents.doc_count_1')
    if (count >= 2 && count <= 4) return t('documents.doc_count_2_4')
    return t('documents.doc_count_many')
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
          <h1 className="text-2xl font-bold text-slate-900">{t('documents.title')}</h1>
          <p className="text-slate-600">{t('documents.subtitle')}</p>
        </div>
        <Button onClick={() => setShowUploadModal(true)} leftIcon={<Upload className="w-4 h-4" />}>
          {t('documents.upload_button')}
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
              <p className="text-sm text-slate-500">{t('documents.stat_total')}</p>
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
            <p className="text-slate-600">{t('documents.loading')}</p>
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
                  placeholder={t('documents.search_placeholder')}
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
                {sortNewest ? t('documents.sort_newest') : t('documents.sort_oldest')}
              </button>
            </CardContent>
          </Card>

          {/* My Uploads — always pinned to top */}
          <Card
            hover
            className="cursor-pointer border-2 border-dashed border-amber-200 bg-amber-50/30"
            onClick={() => openFolder({ id: '__uploads__', label: t('documents.my_uploads') })}
          >
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Upload className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900">{t('documents.my_uploads')}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {ungroupedDocs.length > 0
                      ? `${ungroupedDocs.length} ${getDocCountWord(ungroupedDocs.length)} · ${t('documents.uploads_desc_count')}`
                      : t('documents.upload_desc')
                    }
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
              </div>
            </CardContent>
          </Card>

          {/* Consultation Folders */}
          {filteredFolders.length > 0 && (
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider pt-2">{t('documents.consultations_header')}</p>
          )}
          <div className="space-y-3">
            {filteredFolders.length === 0 && ungroupedDocs.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <FolderOpen className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">{t('documents.empty_title')}</h3>
                  <p className="text-slate-600">
                    {searchQuery ? t('documents.empty_search') : t('documents.empty_all')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredFolders.map((folder) => {
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
                        <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                          <Stethoscope className="w-6 h-6 text-teal-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900">
                            {t('documents.consultation_title', { date: formatDate(folder.dateTime, i18n.language) })}
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
                        <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                )
              })
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
              {t('documents.back')}
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
                      <h2 className="text-lg font-semibold text-slate-900">{t('documents.my_uploads')}</h2>
                    ) : (
                      <>
                        <h2 className="text-lg font-semibold text-slate-900">
                          {t('documents.consultation_title', { date: formatDate(selectedFolder.dateTime, i18n.language) })}
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
              {t('appointments.filter_all')}
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
                  <h3 className="text-lg font-medium text-slate-900 mb-2">{t('documents.no_docs_title')}</h3>
                  <p className="text-slate-600">{t('documents.no_docs_desc')}</p>
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
                              {formatDate(doc.createdAt, i18n.language)}
                            </span>
                            <span className="text-sm text-slate-400">&middot;</span>
                            <span className="text-sm text-slate-500">{getFileSize(doc.file)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
                          {doc.sharedWithDoctors?.length > 0 && (
                            <span className="flex items-center gap-1 text-xs text-teal-600" title={t('documents.shared_badge_title')}>
                              <UserCheck className="w-3.5 h-3.5" />
                              {doc.sharedWithDoctors.length}
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); openShareModal(doc) }}
                            className="p-2 hover:bg-teal-100 rounded-lg text-slate-500 hover:text-teal-600"
                            title={t('documents.share_title')}
                          >
                            <Share2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDownload(doc) }}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                            title={t('documents.download')}
                          >
                            <Download className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(doc.documentId) }}
                            className="p-2 hover:bg-red-100 rounded-lg text-slate-500 hover:text-red-600"
                            title={t('documents.delete_action')}
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
            <Button variant="secondary" onClick={() => setSelectedDocument(null)}>{t('documents.close')}</Button>
            {selectedDocument?.file && (
              <Button leftIcon={<Download className="w-4 h-4" />} onClick={() => handleDownload(selectedDocument)}>
                {t('documents.download')}
              </Button>
            )}
          </>
        }
      >
        {selectedDocument && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between gap-3">
                <span className="text-slate-600 shrink-0">{t('documents.doc_type')}</span>
                <Badge className={(documentTypes[selectedDocument.type] || documentTypes.other).color}>
                  {(documentTypes[selectedDocument.type] || documentTypes.other).label}
                </Badge>
              </div>
              {selectedDocument.doctor?.fullName && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-600 shrink-0">{t('documents.doctor')}</span>
                  <span className="font-medium text-slate-900 text-right wrap-break-word min-w-0">{selectedDocument.doctor.fullName}</span>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <span className="text-slate-600 shrink-0">{t('documents.date')}</span>
                <span className="font-medium text-slate-900">{formatDate(selectedDocument.createdAt, i18n.language)}</span>
              </div>
              {selectedDocument.file && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-600 shrink-0">{t('documents.file_size')}</span>
                  <span className="font-medium text-slate-900">{getFileSize(selectedDocument.file)}</span>
                </div>
              )}
              {selectedDocument.description && (
                <div className="pt-2 border-t">
                  <span className="text-slate-600 block mb-1">{t('documents.description')}</span>
                  <p className="text-slate-900 wrap-break-word whitespace-pre-wrap">{selectedDocument.description}</p>
                </div>
              )}
            </div>

            {selectedDocument.file && (isImagePreview ? (
              previewUrl ? (
                <img src={previewUrl} alt={selectedDocument.title} className="w-full rounded-xl" />
              ) : (
                <div className="bg-slate-100 rounded-xl p-8 text-center text-slate-500">
                  {isPreviewLoading ? t('documents.preview_loading') : previewError || t('documents.preview_unavailable')}
                </div>
              )
            ) : isPdfPreview ? (
              <div className="bg-slate-100 rounded-xl aspect-[3/4] overflow-hidden">
                {isPreviewLoading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('documents.preview_loading')}
                    </div>
                  </div>
                ) : previewUrl ? (
                  <object
                    data={previewUrl}
                    type="application/pdf"
                    className="w-full h-full"
                    aria-label={t('documents.pdf_aria')}
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <FileText className="w-16 h-16 mx-auto text-slate-400 mb-3" />
                        <p className="text-slate-500">{t('documents.preview_unavailable')}</p>
                        <p className="text-sm text-slate-400 mt-1">{t('documents.download_to_view')}</p>
                      </div>
                    </div>
                  </object>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <FileText className="w-16 h-16 mx-auto text-slate-400 mb-3" />
                      <p className="text-slate-500">{previewError || t('documents.preview_unavailable')}</p>
                      <p className="text-sm text-slate-400 mt-1">{t('documents.download_to_view')}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3 border border-slate-200">
                <FileText className="w-8 h-8 text-slate-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{selectedDocument.file.name || t('documents.file_label')}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{getFileSize(selectedDocument.file)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => { setShowUploadModal(false); resetUploadForm() }}
        title={t('documents.upload_modal_title')}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowUploadModal(false); resetUploadForm() }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleUpload} disabled={!uploadFileState || !uploadTitle || isUploading} isLoading={isUploading}>
              {t('documents.upload_action')}
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
                <p className="font-medium text-slate-900 mb-1">{t('documents.drop_file')}</p>
                <p className="text-sm text-slate-500">{t('documents.file_formats')}</p>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('documents.doc_name_label')}</label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder={t('documents.doc_name_placeholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('documents.doc_type_label')}</label>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('documents.doc_desc_label')}</label>
            <textarea
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder={t('documents.doc_desc_placeholder')}
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title={t('documents.delete_title')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => handleDelete(showDeleteConfirm)} isLoading={isLoading}>
              {t('documents.delete_action')}
            </Button>
          </>
        }
      >
        <p className="text-slate-600">{t('documents.delete_desc')}</p>
      </Modal>

      {/* Share Modal */}
      <Modal
        isOpen={!!showShareModal}
        onClose={() => setShowShareModal(null)}
        title={t('documents.share_title')}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowShareModal(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleShare} isLoading={isSaving}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {t('documents.share_desc')}
            {showShareModal && <span className="font-medium"> «{showShareModal.title}»</span>}
          </p>

          {myDoctors.length === 0 ? (
            <div className="text-center py-8">
              <Stethoscope className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">{t('documents.no_doctors')}</p>
              <p className="text-sm text-slate-400 mt-1">{t('documents.no_doctors_desc')}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {myDoctors.map((doctor) => {
                const isSelected = selectedDoctorIds.includes(doctor.documentId)
                const specName = typeof doctor.specialization === 'object'
                  ? doctor.specialization?.name
                  : doctor.specialization
                return (
                  <button
                    key={doctor.id}
                    onClick={() => toggleDoctorSelection(doctor.documentId)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                      isSelected
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    )}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold',
                      isSelected ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-600'
                    )}>
                      {isSelected ? <UserCheck className="w-5 h-5" /> : doctor.fullName?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{doctor.fullName}</p>
                      {specName && <p className="text-sm text-slate-500">{specName}</p>}
                    </div>
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                      isSelected ? 'border-teal-500 bg-teal-500' : 'border-slate-300'
                    )}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {selectedDoctorIds.length > 0 && (
            <p className="text-sm text-teal-600 flex items-center gap-1">
              <Share2 className="w-4 h-4" />
              {t('documents.shared_with', {
                count: selectedDoctorIds.length,
                word: selectedDoctorIds.length === 1
                  ? t('documents.shared_word_1')
                  : selectedDoctorIds.length <= 4
                    ? t('documents.shared_word_2_4')
                    : t('documents.shared_word_many')
              })}
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default PatientDocuments
