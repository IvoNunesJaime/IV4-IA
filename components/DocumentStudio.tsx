import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, ArrowLeft, Download, User, School, BookOpen, GraduationCap, FileCheck, CheckCircle, Loader2, Edit3, Save, Layers, Book, Briefcase, FileText, Mail, FileType, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Undo, Redo, PlusCircle, Type, Frame, Minus, Indent, Outdent, BoxSelect, Move } from 'lucide-react';
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

export const DocumentStudio: React.FC<DocumentStudioProps> = ({ checkUsageLimit }) => {
  // Modes: 'wizard' (chatting details) | 'preview' (generated doc)
  const [mode, setMode] = useState<'wizard' | 'preview'>('wizard');
  
  // Chat State
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<StudioMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Metadata State (Flexible now)
  const [metadata, setMetadata] = useState<any>({});
  const [isReadyToGenerate, setIsReadyToGenerate] = useState(false);

  // Preview State
  const [documentContent, setDocumentContent] = useState<string>('');
  const [showHumanizer, setShowHumanizer] = useState(false);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Dragging State for Text Boxes
  const [dragState, setDragState] = useState<{
      isDragging: boolean;
      element: HTMLElement | null;
      startX: number;
      startY: number;
      initialLeft: number;
      initialTop: number;
  }>({ isDragging: false, element: null, startX: 0, startY: 0, initialLeft: 0, initialTop: 0 });

  // Initial Greeting
  useEffect(() => {
    if (messages.length === 0) {
        setMessages([{
            id: 'init',
            role: 'assistant',
            text: 'Olá! Sou o Criador de Documentos do IV4. O que deseja criar hoje? (Ex: "Um trabalho de História", "Um Currículo Vitae", "Uma carta de pedido de emprego").'
        }]);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- DRAG AND DROP LOGIC FOR TEXT BOXES ---
  const handleMouseDown = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if clicking a drag handle
      if (target.classList.contains('drag-handle')) {
          const draggableBox = target.closest('.draggable-box') as HTMLElement;
          if (draggableBox) {
              e.preventDefault(); // Prevent text selection
              const rect = draggableBox.getBoundingClientRect();
              
              // We need to calculate position relative to the PAGE parent, not screen
              const parentPage = draggableBox.closest('.page') as HTMLElement;
              const parentRect = parentPage.getBoundingClientRect();

              setDragState({
                  isDragging: true,
                  element: draggableBox,
                  startX: e.clientX,
                  startY: e.clientY,
                  initialLeft: draggableBox.offsetLeft,
                  initialTop: draggableBox.offsetTop
              });
          }
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!dragState.isDragging || !dragState.element) return;

      e.preventDefault();
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;

      const newLeft = dragState.initialLeft + dx;
      const newTop = dragState.initialTop + dy;

      dragState.element.style.left = `${newLeft}px`;
      dragState.element.style.top = `${newTop}px`;
  };

  const handleMouseUp = () => {
      if (dragState.isDragging) {
          setDragState({ ...dragState, isDragging: false, element: null });
          // Update content state
          if (editorRef.current) {
              setDocumentContent(editorRef.current.innerHTML);
          }
      }
  };


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
        setMetadata((prev: any) => ({ ...prev, ...result.extractedData }));
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

  const handleDownloadWord = () => {
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
            /* Hide UI elements from Word */
            .drag-handle { display: none !important; }
            .draggable-box { border: none !important; }
        </style>
      </head>
      <body>`;
    const footer = "</body></html>";
    const sourceHTML = header + documentContent + footer;
    
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `Documento_IV4_${Date.now()}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  const handleDownloadPDF = () => {
    // Triggers the browser print dialog, which is the most robust way to save HTML/CSS as PDF
    window.print();
  };

  const executeCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
        editorRef.current.focus();
    }
  };

  const addNewPage = () => {
      if (editorRef.current) {
          const newPage = document.createElement('div');
          newPage.className = 'page';
          newPage.innerHTML = '<p><br/></p>'; // Empty content
          editorRef.current.appendChild(newPage);
          setDocumentContent(editorRef.current.innerHTML);
          
          // Scroll to new page
          setTimeout(() => {
              newPage.scrollIntoView({ behavior: 'smooth' });
          }, 100);
      }
  };

  const insertTextBox = () => {
      const selection = window.getSelection();
      if (!selection || !editorRef.current) return;

      // Try to find the active page
      let activePage = document.querySelector('.page:hover') || document.querySelector('.page');
      
      if (!activePage) {
          alert("Por favor, clique dentro de uma página primeiro.");
          return;
      }

      // Create the text box structure
      const textBoxHTML = `
        <div class="draggable-box" style="position: absolute; left: 100px; top: 100px; min-width: 150px; min-height: 50px; z-index: 10;">
            <div class="drag-handle" contenteditable="false" style="background: #e0e7ff; height: 16px; cursor: move; border-radius: 4px 4px 0 0; display: flex; justify-content: center; align-items: center;">
                <div style="width: 20px; height: 4px; background: #a5b4fc; border-radius: 2px;"></div>
            </div>
            <div class="box-content" contenteditable="true" style="padding: 8px; border: 1px dashed #ccc; background: rgba(255,255,255,0.8);">
                Escreva aqui...
            </div>
        </div>
      `;

      // Insert into the active page (append to end so it sits on top)
      (activePage as HTMLElement).insertAdjacentHTML('beforeend', textBoxHTML);
      setDocumentContent(editorRef.current.innerHTML);
  };

  const togglePageBorder = () => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !editorRef.current) {
        alert("Clique dentro de uma página para aplicar a esquadria.");
        return;
    }

    const range = selection.getRangeAt(0);
    // Find the closest .page ancestor
    let currentNode: Node | null = range.commonAncestorContainer;
    while (currentNode && currentNode !== editorRef.current) {
        if (currentNode.nodeType === 1 && (currentNode as HTMLElement).classList.contains('page')) {
            break;
        }
        currentNode = currentNode.parentNode;
    }

    if (currentNode && (currentNode as HTMLElement).classList.contains('page')) {
        const page = currentNode as HTMLElement;
        const hasBorder = page.querySelector('.cover-border-outer');

        if (hasBorder) {
            // Remove border: Extract content from inner, replace page content
            const innerContent = page.querySelector('.cover-border-inner')?.innerHTML;
            if (innerContent) {
                page.innerHTML = innerContent;
                page.classList.remove('page-cover');
                page.style.padding = "3cm 2.5cm 2.5cm 3cm"; // Reset default padding
            }
        } else {
            // Add border: Wrap content
            const currentContent = page.innerHTML;
            page.innerHTML = `
                <div class="cover-border-outer">
                    <div class="cover-border-inner">
                        ${currentContent}
                    </div>
                </div>
            `;
            page.classList.add('page-cover');
            page.style.padding = "1cm"; // Reduced padding for cover
        }
        // Update state
        setDocumentContent(editorRef.current.innerHTML);
    } else {
        alert("Não foi possível encontrar a página atual. Clique no texto da página.");
    }
  };

  // Helper to render metadata fields dynamically
  const renderMetadataFields = () => {
      const docType = metadata.docType;

      if (docType === 'TRABALHO_ESCOLAR') {
          return (
              <>
                <InfoField icon={School} label="Escola" value={metadata.school} />
                <InfoField icon={BookOpen} label="Disciplina/Tema" value={metadata.topic || metadata.subject} />
                <InfoField icon={User} label="Aluno" value={metadata.student} />
                <InfoField icon={GraduationCap} label="Docente" value={metadata.teacher} />
                <div className="grid grid-cols-2 gap-2">
                    <InfoField label="Classe" value={metadata.grade} />
                    <InfoField label="Turma" value={metadata.class} />
                </div>
              </>
          );
      } else if (docType === 'CURRICULO') {
          return (
              <>
                <InfoField icon={User} label="Nome" value={metadata.cvData?.name || metadata.student} />
                <InfoField icon={Briefcase} label="Experiência" value={metadata.cvData?.experience ? 'Informada' : 'Pendente'} />
                <InfoField icon={Book} label="Educação" value={metadata.cvData?.education ? 'Informada' : 'Pendente'} />
                <InfoField icon={FileText} label="Resumo" value={metadata.cvData?.summary ? 'Sim' : 'Não'} />
              </>
          );
      } else if (docType === 'CARTA') {
           return (
              <>
                <InfoField icon={User} label="De (Remetente)" value={metadata.letterData?.from || metadata.student} />
                <InfoField icon={User} label="Para (Destinatário)" value={metadata.letterData?.to} />
                <InfoField icon={Mail} label="Assunto" value={metadata.letterData?.subject} />
              </>
          );
      }

      // Default Generic
      return (
          <>
            <InfoField icon={FileText} label="Tipo" value={docType || 'Genérico'} />
            <InfoField icon={BookOpen} label="Tópico/Assunto" value={metadata.topic} />
          </>
      );
  };

  // --- PREVIEW MODE ---
  if (mode === 'preview') {
      return (
        <div 
            className="fixed inset-0 z-50 bg-gray-100 dark:bg-gray-900 flex flex-col animate-fade-in overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
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
                    padding: 3cm 2.5cm 2.5cm 3cm; /* Margins: Top Right Bottom Left */
                    margin: 0 auto 30px auto;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    color: black;
                    position: relative;
                    border: none;
                    outline: none;
                    box-sizing: border-box;
                    cursor: text;
                }
                .iv4-editor .page-cover {
                    padding: 1cm !important;
                }
                .iv4-editor .page:last-child {
                    margin-bottom: 100px;
                }
                
                /* Border Styles from Gemini Service */
                .cover-border-outer {
                    border: 3px solid black;
                    height: 100%;
                    width: 100%;
                    padding: 4px;
                    box-sizing: border-box;
                }
                .cover-border-inner {
                    border: 1px solid black;
                    height: 100%;
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    align-items: center;
                    padding: 2cm 1cm;
                    box-sizing: border-box;
                    text-align: center;
                }

                /* Text Box Styles */
                .draggable-box {
                    transition: box-shadow 0.2s;
                }
                .draggable-box:hover {
                    box-shadow: 0 0 0 1px #4f46e5;
                    z-index: 20 !important;
                }
                .box-content {
                    min-height: 20px;
                    outline: none;
                }

                /* Print Styles for PDF Generation */
                @media print {
                    @page {
                        margin: 0;
                        size: auto;
                    }
                    body * {
                        visibility: hidden;
                    }
                    /* Hide UI elements specifically */
                    .no-print, .drag-handle {
                        display: none !important;
                    }
                    /* Show only the content */
                    #printable-content, #printable-content * {
                        visibility: visible;
                    }
                    /* Remove border from text boxes on print */
                    .box-content {
                        border: none !important;
                        background: transparent !important;
                    }
                    #printable-content {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        background: white;
                        padding: 0;
                        margin: 0;
                    }
                    .iv4-editor {
                        padding: 0 !important;
                        background: white !important;
                    }
                    .iv4-editor .page {
                        margin: 0 !important;
                        box-shadow: none !important;
                        page-break-after: always;
                        width: 100% !important;
                        height: auto !important;
                    }
                }
            `}</style>

            {/* Header (Hidden when printing) */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex flex-col shadow-sm shrink-0 z-10 no-print">
                {/* Top Bar */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 dark:border-gray-700">
                    <button 
                        onClick={() => setMode('wizard')}
                        className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} />
                        <span className="font-medium hidden sm:inline">Voltar</span>
                    </button>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setShowHumanizer(true)}
                            className="px-3 py-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                        >
                            <Sparkles size={16} /> <span className="hidden sm:inline">Humanizar</span>
                        </button>
                        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
                        
                        {/* PDF Button */}
                        <button 
                            onClick={handleDownloadPDF}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2 text-sm"
                            title="Salvar como PDF"
                        >
                            <FileType size={16} /> PDF
                        </button>

                        {/* Word Button */}
                        <button 
                            onClick={handleDownloadWord}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2 text-sm"
                            title="Salvar como Word (.doc)"
                        >
                            <FileText size={16} /> Word
                        </button>
                    </div>
                </div>

                {/* Editor Toolbar */}
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 flex items-center gap-1 sm:gap-2 overflow-x-auto">
                     <ToolbarButton onClick={() => executeCommand('undo')} icon={Undo} title="Desfazer" />
                     <ToolbarButton onClick={() => executeCommand('redo')} icon={Redo} title="Refazer" />
                     
                     <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>
                     
                     {/* Font Selection */}
                     <div className="relative flex items-center">
                        <select 
                            onChange={(e) => executeCommand('fontName', e.target.value)} 
                            className="h-8 pl-1 pr-6 bg-transparent border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800"
                            defaultValue="Times New Roman"
                        >
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Arial">Arial</option>
                            <option value="Calibri">Calibri</option>
                            <option value="Verdana">Verdana</option>
                            <option value="Courier New">Courier New</option>
                        </select>
                     </div>

                     {/* Font Size - Updated to Standard Point Sizes */}
                     <div className="relative flex items-center">
                        <select 
                            onChange={(e) => executeCommand('fontSize', e.target.value)} 
                            className="h-8 w-12 pl-1 bg-transparent border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800"
                            defaultValue="3"
                        >
                            <option value="1">8</option>
                            <option value="2">10</option>
                            <option value="3">12</option>
                            <option value="4">14</option>
                            <option value="5">18</option>
                            <option value="6">24</option>
                            <option value="7">36</option>
                        </select>
                     </div>

                     <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>

                     <ToolbarButton onClick={() => executeCommand('bold')} icon={Bold} title="Negrito" />
                     <ToolbarButton onClick={() => executeCommand('italic')} icon={Italic} title="Itálico" />
                     <ToolbarButton onClick={() => executeCommand('underline')} icon={Underline} title="Sublinhado" />
                     
                     <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>
                     
                     <ToolbarButton onClick={() => executeCommand('justifyLeft')} icon={AlignLeft} title="Alinhar à Esquerda" />
                     <ToolbarButton onClick={() => executeCommand('justifyCenter')} icon={AlignCenter} title="Centralizar" />
                     <ToolbarButton onClick={() => executeCommand('justifyRight')} icon={AlignRight} title="Alinhar à Direita" />
                     <ToolbarButton onClick={() => executeCommand('justifyFull')} icon={AlignJustify} title="Justificar" />

                     <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>

                     {/* Indentation */}
                     <ToolbarButton onClick={() => executeCommand('indent')} icon={Indent} title="Aumentar Recuo" />
                     <ToolbarButton onClick={() => executeCommand('outdent')} icon={Outdent} title="Diminuir Recuo" />
                     
                     <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>
                     
                     <ToolbarButton onClick={() => executeCommand('insertUnorderedList')} icon={List} title="Lista com Marcadores" />
                     <ToolbarButton onClick={() => executeCommand('insertOrderedList')} icon={ListOrdered} title="Lista Numerada" />
                     
                     <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>

                     {/* Text Box Button */}
                     <button 
                        onClick={insertTextBox}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                        title="Inserir Caixa de Texto (Arrastável)"
                     >
                        <BoxSelect size={18} />
                        <span className="text-xs font-medium hidden md:inline">Caixa de Texto</span>
                     </button>

                     {/* Esquadria (Border) Button */}
                     <button 
                        onClick={togglePageBorder}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                        title="Adicionar/Remover Esquadria (Borda)"
                     >
                        <Frame size={18} />
                        <span className="text-xs font-medium hidden md:inline">Esquadria</span>
                     </button>

                     <div className="flex-grow"></div>
                     
                     <button 
                        onClick={addNewPage}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm"
                    >
                        <PlusCircle size={14} />
                        Nova Página
                     </button>
                </div>
            </div>

            {/* Content Preview */}
            <div className="flex-grow overflow-y-auto flex justify-center bg-gray-200 dark:bg-[#030712] relative" onMouseDown={handleMouseDown}>
                <div 
                    id="printable-content"
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
        <div className="flex-grow flex flex-col bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
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
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                {isReadyToGenerate && (
                     <button 
                        onClick={handleGenerateDocument}
                        disabled={isGeneratingDoc}
                        className="w-full mb-3 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-200 dark:shadow-none transition-all animate-bounce-short"
                    >
                        {isGeneratingDoc ? <Loader2 className="animate-spin"/> : <CheckCircle />}
                        {isGeneratingDoc ? 'Gerando Documento...' : 'Tudo pronto! Gerar Agora'}
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
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 h-full">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <FileCheck className="text-indigo-500" />
                    Resumo do Documento
                </h3>

                <div className="space-y-6">
                    {renderMetadataFields()}
                </div>

                <div className="mt-8 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                    <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                        <span className="font-bold">Dica IV4:</span> Quanto mais detalhes fornecer, melhor ficará o seu documento. Experimente pedir Currículos ou Cartas!
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
};

const ToolbarButton: React.FC<{ onClick: () => void, icon: any, title: string }> = ({ onClick, icon: Icon, title }) => (
    <button 
        onMouseDown={(e) => { e.preventDefault(); onClick(); }}
        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
        title={title}
    >
        <Icon size={18} />
    </button>
);

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