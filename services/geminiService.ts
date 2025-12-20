
import { GoogleGenAI } from "@google/genai";
import { HumanizerVariant } from "../types";

// Helper to initialize the client with the provided API Key from process.env
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getFriendlyErrorMessage = (error: any): string => {
    const msg = error.message || error.toString();
    if (msg.includes("API_KEY_MISSING")) return "Chave de API não configurada.";
    if (msg.includes("429") || msg.includes("Quota exceeded")) return "⚠️ Limite de tráfego atingido. Aguarde 1 minuto.";
    if (msg.includes("SAFETY")) return "⚠️ Conteúdo bloqueado pelos filtros de segurança.";
    return "⚠️ Ocorreu um erro na comunicação com a IA.";
};

async function withRetry<T>(operation: () => Promise<T>, onStatusUpdate?: (msg: string) => void, baseRetries = 3): Promise<T> {
    let lastError: any;
    let maxRetries = baseRetries;
    for (let i = 0; i < maxRetries; i++) {
        try { return await operation(); } catch (error: any) {
            lastError = error;
            const errorMsg = error.message || error.toString();
            if (errorMsg.includes("API_KEY") || errorMsg.includes("SAFETY")) throw error;
            if (errorMsg.includes('429')) maxRetries = 6;
            if (i === maxRetries - 1) break;
            await wait(2000 * Math.pow(2, i));
            continue;
        }
    }
    throw lastError;
}

export const GeminiService = {
  async chatStream(history: any[], message: string, onChunk: (text: string) => void, mediaBase64?: string, mediaType?: string, signal?: AbortSignal, config?: any) {
    let hasReceivedContent = false;
    try {
      const ai = getAiClient();
      
      // Update models to current recommendations: gemini-2.5-flash-image for image tasks, gemini-3-flash-preview for general text tasks
      const isImageTask = mediaBase64 && !config?.isSearch;
      const modelName = isImageTask ? 'gemini-2.5-flash-image' : 'gemini-3-flash-preview';

      const systemInstruction = `Você é o IV4 IA, criado por Ivo Nunes Jaime em Lichinga, Moçambique. Responda de forma útil e breve.`;

      const modelConfig: any = { systemInstruction };
      if (config?.isSearch) modelConfig.tools = [{ googleSearch: {} }];
      // Thinking config is supported in Gemini 3 series
      if (config?.isThinking) modelConfig.thinkingConfig = { thinkingBudget: 16384 };

      const chat = ai.chats.create({ model: modelName, history, config: modelConfig });

      await withRetry(async () => {
          const content = mediaBase64 
            ? [{ text: message }, { inlineData: { data: mediaBase64.split(',')[1] || mediaBase64, mimeType: mediaType || 'image/jpeg' } }]
            : message;

          // chat.sendMessageStream takes an object with a 'message' property
          const responseStream = await chat.sendMessageStream({ message: content });

          for await (const chunk of responseStream) {
            if (signal?.aborted) break;
            
            // For image editing tasks, iterate through candidates to find image output
            const imagePart = chunk.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imagePart) {
                onChunk(`IMAGE_DATA:data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`);
                hasReceivedContent = true;
            }

            // Extract text using the .text property (not a method call)
            const text = chunk.text;
            if (text) {
                hasReceivedContent = true;
                onChunk(text);
            }
          }
      });
    } catch (error: any) {
      if (!hasReceivedContent) throw new Error(getFriendlyErrorMessage(error));
    }
  },

  async generateImage(prompt: string, aspectRatio: string = "1:1"): Promise<string> {
    return withRetry(async () => {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio } }
      });

      const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (imagePart) {
        return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
      }
      throw new Error("Nenhuma imagem foi gerada.");
    });
  },

  async humanizeText(text: string, variant: HumanizerVariant): Promise<string> {
    return withRetry(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Reescreva como nativo de ${variant}: "${text}"`
        });
        // Access text via the .text property
        return response.text || text;
    });
  },

  async negotiateDocumentDetails(history: any[], currentMessage: string) {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Analise para gerar documento: ${currentMessage}. Histórico: ${JSON.stringify(history)}`,
          config: { responseMimeType: "application/json" }
      });
      // Access text via the .text property
      return JSON.parse(response.text || "{}");
  },

  async generateDocument(data: any) {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Gere um HTML académico para: ${JSON.stringify(data)}`
      });
      // Access text via the .text property
      return response.text || "";
  },

  async editDocumentFragment(html: string, instruction: string) {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Edite este HTML: ${html}. Instrução: ${instruction}`
      });
      // Access text via the .text property
      return response.text || html;
  }
};
