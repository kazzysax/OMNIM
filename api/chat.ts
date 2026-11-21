import { getSnapshot, ranked, type Stats } from './_lib/market.js';

const MODELS = [process.env.OPENROUTER_MODEL, 'openai/gpt-oss-120b', 'deepseek/deepseek-v4-flash', 'google/gemini-2.5-flash-lite'].filter(Boolean) as string[];
const MAX_MESSAGES = 10;
const MAX_CHARS = 1000;

// Light per-instance rate limit: 20 requests / 10 min / IP.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 600000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 20;
}

const pct = (v: number | null) => (v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`);

function table(rows: Stats[]) {
  return rows
    .map(
      (s) =>
        `${s.symbol} (${s.name}, ${s.kind}) price $${s.price} | 7d ${pct(s.ret7d)} | 30d ${pct(s.ret30d)} | 90d ${pct(s.ret90d)} | 1y ${pct(s.ret1y)} | vol ${pct(s.volAnn)} | maxDD ${pct(s.maxDrawdown1y)} | vs 52w high ${pct(s.pctFrom52wHigh)} | trend ${s.trend} | score ${s.score ?? 'n/a'} | src ${s.source} ${s.asOf}`
    )
    .join('\n');
}

const SYSTEM = `You are OMNIM AI, a friendly market buddy inside the OMNIM wallet app, where people trade tokenised stocks, gold, currencies and crypto.

How you talk:
- Talk like a sharp, warm friend who knows markets, in natural conversational language. Short sentences. No report-style headings, no bold titles, no long bullet lists. Use a short list only if the user asks to compare several things.
- Answer the actual question first, then explain why in a sentence or two using the numbers. Keep most replies to 2 to 5 short sentences (under ~120 words) unless asked for more.
- Match the user's tone and language. Casual greetings get a casual reply.

Giving a view:
- When someone asks what to do, give a clear lean in plain words: e.g. "I'd wait", "I'd hold", "looks reasonable to start small", "I'd take some profit", "I'd stay away for now". Back it with the data: trend, recent returns, volatility, drawdown, distance from the 52-week high.
- Practical framing helps: starting small, buying in pieces over time instead of all at once, not putting too much in one asset, setting a level where they'd cut losses. Keep it brief.
- Mention the one or two risks that matter most, naturally, not as a disclaimer wall. Never promise returns, never say "guaranteed", never predict exact prices.
- Tokenised stocks (symbols ending "on", plus AAPLB) track the real stock but trade on-chain; mention liquidity/spread differences only when it matters.

Facts:
- Use ONLY the DATA block for any price, return, volatility, drawdown, trend or ranking. It comes from public daily price history (Yahoo Finance, CoinGecko). Never invent numbers, news, earnings or events. If you don't have something, say so casually.
- The score ranks 90-day return per unit of volatility with trend and drawdown adjustments. It's a screen, not a buy signal.

Always finish any reply that contains a view or suggestion with a new line that says exactly: NFA`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(503).json({ error: 'OMNIM AI is not configured yet (missing OPENROUTER_API_KEY).' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (limited(ip)) return res.status(429).json({ error: 'Too many questions. Please wait a few minutes.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const messages = incoming
    .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MESSAGES)
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'Send a user message.' });
  }

  let data = '';
  let top: Stats[] = [];
  let asOf = '';
  try {
    const snap = await getSnapshot();
    const order = ranked(snap.data);
    top = order;
    const rest = snap.data.filter((s) => s.score === null);
    data = table([...order, ...rest]);
    asOf = new Date(snap.at).toISOString();
    if (snap.failed.length) data += `\nNO DATA AVAILABLE FOR: ${snap.failed.join(', ')}`;
  } catch {
    data = 'NO MARKET DATA COULD BE LOADED RIGHT NOW. Say so and do not quote any figures.';
  }

  const system = `${SYSTEM}\n\nDATA (ranked by score, snapshot ${asOf}):\n${data}`;
  // Try each model in turn (one retry on the first) so a single provider hiccup never kills the chat.
  for (const [idx, model] of MODELS.entries()) {
    for (let attempt = 0; attempt < (idx === 0 ? 2 : 1); attempt++) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          signal: ctrl.signal,
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://omnim-io.vercel.app',
            'X-Title': 'OMNIM AI',
          },
          body: JSON.stringify({
            model,
            max_tokens: 1500,
            temperature: 0.6,
            ...(idx === 0 ? { reasoning: { effort: 'low' } } : {}),
            messages: [{ role: 'system', content: system }, ...messages],
          }),
        }).finally(() => clearTimeout(timer));
        if (!r.ok) continue;
        const json: any = await r.json();
        const reply = json?.choices?.[0]?.message?.content?.trim();
        if (reply) return res.status(200).json({ reply, dataAsOf: asOf });
      } catch {
        /* try again / next model */
      }
    }
  }

  // Every model failed: still be useful with a plain data summary.
  if (top.length > 0) {
    const lines = top.slice(0, 5).map((s) => `• **${s.symbol}** (${s.name}): 90d ${pct(s.ret90d)}, volatility ${pct(s.volAnn)}, worst drop ${pct(s.maxDrawdown1y)}, trend ${s.trend}`);
    return res.status(200).json({
      reply: `The AI is busy right now, so here is the raw data instead. Strongest recent risk-adjusted momentum:\n${lines.join('\n')}\n\nThis is a screen of past data, not a signal.\nNFA`,
      dataAsOf: asOf,
      degraded: true,
    });
  }
  return res.status(502).json({ error: 'The AI service is busy. Please try again in a moment.' });
}
