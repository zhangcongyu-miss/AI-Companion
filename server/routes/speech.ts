import { Router, Request, Response } from 'express';
import { GoogleGenAI, Modality } from '@google/genai';

const router = Router();

const VALID_VOICES = ['Kore', 'Zephyr', 'Puck', 'Charon', 'Fenrir', 'Aoede'];

// POST /api/speech — 文字转语音
router.post('/', async (req: Request, res: Response) => {
  const { text, voiceName = 'Kore' } = req.body as { text: string; voiceName?: string };

  if (!text?.trim()) {
    res.status(400).json({ error: '文本内容不能为空' });
    return;
  }

  const voice = VALID_VOICES.includes(voiceName) ? voiceName : 'Kore';

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: text.trim() }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      res.status(500).json({ error: '未能生成语音' });
      return;
    }

    res.json({ audio: base64Audio });
  } catch (error) {
    console.error('TTS 错误:', error);
    res.status(500).json({ error: '语音生成失败，请稍后重试' });
  }
});

export default router;
