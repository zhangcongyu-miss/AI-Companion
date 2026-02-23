import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import charactersRouter from './routes/characters.js';
import messagesRouter from './routes/messages.js';
import speechRouter from './routes/speech.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3001;

// 允许 Capacitor APP 跨域请求
app.use(cors({
  origin: [
    'http://localhost',
    'http://localhost:3000',
    'capacitor://localhost',
    'ionic://localhost',
    'https://ai-companion-production-43d9.up.railway.app',
  ],
  credentials: true,
}));

// 支持大体积 base64 头像
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API 路由
app.use('/api/characters', charactersRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/speech', speechRouter);

// 生产环境：托管 Vite 构建产物（dist 存在时）
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`✅ 后端服务启动: http://localhost:${PORT}`);
  console.log('🤖 AI 对话：Pollinations.ai（免费，无需 API Key）');
  if (!process.env.GEMINI_API_KEY) {
    console.log('🔇 语音朗读：未配置 GEMINI_API_KEY，语音功能已禁用（可选）');
  }
});
