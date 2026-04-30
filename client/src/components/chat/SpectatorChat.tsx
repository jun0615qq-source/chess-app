import { useState, useEffect, useRef } from 'react';
import { Send, Eye } from 'lucide-react';
import { getSocket } from '../../utils/socket';
import { useAuthStore } from '../../store/authStore';

interface ChatMessage {
  userId: number;
  name: string;
  message: string;
  timestamp: number;
}

interface SpectatorChatProps {
  gameId: number;
  spectatorCount: number;
}

export const SpectatorChat = ({ gameId, spectatorCount }: SpectatorChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const socket = getSocket();

  useEffect(() => {
    // 관전 채팅 수신
    socket.on('spectate_chat_receive', (msg: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-99), msg]); // 최대 100개 유지
    });

    socket.on('chat_error', ({ message }: { message: string }) => {
      setMessages((prev) => [
        ...prev,
        { userId: 0, name: '시스템', message, timestamp: Date.now() },
      ]);
    });

    return () => {
      socket.off('spectate_chat_receive');
      socket.off('chat_error');
    };
  }, [socket]);

  // 새 메시지 시 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !user) return;
    socket.emit('spectate_chat_send', { gameId, message: input.trim() });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-64 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-semibold">관전자 채팅</h4>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Eye size={12} />
          <span>{spectatorCount}</span>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-4">채팅을 시작해보세요!</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="text-xs">
            <span className={msg.userId === 0 ? 'text-gray-400' : 'font-semibold text-blue-600 dark:text-blue-400'}>
              [{msg.name}]
            </span>{' '}
            <span className="text-gray-700 dark:text-gray-300 break-words">{msg.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      {user && (
        <div className="flex gap-2 p-2 border-t border-gray-200 dark:border-gray-700">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지 입력..."
            maxLength={200}
            className="flex-1 text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="p-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
