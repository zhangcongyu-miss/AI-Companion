import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import db from '../db.js';

const router = Router();

interface MessageRow {
  id: string;
  character_id: string;
  text: string;
  is_user: number;
  timestamp: number;
}

interface CharacterRow {
  id: string;
  name: string;
  personality: string;
  intro: string;
}

function rowToMessage(row: MessageRow) {
  return {
    id: row.id,
    text: row.text,
    isUser: row.is_user === 1,
    timestamp: row.timestamp,
  };
}

// GET /api/messages/:characterId — 获取角色聊天记录
router.get('/:characterId', (req: Request, res: Response) => {
  const rows = db.prepare(
    'SELECT id, text, is_user, timestamp FROM messages WHERE character_id = ? ORDER BY timestamp ASC'
  ).all(req.params.characterId) as MessageRow[];
  res.json(rows.map(rowToMessage));
});

// POST /api/messages/:characterId — 发送消息并获取 AI 回复
router.post('/:characterId', async (req: Request, res: Response) => {
  const { text } = req.body as { text: string };
  const { characterId } = req.params;

  if (!text?.trim()) {
    res.status(400).json({ error: '消息内容不能为空' });
    return;
  }

  const character = db.prepare('SELECT id, name, personality, intro FROM characters WHERE id = ?').get(characterId) as CharacterRow | undefined;
  if (!character) {
    res.status(404).json({ error: '角色不存在' });
    return;
  }

  // 保存用户消息
  const userMsgId = Date.now().toString();
  const now = Date.now();
  db.prepare(
    'INSERT INTO messages (id, character_id, text, is_user, timestamp) VALUES (?, ?, ?, 1, ?)'
  ).run(userMsgId, characterId, text.trim(), now);

  // 加载最近50条历史消息用于构建对话上下文
  const historyRows = db.prepare(
    'SELECT text, is_user FROM messages WHERE character_id = ? ORDER BY timestamp ASC LIMIT 50'
  ).all(characterId) as Pick<MessageRow, 'text' | 'is_user'>[];

  // 排除刚刚插入的用户消息（最后一条），构建 AI 历史
  const history = historyRows.slice(0, -1).map(m => ({
    role: m.is_user === 1 ? 'user' as const : 'model' as const,
    parts: [{ text: m.text }],
  }));

  const systemInstruction = `你是${character.name}，一个具有${character.personality}性格的虚拟伴侣。你的目标是提供情感陪伴和价值。${character.intro}请用中文回复，保持角色一致性，回复简洁自然。`;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [...history, { role: 'user', parts: [{ text: text.trim() }] }],
      config: { systemInstruction },
    });

    const aiText = response.text?.trim() || '我在这里听着呢。';
    const aiMsgId = (Date.now() + 1).toString();

    db.prepare(
      'INSERT INTO messages (id, character_id, text, is_user, timestamp) VALUES (?, ?, ?, 0, ?)'
    ).run(aiMsgId, characterId, aiText, Date.now());

    res.json({ id: aiMsgId, text: aiText, isUser: false, timestamp: Date.now() });
  } catch (error) {
    console.error('AI 响应错误:', error);
    // 删除已保存的用户消息，保持一致性
    db.prepare('DELETE FROM messages WHERE id = ?').run(userMsgId);
    res.status(500).json({ error: 'AI 响应失败，请稍后重试' });
  }
});

// DELETE /api/messages/:characterId — 清空聊天记录
router.delete('/:characterId', (req: Request, res: Response) => {
  db.prepare('DELETE FROM messages WHERE character_id = ?').run(req.params.characterId);
  res.status(204).end();
});

export default router;
