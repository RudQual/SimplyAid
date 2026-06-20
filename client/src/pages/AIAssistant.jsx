import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Bot, Send, User, Sparkles, AlertTriangle, ShieldCheck, HeartPulse } from 'lucide-react';
import './AIAssistant.css';

const AIAssistant = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  const simulateAIResponse = (userText) => {
    setIsTyping(true);
    
    // Simulate network delay
    setTimeout(() => {
      let response = "I am an AI assistant. This is a frontend demo interface for the SimplyAID Platform. I can assist with first aid protocols, compliance checks, and emergency procedures.";
      
      const lowerText = userText.toLowerCase();
      if (lowerText.includes('chemical burn')) {
        response = "**First Aid for Chemical Burns:**\n1. Ensure your own safety. Wear protective gloves.\n2. Remove contaminated clothing or jewelry.\n3. Rinse the burn immediately with a gentle, steady stream of cool water for at least 20 minutes.\n4. Do NOT use strong water pressure.\n5. Seek immediate emergency medical assistance (SOS).";
      } else if (lowerText.includes('section 45') || lowerText.includes('factory act')) {
        response = "**Factories Act, 1948 - Section 45 (First Aid Appliances):**\n- There must be at least one first-aid box or cupboard for every 150 workers ordinarily employed.\n- It must be equipped with prescribed contents.\n- It must be kept in the charge of a separate responsible person who holds a certificate in first aid treatment.\n- If the factory employs more than 500 workers, an ambulance room is mandatory.";
      } else if (lowerText.includes('cpr') || lowerText.includes('heart')) {
        response = "**Basic CPR Protocol (Adult):**\n1. Check the scene for safety, then check the person (shout & tap).\n2. Call for emergency medical help immediately.\n3. Open the airway.\n4. Check for breathing.\n5. If not breathing, begin chest compressions (100-120 per minute, 2 inches deep).\n6. Give 2 rescue breaths after every 30 compressions.\n7. Use an AED as soon as it arrives.";
      }

      setMessages(prev => [...prev, { role: 'ai', content: response, timestamp: new Date() }]);
      setIsTyping(false);
    }, 1500);
  };

  const handleSend = () => {
    if (!input.trim() || isTyping) return;
    
    const newUserMsg = { role: 'user', content: input.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    simulateAIResponse(newUserMsg.content);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (text) => {
    setInput(text);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const renderMessageContent = (content) => {
    // Basic markdown support for bold and line breaks
    return content.split('\n').map((line, i) => {
      if (!line) return <br key={i} />;
      const boldParts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <div key={i}>
          {boldParts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
        </div>
      );
    });
  };

  return (
    <div className="ai-assistant-page">
      <div className="ai-container">
        {/* Header */}
        <div className="ai-header">
          <div className="ai-icon-wrapper">
            <Sparkles size={20} />
          </div>
          <div className="ai-title-group">
            <h2>Safety Intelligence</h2>
            <p>AI First Aid & Compliance Assistant</p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="ai-chat-area">
          {messages.length === 0 ? (
            <div className="ai-welcome">
              <div className="ai-welcome-icon">
                <Bot size={32} />
              </div>
              <h3>How can I assist you today?</h3>
              <p>I can help you with emergency protocols, compliance questions, or navigating the platform.</p>
              
              <div className="ai-suggestions">
                <button className="ai-suggestion-btn" onClick={() => handleSuggestion('What is the protocol for a chemical burn?')}>
                  <AlertTriangle size={16} color="var(--orange-500)" /> Chemical Burn Protocol
                </button>
                <button className="ai-suggestion-btn" onClick={() => handleSuggestion('Summarize Section 45 of the Factories Act')}>
                  <ShieldCheck size={16} color="var(--green-500)" /> Section 45 Compliance
                </button>
                <button className="ai-suggestion-btn" onClick={() => handleSuggestion('How to perform CPR?')}>
                  <HeartPulse size={16} color="var(--red-600)" /> CPR Guidelines
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => (
                <div key={index} className={`chat-message ${msg.role}`}>
                  <div className="chat-avatar">
                    {msg.role === 'ai' ? <Bot size={20} /> : (user?.name?.charAt(0) || <User size={18} />)}
                  </div>
                  <div className="chat-bubble">
                    {renderMessageContent(msg.content)}
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="chat-message ai">
                  <div className="chat-avatar"><Bot size={20} /></div>
                  <div className="chat-bubble" style={{ padding: '16px' }}>
                    <div className="typing-indicator">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="ai-input-area">
          <div className="ai-input-wrapper">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about first aid or compliance..."
              disabled={isTyping}
            />
            <button 
              className="ai-send-btn" 
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
            >
              <Send size={18} />
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            AI-generated advice should not replace professional medical assistance. In case of a severe emergency, trigger SOS.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
