import React, { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, Code, Zap, Sparkles, Paperclip, X, FileText, Square, Copy, Check, Globe, BrainCircuit, ArrowUp, Plus, Book, Lightbulb, GraduationCap } from 'lucide-react';
import { GeminiService } from '../services/geminiService';
import { Message, User, ChatSession } from '../types';

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
                <button 
                    onClick={handleCopy} 
                    className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-white transition-colors"
                >
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
      if (currentSession) {
          setMessages(currentSession.messages);
      } else {
          setMessages([]);
      }
  }, [currentSession?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]); // Scroll quando mensagens mudam ou quando o streaming atualiza

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedMedia({
            data: reader.result as string,
            type: file.type,
            name: file.name
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStop = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
          setIsLoading(false);
          setIsStreaming(false);
          
          // Adiciona mensagem de cancelado se necessário ou apenas para o estado atual
          setMessages(prev => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg.role === 'model' && lastMsg.text === '') {
                  // Se cancelou antes de vir qualquer texto
                   return [...prev.slice(0, -1), {
                      ...lastMsg,
                      text: "⏹️ Resposta cancelada."
                   }];
              }
              return prev;
          });
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

    // Atualiza estado local e UI
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    onUpdateSession(newMessages);

    setInput('');
    const mediaToSend = selectedMedia; 
    setSelectedMedia(null); 
    setIsLoading(true);
    setIsStreaming(false);

    abortControllerRef.current = new AbortController();
    
    // ID para a nova mensagem do bot
    const botMsgId = (Date.now() + 1).toString();
    let accumulatedText = "";

    try {
      // FIX: Use 'messages' (previous state) instead of 'newMessages' to avoid 
      // duplicating the current user message in the history context.
      const history = messages
        .filter(m => !m.image) 
        .map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));

      // Pass configuration to service
      const config = {
          isThinking: isThinkingEnabled,
          isSearch: isSearchEnabled
      };

      await GeminiService.chatStream(
          history, 
          userMsg.text, 
          (chunkText) => {
              // Assim que receber dados, marca como streaming
              setIsStreaming(true);

              // Update usando functional state para garantir consistência e evitar duplicação
              setMessages(prev => {
                  const lastMsg = prev[prev.length - 1];
                  
                  // Se a última mensagem for a do bot (streaming em andamento), anexa o texto
                  if (lastMsg && lastMsg.id === botMsgId) {
                      return prev.map(m => 
                          m.id === botMsgId ? { ...m, text: m.text + chunkText } : m
                      );
                  } else {
                      // Se não, é o primeiro chunk, cria a mensagem
                      return [...prev, {
                          id: botMsgId,
                          role: 'model',
                          text: chunkText,
                          timestamp: Date.now()
                      }];
                  }
              });
              
              accumulatedText += chunkText;
          },
          mediaToSend?.data,
          mediaToSend?.type,
          abortControllerRef.current.signal,
          config // Pass config here
      );

      // Atualização final da sessão para persistência
      if (accumulatedText) {
        const finalMessages = [...newMessages, {
            id: botMsgId,
            role: 'model' as const,
            text: accumulatedText,
            timestamp: Date.now()
        }];
        onUpdateSession(finalMessages);
      }

    } catch (error: any) {
        if (error.name !== 'AbortError' && error.message !== 'Aborted') {
            let errorText = "⚠️ Erro ao conectar ao servidor. Verifique sua conexão.";
            
            // Tratamento específico para falta de chave API
            if (error.message === 'API_KEY_MISSING' || error.message?.includes('API key')) {
                errorText = "⚠️ Erro de Configuração: Chave de API não encontrada ou inválida. Por favor, configure a API KEY nas configurações do projeto.";
            }

            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: errorText,
                timestamp: Date.now(),
            };
            const failedMessages = [...newMessages, errorMsg];
            setMessages(failedMessages);
            onUpdateSession(failedMessages);
        }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessageContent = (text: string) => {
    // Basic Markdown Code Block Parser
    const parts = text.split(/```(\w*)\n([\s\S]*?)```/g);
    
    return parts.map((part, index) => {
        if (index % 3 === 0) {
            // Texto normal
            if (!part.trim()) return null;
            return <div key={index} className="whitespace-pre-wrap leading-relaxed text-gray-800 dark:text-gray-200">{part}</div>;
        }
        if (index % 3 === 1) return null; // Linguagem capturada pelo regex
        const language = parts[index - 1];
        return <CodeBlock key={index} code={part} language={language} />;
    });
  };

  // Chips matching the provided image EXACTLY
  const quickActions = [
    { icon: Book, text: "Resuma a Revolução Industrial" },
    { icon: Zap, text: "Explique Física Quântica simples" },
    { icon: Code, text: "Crie um script Python básico" },
    { icon: Sparkles, text: "Ideias para um projeto de História" },
  ];

  // --- Empty State View (Centered Layout) ---
  if (messages.length === 0) {
    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-[#030712] text-gray-900 dark:text-white overflow-hidden relative transition-colors duration-300">
            <div className="flex-grow flex flex-col items-center justify-center px-4 w-full max-w-2xl mx-auto z-10 pb-20">
                
                {/* Greeting Icon */}
                <div className="mb-8 p-5 bg-white dark:bg-[#1f2937]/50 rounded-2xl border border-gray-200 dark:border-white/5 shadow-lg shadow-indigo-500/10">
                    <Sparkles size={42} className="text-indigo-600 dark:text-white" />
                </div>

                {/* Greeting Text */}
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center tracking-tight">
                    Como posso ajudar?
                </h1>

                {/* Input Area (Centered) */}
                <InputArea 
                    input={input} 
                    setInput={setInput} 
                    handleSend={handleSend} 
                    handleKeyDown={handleKeyDown} 
                    isLoading={isLoading} 
                    handleStop={handleStop}
                    handleFileSelect={handleFileSelect}
                    selectedMedia={selectedMedia}
                    setSelectedMedia={setSelectedMedia}
                    fileInputRef={fileInputRef}
                    isThinkingEnabled={isThinkingEnabled}
                    setIsThinkingEnabled={setIsThinkingEnabled}
                    isSearchEnabled={isSearchEnabled}
                    setIsSearchEnabled={setIsSearchEnabled}
                    className="w-full relative mb-10"
                    placeholder="Pergunte qualquer coisa..."
                    isCentered={true}
                />

                {/* Action Chips (Below Input) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                    {quickActions.map((action, i) => (
                        <button 
                            key={i}
                            onClick={() => handleSend(action.text)} 
                            className="flex items-center gap-3 px-5 py-4 bg-white dark:bg-[#1f2937]/40 hover:bg-gray-100 dark:hover:bg-[#374151] border border-gray-200 dark:border-white/5 hover:border-indigo-300 dark:hover:border-white/10 rounded-2xl transition-all text-left group shadow-sm dark:shadow-none"
                        >
                            <div className="text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-white transition-colors">
                                <action.icon size={20} />
                            </div>
                            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium group-hover:text-indigo-700 dark:group-hover:text-white transition-colors">{action.text}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
  }

  // --- Active Chat View ---
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-[#030712] text-gray-900 dark:text-white transition-colors duration-300">
      <div className="flex-grow overflow-y-auto px-4 md:px-0 scroll-smooth pb-36">
        <div className="max-w-3xl mx-auto py-6 space-y-8">
          {messages.map((msg) => (
            <div key={msg.id} className="flex flex-col gap-2">
                
                {/* User Message */}
                {msg.role === 'user' && (
                    <div className="flex justify-end">
                        <div className="bg-white dark:bg-[#1f2937] px-5 py-3 rounded-2xl rounded-tr-none text-gray-800 dark:text-gray-100 max-w-[85%] leading-relaxed border border-gray-200 dark:border-white/5 shadow-sm">
                             {msg.image && (
                                <img src={msg.image} alt="Upload" className="max-h-48 rounded-lg mb-2" />
                             )}
                             {msg.text}
                        </div>
                    </div>
                )}

                {/* AI Message */}
                {msg.role === 'model' && (
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-lg bg-[#4f46e5] flex items-center justify-center shrink-0 shadow-sm mt-1">
                            <Sparkles size={16} className="text-white" />
                        </div>
                        <div className="flex-grow min-w-0 pt-1">
                            <div className="text-gray-800 dark:text-gray-200 text-base leading-relaxed">
                                {renderMessageContent(msg.text)}
                                {/* Cursor blink effect if streaming this message */}
                                {isStreaming && msg.id === messages[messages.length-1].id && (
                                    <span className="inline-block w-2 h-4 align-middle bg-indigo-500 ml-1 animate-pulse rounded-sm"></span>
                                )}
                            </div>
                            {/* Actions toolbar - only show if not streaming or if text is long enough */}
                            {(!isStreaming || msg.text.length > 50) && (
                                <div className="flex items-center gap-4 mt-2 fade-in">
                                    <button onClick={() => onHumanizeRequest(msg.text)} className="p-1 text-gray-400 hover:text-[#4f46e5] dark:text-gray-500 dark:hover:text-[#a78bfa] transition-colors" title="Humanizar">
                                        <Zap size={16} />
                                    </button>
                                    <button onClick={() => navigator.clipboard.writeText(msg.text)} className="p-1 text-gray-400 hover:text-black dark:text-gray-500 dark:hover:text-white transition-colors" title="Copiar">
                                        <Copy size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
          ))}
          
          {/* Loading Indicator (Only show if NOT streaming text yet and IS loading) */}
          {isLoading && !isStreaming && (
            <div className="flex gap-4">
               <div className="w-8 h-8 rounded-lg bg-[#4f46e5] flex items-center justify-center shrink-0 animate-pulse">
                   <Sparkles size={16} className="text-white" />
               </div>
               <div className="flex flex-col justify-center mt-2">
                   {isThinkingEnabled ? (
                       <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 animate-pulse flex items-center gap-2">
                          <BrainCircuit size={14} />
                          A analisar e raciocinar...
                       </span>
                   ) : (
                       <div className="flex items-center gap-1">
                           <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></span>
                           <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-100"></span>
                           <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-200"></span>
                       </div>
                   )}
               </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Input Area (Fixed at bottom for active chat) */}
      <InputArea 
            input={input} 
            setInput={setInput} 
            handleSend={handleSend} 
            handleKeyDown={handleKeyDown} 
            isLoading={isLoading} 
            handleStop={handleStop}
            handleFileSelect={handleFileSelect}
            selectedMedia={selectedMedia}
            setSelectedMedia={setSelectedMedia}
            fileInputRef={fileInputRef}
            isThinkingEnabled={isThinkingEnabled}
            setIsThinkingEnabled={setIsThinkingEnabled}
            isSearchEnabled={isSearchEnabled}
            setIsSearchEnabled={setIsSearchEnabled}
            className="fixed bottom-0 left-0 md:left-0 lg:left-0 right-0 bg-gray-50 dark:bg-[#030712] pt-4 pb-6 px-4 z-20 flex justify-center transition-colors duration-300" 
        />
    </div>
  );
};

// Reusable Input Component
const InputArea = ({ 
    input, setInput, handleSend, handleKeyDown, isLoading, handleStop, 
    handleFileSelect, selectedMedia, setSelectedMedia, fileInputRef,
    isThinkingEnabled, setIsThinkingEnabled, isSearchEnabled, setIsSearchEnabled,
    className, placeholder, isCentered
}: any) => {
    return (
        <div className={className}>
            <div className={`max-w-3xl w-full ${!isCentered ? 'md:ml-[280px] md:mr-0 transition-all duration-300' : ''}`}> 
                <div className={`bg-white dark:bg-[#1f2937] rounded-2xl p-2 border border-gray-200 dark:border-white/5 shadow-xl dark:shadow-2xl relative flex flex-col transition-all focus-within:border-indigo-500/50 dark:focus-within:border-white/10 ${isCentered ? 'min-h-[60px]' : ''}`}>
                    
                    {/* Media Preview */}
                    {selectedMedia && (
                        <div className="mx-2 mt-2 mb-1 p-2 bg-gray-100 dark:bg-[#374151] rounded-lg inline-flex items-center gap-2 self-start border border-gray-200 dark:border-transparent">
                            {selectedMedia.type.includes('image') ? 
                                <img src={selectedMedia.data} className="h-8 w-8 rounded object-cover" /> : 
                                <FileText size={20} className="text-gray-600 dark:text-white"/>}
                            <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[150px]">{selectedMedia.name}</span>
                            <button onClick={() => setSelectedMedia(null)}><X size={14} className="text-gray-400 hover:text-red-500 dark:hover:text-white" /></button>
                        </div>
                    )}

                    {/* Toggles Area */}
                    <div className="flex items-center gap-2 px-2 pb-2">
                        <button 
                            onClick={() => setIsThinkingEnabled(!isThinkingEnabled)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${isThinkingEnabled ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                        >
                            <BrainCircuit size={14} />
                            Raciocínio {isThinkingEnabled ? 'On' : 'Off'}
                        </button>
                         <button 
                            onClick={() => setIsSearchEnabled(!isSearchEnabled)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${isSearchEnabled ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                        >
                            <Globe size={14} />
                            Pesquisa {isSearchEnabled ? 'On' : 'Off'}
                        </button>
                    </div>

                    <div className="flex items-center w-full">
                         <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder || "Pergunte qualquer coisa..."}
                            className="flex-grow bg-transparent border-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 px-4 py-3 focus:ring-0 resize-none min-h-[50px] max-h-[200px] outline-none"
                            rows={1}
                            style={{ height: 'auto', overflowY: 'hidden' }}
                        />
                        
                         {/* Attachment Button */}
                         <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileSelect} 
                                className="hidden" 
                            />
                        <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-white transition-colors mr-1">
                             <Paperclip size={20} />
                        </button>

                         {/* Send Button */}
                        {isLoading ? (
                            <button onClick={handleStop} className="p-2 mr-2 rounded-lg bg-gray-200 dark:bg-white text-black hover:opacity-90">
                                <Square size={16} fill="currentColor" />
                            </button>
                        ) : (
                            <button 
                                onClick={() => handleSend()} 
                                disabled={!input.trim() && !selectedMedia}
                                className="p-2 mr-2 rounded-lg bg-gray-100 dark:bg-[#374151] text-gray-400 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#4b5563] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send size={20} />
                            </button>
                        )}
                    </div>
                    
                </div>
            </div>
        </div>
    );
}