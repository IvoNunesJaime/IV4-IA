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
    // Permitir mais tentativas se for erro de quota (429)
    let maxRetries = baseRetries;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            const errorMsg = error.message || error.toString();
            
            // Não faz retry para erros fatais (Auth, Bad Request, Safety)
            if (errorMsg.includes("API_KEY") || errorMsg.includes("400") || errorMsg.includes("SAFETY")) {
                throw error;
            }

            const isRateLimit = errorMsg.includes('429') || errorMsg.includes('Quota') || errorMsg.includes('RESOURCE');
            const isServerOverload = errorMsg.includes('503');
            const isNetworkError = errorMsg.includes('fetch failed');

            // Se for Rate Limit, aumentamos as tentativas dinamicamente na primeira falha
            if (isRateLimit && maxRetries === baseRetries) {
                maxRetries = 6; // Aumenta para 6 tentativas (aprox 60s total de espera) para tentar vencer o reset de 1 minuto
            }

            if (isRateLimit || isServerOverload || isNetworkError) {
                if (i === maxRetries - 1) break;

                let waitTime = initialDelay * Math.pow(2, i);
                // Cap no tempo de espera máximo (ex: 10s)
                if (waitTime > 10000) waitTime = 10000;
                
                // Feedback visual se fornecido
                if (onStatusUpdate) {
                    const friendly = getFriendlyErrorMessage(error);
                    onStatusUpdate(`\n\n_${friendly} Tentando novamente em ${waitTime/1000}s (${i+1}/${maxRetries})..._`);
                }

                console.log(`[IV4 IA] Retry ${i+1}/${maxRetries} após erro: ${errorMsg}`);
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
   * Chat com a IA com suporte a streaming, Thinking Mode e Google Search dinâmicos.
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
        Você é o IV4 IA, um assistente de inteligência artificial avançado.
        
        == CONTEXTO ==
        HOJE: ${currentFullDate}.
        LOCAL: Moçambique.
        CRIADOR: Ivo Nunes Jaime (Lichinga, Niassa).

        == DIRETRIZES ==
        - Idioma: Português (Moçambique).
        - Seja útil, académico e educado.
        - COMPORTAMENTO: Responda a saudações (como "Olá", "Oi", "Bom dia") de forma natural e breve (ex: "Olá! Como posso ajudar?"). NÃO recite sua biografia ou detalhes do criador na saudação inicial, a menos que perguntado explicitamente "quem é você" ou "quem te criou".
        - ${config?.isSearch ? 'Use Google Search se necessário.' : 'Use seu conhecimento interno.'}
      `;

      // Configuração de Tools
      const tools: any[] = [];
      if (config?.isSearch) tools.push({ googleSearch: {} });

      const modelConfig: any = {
        systemInstruction: systemInstruction,
      };

      if (tools.length > 0) modelConfig.tools = tools;
      
      if (config?.isThinking) {
        modelConfig.thinkingConfig = { thinkingBudget: 16384 }; 
      }

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
                message: [
                    { text: message },
                    { inlineData: { data: base64Data, mimeType: mediaType } }
                ]
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
          // Apenas mostra mensagens de "Tentando novamente" se já recebemos algo, 
          // caso contrário a UI lida com o erro inicial
          if (hasReceivedContent) onChunk(statusMsg);
      });

    } catch (error: any) {
      console.error("Chat Stream Error:", error);
      
      const friendlyMsg = getFriendlyErrorMessage(error);

      if (!hasReceivedContent) {
          // Se falhou antes de enviar qualquer coisa, lançamos o erro para a UI tratar (ex: remover mensagem vazia)
          throw new Error(friendlyMsg);
      } else {
          // Se falhou no meio do stream, anexamos o erro ao final da mensagem existente
          onChunk(`\n\n---\n**Erro:** ${friendlyMsg}`);
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
        await this.chatStream(
            history, 
            message, 
            (chunk) => { fullText += chunk; }, 
            mediaBase64, 
            mediaType, 
            signal
        );
        return fullText;
    } catch (e: any) {
        throw e; // Repassa erro tratado
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
                Tipos: TRABALHO_ESCOLAR, RELATORIO, CURRICULO, CARTA.
                Dados necessários: Escola, Aluno(s), Tema, Classe, Cidade.
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
        const prompt = `
            Crie um documento HTML Académico Completo (Moçambique).
            Dados: ${JSON.stringify(data)}.
            ESTRUTURA:
            1. Capa (Div .page com .page-border)
            2. Contra-capa (Div .page com avaliação)
            3. Índice
            4. Conteúdo (Introdução, Desenvolvimento, Conclusão, Bibliografia).
            
            Use CSS Times New Roman, paginas A4 (21cm x 29.7cm).
            Retorne APENAS HTML.
        `;
        
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });
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
                contents: `Reescreva como falante nativo de ${variant}: "${text}"`
            });
            return response.text || text;
        } catch (error: any) {
             throw new Error(getFriendlyErrorMessage(error));
        }
    });
  }
};