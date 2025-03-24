import { Transaction } from '../plaid';

declare module './OpenAIChat' {
  interface OpenAIChatProps {
    transactions: Transaction[];
  }

  const OpenAIChat: React.FC<OpenAIChatProps>;
  export default OpenAIChat;
} 