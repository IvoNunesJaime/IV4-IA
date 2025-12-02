import { GoogleGenAI } from "@google/genai";

// Configuração para garantir que o corpo seja processado corretamente
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  // 1. Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // 2. Extração segura do corpo da requisição
    let body = req.body;
    
    // Fallback: Se o body chegar como string (alguns ambientes serverless), fazemos o parse
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        console.error("Erro ao fazer parse do body JSON:", e);
        res.status(400).json({ error: 'Payload JSON inválido.' });
        return;
      }
    }

    const { action, prompt, history, message, image, systemInstruction, jsonMode } = body || {};

    // 3. Verificação Robusta da API Key
    // IMPORTANTE: O nome deve corresponder EXATAMENTE ao configurado na Vercel
    const apiKey = process.env.GEMINI_API_KEY;

    // Log de segurança para depuração (mostra apenas se existe ou não)
    if (!apiKey) {
      console.error("[API ERROR] GEMINI_API_KEY não encontrada nas variáveis de ambiente.");
      res.status(500).json({ 
        error: 'Configuração de Servidor: GEMINI_API_KEY não encontrada. Verifique as Variáveis de Ambiente na Vercel.' 
      });
      return;
    } else {
      console.log(`[API SUCCESS] GEMINI_API_KEY carregada. (Inicia com: ${apiKey.substring(0, 4)}...)`);
    }

    // 4. Inicialização do Cliente Gemini
    const ai = new GoogleGenAI({ apiKey });

    // --- ROTEAMENTO DE AÇÕES ---

    // Ação: CHAT (Conversa contínua)
    if (action === 'chat') {
      const chat = ai.chats.create({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: systemInstruction,
        },
        history: history || [],
      });

      let responseText = "";

      if (image) {
        // Se houver imagem, precisamos extrair o base64
        // Formato esperado: "data:image/png;base64,..."
        const parts = image.split(',');
        const base64Data = parts[1] || parts[0]; 
        const mimeMatch = image.match(/:(.*?);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

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
        const response = await chat.sendMessage({
          message: message
        });
        responseText = response.text || "";
      }
      
      res.status(200).json({ text: responseText });
      return;
    }

    // Ação: GENERATE (Geração de texto único ou JSON)
    if (action === 'generate') {
      const config: any = {};
      
      if (jsonMode) {
        config.responseMimeType = "application/json";
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: config
      });

      const responseText = response.text || "";
      
      res.status(200).json({ text: responseText });
      return;
    }

    // Se nenhuma ação válida for encontrada
    res.status(400).json({ error: 'Ação inválida ou não fornecida (esperado "chat" ou "generate").' });

  } catch (error: any) {
    console.error("Erro CRÍTICO na API Route:", error);
    // Retorna o erro detalhado para facilitar a correção
    res.status(500).json({ 
      error: `Erro no processamento da IA: ${error.message || error.toString()}` 
    });
  }
}