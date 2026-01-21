import ChatComponent from '../../components/chat/ChatComponent'

function PatientChat() {
  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Сообщения</h1>
        <p className="text-slate-600">Общайтесь с вашими врачами</p>
      </div>
      <ChatComponent userRole="patient" />
    </div>
  )
}

export default PatientChat
