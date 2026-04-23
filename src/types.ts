export type ChatMode = 'chat' | 'search' | 'image' | 'apps' | 'deep-research' | 'codex' | 'projects';

export interface UserProfile {
  name: string;
  email: string;
  createdAt: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  image?: string;
  timestamp: string;
  suggestions?: string[];
}

export interface ChatSession {
  userId: string;
  messages: ChatMessage[];
  createdAt: string;
}
