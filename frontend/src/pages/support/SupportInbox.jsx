import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Paperclip, Loader2, FileText, X, LifeBuoy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import { cn, formatTimeAgo } from '../../utils/helpers'
import useAuthStore from '../../stores/authStore'
import { isStaffMessage } from '../../stores/supportStore'
import {
  supportAPI,
  messagesAPI,
  normalizeResponse,
  getMediaUrl,
  uploadFile,
} from '../../services/api'
import { subscribeToConversation, subscribeToSupportInbox } from '../../services/realtime'

const STATUSES = ['open', 'in_progress', 'resolved']

const STATUS_STYLES = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-sky-100 text-sky-700',
  resolved: 'bg-emerald-100 text-emerald-700',
}

function getPatient(conversation) {
  const users = conversation?.participants || conversation?.users_permissions_users || []
  return users.find((u) => u.userRole !== 'admin' && u.userRole !== 'manager') || users[0] || {}
}

function AttachmentPreview({ attachment }) {
  const url = getMediaUrl(attachment)
  if (!url) return null
  const isImage = (attachment.mime || '').startsWith('image/')

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-2">
        <img src={url} alt={attachment.name || 'attachment'} className="max-h-40 rounded-lg object-cover" />
      </a>
    )
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 text-sm underline break-all">
      <FileText className="w-4 h-4 shrink-0" />
      {attachment.name || 'file'}
    </a>
  )
}

function SupportInbox() {
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language === 'en' ? 'en-US' : i18n.language === 'kk' ? 'kk-KZ' : 'ru-RU'
  const { user } = useAuthStore()

  const [conversations, setConversations] = useState([])
  const [current, setCurrent] = useState(null)
  const [messages, setMessages] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [pendingFile, setPendingFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)
  const currentRef = useRef(null)
  currentRef.current = current

  const fetchInbox = useCallback(async () => {
    try {
      const response = await supportAPI.getInbox()
      const { data } = normalizeResponse(response)
      const list = data || []
      setConversations(list)
      // Обновляем статус выбранной беседы, если он поменялся
      const cur = currentRef.current
      if (cur) {
        const fresh = list.find((c) => c.documentId === cur.documentId)
        if (fresh) setCurrent(fresh)
      }
    } catch (error) {
      console.error('Error fetching support inbox:', error)
    } finally {
      setIsLoadingList(false)
    }
  }, [])

  const fetchMessages = useCallback(async (conversation, { silent = false } = {}) => {
    if (!conversation?.id) return
    if (!silent) setIsLoadingMessages(true)
    try {
      const response = await messagesAPI.getByConversation(conversation.id)
      const { data } = normalizeResponse(response)
      const sorted = (data || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      setMessages(sorted)
    } catch (error) {
      console.error('Error fetching support messages:', error)
    } finally {
      if (!silent) setIsLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    fetchInbox()
    // Realtime-сигнал об изменении инбокса + редкий поллинг как fallback
    const unsubscribe = subscribeToSupportInbox(() => fetchInbox())
    const interval = setInterval(fetchInbox, 60000)
    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [fetchInbox])

  useEffect(() => {
    if (!current?.id) return
    fetchMessages(current)
    supportAPI.markConversationRead(current.documentId).catch(() => {})
    setConversations((prev) =>
      prev.map((c) => (c.documentId === current.documentId ? { ...c, unreadCount: 0 } : c))
    )
    // Realtime: входящие сообщения и смена статуса выбранной беседы
    const unsubscribe = subscribeToConversation(current.documentId, {
      onMessage: (msg) => {
        setMessages((prev) => {
          const exists = prev.some(
            (m) =>
              (msg.documentId && m.documentId === msg.documentId) ||
              (msg.id && m.id === msg.id)
          )
          return exists ? prev : [...prev, msg]
        })
        supportAPI.markConversationRead(current.documentId).catch(() => {})
      },
      onStatus: ({ supportStatus }) => {
        setCurrent((prev) => (prev ? { ...prev, supportStatus } : prev))
      },
    })
    const interval = setInterval(() => fetchMessages(current, { silent: true }), 45000)
    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [current?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSetStatus = async (status) => {
    if (!current?.documentId || current.supportStatus === status) return
    try {
      const response = await supportAPI.setStatus(current.documentId, status)
      const { data } = normalizeResponse(response)
      setCurrent((prev) => ({ ...prev, ...data, supportStatus: status }))
      setConversations((prev) =>
        prev.map((c) => (c.documentId === current.documentId ? { ...c, supportStatus: status } : c))
      )
    } catch (error) {
      console.error('Error setting support status:', error)
    }
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadError(null)
    setIsUploading(true)
    try {
      const uploaded = await uploadFile(file)
      setPendingFile(uploaded)
    } catch (error) {
      setUploadError(error.message || t('support.upload_error'))
    } finally {
      setIsUploading(false)
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    const content = newMessage.trim()
    if ((!content && !pendingFile) || !current?.id || isSending) return
    setIsSending(true)
    try {
      const payload = {
        conversation: current.id,
        content: content || t('support.attachment_sent'),
      }
      if (pendingFile) payload.attachments = [pendingFile.id]
      const response = await messagesAPI.create(payload)
      const { data } = normalizeResponse(response)
      // Дедупликация: socket-событие о своём сообщении могло прийти раньше REST-ответа
      setMessages((prev) => {
        const exists = prev.some(
          (m) =>
            (data.documentId && m.documentId === data.documentId) ||
            (data.id && m.id === data.id)
        )
        return exists ? prev : [...prev, data]
      })
      setNewMessage('')
      setPendingFile(null)
      // Ответ менеджера переводит «открыто» в «в работе» (синхронно с сервером)
      if (current.supportStatus === 'open') {
        setCurrent((prev) => ({ ...prev, supportStatus: 'in_progress' }))
        setConversations((prev) =>
          prev.map((c) =>
            c.documentId === current.documentId ? { ...c, supportStatus: 'in_progress' } : c
          )
        )
      }
    } catch (error) {
      console.error('Error sending support message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const filtered = conversations.filter(
    (c) => statusFilter === 'all' || (c.supportStatus || 'open') === statusFilter
  )

  const patient = current ? getPatient(current) : null

  return (
    <div className="animate-fadeIn h-full min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 -mx-4 sm:mx-0 flex bg-white border-y border-slate-200 sm:border sm:rounded-2xl overflow-hidden">
        {/* Список обращений */}
        <div className={cn('w-full md:w-80 border-r border-slate-200 flex flex-col min-h-0', current && 'hidden md:flex')}>
          {/* Фильтр по статусу */}
          <div className="p-3 border-b border-slate-100 flex gap-1.5 overflow-x-auto">
            {['all', ...STATUSES].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors',
                  statusFilter === status
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {status === 'all' ? t('support.filter_all') : t(`support.status_${status}`)}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {isLoadingList ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 px-4">
                <p className="text-slate-500 text-sm">{t('support.inbox_empty')}</p>
              </div>
            ) : (
              filtered.map((conversation) => {
                const p = getPatient(conversation)
                const name = p.fullName || p.email || t('support.patient_fallback')
                const status = conversation.supportStatus || 'open'
                return (
                  <button
                    key={conversation.documentId}
                    onClick={() => setCurrent(conversation)}
                    className={cn(
                      'w-full p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors text-left',
                      current?.documentId === conversation.documentId && 'bg-teal-50'
                    )}
                  >
                    <Avatar src={getMediaUrl(p.avatar)} name={name} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium text-slate-900 truncate">{name}</h4>
                        <span className="text-xs text-slate-400 shrink-0">
                          {conversation.lastMessageAt ? formatTimeAgo(conversation.lastMessageAt) : ''}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 truncate">
                        {conversation.lastMessage || t('chat.no_messages')}
                      </p>
                      <span className={cn('inline-block mt-1 text-xs px-2 py-0.5 rounded-md', STATUS_STYLES[status])}>
                        {t(`support.status_${status}`)}
                      </span>
                    </div>
                    {conversation.unreadCount > 0 && (
                      <span className="w-5 h-5 bg-teal-600 text-white text-xs font-medium rounded-full flex items-center justify-center shrink-0">
                        {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Переписка */}
        {current ? (
          <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-x-hidden">
            {/* Шапка */}
            <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center gap-3 min-w-0">
              <button onClick={() => setCurrent(null)} className="md:hidden p-2 hover:bg-slate-100 rounded-lg shrink-0">
                ←
              </button>
              <Avatar
                src={getMediaUrl(patient?.avatar)}
                name={patient?.fullName || patient?.email || ''}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 truncate">
                  {patient?.fullName || patient?.email || t('support.patient_fallback')}
                </h3>
                <p className="text-xs text-slate-500 truncate">{patient?.email}</p>
              </div>
              {/* Переключатель статуса */}
              <div className="flex gap-1 shrink-0">
                {STATUSES.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleSetStatus(status)}
                    className={cn(
                      'px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors',
                      (current.supportStatus || 'open') === status
                        ? STATUS_STYLES[status]
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    )}
                  >
                    {t(`support.status_${status}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Сообщения */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-3 sm:p-4 space-y-4 bg-slate-50">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500">{t('chat.no_messages')}</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isMe = message.sender?.id === user?.id
                  const time = new Date(message.createdAt)
                  const senderName = message.sender?.fullName || message.sender?.email || ''
                  const fromStaff = isStaffMessage(message)
                  const attachments = message.attachments || []

                  return (
                    <div key={message.id} className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}>
                      <span className="text-xs text-slate-400 mb-1 px-1 truncate max-w-[70vw] sm:max-w-80">
                        {senderName}
                        {fromStaff && !isMe && ` · ${t('support.staff_label')}`}
                      </span>
                      <div className={cn(
                        'max-w-[min(78vw,24rem)] rounded-2xl px-4 py-3 break-words',
                        isMe ? 'bg-teal-600 text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-900 rounded-bl-md'
                      )}>
                        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                        {attachments.map((att) => (
                          <AttachmentPreview key={att.id} attachment={att} />
                        ))}
                        <p className={cn('text-xs mt-1', isMe ? 'text-teal-100' : 'text-slate-400')}>
                          {time.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Ввод */}
            <form onSubmit={handleSend} className="p-3 sm:p-4 border-t border-slate-100 bg-white safe-bottom sm:pb-4">
              {pendingFile && (
                <div className="mb-2 flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
                  <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-xs text-slate-600 truncate flex-1">{pendingFile.name}</span>
                  <button type="button" onClick={() => setPendingFile(null)} className="p-1 hover:bg-slate-200 rounded">
                    <X className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                </div>
              )}
              {uploadError && <p className="mb-2 text-xs text-rose-600">{uploadError}</p>}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 shrink-0"
                  aria-label={t('support.attach')}
                >
                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={t('support.reply_placeholder')}
                  className="flex-1 min-w-0 px-4 py-3 bg-slate-100 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={(!newMessage.trim() && !pendingFile) || isSending || isUploading}
                  isLoading={isSending}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center bg-slate-50">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto bg-slate-200 rounded-full flex items-center justify-center mb-4">
                <LifeBuoy className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">{t('support.select_ticket')}</h3>
              <p className="text-slate-500">{t('support.select_ticket_hint')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SupportInbox
