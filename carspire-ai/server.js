import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5174;

app.use(cors());
app.use(express.json({ limit: "3mb" }));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CHAT_MODEL = "gpt-4o-mini";
const EMBED_MODEL = "text-embedding-3-small";

const KNOW = path.join(__dirname, "knowledge.json");
const EMBS = path.join(__dirname, "embeddings.json");

async function ensureFiles() {
  try { await fs.access(KNOW); } catch { await fs.writeFile(KNOW, "[]"); }
  try { await fs.access(EMBS); } catch { await fs.writeFile(EMBS, "[]"); }
}

function chunk(text, max = 900) {
  const lines = text.split(/\n+/), out = []; let buf = "";
  for (const L of lines) {
    if ((buf + "\n" + L).length > max) {
      if (buf.trim()) out.push(buf.trim());
      buf = L;
    } else buf = buf ? buf + "\n" + L : L;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]*b[i];
    na += a[i]*a[i];
    nb += b[i]*b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

app.get("/api_health", (_req, res) => res.json({ ok: true }));

app.post("/api_learn", async (req, res) => {
  try {
    const text = (req.body?.text || "").trim();
    if (text.length < 10)
      return res.status(400).json({ error: "Provide text >= 10 chars" });

    const parts = chunk(text);
    const emb = await client.embeddings.create({ model: EMBED_MODEL, input: parts });
    const vecs = emb.data.map(d => d.embedding);

    const know = JSON.parse(await fs.readFile(KNOW, "utf8"));
    const embs = JSON.parse(await fs.readFile(EMBS, "utf8"));
    know.push(...parts);
    embs.push(...vecs);

    await fs.writeFile(KNOW, JSON.stringify(know, null, 2));
    await fs.writeFile(EMBS, JSON.stringify(embs, null, 2));
    res.json({ added: parts.length });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/api_chat", async (req, res) => {
  try {
    const messages = req.body?.messages;
    if (!Array.isArray(messages))
      return res.status(400).json({ error: "messages array required" });

    const know = JSON.parse(await fs.readFile(KNOW, "utf8"));
    const embs = JSON.parse(await fs.readFile(EMBS, "utf8"));
    let context = [];

    if (know.length && messages.length) {
      const qText = messages[messages.length - 1].content || "";
      const qEmb = await client.embeddings.create({ model: EMBED_MODEL, input: qText });
      const q = qEmb.data[0].embedding;
      context = embs
        .map((v, i) => ({ i, s: cosine(v, q) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 5)
        .map(r => know[r.i]);
    }

    const system = { role: "system", content: "You are Carspire, a friendly car mentor who gives accurate automotive advice." };
    const ctx = context.length ? { role: "system", content: "CONTEXT:\n" + context.join("\n---\n") } : null;
    const msgs = ctx ? [system, ctx, ...messages] : [system, ...messages];

    const r = await client.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.5,
      messages: msgs,
    });
    res.json({ reply: r.choices?.[0]?.message?.content || "Sorry, no reply." });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

(async () => {
  await ensureFiles();
  app.listen(PORT, () => console.log(`✅ Carspire API running on http://localhost:${PORT}`));
})();
