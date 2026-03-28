import { GlobalChat } from '@/components/ai/GlobalChat'
import { MessageSquareText } from 'lucide-react'

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 border border-primary/20">
          <MessageSquareText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Chat com o Board</h1>
          <p className="text-sm text-muted-foreground">
            Chief of Staff conduz, consulta especialistas e devolve uma resposta unica
          </p>
        </div>
      </div>

      <GlobalChat />
    </div>
  )
}
