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
  Upload,
  FileText,
  Save,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  ClipboardList,
  Pill,
  Settings,
  MoreVertical,
  User,
  Link as LinkIcon,
  FolderOpen,
  Folder,
  ChevronDown,
  ExternalLink,
  Star,
  PhoneOff,
} from 'lucide-react'
import { io } from 'socket.io-client'
import Button from '../components/ui/Button'
import Avatar from '../components/ui/Avatar'
import { cn } from '../utils/helpers'
import useAuthStore from '../stores/authStore'
import api, { appointmentsAPI, documentsAPI, uploadFile, getMediaUrl } from '../services/api'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

const PRODUCTION_SIGNALING_URL = 'https://medconnectrtc.nnmc.kz';
const DEVELOPMENT_SIGNALING_URL = 'http://localhost:1341';

const getSignalingUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'medconnect.nnmc.kz' || hostname === 'www.medconnect.nnmc.kz') {
      return PRODUCTION_SIGNALING_URL;
    }
  }
  if (import.meta.env.MODE === 'production' || import.meta.env.PROD) {
    return import.meta.env.VITE_SIGNALING_SERVER || PRODUCTION_SIGNALING_URL;
  }
  return import.meta.env.VITE_SIGNALING_SERVER || DEVELOPMENT_SIGNALING_URL;
};

const SIGNALING_SERVER = getSignalingUrl();

function VideoConsultation() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [connectionState, setConnectionState] = useState('initializing')
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarTab, setSidebarTab] = useState('chat') // 'chat' | 'notes'
  const [duration, setDuration] = useState(0)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [error, setError] = useState(null)
  const [appointment, setAppointment] = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [remoteUser, setRemoteUser] = useState(null)

  // Notes state
  const [notesTab, setNotesTab] = useState('diagnosis')
  const [diagnosisText, setDiagnosisText] = useState('')
  const [planText, setPlanText] = useState('')
  const [prescriptionsText, setPrescriptionsText] = useState('')
  const [diagnosisFile, setDiagnosisFile] = useState(null)
  const [isSavingDiagnosis, setIsSavingDiagnosis] = useState(false)
  const [isSavingPlan, setIsSavingPlan] = useState(false)
  const [isSavingPrescriptions, setIsSavingPrescriptions] = useState(false)
  const [diagnosisSaved, setDiagnosisSaved] = useState(false)
  const [planSaved, setPlanSaved] = useState(false)
  const [prescriptionsSaved, setPrescriptionsSaved] = useState(false)
  // Track existing document IDs to update instead of create duplicates
  const [existingDocIds, setExistingDocIds] = useState({ certificate: null, other: null, prescription: null })
  const [patientDocuments, setPatientDocuments] = useState([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)

  // Rating state (patient)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [isSubmittingRating, setIsSubmittingRating] = useState(false)

  // Force complete state (doctor)
  const [isCompletingCall, setIsCompletingCall] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const socketRef = useRef(null)
  const videoContainerRef = useRef(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setSidebarOpen(false)
    }
  }, [])
  const chatEndRef = useRef(null)

  const isDoctor = user?.userRole === 'doctor'

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const fetchAppointment = async () => {
      if (!roomId) return
      try {
        const query = new URLSearchParams()
        query.append('filters[roomId][$eq]', roomId)
        query.append('populate[doctor][populate][0]', 'specialization')
        query.append('populate[doctor][populate][1]', 'photo')
        query.append('populate[patient][fields][0]', 'id')
        query.append('populate[patient][fields][1]', 'fullName')
        query.append('populate[patient][fields][2]', 'email')
        query.append('populate[patient][fields][3]', 'phone')
        query.append('populate[patient][fields][4]', 'avatar')

        const response = await api.get(`/api/appointments?${query}`)
        const apt = response.data?.data?.[0]
        if (apt) setAppointment(apt)
      } catch (err) {
        console.error('Error fetching appointment:', err)
      }
    }
    fetchAppointment()
  }, [roomId])

  // Fetch patient documents for doctor + load existing docs for this appointment
  useEffect(() => {
    const fetchPatientDocs = async () => {
      if (!isDoctor || !appointment?.patient?.id) return
      setIsLoadingDocs(true)
      try {
        const response = await documentsAPI.getAll({ userId: appointment.patient.id })
        const docs = response.data?.data || []
        setPatientDocuments(docs)

        // Pre-fill forms with existing documents for this appointment
        const aptId = appointment.documentId || appointment.id
        const aptDocs = docs.filter(d => {
          const docAptId = d.appointment?.documentId || d.appointment?.id
          return docAptId && String(docAptId) === String(aptId)
        })
        const ids = { certificate: null, other: null, prescription: null }
        for (const doc of aptDocs) {
          const docId = doc.documentId || doc.id
          if (doc.type === 'certificate' && !ids.certificate) {
            ids.certificate = docId
            setDiagnosisText(doc.description || '')
          } else if (doc.type === 'other' && !ids.other) {
            ids.other = docId
            setPlanText(doc.description || '')
          } else if (doc.type === 'prescription' && !ids.prescription) {
            ids.prescription = docId
            setPrescriptionsText(doc.description || '')
          }
        }
        setExistingDocIds(ids)
      } catch (err) {
        console.error('Error fetching patient documents:', err)
      } finally {
        setIsLoadingDocs(false)
      }
    }
    fetchPatientDocs()
  }, [appointment?.patient?.id, isDoctor])

  const getParticipantInfo = () => {
    if (!appointment) {
      if (remoteUser?.userName) {
        return { name: remoteUser.userName, role: remoteUser.userRole === 'doctor' ? 'Врач' : 'Пациент' }
      }
      return { name: 'Ожидание...', role: '' }
    }

    if (isDoctor) {
      // Doctor sees patient info
      const patientName = remoteUser?.userName ||
                          appointment.patient?.fullName ||
                          appointment.patient?.username ||
                          appointment.patient?.email?.split('@')[0] ||
                          'Пациент'
      return {
        name: patientName,
        role: 'Пациент'
      }
    }

    // Patient sees doctor info
    const doctorName = appointment.doctor?.fullName ||
                       remoteUser?.userName ||
                       'Врач'
    return {
      name: doctorName,
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
    }
  }

  const toggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      setIsVideoOn(videoTrack.enabled)
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoContainerRef.current?.requestFullscreen()
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

  const cleanupCall = () => {
    localStreamRef.current?.getTracks().forEach(track => track.stop())
    peerConnectionRef.current?.close()
    socketRef.current?.emit('leave-room')
    socketRef.current?.disconnect()
  }

  const endCall = () => {
    cleanupCall()
    if (isDoctor) {
      navigate('/doctor')
    } else {
      // Patient — show rating modal
      setShowRatingModal(true)
    }
  }

  const forceCompleteCall = async () => {
    if (!appointment?.documentId) return
    setIsCompletingCall(true)
    try {
      await appointmentsAPI.update(appointment.documentId, { status: 'completed' })
      cleanupCall()
      navigate('/doctor')
    } catch (err) {
      console.error('Error completing appointment:', err)
      setIsCompletingCall(false)
      setShowCompleteConfirm(false)
    }
  }

  const submitRating = async () => {
    if (!appointment?.documentId || rating === 0) return
    setIsSubmittingRating(true)
    try {
      await appointmentsAPI.update(appointment.documentId, {
        rating,
        review: reviewText.trim() || undefined,
        status: 'completed',
      })
    } catch (err) {
      console.error('Error submitting rating:', err)
    } finally {
      setIsSubmittingRating(false)
      setShowRatingModal(false)
      navigate('/patient/appointments')
    }
  }

  const skipRating = () => {
    setShowRatingModal(false)
    navigate('/patient/appointments')
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

  const handleDiagnosisFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const uploaded = await uploadFile(file)
      setDiagnosisFile(uploaded)
    } catch (err) {
      console.error('Error uploading file:', err)
    }
  }

  const saveDiagnosis = async () => {
    if (!appointment?.id) return
    setIsSavingDiagnosis(true)
    try {
      if (existingDocIds.certificate) {
        await documentsAPI.update(existingDocIds.certificate, {
          description: diagnosisText || '',
          file: diagnosisFile?.id,
        })
      } else {
        const res = await documentsAPI.create({
          title: 'Заключение врача',
          type: 'certificate',
          description: diagnosisText || '',
          file: diagnosisFile?.id,
          appointment: appointment.id,
          user: appointment.patient?.id,
          doctor: appointment.doctor?.id,
        })
        const newDoc = res.data?.data
        if (newDoc) setExistingDocIds(prev => ({ ...prev, certificate: newDoc.documentId || newDoc.id }))
      }
      setDiagnosisSaved(true)
      setTimeout(() => setDiagnosisSaved(false), 2000)
    } catch (err) {
      console.error('Error saving diagnosis:', err)
    } finally {
      setIsSavingDiagnosis(false)
    }
  }

  const savePlan = async () => {
    if (!appointment?.id || !planText.trim()) return
    setIsSavingPlan(true)
    try {
      if (existingDocIds.other) {
        await documentsAPI.update(existingDocIds.other, {
          description: planText,
        })
      } else {
        const res = await documentsAPI.create({
          title: 'План обследования',
          type: 'other',
          description: planText,
          appointment: appointment.id,
          user: appointment.patient?.id,
          doctor: appointment.doctor?.id,
        })
        const newDoc = res.data?.data
        if (newDoc) setExistingDocIds(prev => ({ ...prev, other: newDoc.documentId || newDoc.id }))
      }
      setPlanSaved(true)
      setTimeout(() => setPlanSaved(false), 2000)
    } catch (err) {
      console.error('Error saving plan:', err)
    } finally {
      setIsSavingPlan(false)
    }
  }

  const savePrescriptions = async () => {
    if (!appointment?.id || !prescriptionsText.trim()) return
    setIsSavingPrescriptions(true)
    try {
      if (existingDocIds.prescription) {
        await documentsAPI.update(existingDocIds.prescription, {
          description: prescriptionsText,
        })
      } else {
        const res = await documentsAPI.create({
          title: 'Назначения',
          type: 'prescription',
          description: prescriptionsText,
          appointment: appointment.id,
          user: appointment.patient?.id,
          doctor: appointment.doctor?.id,
        })
        const newDoc = res.data?.data
        if (newDoc) setExistingDocIds(prev => ({ ...prev, prescription: newDoc.documentId || newDoc.id }))
      }
      setPrescriptionsSaved(true)
      setTimeout(() => setPrescriptionsSaved(false), 2000)
    } catch (err) {
      console.error('Error saving prescriptions:', err)
    } finally {
      setIsSavingPrescriptions(false)
    }
  }

  return (
    <div className="h-screen bg-slate-900 flex flex-col sm:flex-row overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/40 backdrop-blur-sm sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Main Video Area */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 transition-all duration-300",
        sidebarOpen ? "mr-0" : "mr-0"
      )}>
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-4 py-3 bg-slate-800/50">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative">
                <Avatar name={participant.name} size="md" />
                {connectionState === 'connected' && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-slate-800" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-white font-medium text-sm sm:text-base truncate">{participant.name}</h2>
                <p className="text-slate-400 text-xs truncate">{participant.role}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap justify-end gap-2 w-full sm:w-auto">
            {connectionState === 'connected' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 rounded-full">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 text-sm font-medium">{formatDuration(duration)}</span>
              </div>
            )}
            <button
              onClick={copyInviteLink}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm transition-colors"
            >
              {linkCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <LinkIcon className="w-4 h-4" />}
              <span className="hidden sm:inline">{linkCopied ? 'Скопировано' : 'Ссылка'}</span>
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg bg-teal-600 text-white hover:bg-teal-500 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Video Container */}
        <div ref={videoContainerRef} className="flex-1 relative bg-slate-900">
          {/* Connection States */}
          {connectionState === 'initializing' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-800 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-teal-500 animate-spin" />
                </div>
                <p className="text-white text-xl font-medium">Подготовка...</p>
                <p className="text-slate-400 mt-2">Настройка камеры и микрофона</p>
              </div>
            </div>
          )}

          {connectionState === 'waiting' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md px-4">
                <div className="w-28 h-28 mx-auto mb-6 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center ring-4 ring-slate-700/50">
                  <User className="w-14 h-14 text-slate-500" />
                </div>
                <h3 className="text-white text-2xl font-semibold mb-2">Ожидание собеседника</h3>
                <p className="text-slate-400 mb-8">
                  {isDoctor ? 'Пациент скоро подключится к консультации' : 'Врач скоро присоединится к вам'}
                </p>

                <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-5 text-left">
                  <p className="text-slate-400 text-sm mb-3">Ссылка для подключения:</p>
                  <div className="flex items-center gap-2 bg-slate-900/50 rounded-xl p-3">
                    <code className="flex-1 text-teal-400 text-sm truncate">{window.location.href}</code>
                    <button
                      onClick={copyInviteLink}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        linkCopied ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 hover:bg-slate-600 text-slate-400"
                      )}
                    >
                      {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Animated dots */}
                <div className="flex justify-center gap-1.5 mt-8">
                  <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}

          {connectionState === 'connecting' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-teal-500 to-sky-500 flex items-center justify-center animate-pulse">
                  <Avatar name={participant.name} size="xl" />
                </div>
                <p className="text-white text-xl font-medium mb-2">Подключение к {participant.name}...</p>
                <div className="flex justify-center gap-1">
                  <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}

          {connectionState === 'failed' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md px-4">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-rose-500/20 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-rose-500" />
                </div>
                <h3 className="text-white text-xl font-medium mb-2">Ошибка подключения</h3>
                <p className="text-slate-400 mb-6">{error || 'Не удалось установить соединение'}</p>
                <Button onClick={() => window.location.reload()}>Попробовать снова</Button>
              </div>
            </div>
          )}

          {/* Remote Video */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={cn(
              "w-full h-full object-cover",
              connectionState === 'connected' ? '' : 'hidden'
            )}
          />

          {/* Local Video Preview */}
          <div className="absolute bottom-24 right-3 sm:right-4 w-28 sm:w-48 aspect-video rounded-2xl overflow-hidden shadow-2xl ring-2 ring-white/10 bg-slate-800">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {!isVideoOn && (
              <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                <VideoOff className="w-8 h-8 text-slate-500" />
              </div>
            )}
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 rounded-lg">
              <p className="text-white text-xs">Вы</p>
            </div>
          </div>

          {/* Controls */}
          <div className="absolute bottom-0 inset-x-0 p-4 sm:p-6 flex flex-col items-center justify-center gap-3">
            <div className="flex items-center gap-3 p-2 bg-slate-800/90 backdrop-blur rounded-2xl">
              <button
                onClick={toggleMute}
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center transition-all',
                  isMuted
                    ? 'bg-rose-500 text-white hover:bg-rose-600'
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                )}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                onClick={toggleVideo}
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center transition-all',
                  !isVideoOn
                    ? 'bg-rose-500 text-white hover:bg-rose-600'
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                )}
              >
                {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>

              <div className="w-px h-8 bg-slate-600" />

              <button
                onClick={endCall}
                className="w-14 h-12 bg-rose-500 hover:bg-rose-600 text-white rounded-xl flex items-center justify-center transition-all"
              >
                <Phone className="w-5 h-5 rotate-[135deg]" />
              </button>
            </div>

            {/* Force complete button — far right for doctor only */}
            {isDoctor && (
              <button
                onClick={() => setShowCompleteConfirm(true)}
                className="h-10 px-4 bg-slate-700/80 hover:bg-emerald-600 text-white/80 hover:text-white rounded-xl flex items-center gap-2 transition-all text-sm font-medium backdrop-blur sm:absolute sm:right-6 sm:bottom-8"
              >
                <Check className="w-4 h-4" />
                Завершить встречу
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className={cn(
        "bg-white flex flex-col transition-all duration-300 border-l border-slate-200 fixed sm:static inset-y-0 right-0 z-30 h-full",
        sidebarOpen ? "translate-x-0 w-full sm:w-96" : "translate-x-full sm:translate-x-0 sm:w-0 overflow-hidden"
      )}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSidebarTab('chat')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                sidebarTab === 'chat'
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <MessageCircle className="w-4 h-4" />
              Чат
            </button>
            {isDoctor && (
              <button
                onClick={() => setSidebarTab('notes')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  sidebarTab === 'notes'
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <ClipboardList className="w-4 h-4" />
                Записи
              </button>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Tab */}
        {sidebarTab === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <MessageCircle className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-500 text-sm">Сообщений пока нет</p>
                  <p className="text-slate-400 text-xs mt-1">Начните общение прямо сейчас</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn('flex', msg.sender === 'me' ? 'justify-end' : 'justify-start')}
                  >
                    <div className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-3',
                      msg.sender === 'me'
                        ? 'bg-teal-600 text-white rounded-br-md'
                        : 'bg-slate-100 text-slate-900 rounded-bl-md'
                    )}>
                      {msg.sender !== 'me' && (
                        <p className="text-xs font-medium text-slate-500 mb-1">{msg.senderName}</p>
                      )}
                      <p className="text-sm">{msg.text}</p>
                      <p className={cn(
                        'text-xs mt-1',
                        msg.sender === 'me' ? 'text-teal-100' : 'text-slate-400'
                      )}>
                        {msg.time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Введите сообщение..."
                  className="flex-1 px-4 py-3 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className={cn(
                    "p-3 rounded-xl transition-colors",
                    newMessage.trim()
                      ? "bg-teal-600 text-white hover:bg-teal-700"
                      : "bg-slate-100 text-slate-400"
                  )}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </>
        )}

        {/* Notes Tab (Doctor only) */}
        {sidebarTab === 'notes' && isDoctor && (
          <div className="flex-1 overflow-y-auto">
            {/* Notes Sub-tabs */}
            <div className="flex items-center gap-1.5 p-4 border-b border-slate-100 overflow-x-auto">
              {[
                { id: 'diagnosis', label: 'Диагноз', icon: Stethoscope },
                { id: 'plan', label: 'План', icon: ClipboardList },
                { id: 'prescriptions', label: 'Назначения', icon: Pill },
                { id: 'documents', label: 'Документы', icon: FolderOpen },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setNotesTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    notesTab === tab.id
                      ? "bg-teal-50 text-teal-700"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-4">
              {notesTab === 'diagnosis' && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-slate-700">Заключение врача</label>
                      <label className="flex items-center gap-1.5 text-xs text-teal-600 cursor-pointer hover:text-teal-700">
                        <Upload className="w-3.5 h-3.5" />
                        Загрузить файл
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx"
                          onChange={handleDiagnosisFile}
                        />
                      </label>
                    </div>
                    <textarea
                      value={diagnosisText}
                      onChange={(e) => setDiagnosisText(e.target.value)}
                      className="w-full h-48 px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="Введите диагноз и заключение..."
                    />
                    {diagnosisFile && (
                      <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg text-sm">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600 truncate">{diagnosisFile.name}</span>
                        <button
                          onClick={() => setDiagnosisFile(null)}
                          className="ml-auto p-1 hover:bg-slate-200 rounded"
                        >
                          <X className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={saveDiagnosis}
                      leftIcon={<Save className="w-4 h-4" />}
                      disabled={isSavingDiagnosis || (!diagnosisText && !diagnosisFile)}
                      className="flex-1"
                    >
                      {isSavingDiagnosis ? 'Сохранение...' : 'Сохранить'}
                    </Button>
                    {diagnosisSaved && (
                      <span className="flex items-center gap-1 text-sm text-emerald-600">
                        <Check className="w-4 h-4" /> Сохранено
                      </span>
                    )}
                  </div>
                </>
              )}

              {notesTab === 'plan' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">План обследования</label>
                    <textarea
                      value={planText}
                      onChange={(e) => setPlanText(e.target.value)}
                      className="w-full h-48 px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="Введите план обследования пациента..."
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={savePlan}
                      leftIcon={<Save className="w-4 h-4" />}
                      disabled={isSavingPlan || !planText.trim()}
                      className="flex-1"
                    >
                      {isSavingPlan ? 'Сохранение...' : 'Сохранить'}
                    </Button>
                    {planSaved && (
                      <span className="flex items-center gap-1 text-sm text-emerald-600">
                        <Check className="w-4 h-4" /> Сохранено
                      </span>
                    )}
                  </div>
                </>
              )}

              {notesTab === 'prescriptions' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">Назначения</label>
                    <textarea
                      value={prescriptionsText}
                      onChange={(e) => setPrescriptionsText(e.target.value)}
                      className="w-full h-48 px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="Введите назначения и рекомендации..."
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={savePrescriptions}
                      leftIcon={<Save className="w-4 h-4" />}
                      disabled={isSavingPrescriptions || !prescriptionsText.trim()}
                      className="flex-1"
                    >
                      {isSavingPrescriptions ? 'Сохранение...' : 'Сохранить'}
                    </Button>
                    {prescriptionsSaved && (
                      <span className="flex items-center gap-1 text-sm text-emerald-600">
                        <Check className="w-4 h-4" /> Сохранено
                      </span>
                    )}
                  </div>
                </>
              )}

              {notesTab === 'documents' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Документы пациента
                  </label>
                  {isLoadingDocs ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
                    </div>
                  ) : patientDocuments.length === 0 ? (
                    <div className="text-center py-12">
                      <FolderOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                      <p className="text-slate-500 text-sm">У пациента нет загруженных документов</p>
                    </div>
                  ) : (() => {
                    const typeConfig = {
                      analysis: { label: 'Анализы', icon: 'bg-blue-100', iconColor: 'text-blue-600', folderColor: 'bg-blue-50 border-blue-100' },
                      prescription: { label: 'Назначения', icon: 'bg-emerald-100', iconColor: 'text-emerald-600', folderColor: 'bg-emerald-50 border-emerald-100' },
                      certificate: { label: 'Справки', icon: 'bg-violet-100', iconColor: 'text-violet-600', folderColor: 'bg-violet-50 border-violet-100' },
                      other: { label: 'Другое', icon: 'bg-amber-100', iconColor: 'text-amber-600', folderColor: 'bg-amber-50 border-amber-100' },
                    }
                    const grouped = patientDocuments.reduce((acc, doc) => {
                      const type = doc.type || 'other'
                      if (!acc[type]) acc[type] = []
                      acc[type].push(doc)
                      return acc
                    }, {})
                    const typeOrder = ['analysis', 'prescription', 'certificate', 'other']
                    const sortedTypes = typeOrder.filter(t => grouped[t]?.length > 0)

                    return (
                      <div className="space-y-2">
                        {sortedTypes.map((type) => {
                          const config = typeConfig[type] || typeConfig.other
                          const docs = grouped[type]
                          return (
                            <details key={type} className={`rounded-xl border ${config.folderColor} overflow-hidden`}>
                              <summary className="flex items-center gap-3 p-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:bg-white/40 transition-colors">
                                <div className={`w-9 h-9 rounded-lg ${config.icon} flex items-center justify-center flex-shrink-0`}>
                                  <Folder className={`w-4 h-4 ${config.iconColor}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-medium text-slate-900">{config.label}</h4>
                                  <p className="text-xs text-slate-500">{docs.length} док.</p>
                                </div>
                                <ChevronDown className="w-4 h-4 text-slate-400 transition-transform [[open]>&]:rotate-180 flex-shrink-0" />
                              </summary>
                              <div className="px-3 pb-3 space-y-1.5">
                                {docs.map((doc) => {
                                  const fileUrl = doc.file?.url ? getMediaUrl(doc.file) : null
                                  return (
                                    <div
                                      key={doc.id}
                                      className="flex items-start gap-3 p-2.5 bg-white rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                      <div className={`w-8 h-8 rounded-lg ${config.icon} flex items-center justify-center flex-shrink-0`}>
                                        <FileText className={`w-3.5 h-3.5 ${config.iconColor}`} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-medium text-slate-900 truncate">
                                          {doc.title || 'Документ'}
                                        </h4>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                          {doc.createdAt && new Date(doc.createdAt).toLocaleDateString('ru-RU')}
                                        </p>
                                        {doc.description && (
                                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">{doc.description}</p>
                                        )}
                                      </div>
                                      {fileUrl && (
                                        <a
                                          href={fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors flex-shrink-0"
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                        </a>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </details>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Doctor: Confirm Complete Modal */}
      {showCompleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowCompleteConfirm(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 animate-scaleIn">
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <PhoneOff className="w-7 h-7 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Завершить встречу?</h2>
              <p className="text-slate-500 text-sm mt-1">
                Статус записи будет изменён на «Завершён». Это действие нельзя отменить.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowCompleteConfirm(false)}
              >
                Отмена
              </Button>
              <Button
                className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                onClick={forceCompleteCall}
                disabled={isCompletingCall}
              >
                {isCompletingCall ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Завершить
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 animate-scaleIn">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-teal-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Оцените консультацию</h2>
              <p className="text-slate-500 text-sm mt-1">
                Ваш отзыв поможет улучшить качество обслуживания
              </p>
            </div>

            {/* Stars */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      'w-10 h-10 transition-colors',
                      (hoverRating || rating) >= star
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-300'
                    )}
                  />
                </button>
              ))}
            </div>

            {rating > 0 && (
              <p className="text-center text-sm font-medium text-slate-600 mb-4">
                {rating === 1 && 'Плохо'}
                {rating === 2 && 'Ниже среднего'}
                {rating === 3 && 'Нормально'}
                {rating === 4 && 'Хорошо'}
                {rating === 5 && 'Отлично'}
              </p>
            )}

            {/* Review text */}
            <div className="mb-6">
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Напишите отзыв (необязательно)..."
                className="w-full h-28 px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={skipRating}
              >
                Пропустить
              </Button>
              <Button
                className="flex-1"
                onClick={submitRating}
                disabled={rating === 0 || isSubmittingRating}
              >
                {isSubmittingRating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Отправить
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoConsultation
