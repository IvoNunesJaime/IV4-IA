import { GoogleGenAI } from "@google/genai";

// Removemos 'runtime: edge' para usar o ambiente Node.js padrão da Vercel,
// que é mais estável para processamento de chaves de API e conexões de rede.

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { action, prompt, history, message, image, systemInstruction, jsonMode } = await req.json();
    
    // Na Vercel, a variável correta é process.env.GEMINI_API_KEY
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Erro de Configuração: API Key não encontrada no servidor.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const ai = new GoogleGenAI({ apiKey });

    // --- AÇÃO: CHAT ---
    if (action === 'chat') {
      const chat = ai.chats.create({
        model: "gemini-2.5-flash", // Modelo atualizado
        config: {
          systemInstruction: systemInstruction,
        },
        history: history || [],
      });

      let responseText = "";

      if (image) {
        // Envio com Imagem
        // O formato da imagem deve ser limpo para o SDK (removemos o prefixo data:image...)
        const base64Data = image.split(',')[1]; 
        const mimeType = image.split(';')[0].split(':')[1];

        const response = await chat.sendMessage({
          message: [
            { text: message },
            { 
              inlineData: { 
                data: base64Data, 
                mimeType: mimeType 
              } 
            }
          ]
        });
        responseText = response.text || "";
      } else {
        // Envio apenas Texto
        const response = await chat.sendMessage({
          message: message
        });
        responseText = response.text || "";
      }
      
      return new Response(JSON.stringify({ text: responseText }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // --- AÇÃO: GENERATE (Texto Único / JSON) ---
    if (action === 'generate') {
      const config: any = {};
      
      if (jsonMode) {
        config.responseMimeType = "application/json";
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", // Modelo atualizado
        contents: prompt,
        config: config
      });

      const responseText = response.text || "";
      
      return new Response(JSON.stringify({ text: responseText }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Ação desconhecida enviada ao servidor.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("API Route Error:", error);
    return new Response(JSON.stringify({ error: `Erro interno: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}