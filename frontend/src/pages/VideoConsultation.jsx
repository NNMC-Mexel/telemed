import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  MessageCircle,
  Maximize,
  Minimize,
  Clock,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Send,
  X,
} from 'lucide-react'
import { io } from 'socket.io-client'
import Button from '../components/ui/Button'
import Avatar from '../components/ui/Avatar'
import { cn } from '../utils/helpers'
import useAuthStore from '../stores/authStore'
import api, { getMediaUrl } from '../services/api'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

const SIGNALING_SERVER = import.meta.env.VITE_SIGNALING_SERVER || 'http://localhost:3001'

function VideoConsultation() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  
  const [connectionState, setConnectionState] = useState('initializing')
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [duration, setDuration] = useState(0)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [error, setError] = useState(null)
  const [appointment, setAppointment] = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [remoteUser, setRemoteUser] = useState(null)

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const socketRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const fetchAppointment = async () => {
      if (!roomId) return
      try {
        // Явно указываем populate для связей
        const query = new URLSearchParams()
        query.append('filters[roomId][$eq]', roomId)
        query.append('populate[doctor][populate][0]', 'specialization')
        query.append('populate[doctor][populate][1]', 'photo')
        query.append('populate[doctor][populate][2]', 'user')
        query.append('populate[patient][fields][0]', 'id')
        query.append('populate[patient][fields][1]', 'fullName')
        query.append('populate[patient][fields][2]', 'email')
        query.append('populate[patient][fields][3]', 'phone')
        query.append('populate[patient][fields][4]', 'avatar')
        
        const response = await api.get(`/api/appointments?${query}`)
        const apt = response.data?.data?.[0]
        console.log('Appointment loaded:', apt) // Для отладки
        if (apt) setAppointment(apt)
      } catch (err) {
        console.error('Error fetching appointment:', err)
      }
    }
    fetchAppointment()
  }, [roomId])

  const getParticipantInfo = () => {
    if (remoteUser) {
      return { name: remoteUser.userName, role: remoteUser.userRole === 'doctor' ? 'Врач' : 'Пациент' }
    }
    if (!appointment) {
      return { name: 'Ожидание...', role: '' }
    }
    
    const userRole = user?.userRole || 'patient'
    if (userRole === 'doctor') {
      return {
        name: appointment.patient?.fullName || 'Пациент',
        role: 'Пациент'
      }
    }
    return {
      name: appointment.doctor?.fullName || 'Врач',
      role: typeof appointment.doctor?.specialization === 'object'
        ? appointment.doctor.specialization?.name
        : appointment.doctor?.specialization || 'Специалист'
    }
  }

  const participant = getParticipantInfo()

  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: true,
        })
        
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop())
          return
        }

        localStreamRef.current = stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        const socket = io(SIGNALING_SERVER, {
          transports: ['websocket', 'polling'],
        })
        socketRef.current = socket

        socket.on('connect', () => {
          socket.emit('join-room', {
            roomId,
            userId: user?.id,
            userName: user?.fullName || user?.username,
            userRole: user?.userRole || 'patient',
          })
          setConnectionState('waiting')
        })

        socket.on('connect_error', () => {
          setError('Не удалось подключиться к серверу')
          setConnectionState('failed')
        })

        socket.on('room-participants', (participants) => {
          if (participants.length > 0) {
            const peer = participants[0]
            setRemoteUser(peer)
            createPeerConnection(socket, peer.socketId)
          }
        })

        socket.on('user-joined', async (data) => {
          setRemoteUser(data)
          setConnectionState('connecting')
          
          const pc = createPeerConnection(socket, data.socketId)
          
          try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            socket.emit('offer', { targetSocketId: data.socketId, offer })
          } catch (err) {
            console.error('Error creating offer:', err)
          }
        })

        socket.on('offer', async ({ senderSocketId, offer }) => {
          setConnectionState('connecting')
          const pc = createPeerConnection(socket, senderSocketId)
          
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            socket.emit('answer', { targetSocketId: senderSocketId, answer })
          } catch (err) {
            console.error('Error handling offer:', err)
          }
        })

        socket.on('answer', async ({ answer }) => {
          try {
            await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(answer))
          } catch (err) {
            console.error('Error setting remote description:', err)
          }
        })

        socket.on('ice-candidate', async ({ candidate }) => {
          try {
            await peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(candidate))
          } catch (err) {
            console.error('Error adding ICE candidate:', err)
          }
        })

        socket.on('user-left', () => {
          setRemoteUser(null)
          setConnectionState('waiting')
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
          if (peerConnectionRef.current) {
            peerConnectionRef.current.close()
            peerConnectionRef.current = null
          }
        })

        socket.on('chat-message', (data) => {
          setMessages(prev => [...prev, {
            id: data.id,
            sender: data.senderId === socket.id ? 'me' : 'other',
            text: data.message,
            senderName: data.senderName,
            time: new Date(data.timestamp),
          }])
        })

      } catch (err) {
        console.error('Error initializing:', err)
        if (mounted) {
          setError('Не удалось получить доступ к камере и микрофону')
          setConnectionState('failed')
        }
      }
    }

    init()

    return () => {
      mounted = false
      localStreamRef.current?.getTracks().forEach(track => track.stop())
      peerConnectionRef.current?.close()
      socketRef.current?.emit('leave-room')
      socketRef.current?.disconnect()
    }
  }, [roomId, user])

  const createPeerConnection = (socket, targetSocketId) => {
    if (peerConnectionRef.current) peerConnectionRef.current.close()

    const pc = new RTCPeerConnection(ICE_SERVERS)
    peerConnectionRef.current = pc

    localStreamRef.current?.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current)
    })

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { targetSocketId, candidate: event.candidate })
      }
    }

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0]
        setConnectionState('connected')
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setConnectionState('connected')
      else if (pc.connectionState === 'failed') setConnectionState('failed')
    }

    return pc
  }

  useEffect(() => {
    let interval
    if (connectionState === 'connected') {
      interval = setInterval(() => setDuration(prev => prev + 1), 1000)
    }
    return () => clearInterval(interval)
  }, [connectionState])

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      setIsMuted(!audioTrack.enabled)
      socketRef.current?.emit('media-toggle', { roomId, type: 'audio', enabled: audioTrack.enabled })
    }
  }

  const toggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      setIsVideoOn(videoTrack.enabled)
      socketRef.current?.emit('media-toggle', { roomId, type: 'video', enabled: videoTrack.enabled })
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/consultation/${roomId}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const endCall = () => {
    localStreamRef.current?.getTracks().forEach(track => track.stop())
    peerConnectionRef.current?.close()
    socketRef.current?.emit('leave-room')
    socketRef.current?.disconnect()
    
    const userRole = user?.userRole || 'patient'
    navigate(userRole === 'doctor' ? '/doctor' : '/patient/appointments')
  }

  const sendMessage = (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !socketRef.current) return
    
    socketRef.current.emit('chat-message', {
      roomId,
      message: newMessage,
      senderName: user?.fullName || user?.username,
    })
    setNewMessage('')
  }

  return (
    <div ref={containerRef} className="fixed inset-0 bg-slate-900 flex flex-col z-50">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-20 bg-gradient-to-b from-slate-900/80 to-transparent">
        <div className="flex items-center gap-3">
          <Avatar name={participant.name} size="md" />
          <div>
            <h2 className="text-white font-medium">{participant.name}</h2>
            <p className="text-slate-400 text-sm">{participant.role}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {connectionState === 'connected' && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-full">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-white text-sm font-medium">{formatDuration(duration)}</span>
            </div>
          )}
          <button onClick={toggleFullscreen} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg">
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative">
        {connectionState === 'initializing' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-teal-500 animate-spin mx-auto mb-4" />
              <p className="text-white text-lg">Инициализация...</p>
            </div>
          </div>
        )}

        {connectionState === 'waiting' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-800 flex items-center justify-center">
                <Avatar name={participant.name} size="2xl" />
              </div>
              <p className="text-white text-xl font-medium mb-2">Ожидание собеседника</p>
              <p className="text-slate-400 mb-6">Отправьте ссылку или дождитесь подключения</p>
              
              <div className="bg-slate-800 rounded-xl p-4 mb-4">
                <p className="text-slate-400 text-sm mb-2">Ссылка на комнату:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-teal-400 text-sm truncate">{window.location.href}</code>
                  <button onClick={copyInviteLink} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg">
                    {linkCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {connectionState === 'connecting' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Avatar name={participant.name} size="2xl" className="mx-auto mb-4" />
              <p className="text-white text-lg font-medium mb-2">Подключение...</p>
              <div className="flex justify-center gap-1">
                <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}

        {/* Remote Video - always mounted but hidden when not connected */}
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          className={`w-full h-full object-cover ${connectionState === 'connected' ? '' : 'hidden'}`}
        />

        {connectionState === 'failed' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
              <p className="text-white text-lg font-medium mb-2">Ошибка подключения</p>
              <p className="text-slate-400 mb-4">{error || 'Не удалось установить соединение'}</p>
              <Button onClick={() => window.location.reload()}>Попробовать снова</Button>
            </div>
          </div>
        )}

        {/* Local Video */}
        <div className="absolute bottom-24 right-4 w-48 aspect-video rounded-xl overflow-hidden shadow-lg">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {!isVideoOn && (
            <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
              <VideoOff className="w-8 h-8 text-slate-400" />
            </div>
          )}
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-xl flex flex-col z-30">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">Чат</h3>
            <button onClick={() => setShowChat(false)} className="p-1 hover:bg-slate-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={cn('flex', msg.sender === 'me' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[80%] rounded-xl px-3 py-2',
                  msg.sender === 'me' ? 'bg-teal-600 text-white' : 'bg-slate-100'
                )}>
                  <p className="text-sm">{msg.text}</p>
                  <p className={cn('text-xs mt-1', msg.sender === 'me' ? 'text-teal-100' : 'text-slate-400')}>
                    {msg.time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={sendMessage} className="p-4 border-t flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Сообщение..."
              className="flex-1 px-3 py-2 bg-slate-100 rounded-xl text-sm focus:outline-none"
            />
            <Button type="submit" size="icon"><Send className="w-4 h-4" /></Button>
          </form>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 flex items-center justify-center gap-4 bg-gradient-to-t from-slate-900/80 to-transparent">
        <button
          onClick={toggleMute}
          className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center transition-colors',
            isMuted ? 'bg-rose-600 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
          )}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        <button
          onClick={toggleVideo}
          className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center transition-colors',
            !isVideoOn ? 'bg-rose-600 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
          )}
        >
          {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
        </button>

        <button
          onClick={endCall}
          className="w-14 h-14 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center transition-colors"
        >
          <Phone className="w-6 h-6 rotate-[135deg]" />
        </button>

        <button
          onClick={() => setShowChat(!showChat)}
          className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center transition-colors',
            showChat ? 'bg-teal-600 text-white' : 'bg-slate-700 text-white hover:bg-slate-600'
          )}
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      </div>
    </div>
  )
}

export default VideoConsultation
