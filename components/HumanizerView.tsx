import React, { useState, useEffect } from 'react';
import { Sparkles, Copy, ArrowRight, RotateCcw, Check, Quote, AlertTriangle } from 'lucide-react';
import { HumanizerVariant } from '../types';
import { GeminiService } from '../services/geminiService';

interface HumanizerViewProps {
  initialText?: string;
  checkUsageLimit: () => boolean;
}

export const HumanizerView: React.FC<HumanizerViewProps> = ({ initialText, checkUsageLimit }) => {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<HumanizerVariant>(HumanizerVariant.PT_PT);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialText) {
      setInputText(initialText);
    }
  }, [initialText]);

  const handleHumanize = async () => {
    if (!inputText.trim()) return;
    if (!checkUsageLimit()) return;

    setIsProcessing(true);
    setOutputText('');
    setErrorMsg(null);
    try {
        const cleanText = inputText.replace(/<[^>]*>?/gm, ' ');
        const result = await GeminiService.humanizeText(cleanText, selectedVariant);
        setOutputText(result);
    } catch (error: any) {
        console.error(error);
        setErrorMsg(error.message || "Erro ao humanizar o texto. Tente novamente.");
    } finally {
        setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(outputText);
    alert("Texto humanizado copiado!");
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-8 max-w-6xl mx-auto animate-fade-in">
        <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Sparkles className="text-indigo-600 dark:text-indigo-400" />
                Estúdio de Humanização
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
                Cole o texto gerado por IA e transforme-o em linguagem natural e humana.
            </p>
        </div>

        <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
            {/* Input Column */}
            <div className="flex flex-col gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-full">
                    <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3 flex justify-between items-center">
                        <span>Texto Original (IA)</span>
                        {inputText && (
                            <button onClick={() => setInputText('')} className="text-xs text-gray-400 hover:text-red-500">
                                Limpar
                            </button>
                        )}
                    </label>
                    <textarea 
                        className="flex-grow w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg p-4 resize-none focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-gray-800 dark:text-gray-200"
                        placeholder="Cole aqui o texto do ChatGPT, DeepSeek ou Gemini..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                    />
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
                        <select 
                            value={selectedVariant}
                            onChange={(e) => setSelectedVariant(e.target.value as HumanizerVariant)}
                            className="w-full sm:w-auto px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:border-indigo-500"
                        >
                            {Object.values(HumanizerVariant).map(v => (
                                <option key={v} value={v}>{v}</option>
                            ))}
                        </select>
                        <button 
                            onClick={handleHumanize}
                            disabled={!inputText.trim() || isProcessing}
                            className="w-full sm:w-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none"
                        >
                            {isProcessing ? (
                                <>
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                Processando...
                                </>
                            ) : (
                                <>
                                <RotateCcw size={18} />
                                Humanizar Texto
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Output Column */}
            <div className="flex flex-col gap-4">
                 <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-full relative overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 p-20 bg-green-500/5 blur-[100px] rounded-full pointer-events-none"></div>

                    <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <span>Resultado Humanizado</span>
                        {outputText && <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] rounded-full uppercase tracking-wider">Pronto</span>}
                    </label>
                    
                    <div className="flex-grow w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg p-4 relative overflow-y-auto">
                        {errorMsg ? (
                            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                                <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-full mb-3 text-red-500">
                                    <AlertTriangle size={32} />
                                </div>
                                <h3 className="text-red-600 dark:text-red-400 font-semibold mb-1">Falha na Humanização</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{errorMsg}</p>
                            </div>
                        ) : outputText ? (
                            <p className="whitespace-pre-wrap leading-relaxed text-gray-800 dark:text-gray-200">
                                {outputText}
                            </p>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 p-8 text-center opacity-60">
                                <Quote size={48} className="mb-4 text-indigo-200 dark:text-gray-700" />
                                <p>O texto reescrito aparecerá aqui.</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                        <button 
                            onClick={copyToClipboard}
                            disabled={!outputText}
                            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <Copy size={18} />
                            Copiar Resultado
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};