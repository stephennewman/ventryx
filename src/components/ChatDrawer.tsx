import React, { useState, useRef, useEffect } from 'react';
import { Transaction } from '../plaid';
import ReactMarkdown from 'react-markdown';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
}

const ChatDrawer: React.FC<ChatDrawerProps> = ({ isOpen, onClose, transactions }) => {
  const [prompt, setPrompt] = useState('');
  const [chatLog, setChatLog] = useState<Array<{ role: string; content: string }>>([]);
  const [loading, setLoading] = useState(false);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-adjust textarea height
  const adjustTextareaHeight = () => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 120); // Max height of 120px
      textarea.style.height = `${Math.max(44, newHeight)}px`; // Min height of 44px
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [prompt]);

  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [chatLog]);

  useEffect(() => {
    if (!loading && inputRef.current && isOpen) {
      inputRef.current.focus();
    }
  }, [loading, isOpen]);

  const handleSend = async () => {
    if (!prompt.trim()) return;

    setPrompt('');
    if (inputRef.current) {
      inputRef.current.focus();
    }

    const updatedChatLog = [...chatLog, { role: 'user', content: prompt }];
    setChatLog(updatedChatLog);
    setLoading(true);

    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5176'}/api/openai/chat-with-transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedChatLog,
          transactions,
        }),
      });

      const data = await response.json();
      const aiReply = data?.message || data?.reply || 'No reply from AI.';

      setChatLog([...updatedChatLog, { role: 'assistant', content: aiReply }]);
    } catch (error) {
      console.error('Fetch error:', error);
      setChatLog([...updatedChatLog, { role: 'assistant', content: 'Something went wrong.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 ${
          isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div 
        className={`fixed inset-y-0 right-0 w-96 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="border-b border-gray-200 p-4 flex justify-between items-center bg-white z-10">
          <h2 className="text-xl font-semibold">AI Chat</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div 
          ref={chatLogRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {chatLog.map((chat, index) => (
            <div
              key={index}
              className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  chat.role === 'user'
                    ? 'bg-blue-500 text-white text-right'
                    : 'bg-gray-100 text-gray-800 text-left'
                }`}
              >
                <div className={chat.role === 'user' ? 'text-right' : 'text-left'}>
                  <ReactMarkdown>{chat.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-800 rounded-lg px-4 py-2 text-left">
                Thinking...
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 p-4 bg-white space-y-2">
          <textarea
            ref={inputRef}
            placeholder="Ask me anything about your finances..."
            value={prompt}
            onChange={handlePromptChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            style={{ resize: 'none', overflowY: 'hidden' }}
            className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] transition-all duration-200"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !prompt.trim()}
            className="w-full bg-blue-500 text-white px-4 py-3 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors font-medium"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </>
  );
};

export default ChatDrawer; 