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

// Wrapper genérico para Retry com Feedback Inteligente
async function withRetry<T>(
    operation: () => Promise<T>, 
    onStatusUpdate?: (msg: string) => void,
    retries = 5, // Reduzimos tentativas mas aumentamos a precisão do tempo
    initialDelay = 2000
): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            
            const errorMsg = error.message || error.toString();
            const isRateLimit = error.code === 429 || error.status === 429 || errorMsg.includes('429') || errorMsg.includes('Quota exceeded') || errorMsg.includes('RESOURCE_EXHAUSTED');
            const isServerOverload = error.code === 503 || error.status === 503;

            if (isRateLimit || isServerOverload) {
                if (i === retries - 1) break;

                // Tenta extrair o tempo exato sugerido pelo Google
                // Exemplo: "Please retry in 27.65977238s."
                let waitTime = initialDelay * Math.pow(2, i); // Fallback exponential
                
                const timeMatch = errorMsg.match(/retry in (\d+(\.\d+)?)s/);
                if (timeMatch && timeMatch[1]) {
                    const seconds = parseFloat(timeMatch[1]);
                    waitTime = Math.ceil(seconds * 1000) + 2000; // Tempo exato + 2s de segurança
                    console.log(`[IV4 IA] Google pediu espera de ${seconds}s. Aguardando ${waitTime}ms.`);
                } else {
                    // Se não conseguir ler, usa exponential backoff limitado a 60s
                    waitTime = Math.min(waitTime, 60000); 
                }

                const waitSeconds = Math.ceil(waitTime / 1000);
                const waitMsg = `\n\n⏳ **Limite de tráfego atingido.** Aguardando ${waitSeconds}s para continuar automaticamente...`;
                
                console.warn(waitMsg);
                if (onStatusUpdate) {
                    onStatusUpdate(waitMsg);
                }

                await wait(waitTime);
                continue;
            }
            
            // Outros erros
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
      
      // Thinking (Raciocínio) - Desativado temporariamente se houver erro para economizar tokens
      if (config?.isThinking) {
        modelConfig.thinkingConfig = { thinkingBudget: 16384 }; 
      }

      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: history,
        config: modelConfig
      });

      // Executa com Retry Inteligente
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
         // Tradução amigável de erros comuns
         if (errorDetails.includes('429') || errorDetails.includes('Quota exceeded')) {
             errorDetails = "O servidor está temporariamente cheio (Limite de tráfego). Por favor, aguarde 1 minuto antes de tentar novamente.";
         } else if (errorDetails.includes('503')) {
             errorDetails = "O serviço da Google está instável no momento. Tente novamente em breve.";
         }
         
         onChunk(`\n\n⚠️ **Erro de Conexão:** ${errorDetails}`);
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
            return { reply: "Estou a ter dificuldades de conexão devido ao alto tráfego. Pode repetir?", extractedData: {}, isReady: false };
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