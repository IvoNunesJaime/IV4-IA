import { GoogleGenAI } from "@google/genai";

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { action, prompt, history, message, image, systemInstruction, jsonMode } = await req.json();
    
    // Na Vercel, use GEMINI_API_KEY. Localmente ou fallback, tenta API_KEY.
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Configuração de API Key ausente no servidor.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Handle 'chat' action (with history)
    if (action === 'chat') {
      const model = ai.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        systemInstruction: systemInstruction 
      });

      const chat = model.startChat({
        history: history || [],
      });

      let result;
      if (image) {
        // If image provided, typically we send it as a part. 
        // Note: startChat history structure vs sendMessage structure differs slightly in SDK versions.
        // For simplicity in this proxy, we send the image as a part of the current message.
        const imagePart = {
            inlineData: {
                data: image.split(',')[1], // Remove data:image/png;base64, prefix
                mimeType: image.split(';')[0].split(':')[1]
            }
        };
        result = await chat.sendMessage([message, imagePart]);
      } else {
        result = await chat.sendMessage(message);
      }
      
      const responseText = result.response.text();
      return new Response(JSON.stringify({ text: responseText }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Handle 'generate' action (single prompt)
    if (action === 'generate') {
      const model = ai.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig: jsonMode ? { responseMimeType: "application/json" } : undefined
      });

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      return new Response(JSON.stringify({ text: responseText }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Ação desconhecida.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("API Route Error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno no servidor.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}