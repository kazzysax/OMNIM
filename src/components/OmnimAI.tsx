import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { ArrowUp, X, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';

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
      {line.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, j) =>
        part.startsWith('*') && !part.startsWith('**') && part.endsWith('*') && part.length > 2 ? (
          <em key={j} className="text-slate-400 not-italic text-xs">{part.slice(1, -1)}</em>
        ) : part.startsWith('**') && part.endsWith('**') ? (
          <strong key={j} className="text-slate-900 font-semibold">{part.slice(2, -2)}</strong>
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

  // Draggable launcher: position persists, a tap (no movement) opens the chat.
  const SIZE = { w: 58, h: 58 };
  const clamp = (x: number, y: number) => ({
    x: Math.min(Math.max(8, x), window.innerWidth - SIZE.w - 8),
    y: Math.min(Math.max(8, y), window.innerHeight - SIZE.h - 8),
  });
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('omnim_ai_pos') || 'null');
      if (saved && typeof saved.x === 'number') return clamp(saved.x, saved.y);
    } catch { /* ignore */ }
    return clamp(window.innerWidth - SIZE.w - 16, window.innerHeight - 170);
  });
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);

  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p.x, p.y));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onDown = (e: RPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, sx: e.clientX, sy: e.clientY, moved: false };
  };
  const onMove = (e: RPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 6) d.moved = true;
    if (d.moved) setPos(clamp(e.clientX - d.dx, e.clientY - d.dy));
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      // Snap to the nearest side edge so it never sits over content.
      setPos((p) => {
        const snapped = clamp(p.x + SIZE.w / 2 < window.innerWidth / 2 ? 12 : window.innerWidth - SIZE.w - 12, p.y);
        try { localStorage.setItem('omnim_ai_pos', JSON.stringify(snapped)); } catch { /* ignore */ }
        return snapped;
      });
    } else {
      setOpen(true);
    }
  };

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

  const Avatar = ({ size = 32 }: { size?: number }) => (
    <img
      src="/omnim-logo.png"
      alt="OMNIM"
      style={{ width: size, height: size }}
      className="rounded-full object-cover bg-black ring-1 ring-black/5 shrink-0"
      draggable={false}
    />
  );

  const RankRow = ({ r, up }: { r: RankedItem; up: boolean }) => (
    <button
      onClick={() => send(`Analyse ${r.symbol} for me`)}
      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors text-left"
    >
      <span className="flex items-center gap-2.5 min-w-0">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${up ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
          {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900 leading-tight">{r.symbol}</span>
          <span className="block text-[11px] text-slate-500 truncate leading-tight">{r.name}</span>
        </span>
      </span>
      <span className={`text-sm font-semibold tabular-nums ${up ? 'text-emerald-600' : 'text-rose-500'}`}>
        {pct(r.ret90d)}
        <span className="text-[10px] font-normal text-slate-400 ml-1">90d</span>
      </span>
    </button>
  );

  return (
    <>
      {!open && (
        <button
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => (drag.current = null)}
          aria-label="Open OMNIM AI (drag to move)"
          style={{ left: pos.x, top: pos.y, width: SIZE.w, height: SIZE.h, touchAction: 'none' }}
          className="fixed z-40 rounded-full bg-black p-[3px] shadow-[0_8px_24px_-6px_rgba(0,0,0,0.45)] ring-2 ring-omnim-gold/70 select-none cursor-grab active:cursor-grabbing active:scale-95 transition-transform"
        >
          <img src="/omnim-logo.png" alt="" draggable={false} className="w-full h-full rounded-full object-cover pointer-events-none" />
          <span className="absolute -top-1.5 -right-1.5 w-[26px] h-[26px] rounded-full bg-gradient-to-br from-omnim-goldLight to-omnim-goldDark flex items-center justify-center ring-2 ring-white">
            <span className="omnim-eyes flex items-center gap-[4px] mt-[1px]">
              {[0, 1].map((k) => (
                <span key={k} className="omnim-eye relative block w-[6px] h-[8px] rounded-[45%] bg-black">
                  <span className="absolute top-[1px] right-[1px] w-[2px] h-[2px] rounded-full bg-white" />
                </span>
              ))}
            </span>
          </span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setOpen(false)}>
          <div
            className="mx-auto w-full max-w-md h-[88vh] flex flex-col bg-white rounded-t-[28px] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2.5">
              <span className="w-10 h-1 rounded-full bg-slate-200" />
            </div>

            <div className="flex items-center justify-between px-5 pt-3 pb-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar size={40} />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                </div>
                <div>
                  <div className="text-[15px] font-bold text-slate-900 leading-tight">OMNIM AI</div>
                  <div className="text-[11px] text-slate-500 leading-tight">Market analyst · live price history</div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 bg-slate-50/60 border-t border-slate-100">
              {messages.length === 0 && (
                <div className="pt-4 space-y-4">
                  <div className="flex gap-2.5">
                    <Avatar size={28} />
                    <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm text-slate-700 leading-relaxed">
                      Hi! Ask me about any stock, gold or crypto in OMNIM. I answer from real daily price history (Yahoo Finance, CoinGecko), not guesses.
                    </div>
                  </div>

                  {top.length > 0 && (
                    <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-2">
                      <div className="flex items-center justify-between px-3 pt-2 pb-1">
                        <span className="text-xs font-semibold text-slate-900">Market pulse</span>
                        <span className="text-[10px] text-slate-400">risk-adjusted momentum</span>
                      </div>
                      <div className="px-3 pt-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Strongest</div>
                      {top.map((r) => <RankRow key={r.symbol} r={r} up />)}
                      {bottom.length > 0 && (
                        <>
                          <div className="mx-3 my-1 border-t border-slate-100" />
                          <div className="px-3 pt-1 text-[10px] font-semibold uppercase tracking-wider text-rose-500">Weakest</div>
                          {bottom.map((r) => <RankRow key={r.symbol} r={r} up={false} />)}
                        </>
                      )}
                      <div className="px-3 pt-1 pb-2 text-[10px] text-slate-400">Tap an asset for a full analysis. A screen of past data, not a buy or sell signal.</div>
                    </div>
                  )}

                  <div>
                    <div className="text-[11px] font-medium text-slate-400 px-1 mb-2">Try asking</div>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => send(q)}
                          className="text-[13px] text-slate-700 bg-white border border-slate-200 rounded-full px-3.5 py-2 hover:border-omnim-gold hover:text-slate-900 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {messages.length > 0 && <div className="h-1" />}
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[82%] rounded-2xl rounded-br-md bg-slate-900 text-white px-3.5 py-2.5 text-sm leading-relaxed">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex gap-2.5">
                    <Avatar size={28} />
                    <div className="max-w-[86%] bg-white border border-slate-100 shadow-sm rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm text-slate-700 leading-relaxed">
                      {renderText(m.content)}
                    </div>
                  </div>
                )
              )}

              {busy && (
                <div className="flex gap-2.5">
                  <Avatar size={28} />
                  <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                  </div>
                </div>
              )}
              {error && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</div>}
              <div ref={endRef} />
            </div>

            <div className="bg-white border-t border-slate-100 px-4 pt-3 pb-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex items-center gap-2 bg-slate-100 rounded-full pl-4 pr-1.5 py-1.5 focus-within:ring-2 focus-within:ring-omnim-gold/50 transition"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={500}
                  placeholder="Ask about a stock, gold or crypto…"
                  className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none py-1.5"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                  className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center disabled:bg-slate-300 transition-colors"
                >
                  <ArrowUp size={18} />
                </button>
              </form>
              <div className="text-[10px] text-slate-400 text-center mt-2">
                Not financial advice. Past performance doesn't predict future results.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
