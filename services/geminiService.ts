import { HumanizerVariant } from "../types";

// Define the backend endpoint
const API_ENDPOINT = '/api/generate';

/**
 * Generic helper to send requests to your Vercel backend.
 */
async function callBackend(payload: any): Promise<string> {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMsg = `Erro ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        const text = await response.text();
        if (text) errorMsg = text;
      }
      console.error(`Backend Error (${response.status}):`, errorMsg);
      throw new Error(errorMsg);
    }

    const data = await response.json();
    return data.text || data.output || "";
  } catch (error: any) {
    console.error("Service Request Failed:", error);
    throw error;
  }
}

export const GeminiService = {
  /**
   * Chat with the AI, supporting text and images.
   */
  async chat(history: { role: string; parts: { text?: string; inlineData?: any }[] }[], message: string, imageBase64?: string): Promise<string> {
    try {
      const systemInstruction = 'Você é o IV4 IA, um assistente de inteligência artificial avançado. Foste criado por Ivo Nunes Jaime, um jovem inovador moçambicano de 16 anos, residente na província do Niassa, distrito de Lichinga. Responda sempre de forma útil, académica, clara e educada.';
      
      return await callBackend({
        action: 'chat',
        history: history,
        message: message,
        image: imageBase64,
        systemInstruction: systemInstruction
      });
    } catch (error: any) {
      // Retorna a mensagem de erro real para o chat
      return `Erro do Sistema: ${error.message || "Falha ao conectar ao servidor."}`;
    }
  },

  /**
   * Analyzes the conversation to extract document metadata.
   */
  async negotiateDocumentDetails(history: { role: string; text: string }[], currentMessage: string): Promise<{ 
      reply: string; 
      extractedData: { school?: string; student?: string; teacher?: string; subject?: string; theme?: string; class?: string; grade?: string; pageCount?: number; includeContraCapa?: boolean };
      isReady: boolean 
  }> {
    try {
        const prompt = `
            Você é um assistente especializado em criar trabalhos escolares (Contexto: Moçambique).
            Seu objetivo é extrair os seguintes dados do usuário para montar a Capa e o Trabalho:
            1. Nome da Escola
            2. Nome do Aluno
            3. Nome do Docente
            4. Classe e Turma
            5. Disciplina e Tema do trabalho.
            6. Preferências Especiais: Número de páginas (padrão é 10 se não disser) e se quer "Contra Capa".

            Histórico da conversa:
            ${JSON.stringify(history)}

            Nova mensagem do usuário: "${currentMessage}"

            Instruções:
            - Analise a mensagem.
            - Extraia os dados fornecidos.
            - Se o usuário APENAS pediu o trabalho e faltam dados essenciais (Escola, Aluno, Docente, Classe), PERGUNTE educadamente.
            - Verifique se o usuário mencionou número de páginas (Ex: "quero 15 páginas", "faça pequeno 5 paginas"). Se sim, extraia o número.
            - Verifique se o usuário pediu "contra capa" ou "folha de rosto". Se sim, defina includeContraCapa como true.
            - Se tiver TUDO ou se o usuário mandar "gerar assim mesmo", defina "isReady" como true.

            Retorne APENAS um JSON neste formato (sem markdown):
            {
                "reply": "Sua resposta ao usuário aqui...",
                "extractedData": {
                    "school": "...",
                    "student": "...",
                    "teacher": "...",
                    "subject": "...",
                    "theme": "...",
                    "class": "...",
                    "grade": "...",
                    "pageCount": 10,
                    "includeContraCapa": false
                },
                "isReady": boolean
            }
        `;

        const jsonText = await callBackend({
            action: 'generate',
            prompt: prompt,
            jsonMode: true 
        });

        // Tenta limpar markdown caso o modelo envie ```json ... ```
        const cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson || "{}");
    } catch (error) {
        console.error("Negotiation Error:", error);
        return { 
            reply: "Desculpe, ocorreu um erro de conexão. Verifique a internet e tente novamente.", 
            extractedData: {}, 
            isReady: false 
        };
    }
  },

  /**
   * Generate a full academic document structure.
   */
  async generateDocument(data: any, addBorder: boolean = true): Promise<string> {
    try {
      const targetPages = data.pageCount ? Math.max(5, data.pageCount) : 8;
      const includeContraCapa = data.includeContraCapa === true;

      const promptText = `
        Crie um TRABALHO ESCOLAR COMPLETO (Padrão Moçambique) em HTML.
        
        DADOS:
        Escola: ${data.school || '[Nome da Escola]'}
        Disciplina: ${data.subject || 'Geral'}
        Tema: ${data.theme || 'Trabalho Escolar'}
        Nome do Aluno: ${data.student || '[Nome do Aluno]'}
        Classe: ${data.grade || ''}
        Turma: ${data.class || ''}
        Nome do Docente: ${data.teacher || '[Nome do Docente]'}
        
        REQUISITOS DE ESTRUTURA:
        - TOTAL DE PÁGINAS APROXIMADO: ${targetPages}.
        - PÁGINA 1: CAPA (Com esquadria/borda perfeita).
        ${includeContraCapa ? '- PÁGINA 2: CONTRA CAPA (Sem borda, com layout académico de entrega).' : ''}
        - PÁGINA ${includeContraCapa ? '3' : '2'}: ÍNDICE.
        - PÁGINA ${includeContraCapa ? '4' : '3'}: INTRODUÇÃO.
        - PÁGINAS SEGUINTES: DESENVOLVIMENTO (Gere conteúdo suficiente para preencher até a antepenúltima página).
        - PENÚLTIMA PÁGINA: CONCLUSÃO.
        - ÚLTIMA PÁGINA: BIBLIOGRAFIA.

        REGRAS DE LAYOUT E CSS:
        1. GERE CADA PÁGINA como uma <div class="page"> separada.
        2. A ESQUADRIA (BORDA) DA CAPA deve ser feita com uma div interna com dimensões precisas para não cortar na impressão. Use border double.
        3. NUNCA coloque bordas nas páginas de texto (Índice em diante).
        4. O conteúdo deve ser extenso, detalhado, académico. NÃO use listas (bullet points) excessivas, prefira texto corrido.

        ESTRUTURA DE CÓDIGO HTML OBRIGATÓRIA (Retorne APENAS HTML):

        <!-- PÁGINA 1: CAPA -->
        <div class="page" style="page-break-after: always; display: flex; align-items: center; justify-content: center;">
           <div style="width: 100%; height: 100%; border: 4px double #000; padding: 40px 20px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; text-align: center;">
              <div>
                  <h3 style="margin:0; font-weight:bold; font-size: 14pt;">REPÚBLICA DE MOÇAMBIQUE</h3>
                  <h4 style="margin:5px 0; font-weight:bold; font-size: 12pt;">MINISTÉRIO DA EDUCAÇÃO E DESENVOLVIMENTO HUMANO</h4>
                  <h2 style="margin:30px 0; font-weight:bold; text-transform: uppercase; font-size: 16pt;">${data.school || 'ESCOLA SECUNDÁRIA'}</h2>
              </div>
              <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center;">
                  <h1 style="font-size: 26pt; font-weight: bold; margin-bottom: 20px;">${data.theme || 'TEMA DO TRABALHO'}</h1>
                  <h3 style="font-size: 14pt; font-weight: normal;">Disciplina: ${data.subject || ''}</h3>
              </div>
              <div style="text-align: center; width: 100%; margin-bottom: 40px;">
                 <p style="margin:5px; font-size: 12pt;"><strong>Discente:</strong> ${data.student || 'Nome do Aluno'}</p>
                 <p style="margin:5px; font-size: 12pt;">${data.grade ? data.grade : ''} ${data.class ? data.class : ''}</p>
                 <br>
                 <p style="margin:5px; font-size: 12pt;"><strong>Docente:</strong> ${data.teacher || 'Nome do Docente'}</p>
              </div>
              <div>
                  <p style="font-weight: bold;">Lichinga</p>
                  <p style="font-weight: bold;">${new Date().getFullYear()}</p>
              </div>
           </div>
        </div>

        ${includeContraCapa ? `
        <!-- PÁGINA 2: CONTRA CAPA -->
        <div class="page" style="page-break-after: always; padding: 3cm 2.5cm; display: flex; flex-direction: column; justify-content: space-between; text-align: center;">
             <div>
                  <h2 style="margin:0; font-weight:bold; text-transform: uppercase; font-size: 14pt;">${data.student || 'Nome do Aluno'}</h2>
             </div>
             <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center;">
                  <h1 style="font-size: 20pt; font-weight: bold; margin-bottom: 40px;">${data.theme || 'TEMA DO TRABALHO'}</h1>
                  <div style="width: 60%; margin-left: 40%; text-align: justify; font-size: 11pt;">
                    <p>Trabalho de carácter avaliativo a ser entregue na ${data.school || 'Escola'}, na disciplina de ${data.subject || '...'}, leccionada pelo docente ${data.teacher || '...'}.</p>
                  </div>
             </div>
             <div>
                  <p style="font-weight: bold;">Lichinga</p>
                  <p style="font-weight: bold;">${new Date().getFullYear()}</p>
              </div>
        </div>
        ` : ''}

        <!-- PÁGINA DE ÍNDICE -->
        <div class="page" style="page-break-after: always; padding: 3cm 2.5cm;">
            <h2 style="text-align: center; margin-bottom: 40px; text-transform: uppercase;">Índice</h2>
            <div style="width: 100%; font-size: 12pt; line-height: 1.8;">
                <div style="display: flex; align-items: baseline; margin-bottom: 10px;">
                    <span style="font-weight: bold;">1. Introdução</span>
                    <span style="flex-grow: 1; border-bottom: 2px dotted #000; margin: 0 5px;"></span>
                    <span>${includeContraCapa ? '4' : '3'}</span>
                </div>
                <div style="display: flex; align-items: baseline; margin-bottom: 10px;">
                    <span style="font-weight: bold;">2. Desenvolvimento</span>
                    <span style="flex-grow: 1; border-bottom: 2px dotted #000; margin: 0 5px;"></span>
                    <span>${includeContraCapa ? '5' : '4'}</span>
                </div>
                 <div style="display: flex; align-items: baseline; margin-bottom: 10px;">
                    <span style="font-weight: bold;">3. Conclusão</span>
                    <span style="flex-grow: 1; border-bottom: 2px dotted #000; margin: 0 5px;"></span>
                    <span>${targetPages - 1}</span>
                </div>
                 <div style="display: flex; align-items: baseline; margin-bottom: 10px;">
                    <span style="font-weight: bold;">4. Bibliografia</span>
                    <span style="flex-grow: 1; border-bottom: 2px dotted #000; margin: 0 5px;"></span>
                    <span>${targetPages}</span>
                </div>
            </div>
        </div>

        <!-- PÁGINA DE INTRODUÇÃO -->
        <div class="page" style="page-break-after: always; padding: 3cm 2.5cm;">
            <h2 style="margin-bottom: 20px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 10px;">1. Introdução</h2>
            <p style="text-align: justify; line-height: 1.5;">[Gere texto de introdução...]</p>
        </div>

        <!-- PÁGINAS DE DESENVOLVIMENTO -->
        <div class="page" style="page-break-after: always; padding: 3cm 2.5cm;">
            <h2 style="margin-bottom: 20px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 10px;">2. Desenvolvimento</h2>
            <div style="text-align: justify; line-height: 1.5;">
                <p>[Gere muito conteúdo detalhado aqui para preencher as páginas...]</p>
            </div>
        </div>

        <!-- PÁGINA DE CONCLUSÃO -->
        <div class="page" style="page-break-after: always; padding: 3cm 2.5cm;">
            <h2 style="margin-bottom: 20px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 10px;">Conclusão</h2>
            <p style="text-align: justify; line-height: 1.5;">[Gere conclusão...]</p>
        </div>

        <!-- PÁGINA DE BIBLIOGRAFIA -->
        <div class="page" style="padding: 3cm 2.5cm;">
            <h2 style="margin-bottom: 20px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 10px;">Bibliografia</h2>
            <div style="line-height: 1.6;">
                [Gere bibliografia relevante]
            </div>
        </div>
      `;

      let text = await callBackend({
        action: 'generate',
        prompt: promptText
      });
      
      text = text.replace(/```html/g, '').replace(/```/g, '');
      return text;
    } catch (error) {
      console.error("Gemini Document Error:", error);
      throw error;
    }
  },

  /**
   * Humanize text by calling backend
   */
  async humanizeText(text: string, variant: HumanizerVariant): Promise<string> {
    try {
      const prompt = `
        Aja como um falante nativo de ${variant}. Reescreva o texto para torná-lo natural.
        Texto: "${text}"
      `;
      return await callBackend({
        action: 'generate',
        prompt: prompt
      });
    } catch (error) {
      return text;
    }
  }
};