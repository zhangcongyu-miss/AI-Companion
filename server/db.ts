import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'companion.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar TEXT DEFAULT '',
    description TEXT DEFAULT '',
    intro TEXT DEFAULT '',
    level TEXT DEFAULT 'Lv1 · 初识',
    personality TEXT DEFAULT '温暖型',
    voice TEXT DEFAULT '默认甜美女声',
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL,
    text TEXT NOT NULL,
    is_user INTEGER NOT NULL DEFAULT 0,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );
`);

// Seed initial characters if DB is empty
const { count } = db.prepare('SELECT COUNT(*) as count FROM characters').get() as { count: number };
if (count === 0) {
  const insert = db.prepare(
    'INSERT INTO characters (id, name, avatar, description, intro, level, personality, voice) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insert.run(
    '1', '阳光伙伴',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver',
    '你的24小时温暖陪伴，倾听一切',
    '我是阳光伙伴，喜欢听你分享生活的点滴，随时为你加油打气～',
    'Lv2 · 常来常往', '温暖型', '默认甜美女声'
  );
  insert.run(
    '2', '偶像星语',
    'https://i.pravatar.cc/300?img=68',
    '专属AI偶像，陪你追剧聊心事',
    '我是你的专属AI偶像，无论什么时候我都会在你身边支持你！',
    'Lv1 · 初识', '幽默型', '默认甜美女声'
  );
  insert.run(
    '3', '喵星人',
    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&h=200&fit=crop',
    '治愈系小猫，随时求摸摸～🐾',
    '嘿，今天过得怎么样？来聊聊吧～我是喵星人，也是你的心动语言伙伴。在这里你可以畅所欲言哦！',
    'Lv1 · 初识', '治愈型', '默认甜美女声'
  );
}

export default db;
