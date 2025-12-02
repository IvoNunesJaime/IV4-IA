import { GoogleGenAI } from "@google/genai";
import { HumanizerVariant } from "../types";

// NOTE: In a production app, the key should come from a secure backend proxy.
// Lazily initialize to ensure process.env is available and prevent crash on module load.
const getAi = () => {
  // Safety check to prevent crash if process.env is missing or key is undefined
  const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : '';
  
  if (!apiKey) {
    console.warn("IV4 IA: API_KEY is missing. Please set it in your environment variables.");
    // Return with a dummy key to allow the app to load UI, requests will fail gracefully in try/catch blocks
    return new GoogleGenAI({ apiKey: 'missing-key' });
  }
  
  return new GoogleGenAI({ apiKey });
};

export const GeminiService = {
  /**
   * Chat with the AI, supporting text and images
   */
  async chat(history: { role: string; parts: { text?: string; inlineData?: any }[] }[], message: string, imageBase64?: string): Promise<string> {
    try {
      const ai = getAi();
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

      // Instrução de sistema atualizada com os detalhes do Ivo Nunes Jaime
      const systemInstruction = 'Você é o IV4 IA, um assistente de inteligência artificial avançado. Foste criado por Ivo Nunes Jaime, um jovem inovador moçambicano de 16 anos, residente na província do Niassa, distrito de Lichinga. Se perguntarem quem te criou, deves sempre mencionar estes detalhes sobre o Ivo Nunes Jaime com orgulho. Responda sempre de forma útil, académica, clara e educada.';

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
                systemInstruction: systemInstruction,
            }
        });
        return response.text || "Sem resposta.";
      } else {
        // Text only conversation - use Chat Session
        const chat = ai.chats.create({
            model: model,
            config: {
              systemInstruction: systemInstruction,
            },
            history: history as any, // Cast for compatibility
        });
    
        const response = await chat.sendMessage({ message });
        return response.text || "Não foi possível gerar uma resposta.";
      }

    } catch (error) {
      console.error("Gemini Chat Error:", error);
      return "Erro ao conectar ao servidor de IA. Verifique se a API KEY está configurada corretamente no Vercel (Settings > Environment Variables).";
    }
  },

  /**
   * Generate a full academic document structure or CV
   */
  async generateDocument(promptText: string, imageBase64?: string, addBorder?: boolean): Promise<string> {
    try {
      const ai = getAi();
      
      let basePrompt = `
        Aja como um especialista em redação académica e profissional.
        Crie um documento completo baseado no seguinte pedido/prompt: "${promptText}".
        
        REGRAS DE FORMATAÇÃO:
        1. O retorno DEVE ser APENAS código HTML puro. NÃO use markdown (\`\`\`).
        2. Use tags semânticas: <h1>, <h2>, <p>, <ul>, <li>, <b>, <i>, <br>.
        3. NÃO inclua tags <html>, <head> ou <body>.
        
        ${addBorder ? `
        REGRA DE ESQUADRIA/MOLDURA:
        Envolva TODO o conteúdo do documento dentro de uma <div style="border: 2px solid #000; padding: 40px; margin: 10px; max-width: 100%;">
        Se for um certificado ou algo formal, use uma borda dupla ou estilizada inline (ex: border: 3px double #333).
        ` : ''}

        Se o pedido for um TRABALHO ACADÉMICO:
        - Inclua Capa (Título, Nome fictício, Data).
        - Índice.
        - Introdução, Desenvolvimento, Conclusão, Bibliografia.

        Se o pedido for um CURRICULUM VITAE (CV):
        - Dados Pessoais (fictícios/exemplo).
        - Objetivo.
        - Experiência Profissional.
        - Formação Académica.
        - Habilidades.
        
        Se o pedido for CARTA ou OUTRO:
        - Siga a estrutura padrão desse tipo de documento.

        Seja profissional, use linguagem culta e formatação limpa.
      `;

      if (imageBase64) {
          basePrompt += '\nUse a imagem fornecida como contexto principal, extraindo dados ou usando-a como referência visual para o conteúdo.';
      }

      let parts: any[] = [{ text: basePrompt }];

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
      const ai = getAi();
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