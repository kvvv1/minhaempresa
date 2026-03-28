import { GlobalChat } from '@/components/ai/GlobalChat'
import { MessageSquareText } from 'lucide-react'

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 border border-primary/20">
          <MessageSquareText className="w-4 h-4 text-primary" />
        </div>
        <h1 className="text-base font-bold">Chat com o Board</h1>
      </div>

      <GlobalChat />
    </div>
  )
}
