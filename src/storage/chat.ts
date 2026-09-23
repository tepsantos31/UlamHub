import { getJSON, setJSON, KEYS } from './db';
import { ChatMessage } from '../types/models';

const DEFAULT_CHAT: ChatMessage[] = [
  { role: 'ai', text: "Hi! I'm your UlamHub cook. Tell me what's in your kitchen — or what you're craving." },
];

export async function getChat(): Promise<ChatMessage[]> {
  return getJSON<ChatMessage[]>(KEYS.chat, DEFAULT_CHAT);
}

export async function appendChat(messages: ChatMessage[]): Promise<ChatMessage[]> {
  const existing = await getChat();
  const next = [...existing, ...messages];
  await setJSON(KEYS.chat, next);
  return next;
}
