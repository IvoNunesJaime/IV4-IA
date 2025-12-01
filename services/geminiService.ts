import { GoogleGenAI } from "@google/genai";
import { HumanizerVariant } from "../types";

// NOTE: In a production app, the key should come from a secure backend proxy.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const GeminiService = {
  /**
   * Chat with the AI, supporting text and images
   */
  async chat(history: { role: string; parts: { text?: string; inlineData?: any }[] }[], message: string, imageBase64?: string): Promise<string> {
    try {
      // If there is an image, we can't easily use the chat history object in the same way 
      // with the @google/genai SDK strictly for the current turn if we mix create() and sendMessage().
      // However, to keep it simple and stateless for the "current turn" with image:
      
      let contents: any[] = [];
      
      // Reconstruct history for the model
      // Note: For complex multi-turn with images, using ai.chats.create is trickier with images in history 
      // in some SDK versions, but let's try to append the current message.
      
      // If we have an image in the CURRENT message, we use generateContent on the model directly
      // passing the history context manually if needed, or just the current turn for simplicity in this demo structure.
      // To support full history + new image, we'd format all previous turns as content.

      const model = 'gemini-2.5-flash';

      if (imageBase64) {
        // Image turn: we typically treat this as a generateContent call
        // We will include a simplified history context if possible, or just the current prompt + image
        const parts: any[] = [
            { text: message }
        ];
        
        // Extract base64 data (remove header data:image/png;base64,)
        const base64Data = imageBase64.split(',')[1];
        const mimeType = imageBase64.split(';')[0].split(':')[1];

        parts.push({
            inlineData: {
                mimeType: mimeType,
                data: base64Data
            }
        });

        const response = await ai.models.generateContent({
            model: model,
            contents: { role: 'user', parts: parts },
            config: {
                systemInstruction: 'Você é o IV4 IA. Responda de forma útil.',
            }
        });
        return response.text || "Sem resposta.";
      } else {
        // Text only conversation - use Chat Session
        const chat = ai.chats.create({
            model: model,
            config: {
              systemInstruction: 'Você é o IV4 IA, um assistente inteligente académico e profissional. Responda de forma clara, concisa e útil.',
            },
            history: history as any, // Cast for compatibility
        });
    
        const response = await chat.sendMessage({ message });
        return response.text || "Não foi possível gerar uma resposta.";
      }

    } catch (error) {
      console.error("Gemini Chat Error:", error);
      return "Erro ao conectar ao servidor de IA. Verifique sua conexão.";
    }
  },

  /**
   * Generate a full academic document structure
   */
  async generateDocument(topic: string, imageBase64?: string): Promise<string> {
    try {
      const prompt = `
        Crie um trabalho académico completo sobre o tema: "${topic}".
        ${imageBase64 ? 'Use a imagem fornecida como contexto principal ou referência para o trabalho.' : ''}
        
        O trabalho DEVE ser formatado em HTML simples (tags <h1>, <h2>, <p>, <ul>, <li>, <b>, <i>).
        NÃO inclua markdown (como ** ou #), apenas HTML puro dentro da resposta.
        NÃO inclua tags <html>, <head> ou <body>. Comece diretamente com o conteúdo.
        
        Estrutura obrigatória:
        1. Capa (Título centralizado, Nome do aluno fictício, Data)
        2. Índice (Lista de tópicos)
        3. Introdução
        4. Desenvolvimento (pelo menos 3 subtópicos relevantes)
        5. Conclusão
        6. Bibliografia (fictícia mas realista)

        Seja formal e académico.
      `;

      let parts: any[] = [{ text: prompt }];

      if (imageBase64) {
          const base64Data = imageBase64.split(',')[1];
          const mimeType = imageBase64.split(';')[0].split(':')[1];
          parts.push({
              inlineData: {
                  mimeType: mimeType,
                  data: base64Data
              }
          });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: parts },
      });

      return response.text || "<p>Erro ao gerar documento.</p>";
    } catch (error) {
      console.error("Gemini Document Error:", error);
      throw error;
    }
  },

  /**
   * Humanize text based on region
   */
  async humanizeText(text: string, variant: HumanizerVariant): Promise<string> {
    try {
      const prompt = `
        Aja como um falante nativo de ${variant}.
        Reescreva o texto abaixo para torná-lo mais natural, humano e fluido, removendo qualquer traço de linguagem robótica, repetitiva ou artificial.
        Varie o vocabulário e a estrutura das frases como uma pessoa real faria.
        Se o texto original contiver formatação HTML, tente preservá-la se fizer sentido, caso contrário, retorne texto puro bem formatado.
        
        Texto original:
        "${text}"
        
        Retorne APENAS o texto reescrito.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      return response.text || text;
    } catch (error) {
      console.error("Gemini Humanize Error:", error);
      return text;
    }
  }
};