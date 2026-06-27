import { forwardRef } from 'react'
import ChatCopilotPanel, { type ChatCopilotPanelHandle } from './components/ChatCopilotPanel'

export type TradingAgentsChatSidebarProps = {
  onSymbolDetected: (symbol: string) => void
  onShowReport?: (section?: string) => void
}

export const TradingAgentsChatSidebar = forwardRef<ChatCopilotPanelHandle, TradingAgentsChatSidebarProps>(
  function TradingAgentsChatSidebar({ onSymbolDetected, onShowReport }, ref) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <ChatCopilotPanel ref={ref} onSymbolDetected={onSymbolDetected} onShowReport={onShowReport} />
      </div>
    )
  },
)
