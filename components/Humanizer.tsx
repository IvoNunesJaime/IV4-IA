import React, { useState } from 'react';
import { X, Sparkles, Check } from 'lucide-react';
import { HumanizerVariant } from '../types';
import { GeminiService } from '../services/geminiService';

interface HumanizerProps {
  currentText: string;
  isOpen: boolean;
  onClose: () => void;
  onApply: (newText: string) => void;
}

export const Humanizer: React.FC<HumanizerProps> = ({ currentText, isOpen, onClose, onApply }) => {
  const [selectedVariant, setSelectedVariant] = useState<HumanizerVariant>(HumanizerVariant.PT_PT);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleHumanize = async () => {
    setIsProcessing(true);
    setPreviewText(null);
    try {
        const cleanText = currentText.replace(/<[^>]*>?/gm, ' ');
        const result = await GeminiService.humanizeText(cleanText, selectedVariant);
        const formattedResult = result.split('\n').map(line => line.trim() ? `<p>${line}</p>` : '').join('');
        setPreviewText(formattedResult);
    } catch (error) {
        console.error(error);
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100 dark:border-gray-800 transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-900/20">
          <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300">
            <Sparkles size={20} className="text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-semibold text-lg">Estúdio de Humanização</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Escolha a variante:</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.values(HumanizerVariant).map((variant) => (
                <button
                  key={variant}
                  onClick={() => setSelectedVariant(variant)}
                  className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                    selectedVariant === variant
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {variant}
                </button>
              ))}
            </div>
          </div>

          {!previewText ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">O texto atual será reescrito para parecer mais natural e nativo.</p>
              <button
                onClick={handleHumanize}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isProcessing ? (
                    <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Humanizando...
                    </>
                ) : (
                    <>
                        <Sparkles size={18} />
                        Humanizar Agora
                    </>
                )}
              </button>
            </div>
          ) : (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-100 dark:border-green-800">
                <h3 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">Resultado:</h3>
                <div 
                    className="prose prose-sm max-w-none text-black max-h-60 overflow-y-auto p-2 bg-white rounded border border-green-100" // Keep preview text black/white background for readability like editor
                    dangerouslySetInnerHTML={{__html: previewText}}
                />
            </div>
          )}
        </div>

        {/* Footer */}
        {previewText && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
            <button
              onClick={() => setPreviewText(null)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm font-medium"
            >
              Tentar Novamente
            </button>
            <button
              onClick={() => onApply(previewText)}
              className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 flex items-center gap-2"
            >
              <Check size={16} /> Aplicar Texto
            </button>
          </div>
        )}
      </div>
    </div>
  );
};