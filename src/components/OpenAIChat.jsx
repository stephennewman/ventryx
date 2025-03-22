import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';


function OpenAIChat({ transactions }) {
  const [prompt, setPrompt] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!prompt.trim()) return;

    const updatedChatLog = [...chatLog, { role: 'user', content: prompt }];
    setChatLog(updatedChatLog);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5176/api/openai/chat-with-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      setPrompt('');
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4 max-w-3xl mx-auto my-6">
      <div className="h-64 overflow-y-auto mb-4 p-2 border rounded">
        {chatLog.map((chat, index) => (
          <div key={index} className={`my-2 ${chat.role === 'user' ? 'text-right' : 'text-left'}`}>
            <span className={`inline-block rounded-lg px-4 py-2 ${chat.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
            <ReactMarkdown>{chat.content}</ReactMarkdown>
            </span>
          </div>
        ))}
      </div>

      <div className="flex space-x-2">
        <input
          type="text"
          placeholder="Ask me anything..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="flex-1 border rounded p-2"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || prompt.trim() === ''}
          className="bg-blue-500 text-white rounded px-4 py-2 disabled:bg-gray-400"
        >
          {loading ? 'Thinking...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

export default OpenAIChat;
