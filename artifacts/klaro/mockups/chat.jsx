const { useState: uS, useEffect: uE, useRef: uR, useMemo: uM } = React;

// ————————————————————————————————————————
// Markdown-lite renderer for bot messages (bold **x**, italic _x_, lists)
// ————————————————————————————————————————
function renderRich(text) {
  const lines = text.split("\n");
  const parse = (s) => {
    const out = [];
    let i = 0, buf = "";
    const push = (el) => { if (buf) { out.push(buf); buf = ""; } out.push(el); };
    while (i < s.length) {
      if (s[i] === "*" && s[i+1] === "*") {
        const end = s.indexOf("**", i+2);
        if (end > -1) { push(<strong key={i} className="text-white font-semibold">{s.slice(i+2, end)}</strong>); i = end+2; continue; }
      }
      if (s[i] === "_") {
        const end = s.indexOf("_", i+1);
        if (end > -1) { push(<em key={i} className="text-white/90 italic">{s.slice(i+1, end)}</em>); i = end+1; continue; }
      }
      buf += s[i]; i++;
    }
    if (buf) out.push(buf);
    return out;
  };
  return lines.map((ln, i) => {
    if (!ln.trim()) return <div key={i} className="h-1.5"/>;
    if (/^[•\-]\s/.test(ln)) {
      return <div key={i} className="flex gap-2 pl-1"><span className="text-[var(--accent)] mt-[2px]">•</span><span>{parse(ln.replace(/^[•\-]\s/, ""))}</span></div>;
    }
    if (/^\d+\.\s/.test(ln)) {
      const [, num, rest] = ln.match(/^(\d+)\.\s(.*)$/);
      return <div key={i} className="flex gap-2 pl-1"><span className="text-[var(--muted)] w-4 tnum">{num}.</span><span>{parse(rest)}</span></div>;
    }
    return <div key={i}>{parse(ln)}</div>;
  });
}

function ChatPanel({ onClose, layout = "split" }) {
  const [messages, setMessages] = uS([]);
  const [input, setInput] = uS("");
  const [loading, setLoading] = uS(false);
  const [focused, setFocused] = uS(false);
  const bottomRef = uR(null);
  const inputRef = uR(null);

  uE(() => {
    bottomRef.current?.scrollTo({ top: bottomRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function send(textOverride) {
    const msg = (textOverride ?? input).trim();
    if (!msg || loading) return;
    const next = [...messages, { role: "user", content: msg }];
    setMessages(next);
    setInput("");
    setLoading(true);
    // Mock API latency + keyword reply
    setTimeout(() => {
      const match = REPLIES.find(r => r.match.test(msg));
      const reply = match ? match.reply : DEFAULT_REPLY;
      setMessages([...next, { role: "assistant", content: reply }]);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 40);
    }, 700 + Math.random() * 500);
  }

  const isEmpty = messages.length === 0;

  return (
    <div className={`glass-strong h-full flex flex-col overflow-hidden relative
      ${layout === "split" ? "rounded-2xl" : "rounded-none"}`}>
      {/* brand glow */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-60 h-60 rounded-full bg-[rgba(124,92,255,0.22)] blur-3xl"/>

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] relative">
        <div className="relative">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8a6bff] to-[#5b8cff] grid place-items-center">
            <Icon name="sparkles" size={16} className="text-white"/>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--income)] border-2 border-[#15151a]"/>
        </div>
        <div className="leading-tight flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold text-white flex items-center gap-1.5">
            Klaro IA
            <span className="text-[9px] font-bold tracking-wider px-1.5 py-[1px] rounded bg-[var(--accent-soft)] text-[#a18bff] border border-[rgba(124,92,255,0.3)]">IA</span>
          </div>
          <div className="text-[11px] text-[var(--muted)]">Conectado às suas transações em tempo real</div>
        </div>
        <button className="w-8 h-8 grid place-items-center rounded-lg hover:bg-white/5 text-[var(--muted)] hover:text-white transition-colors" title="Histórico">
          <Icon name="history" size={15}/>
        </button>
        <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-white/5 text-[var(--muted)] hover:text-white transition-colors" title="Fechar">
          <Icon name="x" size={15}/>
        </button>
      </div>

      {/* Messages */}
      <div ref={bottomRef} className="flex-1 overflow-y-auto klaro-scroll px-5 py-5 space-y-3.5 relative">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-5 pb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[rgba(124,92,255,0.3)] to-[rgba(91,140,255,0.15)] border border-[var(--border-2)] grid place-items-center">
              <Icon name="sparkles" size={22} className="text-[#a18bff]"/>
            </div>
            <div>
              <div className="text-[15px] font-semibold text-white">Pergunte qualquer coisa</div>
              <div className="text-[12px] text-[var(--muted)] max-w-[260px] leading-relaxed mt-1">
                Seu assistente entende suas transações, categorias e tendências.
              </div>
            </div>
            <div className="w-full space-y-1.5 max-w-xs">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]/70 font-semibold text-left pl-1">Sugestões</div>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s)}
                  className="pill w-full text-left px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.015)] text-[12.5px] text-[var(--muted)] flex items-center gap-2">
                  <Icon name="corner-down-right" size={12} className="text-[var(--accent)] opacity-70"/>
                  <span className="flex-1">{s}</span>
                  <Icon name="arrow-up-right" size={12} className="opacity-0 group-hover:opacity-100"/>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <Bubble key={i} msg={m}/>
            ))}
            {loading && <TypingBubble/>}
          </>
        )}
      </div>

      {/* Suggestion chips when not empty */}
      {!isEmpty && !loading && (
        <div className="px-5 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
          {SUGGESTIONS.slice(0,3).map((s, i) => (
            <button key={i} onClick={() => send(s)}
              className="pill shrink-0 text-[11px] px-2.5 py-1.5 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.02)] text-[var(--muted)] hover:text-white">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pt-2 pb-4 border-t border-[var(--border)]">
        <form onSubmit={(e) => { e.preventDefault(); send(); }}
              className={`chat-input flex items-end gap-2 px-3 py-2 rounded-2xl border bg-[rgba(255,255,255,0.02)] transition-all
                ${focused ? "border-[var(--accent)] shadow-[0_0_0_3px_rgba(124,92,255,0.15)]" : "border-[var(--border)]"}`}>
          <button type="button" title="Anexar" className="w-8 h-8 grid place-items-center rounded-lg text-[var(--muted)] hover:text-white hover:bg-white/5">
            <Icon name="paperclip" size={14}/>
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder="Pergunte algo sobre suas finanças…"
            className="flex-1 bg-transparent outline-none text-[13px] text-white placeholder:text-[var(--muted)] resize-none py-1.5 max-h-32"
            style={{ lineHeight: 1.5 }}
          />
          <button type="button" title="Voz" className="w-8 h-8 grid place-items-center rounded-lg text-[var(--muted)] hover:text-white hover:bg-white/5">
            <Icon name="mic" size={14}/>
          </button>
          <button type="submit" disabled={!input.trim() || loading}
            className={`w-9 h-9 grid place-items-center rounded-xl transition-all
              ${input.trim() && !loading
                ? "btn-primary text-white"
                : "bg-white/5 text-[var(--muted)] cursor-not-allowed"}`}>
            {loading ? <Icon name="loader" size={14} className="animate-spin"/> : <Icon name="send" size={14}/>}
          </button>
        </form>
        <div className="text-[10.5px] text-[var(--muted)] text-center mt-2 flex items-center justify-center gap-1.5">
          <Icon name="shield-check" size={10}/>
          Suas transações são privadas · respostas podem conter imprecisões
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`fadeUp flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#8a6bff] to-[#5b8cff] grid place-items-center shrink-0 mt-0.5">
          <Icon name="sparkles" size={12} className="text-white"/>
        </div>
      )}
      <div className={`max-w-[78%] px-3.5 py-2.5 text-[12.5px] leading-relaxed
        ${isUser
          ? "bg-gradient-to-br from-[#7c5cff] to-[#6a4fe8] text-white bubble-user shadow-[0_8px_24px_-12px_rgba(124,92,255,0.6)]"
          : "bg-[rgba(255,255,255,0.04)] border border-[var(--border)] text-white/90 bubble-bot"}`}>
        <div className="space-y-0.5">{renderRich(msg.content)}</div>
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-white/5 border border-[var(--border)] grid place-items-center shrink-0 mt-0.5 text-[var(--muted)]">
          <Icon name="user" size={12}/>
        </div>
      )}
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="fadeUp flex gap-2.5 justify-start">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#8a6bff] to-[#5b8cff] grid place-items-center shrink-0 mt-0.5">
        <Icon name="sparkles" size={12} className="text-white"/>
      </div>
      <div className="px-4 py-3 bg-[rgba(255,255,255,0.04)] border border-[var(--border)] bubble-bot">
        <span className="dot"/><span className="dot"/><span className="dot"/>
      </div>
    </div>
  );
}

Object.assign(window, { ChatPanel });
