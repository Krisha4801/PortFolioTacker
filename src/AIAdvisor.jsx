import React, { useState, useEffect, useRef } from 'react';
import { X, Send, RefreshCw, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

const renderMarkdown = (text) => {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} style={{ fontWeight: '700', fontSize: '0.95rem', color: '#1e293b', marginTop: '12px', marginBottom: '4px' }}>
          {renderInline(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} style={{ fontWeight: '700', fontSize: '1rem', color: '#1e293b', marginTop: '14px', marginBottom: '4px' }}>
          {renderInline(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '3px', paddingLeft: '4px' }}>
          <span style={{ color: '#2563eb', fontWeight: 'bold', flexShrink: 0 }}>•</span>
          <span style={{ color: '#334155', fontSize: '0.875rem', lineHeight: '1.5' }}>{renderInline(line.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)/);
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '3px', paddingLeft: '4px' }}>
          <span style={{ color: '#2563eb', fontWeight: 'bold', flexShrink: 0, minWidth: '16px' }}>{match[1]}.</span>
          <span style={{ color: '#334155', fontSize: '0.875rem', lineHeight: '1.5' }}>{renderInline(match[2])}</span>
        </div>
      );
    } else if (line.startsWith('---')) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '10px 0' }} />);
    } else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: '6px' }} />);
    } else {
      elements.push(
        <p key={i} style={{ color: '#334155', fontSize: '0.875rem', lineHeight: '1.6', marginBottom: '2px' }}>
          {renderInline(line)}
        </p>
      );
    }
    i++;
  }
  return elements;
};

const renderInline = (text) => {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} style={{ fontWeight: '700', color: '#1e293b' }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
};

const SUGGESTED_PROMPTS = [
  { label: '📊 Analyze my portfolio', text: 'Analyze my current portfolio and give me a detailed assessment of my holdings, diversification, and overall health.' },
  { label: '📈 Top Indian stocks', text: 'What are the top Indian stocks to consider buying right now? Focus on fundamentally strong companies with good growth potential.' },
  { label: '🏦 Best SIPs under ₹5000', text: 'Suggest the best SIP mutual funds to invest ₹5000/month in for long-term wealth creation in India.' },
  { label: '🪙 Gold vs Equity', text: 'Should I increase my gold allocation or equity? What is the ideal gold to equity ratio for an Indian investor?' },
  { label: '⚖️ Should I rebalance?', text: 'Based on my portfolio, should I rebalance? What changes would you recommend?' },
  { label: '🛡️ Risk assessment', text: 'What are the key risks in my portfolio and how can I reduce them?' },
];

const PERSONAS = [
  { id: 'conservative', label: '🛡️ Conservative', desc: 'FDs, debt funds, gold focus' },
  { id: 'balanced', label: '⚖️ Balanced', desc: 'Mix of equity & debt' },
  { id: 'aggressive', label: '🚀 Aggressive', desc: 'High growth, small/mid cap' },
];

const AIAdvisor = ({ holdings, transactions, typeSummary, portfolioStats }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [persona, setPersona] = useState('balanced');
  const [showPersonas, setShowPersonas] = useState(false);
  const [showPrompts, setShowPrompts] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Namaste! 🙏 I'm your AI Investment Advisor, here to help you make smarter financial decisions.\n\n**I have access to your portfolio data** and can provide personalized advice.\n\nYou can ask me about:\n- Your portfolio performance & rebalancing\n- Top Indian stocks & mutual funds\n- Gold & fixed income strategies\n- Tax-saving investments (ELSS, PPF, NPS)\n- Market trends & sector analysis\n\nWhat would you like to explore today?`
      }]);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  const buildPortfolioContext = () => {
    if (!holdings || holdings.length === 0) return 'No portfolio data available.';
    const lines = ['📊 PORTFOLIO SUMMARY:'];
    lines.push(`Total Invested: ₹${(portfolioStats?.totalCost / 100000)?.toFixed(2)}L`);
    lines.push(`Current Value: ₹${(portfolioStats?.currentValue / 100000)?.toFixed(2)}L`);
    lines.push(`Total Gain/Loss: ₹${(portfolioStats?.totalGain / 1000)?.toFixed(1)}K (${portfolioStats?.totalReturn?.toFixed(2)}%)`);
    lines.push('');
    lines.push('HOLDINGS BY TYPE:');
    typeSummary?.forEach(item => {
      const typeLabel = { stock: 'Stocks', mf: 'Mutual Funds', gold: 'Gold', bank: 'Bank' }[item.type];
      lines.push(`- ${typeLabel}: ₹${(item.currentValue / 1000)?.toFixed(1)}K invested, ${item.totalReturn?.toFixed(1)}% return`);
    });
    lines.push('');
    lines.push('INDIVIDUAL HOLDINGS:');
    holdings.forEach(h => {
      if (h.type !== 'bank') {
        lines.push(`- ${h.name} (${h.type?.toUpperCase()}): Current price ₹${h.currentPrice?.toFixed(2) || 'N/A'}`);
      }
    });
    return lines.join('\n');
  };

  const buildSystemPrompt = () => {
    const personaInstructions = {
      conservative: 'You favor capital preservation. Recommend FDs, debt mutual funds, gold, large-cap stocks, and low-risk instruments. Always mention risk mitigation.',
      balanced: 'You balance growth and safety. Recommend a mix of large-cap equity, balanced mutual funds, some gold, and fixed income.',
      aggressive: 'You favor high growth. Recommend small-cap, mid-cap stocks, sectoral funds, and emerging opportunities. Mention higher risk clearly.'
    };
    return `You are an expert Indian investment advisor with deep knowledge of:
- Indian stock market (NSE/BSE), Nifty, Sensex
- Mutual funds, SIPs, NAVs, AMCs
- Gold investments (SGBs, ETFs, physical gold)
- Tax-saving instruments (ELSS, PPF, NPS, 80C)
- Indian economic conditions, RBI policies, inflation
- SEBI regulations and investor protection

ADVISOR STYLE: ${personaInstructions[persona]}

USER'S CURRENT PORTFOLIO:
${buildPortfolioContext()}

RESPONSE GUIDELINES:
- Always structure responses with clear sections using ## headers
- Use bullet points for recommendations
- Include specific Indian stock/fund names with tickers where relevant
- Always add a brief ⚠️ risk warning for recommendations
- Keep responses concise but actionable
- Format numbers in Indian system (L for lakhs, K for thousands)
- End with a DISCLAIMER: "This is AI-generated advice for informational purposes only. Please consult a SEBI-registered investment advisor before making financial decisions."`;
  };

  const sendMessage = async (text) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage = { role: 'user', content: messageText };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);
    setShowPrompts(false);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`

        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 1000,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            ...updatedMessages.map(m => ({ role: m.role, content: m.content }))
          ]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'API error');
      }

      const fullResponse = data.choices[0].message.content;
      setMessages(prev => [...prev, { role: 'assistant', content: fullResponse }]);
    } catch (error) {
      console.error('AI error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Sorry, I encountered an error: ' + error.message
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setShowPrompts(true);
    setTimeout(() => {
      setMessages([{
        role: 'assistant',
        content: `Chat cleared! I'm ready to help with your investment questions. What would you like to know?`
      }]);
    }, 100);
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed', bottom: '24px', right: '24px',
            backgroundColor: '#2563eb', color: 'white',
            borderRadius: '50px', padding: '14px 20px',
            display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 4px 24px rgba(37,99,235,0.4)',
            border: 'none', cursor: 'pointer', zIndex: 1000,
            fontSize: '0.9rem', fontWeight: '600', transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Sparkles size={18} />
          AI Advisor
        </button>
      )}

      {isOpen && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          width: '420px', maxWidth: 'calc(100vw - 32px)',
          height: '620px', maxHeight: 'calc(100vh - 48px)',
          backgroundColor: 'white', borderRadius: '16px',
          boxShadow: '0 8px 48px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
          zIndex: 1000, overflow: 'hidden', border: '1px solid #e2e8f0'
        }}>

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
            padding: '16px', display: 'flex',
            alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '10px', padding: '6px', display: 'flex' }}>
                <Sparkles size={18} color="white" />
              </div>
              <div>
                <div style={{ color: 'white', fontWeight: '700', fontSize: '0.95rem' }}>AI Investment Advisor</div>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem' }}>Powered by PortFolio Tracker · Indian Markets</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button onClick={clearChat} title="Clear chat"
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'white', display: 'flex' }}>
                <RefreshCw size={15} />
              </button>
              <button onClick={() => setIsOpen(false)}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'white', display: 'flex' }}>
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Persona Selector */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', flexShrink: 0, backgroundColor: '#fafbfc' }}>
            <button
              onClick={() => setShowPersonas(!showPersonas)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'none', border: '1px solid #e2e8f0',
                borderRadius: '8px', padding: '5px 10px', cursor: 'pointer',
                fontSize: '0.78rem', color: '#475569', width: '100%', justifyContent: 'space-between'
              }}
            >
              <span>Advisor style: <strong style={{ color: '#2563eb' }}>{PERSONAS.find(p => p.id === persona)?.label}</strong></span>
              {showPersonas ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {showPersonas && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                {PERSONAS.map(p => (
                  <button key={p.id} onClick={() => { setPersona(p.id); setShowPersonas(false); }}
                    style={{
                      padding: '5px 10px', borderRadius: '8px', fontSize: '0.76rem',
                      cursor: 'pointer', border: '1px solid',
                      borderColor: persona === p.id ? '#2563eb' : '#e2e8f0',
                      backgroundColor: persona === p.id ? '#eff6ff' : 'white',
                      color: persona === p.id ? '#2563eb' : '#475569',
                      fontWeight: persona === p.id ? '600' : '400'
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              backgroundColor: '#fffbeb', border: '1px solid #fde68a',
              borderRadius: '8px', padding: '8px 12px', fontSize: '0.72rem', color: '#92400e'
            }}>
              ⚠️ <strong>Disclaimer:</strong> AI advice is for informational purposes only. Consult a SEBI-registered advisor before investing.
            </div>

            {messages.map((msg, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '88%',
                  backgroundColor: msg.role === 'user' ? '#2563eb' : '#f8fafc',
                  color: msg.role === 'user' ? 'white' : '#1e293b',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  padding: '10px 14px',
                  border: msg.role === 'assistant' ? '1px solid #e2e8f0' : 'none',
                  fontSize: '0.875rem', lineHeight: '1.5'
                }}>
                  {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: '16px 16px 16px 4px', padding: '12px 16px',
                  display: 'flex', gap: '5px', alignItems: 'center'
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: '7px', height: '7px', borderRadius: '50%',
                      backgroundColor: '#2563eb', animation: 'bounce 1.2s infinite',
                      animationDelay: `${i * 0.2}s`
                    }} />
                  ))}
                  <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
                </div>
              </div>
            )}

            {showPrompts && messages.length <= 1 && !isLoading && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '8px', fontWeight: '500' }}>QUICK QUESTIONS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {SUGGESTED_PROMPTS.map((prompt, idx) => (
                    <button key={idx} onClick={() => sendMessage(prompt.text)}
                      style={{
                        textAlign: 'left', padding: '8px 12px',
                        backgroundColor: 'white', border: '1px solid #e2e8f0',
                        borderRadius: '10px', cursor: 'pointer', fontSize: '0.8rem',
                        color: '#334155', transition: 'all 0.15s', fontWeight: '500'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.backgroundColor = '#eff6ff'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.backgroundColor = 'white'; }}
                    >
                      {prompt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid #e2e8f0', backgroundColor: 'white', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                placeholder="Ask about stocks, funds, rebalancing..."
                rows={1}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: '10px',
                  border: '1px solid #e2e8f0', resize: 'none', outline: 'none',
                  fontSize: '0.875rem', color: '#1e293b', lineHeight: '1.5',
                  backgroundColor: '#f8fafc', fontFamily: 'inherit',
                  maxHeight: '100px', overflowY: 'auto'
                }}
                onFocus={e => e.target.style.borderColor = '#2563eb'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                style={{
                  backgroundColor: input.trim() && !isLoading ? '#2563eb' : '#cbd5e1',
                  color: 'white', border: 'none', borderRadius: '10px',
                  padding: '10px 12px', cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background-color 0.15s', flexShrink: 0
                }}
              >
                <Send size={16} />
              </button>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '6px', textAlign: 'center' }}>
              Press Enter to send · Shift+Enter for new line
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAdvisor;
