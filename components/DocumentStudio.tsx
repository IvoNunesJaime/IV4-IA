import React, { useState, useRef } from 'react';
import { FileText, Wand2, Sparkles, Image as ImageIcon, X } from 'lucide-react';
import { GeminiService } from '../services/geminiService';
import { RichTextEditor } from './RichTextEditor';
import { Humanizer } from './Humanizer';

interface DocumentStudioProps {
    checkUsageLimit: () => boolean;
}

export const DocumentStudio: React.FC<DocumentStudioProps> = ({ checkUsageLimit }) => {
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [documentContent, setDocumentContent] = useState<string>('');
  const [showHumanizer, setShowHumanizer] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
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

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    if (!checkUsageLimit()) {
        return;
    }

    setIsGenerating(true);
    try {
      const content = await GeminiService.generateDocument(topic, selectedImage || undefined);
      setDocumentContent(content);
      setSelectedImage(null); // Clear image after generation
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

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Generator Input Section */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Wand2 size={20} className="text-indigo-600 dark:text-indigo-400" />
          Gerador de Documentos
        </h2>
        
        {selectedImage && (
             <div className="mb-4 relative inline-block">
                <img src={selectedImage} alt="Context" className="h-20 w-auto rounded-lg border border-gray-200 dark:border-gray-700" />
                <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><X size={12}/></button>
                <p className="text-xs text-gray-500 mt-1">Imagem adicionada ao contexto</p>
             </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-grow relative">
                <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Sobre o que é o trabalho? Ex: A Revolução Industrial..."
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-gray-50 dark:bg-gray-800 text-black dark:text-white"
                    disabled={isGenerating}
                />
            </div>
            
            <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                title="Adicionar imagem de contexto"
            >
                <ImageIcon size={20} />
            </button>

            <button
                onClick={handleGenerate}
                disabled={isGenerating || !topic.trim()}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap font-medium shadow-md shadow-indigo-200 dark:shadow-none"
            >
                {isGenerating ? (
                    <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    A Gerar...
                    </>
                ) : (
                    <>
                    <Sparkles size={18} />
                    Gerar Agora
                    </>
                )}
            </button>
        </div>
      </div>

      {/* Editor Section */}
      {documentContent ? (
        <div className="flex-grow min-h-0 animate-fade-in">
          <RichTextEditor
            initialContent={documentContent}
            onChange={setDocumentContent}
            onHumanizeRequest={() => setShowHumanizer(true)}
          />
        </div>
      ) : (
        <div className="flex-grow flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 p-8 transition-colors">
            <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mb-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <FileText size={36} className="text-indigo-200 dark:text-indigo-900" />
            </div>
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">Seu editor aparecerá aqui</h3>
            <p className="text-sm max-w-md text-center">
                Escreva um tema acima (e adicione uma foto opcional) e a IA criará uma estrutura completa.
            </p>
        </div>
      )}

      {/* Modals */}
      <Humanizer 
        isOpen={showHumanizer}
        onClose={() => setShowHumanizer(false)}
        currentText={documentContent}
        onApply={handleHumanizeApply}
      />
    </div>
  );
};