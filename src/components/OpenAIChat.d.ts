declare module './OpenAIChat' {
  import React from 'react';

  interface OpenAIChatProps {
    transactions: any[]; // Adjust the type of transactions if you have a specific type
  }

  const OpenAIChat: React.FC<OpenAIChatProps>;

  export default OpenAIChat;
} 