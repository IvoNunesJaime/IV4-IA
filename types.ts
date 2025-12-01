export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // Base64 string
  timestamp: number;
}

export interface DocumentData {
  id: string;
  title: string;
  content: string; // HTML string
  createdAt: number;
}

export enum HumanizerVariant {
  PT_PT = 'Português de Portugal',
  PT_AO = 'Português de Angola',
  PT_MZ = 'Português de Moçambique',
}

export enum AppView {
  AUTH = 'AUTH',
  CHAT = 'CHAT',
  STUDIO = 'STUDIO',
  HUMANIZER = 'HUMANIZER',
}