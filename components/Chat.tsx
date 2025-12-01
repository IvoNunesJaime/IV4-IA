import React, { useState, useEffect, useRef } from 'react';
import { Send, BookOpen, Code, Zap, Sparkles, Paperclip, X } from 'lucide-react';
import { GeminiService } from '../services/geminiService';
import { Message, User } from '../types';

interface ChatProps {
    user: User | null;
    checkUsageLimit: () => boolean;
    onHumanizeRequest: (text: string) => void;
}

export const Chat: React.FC<ChatProps> = ({ user, checkUsageLimit, onHumanizeRequest }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLoaded = useRef(false);

  useEffect(() => {
    const handleNewChat = () => {
        setMessages([]);
        localStorage.removeItem('iv4_chat_history');
    };
    window.addEventListener('iv4-new-chat', handleNewChat);

    const saved = localStorage.getItem('iv4_chat_history');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load chat history");
      }
    }
    isLoaded.current = true;
    return () => window.removeEventListener('iv4-new-chat', handleNewChat);
  }, []);

  useEffect(() => {
    // Only save if initial load is complete to avoid overwriting storage with empty array on mount
    if (isLoaded.current) {
        localStorage.setItem('iv4_chat_history', JSON.stringify(messages));
    }
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if ((!textToSend.trim() && !selectedImage) || isLoading) return;

    if (!checkUsageLimit()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      image: selectedImage || undefined,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const imageToSend = selectedImage; // Store ref to send
    setSelectedImage(null); // Clear UI immediately
    setIsLoading(true);

    try {
      // Prepare history strictly with text for context (filtering out complex image objects for now for simplicity in history)
      const history = messages
        .filter(m => !m.image) 
        .map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));

      const responseText = await GeminiService.chat(history, userMsg.text, imageToSend || undefined);

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
        const errorMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: "Erro ao conectar ao servidor. Tente novamente.",
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = [
    { icon: BookOpen, text: "Resuma a Revolução Industrial" },
    { icon: Zap, text: "Explique Física Quântica simples" },
    { icon: Code, text: "Crie um script Python básico" },
    { icon: Sparkles, text: "Ideias para um projeto de História" },
  ];

  // --- RENDER HELPERS ---

  if (messages.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-full px-4 bg-white dark:bg-gray-900 animate-fade-in transition-colors">
            <div className="w-full max-w-2xl flex flex-col items-center gap-8">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl flex items-center justify-center shadow-sm">
                        <Sparkles size={32} className="text-gray-900 dark:text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Como posso ajudar?</h1>
                </div>

                <div className="w-full relative shadow-lg shadow-gray-200/50 dark:shadow-none rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    {selectedImage && (
                        <div className="px-4 pt-4">
                             <div className="relative inline-block">
                                <img src={selectedImage} alt="Preview" className="h-16 w-auto rounded-lg border border-gray-200 dark:border-gray-600" />
                                <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-gray-900 text-white rounded-full p-0.5 hover:bg-red-500"><X size={12}/></button>
                             </div>
                        </div>
                    )}
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Pergunte qualquer coisa..."
                        className="w-full pl-6 pr-14 py-4 bg-transparent border-none rounded-2xl focus:outline-none focus:ring-0 text-base resize-none text-black dark:text-gray-100 placeholder-gray-400"
                        rows={1}
                        style={{ minHeight: '60px' }}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                            <Paperclip size={18} />
                        </button>
                        <button
                            onClick={() => handleSend()}
                            disabled={!input.trim() && !selectedImage}
                            className="p-2 bg-black dark:bg-white text-white dark:text-black rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:bg-gray-300 dark:disabled:bg-gray-600"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                    {suggestions.map((s, idx) => (
                        <button 
                            key={idx}
                            onClick={() => handleSend(s.text)}
                            className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl transition-all text-left group shadow-sm"
                        >
                            <s.icon size={18} className="text-gray-400 dark:text-gray-500 group-hover:text-black dark:group-hover:text-white" />
                            <span className="text-sm text-gray-600 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white">{s.text}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 relative transition-colors">
      <div className="flex-grow overflow-y-auto px-4 md:px-0 py-6">
        <div className="max-w-3xl mx-auto space-y-8">
            {messages.map((msg) => (
            <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] md:max-w-[90%] ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.image && (
                        <div className={`mb-2 ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                             <img src={msg.image} alt="User upload" className="max-h-64 rounded-lg border border-gray-200 dark:border-gray-700" />
                        </div>
                    )}
                    <div className={`text-base md:text-lg leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user' 
                        ? 'text-black dark:text-gray-200 font-normal'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}>
                        {msg.text}
                    </div>
                </div>
            </div>
            ))}

            {isLoading && (
                <div className="flex justify-start w-full">
                    <div className="flex items-center space-x-1 pl-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>
      
      {/* Sticky Bottom Input */}
      <div className="p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-3xl mx-auto relative">
           {selectedImage && (
                <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                     <div className="relative inline-block">
                        <img src={selectedImage} alt="Preview" className="h-12 w-auto rounded border border-gray-200 dark:border-gray-600" />
                        <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-black text-white rounded-full p-0.5"><X size={10}/></button>
                     </div>
                </div>
            )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Envie uma mensagem..."
            className="w-full pl-4 pr-20 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-600 transition-all resize-none text-black dark:text-white"
            rows={1}
            style={{ minHeight: '52px', maxHeight: '150px' }}
            disabled={isLoading}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
             <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />
             <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <Paperclip size={18} />
             </button>
              <button
                onClick={() => handleSend()}
                disabled={isLoading || (!input.trim() && !selectedImage)}
                className={`p-2 rounded-lg transition-colors ${
                  (input.trim() || selectedImage) && !isLoading 
                  ? 'bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200' 
                  : 'bg-transparent text-gray-400 cursor-not-allowed'
                }`}
              >
                <Send size={18} />
              </button>
          </div>
        </div>
        <p className="text-center text-[10px] text-gray-400 dark:text-gray-500 mt-2">
            IV4 IA pode cometer erros.
        </p>
      </div>
    </div>
  );
};