export interface Character {
  id: string;
  name: string;
  avatar: string;
  description: string;
  intro: string;
  level: string;
  personality: string;
  voice: string;
}

export type Screen = 'home' | 'detail' | 'chat' | 'create';

export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
}
