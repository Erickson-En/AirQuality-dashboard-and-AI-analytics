// src/components/AIChatbot.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../config/api';
import './AIChatbot.css';

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatTime = (d) =>
  new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Very lightweight markdown-like renderer (bold, bullets, line-breaks) */
function renderText(text) {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    // Bold **text**
    const parts = line.split(/\*\*(.*?)\*\*/g).map((s, j) =>
      j % 2 === 1 ? <strong key={j}>{s}</strong> : s
    );
    // Bullet lines
    const isBullet = line.startsWith('• ') || line.startsWith('- ');
    if (isBullet) {
      return (
        <div key={i} className="msg-bullet">
          <span className="msg-bullet-dot">•</span>
          <span>{parts.map((p, j) => (typeof p === 'string' ? p.replace(/^[•\-] /, '') : p))}</span>
        </div>
      );
    }
    return <div key={i} className={line === '' ? 'msg-spacer' : 'msg-line'}>{parts}</div>;
  });
}

// Suggested follow-ups per response category
const FOLLOW_UPS = {
  current:     ['Show PM2.5 breakdown', 'Is it safe to exercise?', 'Trend over 24h'],
  health:      ['Safe to run outside?', 'Any alerts today?', 'Compare with yesterday'],
  trend:       ['Show forecast', 'What caused the change?', 'Health recommendations'],
  forecast:    ['Should I open windows?', 'Best time to go outside today?'],
  anomaly:     ['Which sensor is affected?', 'Show current readings'],
  default:     ['Current air quality', 'Health tips', 'Pollution forecast', '24h trend'],
};

const QUICK_ACTIONS = [
  { icon: '📊', label: 'Live Status',       query: 'What is the current air quality status?',           category: 'current' },
  { icon: '🏃', label: 'Exercise Safety',   query: 'Is it safe to exercise outside right now?',         category: 'health' },
  { icon: '📈', label: '24h Trend',         query: 'Show me air quality trends for the past 24 hours',  category: 'trend' },
  { icon: '🔮', label: 'Forecast',          query: 'What is the air quality forecast for next 6 hours?', category: 'forecast' },
  { icon: '⚠️', label: 'Alerts',           query: 'Are there any anomalies or alerts right now?',      category: 'anomaly' },
  { icon: '🌡️', label: 'Temp & Humidity',  query: 'What is the temperature and humidity?',             category: 'current' },
  { icon: '💨', label: 'PM2.5 Detail',      query: 'Give me a detailed PM2.5 analysis',                category: 'current' },
  { icon: '💡', label: 'Health Tips',       query: 'Give me personalised health recommendations',       category: 'health' },
];

const WELCOME = {
  id: 'welcome',
  sender: 'bot',
  text: "Hello! I'm **AirIQ**, your intelligent air quality assistant.\n\nI can help you with:\n• Real-time air quality status & AQI\n• Health & safety recommendations\n• Pollutant breakdowns (PM2.5, PM10, CO, CO₂, VOC, NOx)\n• 24-hour trends & forecasts\n• Anomaly detection & alerts\n• Temperature & humidity insights\n\nWhat would you like to know?",
  timestamp: Date.now(),
  category: 'default',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function AIChatbot() {
  const [isOpen, setIsOpen]     = useState(false);
  const [isMin, setIsMin]       = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput]       = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState(FOLLOW_UPS.default);
  const [copied, setCopied]     = useState(null);
  const [unread, setUnread]     = useState(0);
  const [isListening, setIsListening] = useState(false);

  const endRef    = useRef(null);
  const inputRef  = useRef(null);
  const recognitionRef = useRef(null);

  // Auto-scroll
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  // Focus on open
  useEffect(() => { if (isOpen) { inputRef.current?.focus(); setUnread(0); } }, [isOpen]);

  // Web Speech API setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (e) => { setInput(e.results[0][0].transcript); setIsListening(false); };
    rec.onerror = () => setIsListening(false);
    rec.onend   = () => setIsListening(false);
    recognitionRef.current = rec;
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (isListening) { recognitionRef.current.stop(); setIsListening(false); }
    else { recognitionRef.current.start(); setIsListening(true); }
  };

  const addMessage = useCallback((msg) => {
    setMessages(prev => [...prev, msg]);
    if (!isOpen) setUnread(n => n + 1);
  }, [isOpen]);

  const send = useCallback(async (text) => {
    const txt = (text || input).trim();
    if (!txt || isTyping) return;
    setInput('');
    setSuggestions([]);

    const userMsg = { id: Date.now(), sender: 'user', text: txt, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const res = await api.post('/api/chatbot/query', { message: txt, timestamp: new Date().toISOString() });
      const d   = res.data;
      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: d.response,
        data: d.data,
        category: d.category || detectCategory(txt),
        timestamp: Date.now(),
      };
      addMessage(botMsg);
      setSuggestions(FOLLOW_UPS[botMsg.category] || FOLLOW_UPS.default);
    } catch {
      addMessage({
        id: Date.now() + 1,
        sender: 'bot',
        text: "I'm having trouble connecting to the sensor network right now. Please try again in a moment.",
        timestamp: Date.now(),
        isError: true,
      });
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, addMessage]);

  const detectCategory = (txt) => {
    const t = txt.toLowerCase();
    if (t.includes('trend') || t.includes('history') || t.includes('24h'))   return 'trend';
    if (t.includes('forecast') || t.includes('predict'))                      return 'forecast';
    if (t.includes('alert') || t.includes('anomal'))                          return 'anomaly';
    if (t.includes('health') || t.includes('safe') || t.includes('exercise')) return 'health';
    return 'current';
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const copyMsg = (id, text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const exportChat = () => {
    const lines = messages.map(m =>
      `[${formatTime(m.timestamp)}] ${m.sender === 'bot' ? 'AirIQ' : 'You'}: ${m.text}`
    ).join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `airiq-chat-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
  };

  const clearChat = () => {
    setMessages([{ ...WELCOME, id: Date.now(), timestamp: Date.now() }]);
    setSuggestions(FOLLOW_UPS.default);
  };

  const hasVoice = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  return (
    <>
      {/* ── FAB button ── */}
      <button
        className={`aiq-fab ${isOpen ? 'aiq-fab--open' : ''}`}
        onClick={() => setIsOpen(o => !o)}
        title="AirIQ Assistant"
        aria-label="Open AI chat"
      >
        {isOpen
          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        }
        {!isOpen && unread > 0 && <span className="aiq-badge">{unread}</span>}
        {!isOpen && <span className="aiq-fab-ring" />}
      </button>

      {/* ── Chat window ── */}
      {isOpen && (
        <div className={`aiq-window ${isMin ? 'aiq-window--min' : ''}`} role="dialog" aria-label="AirIQ Chat">

          {/* Header */}
          <div className="aiq-header">
            <div className="aiq-header-left">
              <div className="aiq-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M12 14c-5 0-8 2-8 4v1h16v-1c0-2-3-4-8-4z"/></svg>
              </div>
              <div>
                <div className="aiq-title">AirIQ Assistant</div>
                <div className="aiq-status">
                  <span className="aiq-dot" />
                  {isTyping ? 'Thinking…' : 'Online · Sensor Network'}
                </div>
              </div>
            </div>
            <div className="aiq-header-actions">
              <button onClick={exportChat}    title="Export chat"    className="aiq-icon-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
              <button onClick={clearChat}     title="Clear chat"     className="aiq-icon-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
              <button onClick={() => setIsMin(m => !m)} title={isMin ? 'Expand' : 'Minimise'} className="aiq-icon-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {isMin ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
                </svg>
              </button>
              <button onClick={() => setIsOpen(false)} title="Close" className="aiq-icon-btn aiq-icon-btn--close">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          {!isMin && (
            <>
              {/* Quick actions (shown only on welcome) */}
              {messages.length === 1 && (
                <div className="aiq-quick">
                  <div className="aiq-quick-label">Quick actions</div>
                  <div className="aiq-quick-grid">
                    {QUICK_ACTIONS.map((a, i) => (
                      <button key={i} className="aiq-quick-btn" onClick={() => send(a.query)}>
                        <span className="aiq-quick-icon">{a.icon}</span>
                        <span>{a.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="aiq-messages">
                {messages.map(msg => (
                  <div key={msg.id} className={`aiq-msg aiq-msg--${msg.sender}`}>
                    {msg.sender === 'bot' && (
                      <div className="aiq-msg-avatar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M12 14c-5 0-8 2-8 4v1h16v-1c0-2-3-4-8-4z"/></svg>
                      </div>
                    )}
                    <div className={`aiq-bubble ${msg.isError ? 'aiq-bubble--error' : ''}`}>
                      <div className="aiq-bubble-text">{renderText(msg.text)}</div>

                      {/* Structured data cards */}
                      {msg.data && msg.data.aqi != null && (
                        <div className="aiq-data-card">
                          <div className="aiq-data-row">
                            <span>AQI</span>
                            <strong style={{ color: msg.data.aqi <= 50 ? '#10b981' : msg.data.aqi <= 100 ? '#f59e0b' : '#ef4444' }}>
                              {msg.data.aqi}
                            </strong>
                          </div>
                          {msg.data.health?.category && (
                            <div className="aiq-data-row">
                              <span>Category</span>
                              <strong>{msg.data.health.category}</strong>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="aiq-bubble-footer">
                        <span className="aiq-time">{formatTime(msg.timestamp)}</span>
                        <button
                          className={`aiq-copy-btn ${copied === msg.id ? 'aiq-copy-btn--done' : ''}`}
                          onClick={() => copyMsg(msg.id, msg.text)}
                          title="Copy message"
                        >
                          {copied === msg.id
                            ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="aiq-msg aiq-msg--bot">
                    <div className="aiq-msg-avatar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M12 14c-5 0-8 2-8 4v1h16v-1c0-2-3-4-8-4z"/></svg>
                    </div>
                    <div className="aiq-bubble aiq-bubble--typing">
                      <span /><span /><span />
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {/* Suggested follow-ups */}
              {suggestions.length > 0 && !isTyping && (
                <div className="aiq-suggestions">
                  {suggestions.map((s, i) => (
                    <button key={i} className="aiq-suggestion" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              )}

              {/* Input bar */}
              <div className="aiq-input-bar">
                <textarea
                  ref={inputRef}
                  className="aiq-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Ask about air quality, health, trends…"
                  rows={1}
                  maxLength={500}
                />
                <div className="aiq-input-actions">
                  {hasVoice && (
                    <button
                      className={`aiq-voice-btn ${isListening ? 'aiq-voice-btn--active' : ''}`}
                      onClick={toggleVoice}
                      title={isListening ? 'Stop listening' : 'Voice input'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
                      </svg>
                    </button>
                  )}
                  <button
                    className="aiq-send-btn"
                    onClick={() => send()}
                    disabled={!input.trim() || isTyping}
                    title="Send (Enter)"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="aiq-footer">
                <span>AirIQ · {messages.length - 1} message{messages.length !== 2 ? 's' : ''}</span>
                <span>Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for newline</span>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
