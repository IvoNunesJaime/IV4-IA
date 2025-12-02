import { GoogleGenAI } from "@google/genai";

// Usamos a assinatura padrão de função Serverless da Vercel (Node.js)
// Isso evita erros de parsing de corpo (req.json) que ocorrem frequentemente.
export default async function handler(req: any, res: any) {
  // 1. Configurar CORS (Permitir que seu frontend fale com este backend)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Lidar com requisição OPTIONS (Pre-flight do navegador)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Apenas aceitar POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // 2. Extração segura do corpo da requisição
    // Na Vercel (Node.js), req.body já vem parseado se o Content-Type for application/json
    const { action, prompt, history, message, image, systemInstruction, jsonMode } = req.body;

    // 3. Verificação Robusta da API Key
    const apiKey = process.env.GEMINI_API_KEY;

    // LOG DE DEPURAÇÃO (Visível no Dashboard da Vercel em Functions > Logs)
    // Não mostramos a chave inteira por segurança, apenas os 4 primeiros dígitos
    if (apiKey) {
      console.log(`[API] Chave encontrada: ${apiKey.substring(0, 4)}...`);
    } else {
      console.error("[API] ERRO CRÍTICO: GEMINI_API_KEY não encontrada nas variáveis de ambiente.");
    }

    if (!apiKey) {
      // Retorna erro 500 claro se a chave faltar
      res.status(500).json({ 
        error: 'Erro de Configuração no Servidor: A chave de API (GEMINI_API_KEY) não está configurada ou não foi carregada.' 
      });
      return;
    }

    // 4. Inicialização do Cliente Gemini
    const ai = new GoogleGenAI({ apiKey });

    // --- LÓGICA DO GEMINI ---

    // AÇÃO: CHAT
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
        // Tratamento de imagem base64
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
        const response = await chat.sendMessage({
          message: message
        });
        responseText = response.text || "";
      }
      
      res.status(200).json({ text: responseText });
      return;
    }

    // AÇÃO: GENERATE (Texto Único / JSON)
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

    // Se a ação não for reconhecida
    res.status(400).json({ error: 'Ação desconhecida enviada ao servidor.' });

  } catch (error: any) {
    console.error("Erro na API Route:", error);
    // Retorna a mensagem de erro real para ajudar no diagnóstico
    res.status(500).json({ error: `Erro interno do servidor: ${error.message}` });
  }
}