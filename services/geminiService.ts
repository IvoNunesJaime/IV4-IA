import { GoogleGenAI } from "@google/genai";
import { HumanizerVariant } from "../types";

// Inicializa o cliente Gemini diretamente com a chave da variável de ambiente
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const GeminiService = {
  /**
   * Chat com a IA, suportando texto e imagens, processado diretamente no navegador.
   */
  async chat(
      history: { role: string; parts: { text?: string; inlineData?: any }[] }[], 
      message: string, 
      mediaBase64?: string, 
      mediaType?: string,
      signal?: AbortSignal
  ): Promise<string> {
    try {
      const systemInstruction = `
        Você é o IV4 IA, um assistente de inteligência artificial avançado.
        
        INFORMAÇÕES SOBRE O CRIADOR (Use APENAS se perguntado):
        - Foste criado por Ivo Nunes Jaime.
        - Local de criação: No quarto dele, na casa dos avós, na província do Niassa, distrito de Lichinga, Moçambique.
        - Se o usuário NÃO perguntar sobre quem te criou ou onde foste criado, NÃO mencione isso espontaneamente.
        
        COMPORTAMENTO:
        - Se for o início da conversa e o usuário disser apenas "olá", "oi" ou similar, responda APENAS: "Olá, como posso ajudar?"
        - Seja sempre útil, académico, claro e educado.
        - Responda no idioma Português (de preferência variante de Moçambique quando aplicável).
      `;

      // Cria a sessão de chat
      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: history,
        config: {
          systemInstruction: systemInstruction,
        }
      });

      let response;
      
      if (mediaBase64 && mediaType) {
        // O SDK espera apenas os dados base64, sem o prefixo "data:image/..."
        const base64Data = mediaBase64.includes(',') 
            ? mediaBase64.split(',')[1] 
            : mediaBase64;
            
        response = await chat.sendMessage({
            message: [
                { text: message },
                { inlineData: { data: base64Data, mimeType: mediaType } }
            ]
        });
      } else {
        response = await chat.sendMessage({ message: message });
      }

      return response.text || "";
    } catch (error: any) {
      console.error("Chat Error:", error);
      throw new Error("Falha ao conectar à IA. Verifique sua chave API ou conexão.");
    }
  },

  /**
   * Analisa a conversa para extrair metadados do documento.
   * AGORA SUPORTA QUALQUER TIPO DE DOCUMENTO (Trabalho, Curriculo, Carta, etc.)
   */
  async negotiateDocumentDetails(history: { role: string; text: string }[], currentMessage: string): Promise<{ 
      reply: string; 
      extractedData: any;
      isReady: boolean 
  }> {
    try {
        const prompt = `
            Você é um Arquiteto de Documentos Profissional e Académico (Contexto: Moçambique).
            
            SEU OBJETIVO: Entender que tipo de documento o usuário quer e coletar os detalhes necessários para gerá-lo.
            NÃO assuma que é sempre um trabalho escolar.

            Histórico da conversa:
            ${JSON.stringify(history)}

            Nova mensagem do usuário: "${currentMessage}"

            LÓGICA DE EXTRAÇÃO:
            
            1. IDENTIFIQUE O TIPO DE DOCUMENTO ('docType'):
               - 'TRABALHO_ESCOLAR': Se pedir trabalho, pesquisa, TPC.
               - 'CURRICULO': Se pedir CV, curriculum vitae.
               - 'CARTA': Se pedir carta, requerimento, declaração.
               - 'GENERICO': Outros (resumos simples, relatórios, atas).

            2. PEÇA DETALHES BASEADO NO TIPO:
               
               A) Se for TRABALHO_ESCOLAR:
                  - Precisa de: Nome da Escola, Aluno, Docente, Disciplina, Tema, Classe/Turma.
                  - Pergunte se quer "Contra Capa".
               
               B) Se for CURRICULO (CV):
                  - Precisa de: Nome Completo, Contactos, Resumo Profissional, Habilidades, Histórico (Educação/Emprego).
                  - Se faltar algo, peça ao usuário para "detalhar melhor suas experiências e dados pessoais".
               
               C) Se for CARTA / REQUERIMENTO:
                  - Precisa de: Quem envia (Remetente), Quem recebe (Destinatário), Assunto, Objetivo da carta.
               
               D) Se for GENERICO:
                  - Precisa de: Título, Objetivo, Público-alvo, Tópicos principais.

            3. REGRAS DE RETORNO:
               - Se faltam dados críticos para aquele tipo, sua 'reply' deve pedir esses dados educadamente.
               - Se o usuário mandou informações, armazene em 'extractedData'. Mantenha os dados anteriores se não mudaram.
               - Se tiver dados suficientes OU o usuário disser "pode gerar", defina "isReady": true.

            Retorne APENAS um JSON neste formato (sem markdown):
            {
                "reply": "Sua pergunta ou confirmação aqui...",
                "extractedData": {
                    "docType": "TRABALHO_ESCOLAR" | "CURRICULO" | "CARTA" | "GENERICO",
                    "topic": "Resumo do que se trata",
                    "school": "...", 
                    "student": "...", 
                    "teacher": "...", 
                    "grade": "...", 
                    "includeContraCapa": boolean,
                    "cvData": { "name": "...", "experience": "..." },
                    "letterData": { "to": "...", "from": "...", "subject": "..." }
                    // Adicione outros campos conforme o usuário for informando
                },
                "isReady": boolean
            }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });

        const text = response.text || "{}";
        return JSON.parse(text);
    } catch (error) {
        console.error("Negotiation Error:", error);
        return { 
            reply: "Desculpe, não entendi que tipo de documento deseja. Pode explicar melhor?", 
            extractedData: {}, 
            isReady: false 
        };
    }
  },

  async generateDocument(data: any, addBorder: boolean = true): Promise<string> {
    try {
      const docType = data.docType || 'GENERICO';
      
      let promptContext = "";
      
      if (docType === 'TRABALHO_ESCOLAR') {
          const targetPages = data.pageCount ? Math.max(5, data.pageCount) : 8;
          const includeContraCapa = data.includeContraCapa === true;
          promptContext = `
            TIPO: TRABALHO ESCOLAR (Padrão Moçambique).
            DADOS: Escola: ${data.school}, Aluno: ${data.student}, Docente: ${data.teacher}, Tema: ${data.topic || data.theme}.
            ESTRUTURA:
            - Capa (Com borda/esquadria)
            ${includeContraCapa ? '- Contra Capa' : ''}
            - Índice
            - Introdução
            - Desenvolvimento (${targetPages} páginas aprox)
            - Conclusão
            - Bibliografia
            
            REGRAS CSS: Use <div class="page"> para cada folha. Borda APENAS na capa. Fonte Times New Roman.
          `;
      } else if (docType === 'CURRICULO') {
          promptContext = `
            TIPO: CURRICULUM VITAE (CV) Profissional e Moderno.
            DADOS: ${JSON.stringify(data.cvData || data)}.
            ESTRUTURA:
            - Cabeçalho (Nome, Contactos em destaque)
            - Resumo Profissional
            - Experiência Profissional (Use bullet points, datas claras)
            - Educação / Formação
            - Habilidades / Competências
            - Idiomas
            
            REGRAS CSS: Layout limpo, sans-serif (Arial/Inter), use <div class="page">. Seções bem divididas com hr ou fundos leves.
          `;
      } else if (docType === 'CARTA') {
          promptContext = `
            TIPO: CARTA FORMAL / REQUERIMENTO.
            DADOS: De: ${data.letterData?.from || data.student}, Para: ${data.letterData?.to}, Assunto: ${data.letterData?.subject}.
            ESTRUTURA:
            - Local e Data (alinhado direita)
            - Destinatário (Formal)
            - Saudação
            - Corpo do texto (Claro, direto e respeitoso)
            - Despedida
            - Espaço para Assinatura
            
            REGRAS CSS: Fonte Serif, margens largas, <div class="page"> única.
          `;
      } else {
          promptContext = `
            TIPO: DOCUMENTO GENÉRICO / RELATÓRIO.
            TEMA: ${data.topic}.
            ESTRUTURA: Título, Subtítulos, Parágrafos bem estruturados.
            REGRAS CSS: <div class="page">.
          `;
      }

      const promptText = `
        Gere um DOCUMENTO HTML COMPLETO pronto para imprimir/Word.
        
        ${promptContext}

        IMPORTANTE:
        1. Gere APENAS o HTML dentro das divs class="page".
        2. Não use markdown.
        3. CSS inline para garantir formatação básica.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptText
      });
      
      let text = response.text || "";
      // Remove blocos de código se a IA os incluir
      text = text.replace(/```html/g, '').replace(/```/g, '');
      return text;
    } catch (error) {
      console.error("Gemini Document Error:", error);
      throw error;
    }
  },

  async humanizeText(text: string, variant: HumanizerVariant): Promise<string> {
    try {
      const prompt = `
        Aja como um falante nativo de ${variant}. Reescreva o texto para torná-lo natural.
        Texto: "${text}"
      `;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      return response.text || text;
    } catch (error) {
      console.error("Humanizer Error:", error);
      return text;
    }
  }
};