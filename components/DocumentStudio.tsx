import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, ArrowLeft, Download, FileCheck, CheckCircle, Loader2, Edit3, Save, Layers, Book, Briefcase, FileText, Mail, FileType, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Indent, Outdent, BoxSelect, FolderOpen, Image as ImageIcon, Frame, PlusCircle, Check, AlertTriangle } from 'lucide-react';
import { GeminiService } from '../services/geminiService';
import { Humanizer } from './Humanizer';
import { SavedDocument } from '../types';

interface DocumentStudioProps {
    checkUsageLimit: () => boolean;
}

interface StudioMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    text: string;
}

// Ribbon Tabs
type RibbonTab = 'inicio' | 'inserir' | 'layout';

export const DocumentStudio: React.FC<DocumentStudioProps> = ({ checkUsageLimit }) => {
  // Modes: 'wizard' (chatting details) | 'preview' (generated doc)
  const [mode, setMode] = useState<'wizard' | 'preview'>('wizard');
  const [activeTab, setActiveTab] = useState<RibbonTab>('inicio');
  
  // Chat State
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<StudioMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Error UI State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Metadata State
  const [metadata, setMetadata] = useState<any>({});
  const [isReadyToGenerate, setIsReadyToGenerate] = useState(false);

  // Preview / Editor State
  const [documentContent, setDocumentContent] = useState<string>('');
  const [showHumanizer, setShowHumanizer] = useState(false);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // AI Edit State
  const [showAIEditModal, setShowAIEditModal] = useState(false);
  const [aiEditPrompt, setAiEditPrompt] = useState('');
  const [isAIEditing, setIsAIEditing] = useState(false);

  // Persistence State
  const [savedDocuments, setSavedDocuments] = useState<SavedDocument[]>([]);
  const [showSavedDocsModal, setShowSavedDocsModal] = useState(false);

  // Initial Greeting & Load Saved Docs
  useEffect(() => {
    if (messages.length === 0) {
        setMessages([{
            id: 'init',
            role: 'assistant',
            text: 'Olá! Sou o Criador de Documentos do IV4. O que deseja criar hoje? (Ex: "Um trabalho de História em grupo", "Uma carta de pedido de emprego").'
        }]);
    }
    const saved = localStorage.getItem('iv4_saved_docs');
    if (saved) {
        try {
            setSavedDocuments(JSON.parse(saved));
        } catch(e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- PERSISTENCE ---
  const saveDocument = () => {
      if (!documentContent) return;
      
      const title = metadata.topic || metadata.subject || `Documento ${new Date().toLocaleDateString()}`;
      const newDoc: SavedDocument = {
          id: Date.now().toString(),
          title: title,
          content: documentContent,
          createdAt: Date.now(),
          metadata: metadata
      };

      const updatedDocs = [newDoc, ...savedDocuments];
      setSavedDocuments(updatedDocs);
      localStorage.setItem('iv4_saved_docs', JSON.stringify(updatedDocs));
      // Toast feedback could be added here
  };

  const loadDocument = (doc: SavedDocument) => {
      setMetadata(doc.metadata || {});
      setDocumentContent(doc.content);
      setMode('preview');
      setShowSavedDocsModal(false);
      // Wait for render to update innerHTML ref if needed
      setTimeout(() => {
          if (editorRef.current) editorRef.current.innerHTML = doc.content;
      }, 100);
  };

  const deleteSavedDocument = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updated = savedDocuments.filter(d => d.id !== id);
      setSavedDocuments(updated);
      localStorage.setItem('iv4_saved_docs', JSON.stringify(updated));
  };

  // --- CHAT LOGIC ---
  const handleSendMessage = async () => {
    if (!input.trim() || isTyping) return;
    if (!checkUsageLimit()) return;

    setErrorMsg(null); // Clear previous errors
    const userText = input;
    const userMsg: StudioMessage = { id: Date.now().toString(), role: 'user', text: userText };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
        const history = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));
        const result = await GeminiService.negotiateDocumentDetails(history, userText);
        
        setMetadata((prev: any) => ({ ...prev, ...result.extractedData }));
        setIsReadyToGenerate(result.isReady);

        const aiMsg: StudioMessage = { 
            id: (Date.now() + 1).toString(), 
            role: 'assistant', 
            text: result.reply 
        };
        setMessages(prev => [...prev, aiMsg]);

    } catch (error: any) {
        // Exibir erro amigável no chat como mensagem de sistema
        const sysMsg: StudioMessage = {
            id: Date.now().toString(),
            role: 'system',
            text: `⚠️ ${error.message || "Ocorreu um erro ao processar. Tente novamente."}`
        };
        setMessages(prev => [...prev, sysMsg]);
    } finally {
        setIsTyping(false);
    }
  };

  const handleGenerateDocument = async () => {
    setIsGeneratingDoc(true);
    setErrorMsg(null);
    try {
        const content = await GeminiService.generateDocument(metadata, true);
        setDocumentContent(content);
        setMode('preview');
    } catch (e: any) {
        setErrorMsg(e.message || "Não foi possível gerar o documento. Tente novamente.");
    } finally {
        setIsGeneratingDoc(false);
    }
  };

  // --- EDITOR COMMANDS ---
  const executeCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
        editorRef.current.focus();
    }
  };

  const handleDownloadPDF = () => {
    // 1. Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    // 2. Write content to iframe
    const doc = iframe.contentWindow?.document;
    if (doc) {
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${metadata.topic || "Documento"}</title>
                <style>
                    /* Basic Print Reset */
                    @page { margin: 0; size: auto; }
                    body { 
                        margin: 0; 
                        padding: 0; 
                        font-family: 'Times New Roman', serif; 
                        background: white;
                        -webkit-print-color-adjust: exact;
                    }
                    
                    /* Ensure content container uses full width */
                    .iv4-document-container {
                        width: 100%;
                    }

                    /* Hide Editor UI elements */
                    .drag-handle, .iv4-ui-element { display: none !important; }
                    
                    /* Page Break Logic */
                    .page {
                        page-break-after: always;
                        break-after: page;
                        width: 100%;
                        min-height: 29.7cm; 
                        position: relative;
                        overflow: hidden;
                        margin: 0;
                        box-shadow: none;
                    }

                    /* Override any generated "visibility: hidden" from Gemini CSS that expects to be in the main app */
                    @media print {
                        body * { visibility: visible !important; }
                        .drag-handle { display: none !important; }
                    }
                </style>
            </head>
            <body>
                <div id="printable-content" class="iv4-document-container">
                    ${documentContent}
                </div>
            </body>
            </html>
        `);
        doc.close();

        // 3. Print execution
        const printDocument = () => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            
            // Cleanup after print dialog closes (approximate)
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 3000);
        };

        // Wait for potential images/fonts to load
        setTimeout(printDocument, 1000);
    }
  };

  // --- AI EDIT FEATURE ---
  const handleAIEdit = async () => {
      if (!aiEditPrompt.trim()) return;
      setIsAIEditing(true);
      setErrorMsg(null);
      try {
          const currentHTML = editorRef.current?.innerHTML || documentContent;
          const newContent = await GeminiService.editDocumentFragment(currentHTML, aiEditPrompt);
          setDocumentContent(newContent);
          if (editorRef.current) editorRef.current.innerHTML = newContent;
          setShowAIEditModal(false);
          setAiEditPrompt('');
      } catch (error: any) {
          setErrorMsg(error.message);
          // Close modal to show error on main screen or show inside modal?
          // Let's show alert for now inside the modal logic
          alert(`Erro: ${error.message}`); 
      } finally {
          setIsAIEditing(false);
      }
  };

  // --- UI HELPERS ---
  const addNewPage = () => {
      if (editorRef.current) {
          const newPage = document.createElement('div');
          newPage.className = 'page';
          newPage.innerHTML = '<p><br/></p>';
          editorRef.current.appendChild(newPage);
          setDocumentContent(editorRef.current.innerHTML);
          setTimeout(() => newPage.scrollIntoView({ behavior: 'smooth' }), 100);
      }
  };

  const insertTextBox = () => {
      const activePage = document.querySelector('.page:hover') || document.querySelector('.page');
      if (!activePage) { return; } // Removed Alert

      const textBoxHTML = `
        <div class="draggable-box" style="position: absolute; left: 100px; top: 100px; min-width: 150px; z-index: 10;">
            <div class="drag-handle" contenteditable="false" style="background: #bfdbfe; height: 16px; cursor: move; border-radius: 4px 4px 0 0; display: flex; justify-content: center;">
                 <div style="width: 20px; height: 4px; background: #60a5fa; border-radius: 2px; margin-top: 6px;"></div>
            </div>
            <div class="box-content" contenteditable="true" style="padding: 10px; border: 1px solid #93c5fd; background: rgba(255,255,255,0.9); color: black;">
                Texto flutuante
            </div>
        </div>
      `;
      (activePage as HTMLElement).insertAdjacentHTML('beforeend', textBoxHTML);
      setDocumentContent(editorRef.current?.innerHTML || '');
  };

  const togglePageBorder = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    const page = (range.commonAncestorContainer as HTMLElement).closest('.page');
    if (page) {
         if (page.classList.contains('page-cover')) {
            page.classList.remove('page-cover');
         } else {
             page.classList.add('page-cover');
         }
    }
  };

  // --- PREVIEW / WORD EDITOR UI ---
  if (mode === 'preview') {
      return (
        <div className="fixed inset-0 z-50 bg-[#f0f0f0] flex flex-col animate-fade-in overflow-hidden">
            <style>{`
                /* Editor UI */
                .iv4-word-ribbon {
                    background: #f3f4f6;
                    border-bottom: 1px solid #d1d5db;
                }
                .ribbon-tab {
                    padding: 8px 16px;
                    font-size: 13px;
                    cursor: pointer;
                    color: #374151;
                    border-top-left-radius: 4px;
                    border-top-right-radius: 4px;
                }
                .ribbon-tab.active {
                    background: white;
                    color: #2563eb;
                    font-weight: 600;
                    border-bottom: 2px solid #2563eb;
                }
                .ribbon-group {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 0 12px;
                    border-right: 1px solid #e5e7eb;
                    height: 100%;
                }
                .ribbon-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 4px 8px;
                    border-radius: 4px;
                    color: #4b5563;
                    font-size: 11px;
                    gap: 2px;
                    min-width: 40px;
                }
                .ribbon-btn:hover { background: #e5e7eb; color: black; }
                .ribbon-btn-sm { padding: 4px; }
                
                /* Draggable Logic (Simple CSS Based, needs JS for actual move) */
                .draggable-box:active .drag-handle { cursor: grabbing; background: #60a5fa !important; }
            `}</style>

            {/* --- TOP BAR (System) --- */}
            <div className="h-10 bg-[#2b579a] flex items-center justify-between px-4 text-white shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => setMode('wizard')} className="hover:bg-white/20 p-1 rounded"><ArrowLeft size={16}/></button>
                    <span className="font-semibold text-sm flex items-center gap-2 max-w-[150px] md:max-w-none truncate"><FileText size={14}/> {metadata.topic || "Documento Sem Título"}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowSavedDocsModal(true)} className="p-1.5 hover:bg-white/20 rounded" title="Abrir"><FolderOpen size={16}/></button>
                    <button onClick={saveDocument} className="p-1.5 hover:bg-white/20 rounded" title="Salvar"><Save size={16}/></button>
                </div>
            </div>

            {/* --- RIBBON INTERFACE --- */}
            <div className="bg-white border-b border-gray-300 shadow-sm shrink-0 flex flex-col">
                {/* Tabs */}
                <div className="flex px-2 bg-[#f3f4f6] pt-1 overflow-x-auto">
                    <div className={`ribbon-tab whitespace-nowrap ${activeTab === 'inicio' ? 'active' : ''}`} onClick={() => setActiveTab('inicio')}>Início</div>
                    <div className={`ribbon-tab whitespace-nowrap ${activeTab === 'inserir' ? 'active' : ''}`} onClick={() => setActiveTab('inserir')}>Inserir</div>
                    <div className={`ribbon-tab whitespace-nowrap ${activeTab === 'layout' ? 'active' : ''}`} onClick={() => setActiveTab('layout')}>Leiaute</div>
                </div>

                {/* Toolbar Content */}
                <div className="h-24 flex items-center px-2 py-2 gap-2 bg-white overflow-x-auto custom-scrollbar">
                    
                    {activeTab === 'inicio' && (
                        <>
                            <div className="ribbon-group">
                                <button className="ribbon-btn" onClick={() => executeCommand('paste')}><div className="bg-yellow-100 p-2 rounded"><FolderOpen size={20} className="text-yellow-600"/></div>Colar</button>
                            </div>
                            <div className="ribbon-group">
                                <div className="flex flex-col gap-1">
                                    <div className="flex gap-1">
                                        <select onChange={(e) => executeCommand('fontName', e.target.value)} className="h-6 text-xs border border-gray-300 rounded w-24 md:w-32">
                                            <option value="Times New Roman">Times</option>
                                            <option value="Arial">Arial</option>
                                            <option value="Calibri">Calibri</option>
                                        </select>
                                        <select onChange={(e) => executeCommand('fontSize', e.target.value)} className="h-6 text-xs border border-gray-300 rounded w-14">
                                            <option value="3">12</option>
                                            <option value="4">14</option>
                                            <option value="5">18</option>
                                            <option value="6">24</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-1">
                                        <button className="ribbon-btn-sm hover:bg-gray-100 rounded" onClick={() => executeCommand('bold')}><Bold size={16}/></button>
                                        <button className="ribbon-btn-sm hover:bg-gray-100 rounded" onClick={() => executeCommand('italic')}><Italic size={16}/></button>
                                        <button className="ribbon-btn-sm hover:bg-gray-100 rounded" onClick={() => executeCommand('underline')}><Underline size={16}/></button>
                                    </div>
                                </div>
                            </div>
                            <div className="ribbon-group hidden md:flex">
                                <div className="flex flex-col gap-1">
                                    <div className="flex gap-1">
                                         <button className="ribbon-btn-sm hover:bg-gray-100 rounded" onClick={() => executeCommand('insertUnorderedList')}><List size={16}/></button>
                                         <button className="ribbon-btn-sm hover:bg-gray-100 rounded" onClick={() => executeCommand('insertOrderedList')}><ListOrdered size={16}/></button>
                                    </div>
                                    <div className="flex gap-1">
                                        <button className="ribbon-btn-sm hover:bg-gray-100 rounded" onClick={() => executeCommand('justifyLeft')}><AlignLeft size={16}/></button>
                                        <button className="ribbon-btn-sm hover:bg-gray-100 rounded" onClick={() => executeCommand('justifyCenter')}><AlignCenter size={16}/></button>
                                        <button className="ribbon-btn-sm hover:bg-gray-100 rounded" onClick={() => executeCommand('justifyRight')}><AlignRight size={16}/></button>
                                    </div>
                                </div>
                            </div>
                            <div className="ribbon-group">
                                <button className="ribbon-btn whitespace-nowrap" onClick={() => setShowHumanizer(true)}>
                                    <Sparkles size={20} className="text-purple-600" /> Humanizar
                                </button>
                                <button className="ribbon-btn whitespace-nowrap" onClick={() => setShowAIEditModal(true)}>
                                    <Edit3 size={20} className="text-green-600" /> Editar IA
                                </button>
                            </div>
                        </>
                    )}

                    {activeTab === 'inserir' && (
                        <>
                            <div className="ribbon-group">
                                <button className="ribbon-btn whitespace-nowrap" onClick={addNewPage}><PlusCircle size={24} className="text-blue-600"/>Nova Página</button>
                            </div>
                            <div className="ribbon-group">
                                <button className="ribbon-btn whitespace-nowrap" onClick={insertTextBox}><BoxSelect size={24} className="text-gray-600"/>Cx Texto</button>
                                <button className="ribbon-btn"><ImageIcon size={24} className="text-gray-600"/>Imagem</button>
                            </div>
                        </>
                    )}

                    {activeTab === 'layout' && (
                        <>
                             <div className="ribbon-group">
                                <button className="ribbon-btn" onClick={togglePageBorder}><Frame size={24}/>Bordas</button>
                            </div>
                            <div className="ribbon-group">
                                <button className="ribbon-btn" onClick={() => executeCommand('indent')}><Indent size={24}/>Recuar</button>
                                <button className="ribbon-btn" onClick={() => executeCommand('outdent')}><Outdent size={24}/>Avançar</button>
                            </div>
                        </>
                    )}

                    <div className="flex-grow"></div>
                    <button onClick={handleDownloadPDF} className="bg-blue-600 text-white px-3 py-2 rounded shadow hover:bg-blue-700 flex items-center gap-2 whitespace-nowrap text-sm">
                        <Download size={16}/> PDF
                    </button>
                </div>
            </div>

            {/* --- DOCUMENT EDITOR --- */}
            <div className="flex-grow overflow-y-auto bg-[#e5e5e5] p-2 md:p-8 flex justify-center relative">
                {/* AI Edit Button Floating */}
                <button 
                    onClick={() => setShowAIEditModal(true)}
                    className="absolute right-4 bottom-4 md:right-8 md:top-8 md:bottom-auto bg-green-600 text-white p-3 rounded-full shadow-lg hover:bg-green-700 transition-transform hover:scale-105 z-40 flex items-center gap-2"
                >
                    <Edit3 size={20} /> <span className="text-sm font-bold hidden md:inline">Editar com IA</span>
                </button>

                <div id="printable-content" className="iv4-document-wrapper w-full flex justify-center">
                    <div 
                        ref={editorRef}
                        className="iv4-editor outline-none iv4-document-container w-full"
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(e) => setDocumentContent(e.currentTarget.innerHTML)}
                        dangerouslySetInnerHTML={{ __html: documentContent }}
                        onBlur={() => setDocumentContent(editorRef.current?.innerHTML || '')}
                    />
                </div>
            </div>

            {/* --- MODALS --- */}
            
            {/* AI Edit Modal */}
            {showAIEditModal && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900"><Sparkles className="text-green-600"/> Editor Inteligente</h3>
                            <button onClick={() => setShowAIEditModal(false)}><X size={20} className="text-gray-500"/></button>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">Diga o que você quer mudar no documento (Ex: "Adicione um parágrafo sobre a Guerra Fria na Introdução" ou "Mude o nome do aluno para João").</p>
                        <textarea 
                            value={aiEditPrompt}
                            onChange={(e) => setAiEditPrompt(e.target.value)}
                            className="w-full h-32 border border-gray-300 rounded-lg p-3 mb-4 focus:ring-2 focus:ring-green-500 outline-none resize-none text-black"
                            placeholder="Descreva as alterações..."
                        />
                        <button 
                            onClick={handleAIEdit}
                            disabled={isAIEditing}
                            className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {isAIEditing ? <Loader2 className="animate-spin"/> : <Send size={18}/>}
                            {isAIEditing ? 'Processando...' : 'Aplicar Alterações'}
                        </button>
                    </div>
                </div>
            )}

            {/* Saved Docs Modal */}
            {showSavedDocsModal && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900"><FolderOpen className="text-blue-600"/> Documentos Salvos</h3>
                            <button onClick={() => setShowSavedDocsModal(false)}><X size={20} className="text-gray-500"/></button>
                        </div>
                        
                        <div className="overflow-y-auto flex-grow">
                            {savedDocuments.length === 0 ? (
                                <p className="text-center text-gray-500 py-10">Nenhum documento salvo.</p>
                            ) : (
                                <div className="space-y-2">
                                    {savedDocuments.map(doc => (
                                        <div key={doc.id} onClick={() => loadDocument(doc)} className="flex items-center justify-between p-3 hover:bg-gray-100 rounded-lg cursor-pointer border border-gray-100">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-100 p-2 rounded text-blue-600"><FileText size={20}/></div>
                                                <div>
                                                    <p className="font-medium text-gray-800">{doc.title}</p>
                                                    <p className="text-xs text-gray-500">{new Date(doc.createdAt).toLocaleDateString()} às {new Date(doc.createdAt).toLocaleTimeString()}</p>
                                                </div>
                                            </div>
                                            <button onClick={(e) => deleteSavedDocument(doc.id, e)} className="p-2 text-gray-400 hover:text-red-500"><X size={18}/></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

             <Humanizer 
                isOpen={showHumanizer}
                onClose={() => setShowHumanizer(false)}
                currentText={documentContent}
                onApply={(text) => {
                    setDocumentContent(text);
                    if (editorRef.current) {
                        editorRef.current.innerHTML = text;
                    }
                }}
            />
        </div>
      );
  }

  // --- WIZARD UI (CHAT) ---
  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto animate-fade-in relative">
        <div className="absolute top-0 right-0 p-4">
             <button onClick={() => setShowSavedDocsModal(true)} className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg text-sm hover:bg-indigo-100">
                <FolderOpen size={16}/> Abrir Salvos
             </button>
        </div>

        <div className="flex-grow overflow-y-auto space-y-4 pb-4 custom-scrollbar">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl ${
                        msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : msg.role === 'system'
                        ? 'bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800'
                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none shadow-sm'
                    }`}>
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                </div>
            ))}
            <div ref={messagesEndRef} />
        </div>

        {/* Error Banner for Wizard */}
        {errorMsg && (
             <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 p-3 rounded-lg mb-2 flex items-center gap-2 text-sm border border-red-200 dark:border-red-800">
                <AlertTriangle size={16} />
                {errorMsg}
                <button onClick={() => setErrorMsg(null)} className="ml-auto"><X size={14}/></button>
             </div>
        )}

        <div className="mt-4 bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col gap-2 shadow-sm">
            {isReadyToGenerate && (
                <div className="px-2 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg flex justify-between items-center animate-fade-in">
                    <span className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                        <CheckCircle size={16}/> Tudo pronto para criar o documento!
                    </span>
                    <button 
                        onClick={handleGenerateDocument}
                        disabled={isGeneratingDoc}
                        className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isGeneratingDoc ? <Loader2 className="animate-spin" size={16}/> : <FileCheck size={16}/>}
                        {isGeneratingDoc ? 'Gerando...' : 'Gerar Agora'}
                    </button>
                </div>
            )}
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Responda ou descreva o documento..."
                    className="flex-grow bg-transparent px-3 py-2 outline-none text-gray-900 dark:text-white placeholder-gray-400"
                    disabled={isGeneratingDoc}
                />
                <button 
                    onClick={handleSendMessage}
                    disabled={!input.trim() || isTyping || isGeneratingDoc}
                    className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
        
        {/* Saved Docs Modal (Wizard View) */}
         {showSavedDocsModal && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900"><FolderOpen className="text-blue-600"/> Documentos Salvos</h3>
                            <button onClick={() => setShowSavedDocsModal(false)}><X size={20} className="text-gray-500"/></button>
                        </div>
                        
                        <div className="overflow-y-auto flex-grow">
                            {savedDocuments.length === 0 ? (
                                <p className="text-center text-gray-500 py-10">Nenhum documento salvo.</p>
                            ) : (
                                <div className="space-y-2">
                                    {savedDocuments.map(doc => (
                                        <div key={doc.id} onClick={() => loadDocument(doc)} className="flex items-center justify-between p-3 hover:bg-gray-100 rounded-lg cursor-pointer border border-gray-100">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-100 p-2 rounded text-blue-600"><FileText size={20}/></div>
                                                <div>
                                                    <p className="font-medium text-gray-800">{doc.title}</p>
                                                    <p className="text-xs text-gray-500">{new Date(doc.createdAt).toLocaleDateString()} às {new Date(doc.createdAt).toLocaleTimeString()}</p>
                                                </div>
                                            </div>
                                            <button onClick={(e) => deleteSavedDocument(doc.id, e)} className="p-2 text-gray-400 hover:text-red-500"><X size={18}/></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
    </div>
  );
};