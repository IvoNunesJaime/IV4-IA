import React, { useState, useRef } from 'react';
import { FileText, Sparkles, Image as ImageIcon, X, Layout, Briefcase, GraduationCap, FileCheck, Frame, ArrowLeft } from 'lucide-react';
import { GeminiService } from '../services/geminiService';
import { RichTextEditor } from './RichTextEditor';
import { Humanizer } from './Humanizer';

interface DocumentStudioProps {
    checkUsageLimit: () => boolean;
}

export const DocumentStudio: React.FC<DocumentStudioProps> = ({ checkUsageLimit }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [documentContent, setDocumentContent] = useState<string>('');
  const [showHumanizer, setShowHumanizer] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [addBorder, setAddBorder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleGenerate = async (overridePrompt?: string) => {
    const finalPrompt = overridePrompt || prompt;
    if (!finalPrompt.trim()) return;

    if (!checkUsageLimit()) {
        return;
    }

    setIsGenerating(true);
    try {
      const content = await GeminiService.generateDocument(finalPrompt, selectedImage || undefined, addBorder);
      setDocumentContent(content);
      // Don't clear prompt so user sees what they asked for, but clear image
      setSelectedImage(null); 
    } catch (error) {
      alert("Erro ao gerar documento. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleHumanizeApply = (newText: string) => {
    setDocumentContent(newText);
    setShowHumanizer(false);
  };

  const handleTemplateClick = (templatePrompt: string) => {
      setPrompt(templatePrompt);
  };

  const TemplateCard = ({ icon: Icon, title, description, promptTemplate }: any) => (
      <button 
        onClick={() => handleTemplateClick(promptTemplate)}
        className="flex flex-col items-start p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800 transition-all text-left h-full group"
      >
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg mb-4 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <Icon size={24} />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </button>
  );

  // --- RENDER EDITOR VIEW ---
  if (documentContent) {
      return (
        <div className="h-full flex flex-col space-y-4 animate-fade-in">
             <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                <button 
                    onClick={() => setDocumentContent('')}
                    className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors text-sm font-medium"
                >
                    <ArrowLeft size={18} />
                    Voltar ao Criador
                </button>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 hidden sm:inline">Edite ou exporte o seu documento</span>
                </div>
            </div>

            <div className="flex-grow min-h-0">
                <RichTextEditor
                    initialContent={documentContent}
                    onChange={setDocumentContent}
                    onHumanizeRequest={() => setShowHumanizer(true)}
                />
            </div>
            
             <Humanizer 
                isOpen={showHumanizer}
                onClose={() => setShowHumanizer(false)}
                currentText={documentContent}
                onApply={handleHumanizeApply}
            />
        </div>
      );
  }

  // --- RENDER LANDING/INPUT VIEW ---
  return (
    <div className="h-full flex flex-col items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-5xl flex flex-col gap-10 py-10">
            
            {/* Header */}
            <div className="text-center space-y-4">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight">
                    Crie documentos perfeitos com IV4
                </h1>
                <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                    Trabalhos escolares, Curriculum Vitae, Cartas e Projetos. Digite o que precisa e a IA formata tudo para si, com opção de esquadrias e normas ABNT.
                </p>
            </div>

            {/* Input Area */}
            <div className="w-full max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-indigo-100/50 dark:shadow-none border border-gray-200 dark:border-gray-700 p-2 relative">
                 {selectedImage && (
                    <div className="absolute -top-12 left-0 mb-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 flex items-center gap-2 animate-fade-in">
                            <img src={selectedImage} alt="Preview" className="h-8 w-auto rounded" />
                            <span className="text-xs text-gray-500">Imagem anexada</span>
                            <button onClick={() => setSelectedImage(null)} className="text-red-500 hover:bg-red-50 rounded-full p-1"><X size={12}/></button>
                    </div>
                )}
                
                <div className="flex flex-col sm:flex-row items-center gap-2">
                    <div className="flex-grow w-full relative">
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                            placeholder="Ex: Trabalho de Biologia sobre Células ou CV para Motorista..."
                            className="w-full pl-6 pr-4 py-4 bg-transparent border-none focus:ring-0 text-lg text-gray-900 dark:text-white placeholder-gray-400"
                            autoFocus
                        />
                    </div>
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto px-2 pb-2 sm:pb-0">
                         {/* Toggle Border */}
                        <button
                            onClick={() => setAddBorder(!addBorder)}
                            className={`p-3 rounded-xl transition-all flex items-center gap-2 text-sm font-medium border ${
                                addBorder 
                                ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' 
                                : 'bg-gray-50 dark:bg-gray-700/50 border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                            title="Adicionar Esquadria/Borda ao documento"
                        >
                           <Frame size={20} />
                           <span className="hidden sm:inline">Esquadria</span>
                        </button>

                        <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors"
                            title="Enviar imagem de referência"
                        >
                            <ImageIcon size={22} />
                        </button>
                        
                        <button
                            onClick={() => handleGenerate()}
                            disabled={!prompt.trim() || isGenerating}
                            className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isGenerating ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <span>Gerar</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Templates Grid */}
            <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 text-center">Ou escolha um modelo rápido</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <TemplateCard 
                        icon={GraduationCap}
                        title="Trabalho Escolar"
                        description="Estrutura completa com Capa, Índice, Intro e Conclusão."
                        promptTemplate="Crie um Trabalho Escolar completo sobre [ASSUNTO]. Inclua Capa, Índice, Introdução, Desenvolvimento e Conclusão."
                    />
                    <TemplateCard 
                        icon={Briefcase}
                        title="Curriculum Vitae"
                        description="CV profissional moderno para destacar suas habilidades."
                        promptTemplate="Crie um Curriculum Vitae profissional para [NOME/PROFISSÃO]. Inclua Objetivo, Experiência, Educação e Habilidades. Destaque qualidades de liderança."
                    />
                    <TemplateCard 
                        icon={FileCheck}
                        title="Carta Formal"
                        description="Cartas de apresentação, pedidos ou requerimentos."
                        promptTemplate="Escreva uma Carta Formal de [TIPO DE PEDIDO] endereçada a [DESTINATÁRIO]. Use linguagem culta e respeitosa."
                    />
                    <TemplateCard 
                        icon={Layout}
                        title="Projeto de Pesquisa"
                        description="Estrutura para projetos académicos ou científicos."
                        promptTemplate="Desenvolva uma estrutura de Projeto de Pesquisa sobre [TEMA]. Inclua Justificativa, Objetivos Gerais e Específicos e Metodologia."
                    />
                </div>
            </div>

        </div>
    </div>
  );
};