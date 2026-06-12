import { useState, useRef, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { LifeBuoy, X, Send, Paperclip, Loader2, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import { cn } from '../../utils/helpers'
import useSupportStore, { isStaffMessage } from '../../stores/supportStore'
import useAuthStore from '../../stores/authStore'
import { getMediaUrl, uploadFile } from '../../services/api'
import { subscribeToConversation } from '../../services/realtime'

const STATUS_STYLES = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-sky-100 text-sky-700',
  resolved: 'bg-emerald-100 text-emerald-700',
}

function AttachmentPreview({ attachment }) {
  const url = getMediaUrl(attachment)
  if (!url) return null
  const isImage = (attachment.mime || '').startsWith('image/')

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-2">
        <img
          src={url}
          alt={attachment.name || 'attachment'}
          className="max-h-40 rounded-lg object-cover"
        />
      </a>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center gap-2 text-sm underline break-all"
    >
      <FileText className="w-4 h-4 shrink-0" />
      {attachment.name || 'file'}
    </a>
  )
}

function SupportChatWidget() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const dateLocale = i18n.language === 'en' ? 'en-US' : i18n.language === 'kk' ? 'kk-KZ' : 'ru-RU'
  const { user } = useAuthStore()
  const {
    conversation,
    messages,
    isOpen,
    isLoading,
    isSending,
    unreadCount,
    init,
    refresh,
    send,
    markRead,
    open,
    close,
    appendMessage,
    setConversationStatus,
  } = useSupportStore()

  const [newMessage, setNewMessage] = useState('')
  const [pendingFile, setPendingFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)

  // Имя менеджера, который сейчас отвечает (последнее staff-сообщение)
  const agentName = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (isStaffMessage(messages[i])) {
        return messages[i].sender?.fullName || messages[i].sender?.username || null
      }
    }
    return null
  }, [messages])

  const supportStatus = conversation?.supportStatus || 'open'

  useEffect(() => {
    if (user?.id) init(user.id)
  }, [user?.id])

  // Автооткрытие по ссылке из уведомления (/patient?support=1)
  useEffect(() => {
    if (new URLSearchParams(location.search).get('support')) open()
  }, [location.search])

  // Realtime: новые сообщения и смена статуса приходят мгновенно по сокету
  useEffect(() => {
    if (!user?.id || !conversation?.documentId) return
    return subscribeToConversation(conversation.documentId, {
      onMessage: (msg) => appendMessage(msg, user.id),
      onStatus: ({ supportStatus }) => setConversationStatus(supportStatus),
    })
  }, [user?.id, conversation?.documentId])

  // Поллинг — fallback на случай проблем с сокетом
  useEffect(() => {
    if (!user?.id || !conversation?.id) return
    const interval = setInterval(() => refresh(user.id), isOpen ? 30000 : 60000)
    return () => clearInterval(interval)
  }, [user?.id, conversation?.id, isOpen])

  // При открытии панели сразу подтягиваем актуальное состояние
  useEffect(() => {
    if (isOpen && user?.id && conversation?.id) refresh(user.id)
  }, [isOpen])

  // Открыли виджет или пришли новые сообщения → помечаем прочитанными
  useEffect(() => {
    if (isOpen && unreadCount > 0) markRead()
  }, [isOpen, unreadCount])

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

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
    if ((!content && !pendingFile) || isSending) return
    const result = await send(
      content || t('support.attachment_sent'),
      pendingFile ? [pendingFile.id] : []
    )
    if (result.success) {
      setNewMessage('')
      setPendingFile(null)
    }
  }

  if (!user?.id) return null

  return (
    <>
      {/* Плавающая кнопка */}
      {!isOpen && (
        <button
          onClick={open}
          aria-label={t('support.title')}
          className="fixed z-40 right-4 bottom-[calc(6.25rem+var(--safe-bottom))] lg:right-6 lg:bottom-6 w-14 h-14 bg-teal-600 hover:bg-teal-700 text-white rounded-full shadow-lg shadow-teal-600/30 flex items-center justify-center transition-colors"
        >
          <LifeBuoy className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-rose-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Панель чата */}
      {isOpen && (
        <div className="fixed z-50 inset-0 lg:inset-auto lg:right-6 lg:bottom-6 lg:w-96 lg:h-[34rem] bg-white lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-2xl flex flex-col overflow-hidden pt-[var(--safe-top)] lg:pt-0">
          {/* Шапка */}
          <div className="p-4 bg-teal-600 text-white flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center shrink-0">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{t('support.title')}</h3>
              <p className="text-xs text-teal-100 truncate">
                {agentName
                  ? t('support.agent_replying', { name: agentName })
                  : t('support.subtitle_online')}
              </p>
            </div>
            <span className={cn('text-xs px-2 py-1 rounded-lg shrink-0', STATUS_STYLES[supportStatus])}>
              {t(`support.status_${supportStatus}`)}
            </span>
            <button
              onClick={close}
              aria-label={t('common.close')}
              className="p-2 hover:bg-white/15 rounded-lg shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Сообщения */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4 bg-slate-50">
            {isLoading && messages.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500 text-sm">{t('support.empty')}</p>
                <p className="text-slate-400 text-xs mt-1">{t('support.empty_hint')}</p>
              </div>
            ) : (
              messages.map((message) => {
                const isMe = message.sender?.id === user.id
                const fromStaff = isStaffMessage(message)
                const time = new Date(message.createdAt)
                const attachments = message.attachments || []

                return (
                  <div key={message.id} className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}>
                    {!isMe && fromStaff && (
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <Avatar
                          src={getMediaUrl(message.sender?.avatar)}
                          name={message.sender?.fullName || ''}
                          size="xs"
                        />
                        <span className="text-xs text-slate-500 truncate max-w-[60vw] lg:max-w-56">
                          {message.sender?.fullName || t('support.title')}
                        </span>
                      </div>
                    )}
                    <div className={cn(
                      'max-w-[78vw] lg:max-w-72 rounded-2xl px-4 py-3 break-words',
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

          {/* Уведомление о решённом обращении */}
          {supportStatus === 'resolved' && (
            <div className="px-4 py-2 bg-emerald-50 border-t border-emerald-100 shrink-0">
              <p className="text-xs text-emerald-700 text-center">{t('support.resolved_notice')}</p>
            </div>
          )}

          {/* Ввод */}
          <form onSubmit={handleSend} className="p-3 border-t border-slate-100 bg-white safe-bottom lg:pb-3 shrink-0">
            {pendingFile && (
              <div className="mb-2 flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
                <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="text-xs text-slate-600 truncate flex-1">{pendingFile.name}</span>
                <button type="button" onClick={() => setPendingFile(null)} className="p-1 hover:bg-slate-200 rounded">
                  <X className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
            )}
            {uploadError && (
              <p className="mb-2 text-xs text-rose-600">{uploadError}</p>
            )}
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
                placeholder={t('support.placeholder')}
                className="flex-1 min-w-0 px-4 py-2.5 bg-slate-100 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
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
      )}
    </>
  )
}

export default SupportChatWidget
