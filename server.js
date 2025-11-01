app.use(express.static(__dirname, { index: 'index.html' })); // serve this folder

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/styles.css', (_req, res) => res.sendFile(path.join(__dirname, 'styles.css')));
app.get('/app.js', (_req, res) => res.sendFile(path.join(__dirname, 'app.js')));


import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5174;
const DATA_DIR = path.join(__dirname, 'data');
const KNOW_PATH = path.join(DATA_DIR, 'knowledge.json');
const EMBED_PATH = path.join(DATA_DIR, 'embeddings.json');
const SEED_PATH = path.join(__dirname, 'seed', 'cars_seed.md');

const app = express();
app.use(express.json({ limit: '3mb' }));
app.use(express.static('dist')); // serve built frontend

// --- Utils
async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  // init knowledge
  try { await fs.access(KNOW_PATH); } catch {
    await fs.writeFile(KNOW_PATH, JSON.stringify([], null, 2));
  }
  try { await fs.access(EMBED_PATH); } catch {
    await fs.writeFile(EMBED_PATH, JSON.stringify([], null, 2));
  }
}
function chunkText(text, maxChars = 1000) {
  const lines = text.split(/\n+/);
  const chunks = [];
  let buf = '';
  for (const line of lines) {
    if ((buf + '\n' + line).length > maxChars) {
      if (buf.trim()) chunks.push(buf.trim());
      buf = line;
    } else {
      buf = buf ? buf + '\n' + line : line;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}
function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

// --- OpenAI
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CHAT_MODEL = 'gpt-4o-mini';
const EMBED_MODEL = 'text-embedding-3-small';

// --- Seed once on first run
async function seedIfEmpty() {
  const know = JSON.parse(await fs.readFile(KNOW_PATH, 'utf8'));
  if (know.length) return;
  try {
    const seed = await fs.readFile(SEED_PATH, 'utf8');
    const chunks = chunkText(seed, 900);
    const emb = await client.embeddings.create({
      model: EMBED_MODEL,
      input: chunks
    });
    const vectors = emb.data.map(e => e.embedding);
    await fs.writeFile(KNOW_PATH, JSON.stringify(chunks, null, 2));
    await fs.writeFile(EMBED_PATH, JSON.stringify(vectors, null, 2));
    console.log(`Seeded ${chunks.length} chunks from seed/cars_seed.md`);
  } catch (e) {
    console.warn('Seed error:', e.message);
  }
}

// --- API: learn (add text, chunk & embed)
app.post('/api/learn', async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || text.trim().length < 10) {
      return res.status(400).json({ error: 'Provide some car text (>= 10 chars)' });
    }
    const chunks = chunkText(text, 900);
    const emb = await client.embeddings.create({
      model: EMBED_MODEL,
      input: chunks
    });
    const vectors = emb.data.map(e => e.embedding);

    const know = JSON.parse(await fs.readFile(KNOW_PATH, 'utf8'));
    const embs = JSON.parse(await fs.readFile(EMBED_PATH, 'utf8'));

    know.push(...chunks);
    embs.push(...vectors);

    await fs.writeFile(KNOW_PATH, JSON.stringify(know, null, 2));
    await fs.writeFile(EMBED_PATH, JSON.stringify(embs, null, 2));

    res.json({ added: chunks.length });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// --- API: chat (retrieve + answer)
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, topK = 5 } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    // retrieval
    const know = JSON.parse(await fs.readFile(KNOW_PATH, 'utf8'));
    const embs = JSON.parse(await fs.readFile(EMBED_PATH, 'utf8'));

    let contextBlocks = [];
    if (know.length && messages.length) {
      const userText = messages[messages.length - 1].content || '';
      const qEmbed = await client.embeddings.create({
        model: EMBED_MODEL,
        input: userText
      });
      const q = qEmbed.data[0].embedding;
      const scored = embs.map((v, idx) => ({ idx, score: cosineSim(v, q) }))
                         .sort((a,b) => b.score - a.score)
                         .slice(0, Math.min(topK, know.length));
      contextBlocks = scored.map(s => know[s.idx]);
    }

    const system = {
      role: 'system',
      content:
        "You are Carspire, a friendly, precise car mentor. Explain clearly and briefly for non-experts. " +
        "Use the provided CONTEXT when relevant. Always emphasize safety and legality. " +
        "If unsure, say you are unsure and suggest checking the owner's manual or a certified mechanic."
    };

    const contextMsg = contextBlocks.length
      ? { role: 'system', content: "CONTEXT:\n" + contextBlocks.join("\n---\n") }
      : null;

    const finalMessages = contextMsg
      ? [system, contextMsg, ...messages]
      : [system, ...messages];

    const r = await client.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.5,
      messages: finalMessages
    });

    const reply = r.choices?.[0]?.message?.content || "Sorry, I couldn't generate a reply.";
    res.json({ reply, usedContext: contextBlocks.length });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// --- SPA fallback (serve built UI)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- boot
(async () => {
  await ensureDataFiles();
  await seedIfEmpty();
  app.listen(PORT, () => console.log(`Carspire server on http://localhost:${PORT}`));
})();

