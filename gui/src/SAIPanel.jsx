import React, { useState, useRef, useEffect } from "react";

const SAI_WELCOME = `Hi, I'm SAI — your SAION vocal coach and guide. Ask me about dials, ARLNS notation, FX controls, or anything else in the app.`;

const TAB_TIPS = {
  PERFORMANCE: [
    "The Emotion dial blends across presets — it's not just a selector, it shapes the full character.",
    "Micro-trim lets you nudge a preset without leaving it. Great for fine-tuning a vibe mid-session.",
    "Version A and B save complete dial snapshots. Use them to A/B test emotional or sonic choices.",
  ],
  CONTROLS: [
    "Reverb above 60% gets washy fast. Keep it under 40% for intimate, close-mic sound.",
    "EQ is relative — 50% is neutral on all three bands. No cut, no boost.",
    "FX Macro presets are a starting point. You can still adjust individual sliders after loading one.",
  ],
  GENERATE: [
    "The prompt builder reads your current dials automatically — set them before generating.",
    "Add a personal note in the General Prompt field. It appends to the end of the built prompt.",
    "Try the same prompt on different generators to compare how each one interprets it.",
  ],
  VISUALIZE: [
    "Chaos sensitivity controls how strongly the orb reacts to audio energy spikes.",
    "Reform speed sets how fast the orb returns to its resting shape after a spike.",
    "Texture presets change the surface image on the globe — scroll the rail to browse.",
  ],
};

function getTip(tab, index) {
  const tips = TAB_TIPS[tab] || TAB_TIPS.PERFORMANCE;
  return tips[index % tips.length];
}

export default function SAIPanel({ open, onClose, activeTab }) {
  const [messages, setMessages] = useState([{ role: "sai", content: SAI_WELCOME }]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  // null = default bottom-right anchor; {x, y} = dragged position from top-left
  const [dragPos, setDragPos] = useState(null);
  const dragState = useRef(null);
  const widgetRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    setTipIndex((i) => i + 1);
  }, [activeTab]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isTyping) return;

    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setIsTyping(true);

    // Build history for the API (exclude the welcome message)
    const history = next.slice(1, -1).map((m) => ({
      role: m.role === "sai" ? "assistant" : "user",
      content: m.content,
    }));

    try {
      const res = await fetch("/api/sai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "sai", content: data.reply || data.error || "Something went wrong." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "sai", content: "Can't reach SAI right now. Check that the backend is running." },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ── Drag-to-reposition (mouse + touch) ───────────────────────────────────
  function startDrag(clientX, clientY) {
    const rect = widgetRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragState.current = { startX: clientX, startY: clientY, origX: rect.left, origY: rect.top };
  }

  useEffect(() => {
    const onMove = (clientX, clientY) => {
      if (!dragState.current) return;
      const { startX, startY, origX, origY } = dragState.current;
      const x = Math.max(0, Math.min(window.innerWidth - 370, origX + (clientX - startX)));
      const y = Math.max(0, Math.min(window.innerHeight - 80, origY + (clientY - startY)));
      setDragPos({ x, y });
    };
    const onMouseMove = (e) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e) => onMove(e.touches[0].clientX, e.touches[0].clientY);
    const onUp = () => { dragState.current = null; };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []); // setDragPos is stable, dragState is a ref — safe

  const currentTip = getTip(activeTab, tipIndex);

  // Build inline position style only when user has dragged
  const posStyle = dragPos
    ? { position: "fixed", left: dragPos.x, top: dragPos.y, bottom: "auto", right: "auto" }
    : {};

  return (
    <div className="sai-widget" ref={widgetRef} style={posStyle}>
      <div className={`sai-window ${open ? "is-open" : ""}`} role="dialog" aria-label="SAI vocal coach">

        {/* Header — drag handle */}
        <div
          className="sai-header"
          onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
          onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
        >
          <div className="sai-header-identity">
            <span className="sai-avatar">S</span>
            <div>
              <div className="sai-header-title">SAI</div>
              <div className="sai-header-status">
                <span className="sai-status-dot" />
                Vocal Coach &amp; Guide
              </div>
            </div>
          </div>
          <button type="button" className="sai-minimize" onClick={onClose} aria-label="Close SAI">
            &#8722;
          </button>
        </div>

        {/* Tip banner */}
        <div className="sai-tip-banner">
          <span className="sai-tip-tab">{activeTab}</span>
          <span className="sai-tip-text">{currentTip}</span>
          <button
            type="button"
            className="sai-tip-next"
            onClick={() => setTipIndex((i) => i + 1)}
            aria-label="Next tip"
          >
            next →
          </button>
        </div>

        {/* Messages */}
        <div className="sai-messages" role="log" aria-live="polite">
          {messages.map((msg, i) => (
            <div key={i} className={`sai-msg sai-msg--${msg.role}`}>
              {msg.role === "sai" && <span className="sai-msg-avatar">S</span>}
              <div className="sai-msg-bubble">{msg.content}</div>
            </div>
          ))}
          {isTyping && (
            <div className="sai-msg sai-msg--sai">
              <span className="sai-msg-avatar">S</span>
              <div className="sai-msg-bubble sai-typing">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* SAION quick ref */}
        <details className="sai-ref">
          <summary>SAION Quick Reference</summary>
          <ul>
            <li><code>{"^^...^^"}</code> soft span</li>
            <li><code>{"{b}"}</code> quick breath &nbsp; <code>{"{B}"}</code> phrase reset</li>
            <li><code>{"~>"}</code> elongate &nbsp; <code>{">>"}</code> compress</li>
            <li><code>{"<"}</code> soften &nbsp; <code>{">"}  </code> push</li>
            <li><code>{"\\"}</code> fall cadence &nbsp; <code>{"/~"}</code> rise with trail</li>
            <li><code>T:raspy</code> / <code>T:airy</code> / <code>T:warm</code> — texture</li>
            <li><code>R:q</code> / <code>R:h</code> / <code>R:w</code> — quarter / half / whole rest</li>
          </ul>
        </details>

        {/* Input */}
        <div className="sai-input-row">
          <input
            ref={inputRef}
            type="text"
            className="sai-input"
            placeholder="Ask about a dial, notation, or workflow…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={isTyping}
            aria-label="Message SAI"
          />
          <button
            type="button"
            className="sai-send"
            onClick={sendMessage}
            disabled={!input.trim() || isTyping}
            aria-label="Send"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <p className="sai-boundary">SAI provides guidance only — it does not control the app.</p>
      </div>
    </div>
  );
}
