import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
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

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('未配置 GROQ_API_KEY，请在 Railway Variables 中添加');
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });
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

  const character = db.prepare(
    'SELECT id, name, personality, intro FROM characters WHERE id = ?'
  ).get(characterId) as CharacterRow | undefined;

  if (!character) {
    res.status(404).json({ error: '角色不存在' });
    return;
  }

  // 保存用户消息
  const userMsgId = Date.now().toString();
  db.prepare(
    'INSERT INTO messages (id, character_id, text, is_user, timestamp) VALUES (?, ?, ?, 1, ?)'
  ).run(userMsgId, characterId, text.trim(), Date.now());

  // 取最近 20 条历史（排除刚插入的用户消息）
  const historyRows = db.prepare(
    'SELECT text, is_user FROM messages WHERE character_id = ? ORDER BY timestamp ASC LIMIT 20'
  ).all(characterId) as Pick<MessageRow, 'text' | 'is_user'>[];

  const history: OpenAI.Chat.ChatCompletionMessageParam[] = historyRows
    .slice(0, -1)
    .map(m => ({
      role: m.is_user === 1 ? 'user' : 'assistant',
      content: m.text,
    }));

  const systemPrompt = `你是${character.name}，一个${character.personality}性格的虚拟伴侣。${character.intro}
请用中文回复，保持角色特色，语气自然亲切，回复在80字以内。`;

  try {
    const client = getGroqClient();
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: text.trim() },
      ],
      max_tokens: 300,
      temperature: 0.85,
    });

    const aiText = completion.choices[0]?.message?.content?.trim() || '我在这里听着呢～';
    const aiMsgId = (Date.now() + 1).toString();

    db.prepare(
      'INSERT INTO messages (id, character_id, text, is_user, timestamp) VALUES (?, ?, ?, 0, ?)'
    ).run(aiMsgId, characterId, aiText, Date.now());

    console.log(`[AI] ${character.name} → "${aiText.slice(0, 40)}..."`);
    res.json({ id: aiMsgId, text: aiText, isUser: false, timestamp: Date.now() });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[AI] 响应失败:', errMsg);
    db.prepare('DELETE FROM messages WHERE id = ?').run(userMsgId);
    res.status(500).json({ error: `AI 响应失败：${errMsg}` });
  }
});

// DELETE /api/messages/:characterId — 清空聊天记录
router.delete('/:characterId', (req: Request, res: Response) => {
  db.prepare('DELETE FROM messages WHERE character_id = ?').run(req.params.characterId);
  res.status(204).end();
});

export default router;
