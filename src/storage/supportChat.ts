import { getJSON, setJSON, KEYS } from './db';
import { ChatMessage } from '../types/models';

const DEFAULT_CHAT: ChatMessage[] = [
  { role: 'ai', text: "Hi! I'm UlamHub Support. Ask me anything about using the app — or tap \"Talk to a real person\" below if you'd rather speak with someone." },
];

export async function getSupportChat(): Promise<ChatMessage[]> {
  return getJSON<ChatMessage[]>(KEYS.supportChat, DEFAULT_CHAT);
}

export async function appendSupportChat(messages: ChatMessage[]): Promise<ChatMessage[]> {
  const existing = await getSupportChat();
  const next = [...existing, ...messages];
  await setJSON(KEYS.supportChat, next);
  return next;
}
