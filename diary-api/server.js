// diary-api/server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors({ origin: ['http://127.0.0.1:5500', 'http://localhost:5500'] }));
app.use(express.json());

const DB_FILE = path.join(__dirname, 'data.json');
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}));

const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// 프롬프트 생성 API
app.post('/api/generate-prompt', async (req, res) => {
  const { diary } = req.body;
  console.log("📘 입력된 일기:", diary);
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: '이 일기를 그림으로 표현할 수 있는 영어 이미지 프롬프트를 1~2문장으로 생성하세요.' },
        { role: 'user', content: diary }
      ],
    });
    const prompt = response.choices[0].message.content.trim();
    console.log("✅ 생성된 프롬프트:\n" + prompt);
    res.json({ prompt });
  } catch (err) {
    console.error("❌ 프롬프트 생성 실패:", err);
    res.status(500).json({ error: '프롬프트 생성 실패' });
  }
});

// 이미지 생성 API
app.post('/api/generate-image', async (req, res) => {
  const { prompt } = req.body;
  const finalPrompt = `${prompt}, in surrealism, ultra detailed, 4K style`;
  console.log("🎨 이미지 생성 요청:\n" + finalPrompt);

  try {
    const imgResponse = await openai.images.generate({
      model: 'dall-e-2',
      prompt: finalPrompt,
      n: 1,
      size: '512x512'
    });
    const imageUrl = imgResponse.data[0].url;
    console.log("✅ 생성된 이미지 URL:", imageUrl);
    res.json({ imageUrl });
  } catch (err) {
    console.error("❌ 이미지 생성 실패:", err);
    res.status(500).json({ error: '이미지 생성 실패' });
  }
});

// 일기 저장 API (로그 없음)
app.post('/api/save-diary', (req, res) => {
  const { userId, diary, imageUrl, date, timestamp } = req.body;

  if (!userId || !diary || !imageUrl || !date) {
    console.warn("⚠️ 필수 값 누락:", req.body);
    return res.status(400).json({ error: '필수 값 누락' });
  }

  const db = readDB();
  if (!db[userId]) db[userId] = {};
  if (!db[userId][date]) db[userId][date] = [];

  db[userId][date].push({ diary, imageUrl, date, timestamp });
  writeDB(db);
  res.json({ success: true });
});

// 사용자 데이터 조회 API (로그 없음)
app.get('/api/diaries', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId 필요' });

  const db = readDB();
  const userData = db[userId] || {};
  const allEntries = Object.values(userData).flat();
  allEntries.sort((a, b) => b.timestamp - a.timestamp);
  res.json({ entries: allEntries });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 서버 실행: http://localhost:${PORT}`);
});
