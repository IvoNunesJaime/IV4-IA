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

// Wrapper genérico para Retry com Feedback
async function withRetry<T>(
    operation: () => Promise<T>, 
    onStatusUpdate?: (msg: string) => void,
    retries = 8, 
    initialDelay = 2000
): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            
            // Verifica códigos de erro comuns para Rate Limit (429) ou Serviço Indisponível (503)
            const isRateLimit = error.code === 429 || error.status === 429 || error.message?.includes('429') || error.message?.includes('Quota exceeded');
            const isServerOverload = error.code === 503 || error.status === 503;

            if (isRateLimit || isServerOverload) {
                // Se for a última tentativa, não espera, deixa falhar
                if (i === retries - 1) break;

                // Delay progressivo: 2s, 4s, 8s, 16s... até max 30s
                const calcDelay = initialDelay * Math.pow(2, i);
                const delay = Math.min(calcDelay, 20000); 

                const waitMsg = `\n\n[⚠️ Tráfego alto. Aguardando ${delay/1000}s para reconectar...]`;
                console.warn(waitMsg);
                
                if (onStatusUpdate) {
                    onStatusUpdate(waitMsg);
                }

                await wait(delay);
                continue;
            }
            
            // Se for outro erro (ex: 400 Bad Request), falha imediatamente
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
    try {
      const ai = getAiClient();

      const now = new Date();
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      };
      const currentFullDate = now.toLocaleDateString('pt-PT', options);
      const currentYear = now.getFullYear();

      const systemInstruction = `
        Você é o IV4 IA, um assistente de inteligência artificial avançado.
        
        == CONTEXTO ==
        HOJE: ${currentFullDate}. ANO: ${currentYear}.
        LOCAL: Moçambique.
        PRESIDENTE MOÇAMBIQUE: Daniel Chapo.
        CRIADOR: Ivo Nunes Jaime (Lichinga, Niassa).

        == DIRETRIZES ==
        - Seja útil, académico e educado.
        - Use emojis moderadamente 🚀.
        - Idioma: Português (Moçambique).
        - ${config?.isSearch ? 'Use Google Search se necessário.' : 'Use seu conhecimento interno.'}
      `;

      // Configuração de Tools
      const tools: any[] = [];
      if (config?.isSearch) tools.push({ googleSearch: {} });

      const modelConfig: any = {
        systemInstruction: systemInstruction,
      };

      if (tools.length > 0) modelConfig.tools = tools;
      
      // Thinking (Raciocínio)
      if (config?.isThinking) {
        modelConfig.thinkingConfig = { thinkingBudget: 16384 }; // Ajustado para ser mais rápido
      }

      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: history,
        config: modelConfig
      });

      // Executa com Retry e Feedback Visual
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
            if (text) onChunk(text);
          }
      }, (statusMsg) => {
          // Callback chamado quando entramos em modo de espera
          onChunk(statusMsg);
      });

    } catch (error: any) {
      console.error("Chat Stream Error:", error);
      
      if (error.message === "API_KEY_MISSING") {
         throw error;
      }

      if (!signal?.aborted) {
         let errorDetails = error.message || error.toString();
         if (errorDetails.includes('429') || errorDetails.includes('Quota exceeded')) {
             errorDetails = "Limite de uso gratuito atingido. O servidor está muito ocupado. Tente novamente em 1 minuto.";
         }
         onChunk(`\n\n⚠️ **Erro Final:** ${errorDetails}`);
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
    await this.chatStream(
        history, 
        message, 
        (chunk) => { fullText += chunk; }, 
        mediaBase64, 
        mediaType, 
        signal
    );
    return fullText;
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
        } catch (error) {
            return { reply: "Erro de conexão. Pode repetir?", extractedData: {}, isReady: false };
        }
    });
  },

  async editDocumentFragment(currentHTML: string, userInstruction: string): Promise<string> {
    return withRetry(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Edite este HTML seguindo a instrução: "${userInstruction}".\nHTML: ${currentHTML}`
        });
        return (response.text || currentHTML).replace(/```html/g, '').replace(/```/g, '');
    });
  },

  async generateDocument(data: any, addBorder: boolean = true): Promise<string> {
    return withRetry(async () => {
        const ai = getAiClient();
        // Construção simplificada para garantir execução
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
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return (response.text || "").replace(/```html/g, '').replace(/```/g, '');
    });
  },

  async humanizeText(text: string, variant: HumanizerVariant): Promise<string> {
    return withRetry(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Reescreva como falante nativo de ${variant}: "${text}"`
        });
        return response.text || text;
    });
  }
};