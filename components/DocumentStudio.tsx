import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, ArrowLeft, Download, User, School, BookOpen, GraduationCap, FileCheck, CheckCircle, Loader2, Edit3, Save, Layers, Book } from 'lucide-react';
import { GeminiService } from '../services/geminiService';
import { Humanizer } from './Humanizer';

interface DocumentStudioProps {
    checkUsageLimit: () => boolean;
}

interface StudioMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
}

interface DocMetadata {
    school?: string;
    student?: string;
    teacher?: string;
    subject?: string;
    theme?: string;
    class?: string;
    grade?: string;
    pageCount?: number;
    includeContraCapa?: boolean;
}

export const DocumentStudio: React.FC<DocumentStudioProps> = ({ checkUsageLimit }) => {
  // Modes: 'wizard' (chatting details) | 'preview' (generated doc)
  const [mode, setMode] = useState<'wizard' | 'preview'>('wizard');
  
  // Chat State
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<StudioMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Metadata State
  const [metadata, setMetadata] = useState<DocMetadata>({});
  const [isReadyToGenerate, setIsReadyToGenerate] = useState(false);

  // Preview State
  const [documentContent, setDocumentContent] = useState<string>('');
  const [showHumanizer, setShowHumanizer] = useState(false);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Initial Greeting
  useEffect(() => {
    if (messages.length === 0) {
        setMessages([{
            id: 'init',
            role: 'assistant',
            text: 'Olá! Sou o assistente do Estúdio. Que trabalho escolar ou documento deseja criar hoje? (Ex: "Faça um trabalho de Biologia sobre Seres Vivos, quero com 10 páginas e contra capa")'
        }]);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isTyping) return;
    if (!checkUsageLimit()) return;

    const userText = input;
    const userMsg: StudioMessage = { id: Date.now().toString(), role: 'user', text: userText };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
        // Convert internal messages to history format for API
        const history = messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));
        
        const result = await GeminiService.negotiateDocumentDetails(history, userText);
        
        // Merge new metadata
        setMetadata(prev => ({ ...prev, ...result.extractedData }));
        setIsReadyToGenerate(result.isReady);

        const aiMsg: StudioMessage = { 
            id: (Date.now() + 1).toString(), 
            role: 'assistant', 
            text: result.reply 
        };
        setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: "Ocorreu um erro ao processar. Tente novamente." }]);
    } finally {
        setIsTyping(false);
    }
  };

  const handleGenerateDocument = async () => {
    setIsGeneratingDoc(true);
    try {
        const content = await GeminiService.generateDocument(metadata, true);
        setDocumentContent(content);
        setMode('preview');
    } catch (e) {
        alert("Erro ao gerar. Tente novamente.");
    } finally {
        setIsGeneratingDoc(false);
    }
  };

  const handleDownload = () => {
    // Basic Word HTML wrapper
    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Documento IV4</title>
        <style>
            /* Ensure page breaks work in Word */
            .page { page-break-after: always; mso-break-type:section-break; }
            body { font-family: 'Times New Roman', serif; }
            /* Word sometimes needs explicit table styling */
            table { width: 100%; border-collapse: collapse; }
        </style>
      </head>
      <body>`;
    const footer = "</body></html>";
    const sourceHTML = header + documentContent + footer;
    
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `Trabalho_${metadata.student || 'IV4'}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  // --- PREVIEW MODE ---
  if (mode === 'preview') {
      return (
        <div className="fixed inset-0 z-50 bg-gray-200 dark:bg-gray-900 flex flex-col animate-fade-in overflow-hidden">
            <style>{`
                /* Styling for the Web View to simulate paper */
                .iv4-editor {
                    padding: 40px 0;
                    background-color: transparent;
                }
                .iv4-editor .page {
                    background: white;
                    width: 21cm; /* A4 Width */
                    min-height: 29.7cm; /* A4 Height */
                    padding: 2.5cm 2.5cm 2.5cm 3cm; /* Margins: Top Right Bottom Left (Left is usually larger for binding) */
                    margin: 0 auto 30px auto;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    color: black;
                    position: relative;
                    /* Ensure no random borders from user agent */
                    border: none;
                    outline: none;
                    box-sizing: border-box;
                }
                /* Hide the last margin to look clean */
                .iv4-editor .page:last-child {
                    margin-bottom: 100px;
                }
            `}</style>

            {/* Header */}
            <div className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 shadow-sm shrink-0 z-10">
                <button 
                    onClick={() => setMode('wizard')}
                    className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} />
                    <span className="font-medium">Voltar ao Chat</span>
                </button>
                
                <div className="flex items-center gap-3">
                     <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-xs font-medium border border-green-100 dark:border-green-800">
                        <Edit3 size={12} />
                        Podes editar as folhas abaixo
                    </div>
                    <button 
                        onClick={() => setShowHumanizer(true)}
                        className="px-4 py-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                        <Sparkles size={18} /> Humanizar
                    </button>
                    <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
                    <button 
                        onClick={handleDownload}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-md flex items-center gap-2"
                    >
                        <Download size={18} /> Baixar Word
                    </button>
                </div>
            </div>

            {/* Content Preview */}
            <div className="flex-grow overflow-y-auto flex justify-center bg-gray-200 dark:bg-gray-950">
                <div 
                    ref={editorRef}
                    className="iv4-editor w-full outline-none focus:outline-none"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => setDocumentContent(e.currentTarget.innerHTML)}
                    dangerouslySetInnerHTML={{ __html: documentContent }}
                    style={{ 
                        fontFamily: 'Times New Roman, serif',
                        lineHeight: '1.5'
                    }}
                />
            </div>

             <Humanizer 
                isOpen={showHumanizer}
                onClose={() => setShowHumanizer(false)}
                currentText={documentContent}
                onApply={(text) => {
                    setDocumentContent(text);
                    if (editorRef.current) {
                        editorRef.current.innerHTML = text;
                    }
                    setShowHumanizer(false);
                }}
            />
        </div>
      );
  }

  // --- WIZARD / CHAT MODE ---
  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-100px)] md:h-[calc(100vh-60px)] gap-6 animate-fade-in max-w-6xl mx-auto w-full">
        
        {/* Left: Chat Interface */}
        <div className="flex-grow flex flex-col bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-4 rounded-2xl text-sm md:text-base leading-relaxed ${
                            msg.role === 'user' 
                            ? 'bg-black dark:bg-white text-white dark:text-black rounded-tr-sm' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm'
                        }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {isTyping && (
                     <div className="flex justify-start">
                        <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-2xl rounded-tl-sm flex gap-1">
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                {isReadyToGenerate && (
                     <button 
                        onClick={handleGenerateDocument}
                        disabled={isGeneratingDoc}
                        className="w-full mb-3 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-200 dark:shadow-none transition-all animate-bounce-short"
                    >
                        {isGeneratingDoc ? <Loader2 className="animate-spin"/> : <CheckCircle />}
                        {isGeneratingDoc ? 'Gerando Documento...' : 'Tudo pronto! Gerar Trabalho Agora'}
                    </button>
                )}
                
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Digite sua resposta..."
                        className="w-full pl-4 pr-12 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                        disabled={isTyping || isGeneratingDoc}
                    />
                    <button 
                        onClick={handleSendMessage}
                        disabled={!input.trim() || isTyping}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:bg-gray-400 transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>

        {/* Right: Metadata Card (Desktop) */}
        <div className="hidden md:block w-80 shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-full">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <FileCheck className="text-indigo-500" />
                    Dados do Trabalho
                </h3>

                <div className="space-y-6">
                    <InfoField icon={School} label="Escola" value={metadata.school} />
                    <InfoField icon={BookOpen} label="Tema / Disciplina" value={metadata.theme ? `${metadata.subject || ''} - ${metadata.theme}` : metadata.subject} />
                    <InfoField icon={User} label="Nome do Aluno" value={metadata.student} />
                    <InfoField icon={GraduationCap} label="Docente" value={metadata.teacher} />
                    <div className="grid grid-cols-2 gap-2">
                        <InfoField label="Classe" value={metadata.grade} />
                        <InfoField label="Turma" value={metadata.class} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <InfoField icon={Layers} label="Páginas" value={metadata.pageCount ? `${metadata.pageCount} págs` : 'Padrão'} />
                        <InfoField icon={Book} label="Contra Capa" value={metadata.includeContraCapa ? 'Sim' : 'Não'} />
                    </div>
                </div>

                <div className="mt-8 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                    <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                        <span className="font-bold">Dica IV4:</span> Especifique o número de páginas e se deseja contra capa para um trabalho perfeito.
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
};

const InfoField = ({ icon: Icon, label, value }: { icon?: any, label: string, value?: string }) => (
    <div className={`group ${!value ? 'opacity-50' : 'opacity-100'} transition-opacity`}>
        <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {Icon && <Icon size={12} />}
            {label}
        </div>
        <div className="text-sm font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1 min-h-[24px]">
            {value || '---'}
        </div>
    </div>
);