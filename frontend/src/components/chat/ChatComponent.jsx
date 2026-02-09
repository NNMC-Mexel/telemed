import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, Image, Smile, MoreVertical, Phone, Video, Search, Loader2 } from 'lucide-react'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import { cn, formatTimeAgo } from '../../utils/helpers'
import useChatStore from '../../stores/chatStore'
import useAuthStore from '../../stores/authStore'
import { getMediaUrl } from '../../services/api'

function ChatComponent({ userRole = 'patient' }) {
  const { user } = useAuthStore()
  const { 
    conversations, 
    messages, 
    currentConversation,
    isLoading,
    fetchConversations, 
    fetchMessages, 
    sendMessage,
    setCurrentConversation,
  } = useChatStore()
  
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (user?.id) {
      fetchConversations(user.id)
    }
  }, [user?.id])

  useEffect(() => {
    if (currentConversation?.id) {
      fetchMessages(currentConversation.id)
    }
  }, [currentConversation?.id])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSelectConversation = (conv) => {
    setCurrentConversation(conv)
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !currentConversation?.id || isSending) return

    setIsSending(true)
    try {
      await sendMessage(currentConversation.id, newMessage.trim(), user.id)
      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const filteredConversations = conversations.filter(conv => {
    const participant = conv.participants?.find(p => p.id !== user?.id) || {}
    const name = participant.fullName || participant.username || ''
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const getParticipant = (conv) => {
    return conv.participants?.find(p => p.id !== user?.id) || {}
  }

  return (
    <div className="h-full min-h-0 flex bg-white border-y border-slate-200 sm:border sm:rounded-2xl overflow-hidden">
      {/* Conversations List */}
      <div className={cn(
        'w-full md:w-80 border-r border-slate-200 flex flex-col min-h-0',
        currentConversation && 'hidden md:flex'
      )}>
        {/* Search */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">Нет диалогов</p>
              <p className="text-slate-400 text-xs mt-1">
                Диалоги появятся после записи к врачу
              </p>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const participant = getParticipant(conversation)
              const participantName = participant.fullName || participant.username || 'Собеседник'
              const isOnline = participant.isOnline || false
              const spec = userRole === 'patient' 
                ? (typeof participant.specialization === 'object' 
                    ? participant.specialization?.name 
                    : participant.specialization || '')
                : ''
              
              return (
                <button
                  key={conversation.id}
                  onClick={() => handleSelectConversation(conversation)}
                  className={cn(
                    'w-full p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors text-left',
                    currentConversation?.id === conversation.id && 'bg-teal-50'
                  )}
                >
                  <div className="relative">
                    <Avatar 
                      src={getMediaUrl(participant.avatar || participant.photo)} 
                      name={participantName} 
                      size="md" 
                    />
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-slate-900 truncate">
                        {participantName}
                      </h4>
                      <span className="text-xs text-slate-400">
                        {conversation.lastMessage?.createdAt 
                          ? formatTimeAgo(conversation.lastMessage.createdAt)
                          : ''}
                      </span>
                    </div>
                    {spec && <p className="text-xs text-teal-600">{spec}</p>}
                    <p className="text-sm text-slate-500 truncate">
                      {conversation.lastMessage?.content || 'Нет сообщений'}
                    </p>
                  </div>
                  {conversation.unreadCount > 0 && (
                    <span className="w-5 h-5 bg-teal-600 text-white text-xs font-medium rounded-full flex items-center justify-center">
                      {conversation.unreadCount}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      {currentConversation ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentConversation(null)}
                className="md:hidden p-2 hover:bg-slate-100 rounded-lg"
              >
                ←
              </button>
              {(() => {
                const participant = getParticipant(currentConversation)
                const participantName = participant.fullName || participant.username || 'Собеседник'
                const isOnline = participant.isOnline || false
                const spec = userRole === 'patient'
                  ? (typeof participant.specialization === 'object'
                      ? participant.specialization?.name
                      : participant.specialization || '')
                  : ''
                
                return (
                  <>
                    <Avatar 
                      src={getMediaUrl(participant.avatar || participant.photo)} 
                      name={participantName} 
                      size="md" 
                    />
                    <div>
                      <h3 className="font-semibold text-slate-900">{participantName}</h3>
                      <p className="text-sm text-slate-500">
                        {spec}
                        {isOnline && (
                          <span className="text-emerald-600 ml-2">● онлайн</span>
                        )}
                      </p>
                    </div>
                  </>
                )
              })()}
            </div>
            <div className="flex items-center gap-2">
              <button className="hidden sm:inline-flex p-2 hover:bg-slate-100 rounded-lg text-slate-600">
                <Phone className="w-5 h-5" />
              </button>
              <button className="hidden sm:inline-flex p-2 hover:bg-slate-100 rounded-lg text-slate-600">
                <Video className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500">Нет сообщений</p>
                <p className="text-slate-400 text-sm mt-1">Начните диалог первым!</p>
              </div>
            ) : (
              messages.map((message) => {
                const isMe = message.sender?.id === user?.id || message.senderId === user?.id
                const time = new Date(message.createdAt || message.time)
                
                return (
                  <div
                    key={message.id}
                    className={cn('flex', isMe ? 'justify-end' : 'justify-start')}
                  >
                    <div className={cn(
                      'max-w-[70%] rounded-2xl px-4 py-3',
                      isMe
                        ? 'bg-teal-600 text-white rounded-br-md'
                        : 'bg-slate-100 text-slate-900 rounded-bl-md'
                    )}>
                      <p className="text-sm">{message.content}</p>
                      <p className={cn(
                        'text-xs mt-1',
                        isMe ? 'text-teal-100' : 'text-slate-400'
                      )}>
                        {time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-slate-100 safe-bottom sm:pb-4">
            <div className="flex items-center gap-2">
              <button type="button" className="hidden sm:inline-flex p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                <Paperclip className="w-5 h-5" />
              </button>
              <button type="button" className="hidden sm:inline-flex p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                <Image className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Написать сообщение..."
                className="flex-1 px-4 py-3 bg-slate-100 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button type="button" className="hidden sm:inline-flex p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                <Smile className="w-5 h-5" />
              </button>
              <Button 
                type="submit" 
                size="icon" 
                disabled={!newMessage.trim() || isSending}
                isLoading={isSending}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
      ) : (
        // Empty State
        <div className="hidden md:flex flex-1 items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto bg-slate-200 rounded-full flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              Выберите диалог
            </h3>
            <p className="text-slate-500">
              Выберите диалог из списка слева, чтобы начать общение
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatComponent
