import ChatComponent from '../../components/chat/ChatComponent'

function PatientChat() {
  return (
    <div className="animate-fadeIn h-full min-h-0 flex flex-col">
      <div className="mb-4 sm:mb-6 hidden sm:block">
        <h1 className="text-2xl font-bold text-slate-900">Сообщения</h1>
        <p className="text-slate-600">Общайтесь с вашими врачами</p>
      </div>
      <div className="flex-1 min-h-0 -mx-4 sm:mx-0">
        <ChatComponent userRole="patient" />
      </div>
    </div>
  )
}

export default PatientChat
