import { Router, Request, Response } from 'express';
import db from '../db.js';

const router = Router();

interface CharacterRow {
  id: string;
  name: string;
  avatar: string;
  description: string;
  intro: string;
  level: string;
  personality: string;
  voice: string;
  created_at: number;
}

// GET /api/characters — 获取所有角色
router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare(
    'SELECT id, name, avatar, description, intro, level, personality, voice FROM characters ORDER BY created_at ASC'
  ).all() as CharacterRow[];
  res.json(rows);
});

// POST /api/characters — 创建新角色
router.post('/', (req: Request, res: Response) => {
  const { id, name, avatar, description, intro, level, personality, voice } = req.body as Partial<CharacterRow>;
  if (!name?.trim()) {
    res.status(400).json({ error: '角色名称不能为空' });
    return;
  }
  const charId = id || Date.now().toString();
  db.prepare(
    `INSERT INTO characters (id, name, avatar, description, intro, level, personality, voice)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    charId,
    name,
    avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
    description || '一个新伙伴',
    intro || `我是${name}，很高兴认识你！`,
    level || 'Lv1 · 初识',
    personality || '温暖型',
    voice || '默认甜美女声'
  );
  const character = db.prepare('SELECT id, name, avatar, description, intro, level, personality, voice FROM characters WHERE id = ?').get(charId);
  res.status(201).json(character);
});

// PUT /api/characters/:id — 更新角色
router.put('/:id', (req: Request, res: Response) => {
  const { name, avatar, description, intro, level, personality, voice } = req.body as Partial<CharacterRow>;
  const exists = db.prepare('SELECT id FROM characters WHERE id = ?').get(req.params.id);
  if (!exists) {
    res.status(404).json({ error: '角色不存在' });
    return;
  }
  db.prepare(
    `UPDATE characters SET name = ?, avatar = ?, description = ?, intro = ?, level = ?, personality = ?, voice = ?
     WHERE id = ?`
  ).run(name, avatar, description, intro, level, personality, voice, req.params.id);
  const character = db.prepare('SELECT id, name, avatar, description, intro, level, personality, voice FROM characters WHERE id = ?').get(req.params.id);
  res.json(character);
});

// DELETE /api/characters/:id — 删除角色（同时级联删除消息）
router.delete('/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM characters WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
