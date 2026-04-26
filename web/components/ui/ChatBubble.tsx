import type { ReactNode } from 'react'

export type ChatRole = 'user' | 'assistant'

interface ChatBubbleProps {
  role: ChatRole
  children: ReactNode
}

export function ChatBubble({ role, children }: ChatBubbleProps) {
  if (role === 'assistant') {
    return (
      <div data-testid="ui-chat-bubble" data-role="assistant" className="flex justify-start">
        <div className="max-w-[90%] text-body leading-body text-text">
          {children}
        </div>
      </div>
    )
  }

  return (
    <div data-testid="ui-chat-bubble" data-role="user" className="flex justify-end">
      <div className="max-w-[80%] bg-page text-text text-body leading-body rounded-card px-3 py-2">
        {children}
      </div>
    </div>
  )
}
