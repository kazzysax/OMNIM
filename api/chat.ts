import { getSnapshot, ranked, Stats } from './_lib/market';

const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b';
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

const SYSTEM = `You are OMNIM AI, the market analyst inside the OMNIM wallet app. Users can trade tokenised stocks, gold, currencies and crypto in OMNIM.

Rules:
- Use ONLY the DATA block below for any price, return, volatility, drawdown or ranking. It is computed from public daily price history (Yahoo Finance, CoinGecko). Never invent numbers, news, earnings, or forecasts. If something is not in the data (an asset, a news event, a fundamental), say you don't have it.
- You may add well-established general knowledge (what a company does, what volatility or drawdown mean, diversification, position sizing) but label it as general knowledge.
- Give a clear view when asked, framed as an assessment of past data, not a prediction. Always include the main risks (volatility, drawdown, concentration, that past performance does not predict the future). Never promise returns or say "guaranteed".
- Tokenised stocks (symbols ending "on", plus AAPLB) track the underlying US stock but are on-chain tokens: mention that liquidity and spreads can differ from the real market and that some are not available to US persons, when relevant.
- The SCORE ranks 90-day return per unit of volatility, adjusted for trend and deep drawdowns. It is a screen, not a buy signal.
- Be concise: short paragraphs or a compact list, no more than ~220 words unless the user asks for depth. End advice answers with one short line: "Not financial advice."
- Reply in the user's language.`;

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
  let asOf = '';
  try {
    const snap = await getSnapshot();
    const order = ranked(snap.data);
    const rest = snap.data.filter((s) => s.score === null);
    data = table([...order, ...rest]);
    asOf = new Date(snap.at).toISOString();
    if (snap.failed.length) data += `\nNO DATA AVAILABLE FOR: ${snap.failed.join(', ')}`;
  } catch {
    data = 'NO MARKET DATA COULD BE LOADED RIGHT NOW. Say so and do not quote any figures.';
  }

  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://omnim-io.vercel.app',
        'X-Title': 'OMNIM AI',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        temperature: 0.3,
        reasoning: { effort: 'low' },
        messages: [
          { role: 'system', content: `${SYSTEM}\n\nDATA (ranked by score, snapshot ${asOf}):\n${data}` },
          ...messages,
        ],
      }),
    });
    if (!r.ok) return res.status(502).json({ error: 'The AI service is busy. Try again in a moment.' });
    const json: any = await r.json();
    const reply = json?.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ error: 'No answer came back. Try again.' });
    return res.status(200).json({ reply, dataAsOf: asOf });
  } catch {
    return res.status(502).json({ error: 'The AI service is unreachable. Try again shortly.' });
  }
}
