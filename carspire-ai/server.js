// server.js — Carspire backend (ESM)
// Requirements:
//   - Node 18+
//   - package.json: { "type": "module" }
//   - .env with OPENAI_API_KEY=sk-...

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';

const app = express();
const port = process.env.PORT || 8080;

// --- security & parsing ---
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // keep simple for JSON API
}));
app.use(express.json({ limit: '1mb' }));

// --- CORS: allow your GitHub Pages site + local dev ---
const allowed = new Set([
  'http://localhost:5173',
  'http://localhost:3000',
  'https://carspirethailand.github.io',          // org pages
  'https://carspirethailand.github.io/carspireAI'// repo pages
]);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);          // curl/postman
    try {
      const u = new URL(origin);
      const base = `${u.protocol}//${u.host}`;
      return cb(null, allowed.has(base));
    } catch {
      return cb(null, false);
    }
  },
  methods: ['GET','POST','OPTIONS'],
  credentials: false
}));

// --- rate limit (per IP) ---
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// --- OpenAI client (Responses API) ---
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // required
});

// Optional: tweak the default model here
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// --- health check ---
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: MODEL, time: new Date().toISOString() });
});

// --- main chat endpoint ---
// body: { prompt: string, car?: { make, model, year } }
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt, car } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing "prompt" string.' });
    }

    // Build system guidance for Carspire
    const instructions = [
      'You are Carspire, a friendly automotive AI.',
      'Be concise, actionable, and safe. If a procedure affects safety, call it out.',
      'When specs vary by trim/engine/market, say what to check in the owner’s manual.',
      'If asked for oil/fluids: remind to use the exact viscosity/spec in the manual (e.g., 0W-20 API SP).',
      'If asked about brakes: mention pad thickness, rotor condition, and that vibration under braking can indicate rotor runout.',
      'If asked about EVs: mention preconditioning for fast charging and keeping SOC roughly 10–80% for longevity.',
    ];
    const carLine = car && (car.make || car.model || car.year)
      ? `Vehicle context: ${[car.year, car.make, car.model].filter(Boolean).join(' ')}.`
      : '';

    // Responses API call
    // Docs: client.responses.create({ model, instructions, input }) → output_text
    // (Official OpenAI Node SDK sample demonstrates this pattern.)  // :contentReference[oaicite:1]{index=1}
    const ai = await client.responses.create({
      model: MODEL,
      instructions: [instructions.join(' '), carLine].filter(Boolean).join(' '),
      input: [
        {
          role: 'user',
          content: prompt
        }
      ],
      // temperature: 0.4, // optional tuning
      // max_output_tokens: 500, // optional limit
    });

    const reply = ai.output_text ?? 'Sorry, I could not generate a reply.';
    return res.json({ reply });
  } catch (err) {
    // Normalize error
    console.error('Chat error:', err?.response?.data || err?.message || err);
    const status = err?.status || err?.response?.status || 500;
    return res.status(status).json({
      error: 'AI_REQUEST_FAILED',
      status,
      detail: err?.response?.data || err?.message || 'Unknown error'
    });
  }
});

// --- not found ---
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// --- start ---
app.listen(port, () => {
  console.log(`Carspire API running on http://localhost:${port}`);
});
