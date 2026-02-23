import { Character, Message } from '../types';

// 网页版用相对路径，APP 版用 Railway 完整地址（通过 VITE_API_URL 环境变量注入）
const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '请求失败' }));
    throw new Error(err.error || '请求失败');
  }
  return res.json();
}

// ——— 角色 ———

export function fetchCharacters(): Promise<Character[]> {
  return request('/characters');
}

export function createCharacter(data: Omit<Character, 'id'> & { id?: string }): Promise<Character> {
  return request('/characters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateCharacter(id: string, data: Character): Promise<Character> {
  return request(`/characters/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteCharacter(id: string): Promise<void> {
  await fetch(`${BASE}/characters/${id}`, { method: 'DELETE' });
}

// ——— 消息 ———

export function fetchMessages(characterId: string): Promise<Message[]> {
  return request(`/messages/${characterId}`);
}

export function sendMessage(characterId: string, text: string): Promise<Message> {
  return request(`/messages/${characterId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export async function clearMessages(characterId: string): Promise<void> {
  await fetch(`${BASE}/messages/${characterId}`, { method: 'DELETE' });
}

// ——— 语音 ———

export async function generateSpeech(text: string, voiceName: string = 'Kore'): Promise<string | null> {
  try {
    const data = await request<{ audio: string }>('/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceName }),
    });
    return data.audio;
  } catch {
    return null;
  }
}
