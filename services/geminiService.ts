import { GoogleGenAI } from "@google/genai";
import { HumanizerVariant } from "../types";

// Função auxiliar para obter o cliente de forma segura
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

// Função auxiliar para esperar (delay)
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Traduz erros técnicos para mensagens amigáveis ao utilizador (PT-MZ/PT-PT)
 */
const getFriendlyErrorMessage = (error: any): string => {
    const msg = error.message || error.toString();
    
    if (msg.includes("API_KEY_MISSING")) return "Chave de API não configurada. Contacte o administrador.";
    if (msg.includes("429") || msg.includes("Quota exceeded") || msg.includes("RESOURCE_EXHAUSTED")) {
        return "⚠️ Tráfego elevado (Limite da Google atingido). O sistema está a tentar reconectar, mas se persistir, aguarde 1 minuto.";
    }
    if (msg.includes("503") || msg.includes("Overloaded")) {
        return "⚠️ Os servidores da Google estão sobrecarregados. Tente novamente em breve.";
    }
    if (msg.includes("fetch failed") || msg.includes("NetworkError") || msg.includes("Failed to fetch")) {
        return "⚠️ Erro de conexão. Verifique a sua ligação à internet.";
    }
    if (msg.includes("SAFETY") || msg.includes("blocked")) {
        return "⚠️ A resposta foi bloqueada pelos filtros de segurança (Conteúdo sensível). Tente reformular a sua pergunta.";
    }
    if (msg.includes("400") || msg.includes("INVALID_ARGUMENT")) {
        return "⚠️ O pedido foi rejeitado. O texto ou ficheiro pode ser demasiado grande ou inválido.";
    }

    return "⚠️ Ocorreu um erro inesperado ao comunicar com a IA.";
};

// Wrapper genérico para Retry com Feedback Inteligente
async function withRetry<T>(
    operation: () => Promise<T>, 
    onStatusUpdate?: (msg: string) => void,
    baseRetries = 3, 
    initialDelay = 2000
): Promise<T> {
    let lastError: any;
    let maxRetries = baseRetries;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            const errorMsg = error.message || error.toString();
            
            if (errorMsg.includes("API_KEY") || errorMsg.includes("400") || errorMsg.includes("SAFETY")) {
                throw error;
            }

            const isRateLimit = errorMsg.includes('429') || errorMsg.includes('Quota') || errorMsg.includes('RESOURCE');
            const isServerOverload = errorMsg.includes('503');
            const isNetworkError = errorMsg.includes('fetch failed');

            if (isRateLimit && maxRetries === baseRetries) {
                maxRetries = 6; 
            }

            if (isRateLimit || isServerOverload || isNetworkError) {
                if (i === maxRetries - 1) break;

                let waitTime = initialDelay * Math.pow(2, i);
                if (waitTime > 10000) waitTime = 10000;
                
                if (onStatusUpdate) {
                    const friendly = getFriendlyErrorMessage(error);
                    onStatusUpdate(`\n\n_${friendly} Tentando novamente em ${waitTime/1000}s (${i+1}/${maxRetries})..._`);
                }

                await wait(waitTime);
                continue;
            }
            
            throw error;
        }
    }
    throw lastError;
}

export const GeminiService = {
  /**
   * Chat com a IA com suporte a streaming e nova Persona IV4 IA.
   */
  async chatStream(
      history: { role: string; parts: { text?: string; inlineData?: any }[] }[], 
      message: string, 
      onChunk: (text: string) => void,
      mediaBase64?: string, 
      mediaType?: string, 
      signal?: AbortSignal,
      config?: { isThinking?: boolean; isSearch?: boolean }
  ): Promise<void> {
    let hasReceivedContent = false;

    try {
      const ai = getAiClient();
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      };
      const currentFullDate = now.toLocaleDateString('pt-PT', options);

      const systemInstruction = `
        Você é o IV4 IA, um assistente de inteligência artificial avançado criado por Ivo Nunes Jaime em Lichinga, Niassa, Moçambique.
        
        Seu propósito principal é ajudar pessoas com informações claras, conselhos práticos e apoio acessível — mesmo quando a internet está lenta.

        == REGRAS DE COMPORTAMENTO (MODO ONLINE) ==
        - Forneça respostas completas, atualizadas e contextualizadas.
        - Mantenha o tom profissional, acolhedor e inspirador.
        - Idioma: Português de Moçambique.
        - SAUDAÇÕES: Responda a "Olá", "Oi", "Bom dia", etc., de forma natural e BREVE (ex: "Olá! Como posso ajudar hoje?"). NÃO recite sua biografia ou detalhes do criador em saudações simples. Só fale da sua origem se perguntado "quem é você?" ou "quem te criou?".
        - Priorize conhecimento essencial para Moçambique: Saúde primária, higiene, educação, agricultura familiar e direitos cívicos.

        == CONTEXTO TEMPORAL ==
        HOJE: ${currentFullDate}.
        LOCAL: Moçambique.
        
        ${config?.isSearch ? 'Use Google Search se necessário.' : 'Use seu conhecimento interno.'}
      `;

      const tools: any[] = [];
      if (config?.isSearch) tools.push({ googleSearch: {} });

      const modelConfig: any = {
        systemInstruction: systemInstruction,
      };

      if (tools.length > 0) modelConfig.tools = tools;
      if (config?.isThinking) modelConfig.thinkingConfig = { thinkingBudget: 16384 }; 

      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: history,
        config: modelConfig
      });

      await withRetry(async () => {
          let responseStream;
          if (mediaBase64 && mediaType) {
            const base64Data = mediaBase64.includes(',') ? mediaBase64.split(',')[1] : mediaBase64;
            responseStream = await chat.sendMessageStream({
                message: [{ text: message }, { inlineData: { data: base64Data, mimeType: mediaType } }]
            });
          } else {
            responseStream = await chat.sendMessageStream({ message: message });
          }

          for await (const chunk of responseStream) {
            if (signal?.aborted) break;
            const text = chunk.text;
            if (text) {
                hasReceivedContent = true;
                onChunk(text);
            }
          }
      }, (statusMsg) => {
          if (hasReceivedContent) onChunk(statusMsg);
      });

    } catch (error: any) {
      console.error("Chat Stream Error:", error);
      
      // MODO OFFLINE FALLBACK (Como solicitado pelo usuário)
      // Se a API falhar completamente, agimos como "IV4 IA (modo offline)"
      const offlineFallback = (msg: string) => {
          const lower = msg.toLowerCase();
          let advice = "No momento estou com dificuldades de conexão aos meus servidores principais.";
          
          if (lower.includes("saúde") || lower.includes("doente") || lower.includes("febre") || lower.includes("diarreia")) {
              advice = "Se houver febre ou mal-estar persistente, procure o centro de saúde mais próximo. Beba muita água filtrada ou fervida e mantenha o repouso.";
          } else if (lower.includes("olá") || lower.includes("oi") || lower.includes("bom dia")) {
              advice = "Olá! Estou a operar em modo básico devido a problemas de rede. Como posso ajudar com conselhos práticos?";
          } else if (lower.includes("escola") || lower.includes("estudar") || lower.includes("trabalho")) {
              advice = "Para estudar melhor, organize o seu tempo em blocos de 30 minutos e faça revisões constantes dos seus apontamentos.";
          }

          return `IV4 IA (modo offline): ${advice} Tente novamente em alguns minutos para obter uma resposta completa.`;
      };

      if (!hasReceivedContent) {
          onChunk(offlineFallback(message));
      } else {
          const friendlyMsg = getFriendlyErrorMessage(error);
          onChunk(`\n\n---\n**Nota:** A conexão foi interrompida. Entrei em modo offline limitado.`);
      }
    }
  },

  async chat(
      history: { role: string; parts: { text?: string; inlineData?: any }[] }[], 
      message: string, 
      mediaBase64?: string, 
      mediaType?: string, 
      signal?: AbortSignal
  ): Promise<string> {
    let fullText = "";
    try {
        await this.chatStream(history, message, (chunk) => { fullText += chunk; }, mediaBase64, mediaType, signal);
        return fullText;
    } catch (e: any) {
        throw e;
    }
  },

  async negotiateDocumentDetails(history: { role: string; text: string }[], currentMessage: string): Promise<{ 
      reply: string; extractedData: any; isReady: boolean 
  }> {
    return withRetry(async () => {
        try {
            const ai = getAiClient();
            const prompt = `
                Objetivo: Extrair dados para gerar documento (Contexto: Moçambique).
                Histórico: ${JSON.stringify(history)}
                Nova Msg: "${currentMessage}"
                Extraia JSON: { "reply": "...", "extractedData": {...}, "isReady": boolean }
            `;
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            return JSON.parse(response.text || "{}");
        } catch (error: any) {
             throw new Error(getFriendlyErrorMessage(error));
        }
    });
  },

  async editDocumentFragment(currentHTML: string, userInstruction: string): Promise<string> {
    return withRetry(async () => {
        const ai = getAiClient();
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Edite este HTML seguindo a instrução: "${userInstruction}".\nHTML: ${currentHTML}`
            });
            return (response.text || currentHTML).replace(/```html/g, '').replace(/```/g, '');
        } catch (error: any) {
            throw new Error(getFriendlyErrorMessage(error));
        }
    });
  },

  async generateDocument(data: any, addBorder: boolean = true): Promise<string> {
    return withRetry(async () => {
        const ai = getAiClient();
        const prompt = `Crie um documento HTML Académico Completo (Moçambique). Dados: ${JSON.stringify(data)}. Retorne APENAS HTML.`;
        try {
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            return (response.text || "").replace(/```html/g, '').replace(/```/g, '');
        } catch (error: any) {
            throw new Error(getFriendlyErrorMessage(error));
        }
    });
  },

  async humanizeText(text: string, variant: HumanizerVariant): Promise<string> {
    return withRetry(async () => {
        const ai = getAiClient();
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Reescreva o seguinte texto para que pareça escrito por um humano nativo de ${variant}, mantendo o sentido original mas com fluidez natural: "${text}"`
            });
            return response.text || text;
        } catch (error: any) {
             throw new Error(getFriendlyErrorMessage(error));
        }
    });
  }
};