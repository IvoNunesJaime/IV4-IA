import React, { useState, useEffect, useRef } from 'react';
import { Send, Code, Zap, Sparkles, Paperclip, X, Square, Copy, Check, Globe, BrainCircuit, Download, MapPin, PenTool, Lightbulb } from 'lucide-react';
import { GeminiService } from '../services/geminiService';
import { Message, User, ChatSession } from '../types';
import { Logo } from './Logo';

interface ChatProps {
    user: User | null;
    checkUsageLimit: () => boolean;
    onHumanizeRequest: (text: string) => void;
    currentSession?: ChatSession;
    onUpdateSession: (messages: Message[]) => void;
}

const CodeBlock: React.FC<{ code: string, language: string }> = ({ code, language }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="my-4 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0d1117] text-gray-800 dark:text-gray-100 font-mono text-sm shadow-sm">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-[#161b22] border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">{language || 'code'}</span>
                <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-white transition-colors">
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    {copied ? 'Copiado!' : 'Copiar'}
                </button>
            </div>
            <div className="p-4 overflow-x-auto custom-scrollbar bg-white dark:bg-[#0d1117]">
                <pre><code>{code}</code></pre>
            </div>
        </div>
    );
};

export const Chat: React.FC<ChatProps> = ({ user, checkUsageLimit, onHumanizeRequest, currentSession, onUpdateSession }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<{data: string, type: string, name: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  
  // Toggles
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(false);
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
      if (currentSession) setMessages(currentSession.messages);
      else setMessages([]);
  }, [currentSession?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedMedia({ data: reader.result as string, type: file.type, name: file.name });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if ((!textToSend.trim() && !selectedMedia) || isLoading) return;
    if (!checkUsageLimit()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      image: selectedMedia?.data || undefined, 
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    onUpdateSession(newMessages);

    setInput('');
    const mediaToSend = selectedMedia; 
    setSelectedMedia(null); 
    setIsLoading(true);
    setIsStreaming(false);

    // CHAT E ANÁLISE MULTIMODAL
    abortControllerRef.current = new AbortController();
    const botMsgId = (Date.now() + 1).toString();
    let accumulatedText = "";

    try {
      const history = messages.filter(m => !m.image).map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      
      await GeminiService.chatStream(
          history, 
          userMsg.text, 
          (chunk) => {
              setIsStreaming(true);
              setMessages(prev => {
                  const lastMsg = prev[prev.length - 1];
                  if (lastMsg && lastMsg.id === botMsgId) {
                      return prev.map(m => m.id === botMsgId ? { ...m, text: m.text + chunk } : m);
                  } else {
                      return [...prev, { id: botMsgId, role: 'model', text: chunk, timestamp: Date.now() }];
                  }
              });
              accumulatedText += chunk;
          },
          mediaToSend?.data,
          mediaToSend?.type,
          abortControllerRef.current.signal,
          { isThinking: isThinkingEnabled, isSearch: isSearchEnabled }
      );

      onUpdateSession([...newMessages, { id: botMsgId, role: 'model', text: accumulatedText, timestamp: Date.now() }]);
    } catch (error: any) {
        setMessages([...newMessages, { id: Date.now().toString(), role: 'model', text: error.message, timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const renderMessageContent = (text: string) => {
    const parts = text.split(/```(\w*)\n([\s\S]*?)```/g);
    return parts.map((part, index) => {
        if (index % 3 === 0) {
            if (!part.trim()) return null;
            return <div key={index} className="whitespace-pre-wrap leading-relaxed text-gray-800 dark:text-gray-200">{part}</div>;
        }
        if (index % 3 === 1) return null;
        return <CodeBlock key={index} code={part} language={parts[index - 1]} />;
    });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-[#030712] text-gray-900 dark:text-white transition-colors duration-300">
      <div className="flex-grow overflow-y-auto px-4 md:px-0 scroll-smooth pb-36">
        <div className="max-w-3xl mx-auto py-6 space-y-8">
          {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center pt-20">
                  <Logo size={80} className="mb-6" />
                  <h2 className="text-2xl font-bold mb-8">O que vamos criar hoje?</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                      <QuickAction 
                        icon={MapPin} 
                        text="Planeamento de Viagem: Como organizar um roteiro por Moçambique?" 
                        onClick={handleSend} 
                      />
                      <QuickAction 
                        icon={Code} 
                        text="Aprender Python do Zero: Qual o melhor caminho para começar?" 
                        onClick={handleSend} 
                      />
                      <QuickAction 
                        icon={Lightbulb} 
                        text="Dar Conselho: Como ter mais disciplina e sucesso nos estudos?" 
                        onClick={handleSend} 
                      />
                      <QuickAction 
                        icon={PenTool} 
                        text="Aprender a Escrever: Como melhorar a minha escrita e gramática?" 
                        onClick={handleSend} 
                      />
                  </div>
              </div>
          ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        {msg.role === 'model' && <Logo size={32} className="shrink-0 mt-1" />}
                        <div className={`px-5 py-3 rounded-2xl shadow-sm border ${msg.role === 'user' ? 'bg-white dark:bg-[#1f2937] border-gray-200 dark:border-white/5 rounded-tr-none' : 'bg-transparent border-transparent'}`}>
                            {msg.image && (
                                <div className="relative group mb-3">
                                    <img src={msg.image} className="max-w-full rounded-lg shadow-md border dark:border-white/10" alt="Uploaded Content" />
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                        <a href={msg.image} download="iv4-attachment.png" className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70"><Download size={16}/></a>
                                    </div>
                                </div>
                            )}
                            {renderMessageContent(msg.text)}
                        </div>
                    </div>
                </div>
              ))
          )}
          {isLoading && !isStreaming && <div className="flex gap-4"><Logo size={32} className="animate-pulse" /><div className="h-8 w-12 bg-gray-200 dark:bg-gray-800 rounded-full animate-bounce"></div></div>}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 md:ml-[280px] bg-gradient-to-t from-gray-50 dark:from-[#030712] via-gray-50 dark:via-[#030712] to-transparent">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
            <div className="flex gap-2 mb-1">
                <ToggleBtn active={isThinkingEnabled} onClick={() => setIsThinkingEnabled(!isThinkingEnabled)} icon={BrainCircuit} label="Raciocínio" />
                <ToggleBtn active={isSearchEnabled} onClick={() => setIsSearchEnabled(!isSearchEnabled)} icon={Globe} label="Pesquisa" />
            </div>

            <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl border border-gray-200 dark:border-white/10 p-2 flex flex-col">
                {selectedMedia && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg mb-2 self-start animate-fade-in">
                        <img src={selectedMedia.data} className="w-10 h-10 rounded object-cover" />
                        <span className="text-xs truncate max-w-[100px]">{selectedMedia.name}</span>
                        <button onClick={() => setSelectedMedia(null)}><X size={14} /></button>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-indigo-500 transition-colors"><Paperclip size={20}/></button>
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                    <textarea 
                        value={input} 
                        onChange={(e) => setInput(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                        placeholder="Pergunte qualquer coisa ou anexe uma imagem para análise..."
                        className="flex-grow bg-transparent p-2 resize-none outline-none max-h-32"
                        rows={1}
                    />
                    <button onClick={() => handleSend()} disabled={isLoading || (!input.trim() && !selectedMedia)} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 shadow-md">
                        {isLoading ? <Square size={16} fill="white" /> : <Send size={20} />}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const QuickAction = ({ icon: Icon, text, onClick }: any) => (
    <button onClick={() => onClick(text)} className="flex items-center gap-3 p-4 bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-white/5 rounded-xl hover:border-indigo-500 transition-all text-left shadow-sm">
        <Icon size={18} className="text-indigo-500 shrink-0" />
        <span className="text-sm font-medium leading-snug">{text}</span>
    </button>
);

const ToggleBtn = ({ active, onClick, icon: Icon, label, color = "text-indigo-500" }: any) => (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${active ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-white/5'}`}>
        <Icon size={14} className={active ? "text-white" : color} />
        {label}
    </button>
);