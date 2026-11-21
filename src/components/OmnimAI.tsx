import { useEffect, useRef, useState } from 'react';
import { Send, X, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

interface RankedItem {
  symbol: string;
  name: string;
  ret90d: number | null;
  volAnn: number | null;
  trend: string;
  score: number | null;
}

const SUGGESTIONS = [
  'Which stock looks strongest right now?',
  'Compare NVIDIA and Tesla',
  'Is gold a good hedge at the moment?',
  'What are the biggest risks in my portfolio style?',
];

const pct = (v: number | null) => (v === null ? '–' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`);

/** Renders **bold** and line breaks from the model without pulling in a markdown library. */
function renderText(text: string) {
  return text.split('\n').map((line, i) => (
    <p key={i} className={line.trim() === '' ? 'h-2' : 'mb-1'}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={j} className="text-white font-semibold">{part.slice(2, -2)}</strong>
        ) : (
          <span key={j}>{part.replace(/^\s*[-•]\s+/, '• ')}</span>
        )
      )}
    </p>
  ));
}

export default function OmnimAI() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ranking, setRanking] = useState<RankedItem[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || ranking.length > 0) return;
    fetch('/api/market')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.ranking && setRanking(d.ranking))
      .catch(() => {});
  }, [open, ranking.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy, open]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reply) throw new Error(data.error || 'Something went wrong. Try again.');
      setMessages([...next, { role: 'assistant', content: data.reply }]);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const top = ranking.slice(0, 3);
  const bottom = ranking.length > 3 ? ranking.slice(-2) : [];

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open OMNIM AI"
          className="fixed bottom-24 right-4 z-40 flex items-center gap-2 pl-3 pr-4 h-12 rounded-full bg-gradient-to-br from-omnim-goldLight to-omnim-goldDark text-black font-bold text-sm shadow-glow-gold active:scale-95 transition-transform"
        >
          <Sparkles size={18} />
          AI
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={() => setOpen(false)}>
          <div
            className="mx-auto w-full max-w-md h-[85vh] flex flex-col bg-omnim-bg border border-omnim-border rounded-t-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-omnim-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-omnim-goldLight to-omnim-goldDark flex items-center justify-center">
                  <Sparkles size={16} className="text-black" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white leading-tight">OMNIM AI</div>
                  <div className="text-[10px] text-omnim-muted leading-tight">Analysis from public price history</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="p-2 text-omnim-muted">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <>
                  <p className="text-sm text-omnim-muted">
                    Ask about stocks, gold or crypto listed in OMNIM. Answers use real daily price history (Yahoo Finance, CoinGecko), not guesses.
                  </p>

                  {top.length > 0 && (
                    <div className="bg-omnim-card border border-omnim-border rounded-2xl p-3">
                      <div className="text-[11px] uppercase tracking-wide text-omnim-muted mb-2">Strongest recent risk-adjusted momentum</div>
                      {top.map((r) => (
                        <button
                          key={r.symbol}
                          onClick={() => send(`Analyse ${r.symbol} for me`)}
                          className="w-full flex items-center justify-between py-1.5 text-left"
                        >
                          <span className="flex items-center gap-2 text-sm text-white font-semibold">
                            <TrendingUp size={14} className="text-emerald-400" />
                            {r.symbol}
                            <span className="text-xs text-omnim-muted font-normal">{r.name}</span>
                          </span>
                          <span className="text-xs text-emerald-400">{pct(r.ret90d)} 90d</span>
                        </button>
                      ))}
                      {bottom.length > 0 && (
                        <>
                          <div className="text-[11px] uppercase tracking-wide text-omnim-muted mt-2 mb-1">Weakest</div>
                          {bottom.map((r) => (
                            <button
                              key={r.symbol}
                              onClick={() => send(`Analyse ${r.symbol} for me`)}
                              className="w-full flex items-center justify-between py-1.5 text-left"
                            >
                              <span className="flex items-center gap-2 text-sm text-white font-semibold">
                                <TrendingDown size={14} className="text-rose-400" />
                                {r.symbol}
                                <span className="text-xs text-omnim-muted font-normal">{r.name}</span>
                              </span>
                              <span className="text-xs text-rose-400">{pct(r.ret90d)} 90d</span>
                            </button>
                          ))}
                        </>
                      )}
                      <div className="text-[10px] text-omnim-muted mt-2">A screen of past data, not a buy or sell signal.</div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="text-xs text-omnim-text bg-omnim-card border border-omnim-border rounded-full px-3 py-2"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[85%] rounded-2xl rounded-br-md bg-omnim-gold text-black px-3 py-2 text-sm'
                        : 'max-w-[92%] rounded-2xl rounded-bl-md bg-omnim-card border border-omnim-border text-omnim-text px-3 py-2 text-sm leading-relaxed'
                    }
                  >
                    {m.role === 'user' ? m.content : renderText(m.content)}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-omnim-card border border-omnim-border px-3 py-2 text-sm text-omnim-muted animate-pulse">
                    Analysing the data…
                  </div>
                </div>
              )}
              {error && <div className="text-xs text-rose-400 bg-rose-500/10 rounded-xl px-3 py-2">{error}</div>}
              <div ref={endRef} />
            </div>

            <div className="border-t border-omnim-border px-3 pt-2 pb-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={500}
                  placeholder="Ask about a stock, gold or crypto…"
                  className="flex-1 bg-omnim-card border border-omnim-border rounded-full px-4 py-3 text-sm text-white placeholder:text-omnim-muted outline-none focus:border-omnim-gold"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                  className="w-11 h-11 rounded-full bg-omnim-gold text-black flex items-center justify-center disabled:opacity-40"
                >
                  <Send size={18} />
                </button>
              </form>
              <div className="text-[10px] text-omnim-muted text-center mt-2">
                Not financial advice. Past performance doesn't predict future results.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
