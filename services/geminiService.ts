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
        
        INFORMAÇÕES SOBRE ORIGEM, CRIADOR E A EMPRESA (Use APENAS se perguntado sobre quem te criou, ano de criação ou o que é a IV4):
        - Ano de criação: 2025.
        - Criador: Ivo Nunes Jaime.
        - Local: No quarto dele, na casa dos avós, na província do Niassa, distrito de Lichinga, Moçambique.
        - Contexto: És um dos projetos de Ivo que já está em funcionamento.
        - Sobre a IV4: A IV4 não é apenas um chat, é uma empresa de tecnologia que está a nascer num quarto com o objetivo de trazer inovação.
        
        COMPORTAMENTO:
        - Se o usuário NÃO perguntar sobre sua origem, criador ou empresa, NÃO mencione isso espontaneamente.
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
            
            Histórico da conversa:
            ${JSON.stringify(history)}

            Nova mensagem do usuário: "${currentMessage}"

            LÓGICA DE EXTRAÇÃO:
            
            1. IDENTIFIQUE O TIPO DE DOCUMENTO ('docType'):
               - 'TRABALHO_ESCOLAR': Se pedir trabalho, pesquisa, relatório, TPC, projeto.
               - 'CURRICULO': Se pedir CV, curriculum vitae.
               - 'CARTA': Se pedir carta, requerimento, declaração.
               - 'GENERICO': Outros.

            2. PEÇA DETALHES BASEADO NO TIPO:
               
               A) Se for TRABALHO_ESCOLAR / RELATÓRIO:
                  - Precisa de: Nome da Escola/Instituição, Nome do Aluno (Autor), Nome do Docente/Supervisor, Cadeira/Disciplina, TEMA DO TRABALHO, Classe/Ano, Local (Cidade) e Ano atual.
               
               B) Se for CURRICULO (CV):
                  - Precisa de: Nome Completo, Contactos, Resumo Profissional, Habilidades, Histórico (Educação/Emprego).
               
               C) Se for CARTA / REQUERIMENTO:
                  - Precisa de: Quem envia (Remetente), Quem recebe (Destinatário), Assunto, Objetivo da carta.

            3. REGRAS DE RETORNO:
               - Se faltam dados críticos para aquele tipo, sua 'reply' deve pedir esses dados educadamente.
               - Se o usuário mandou informações, armazene em 'extractedData'. Mantenha os dados anteriores se não mudaram.
               - Se tiver dados suficientes OU o usuário disser "pode gerar", defina "isReady": true.

            Retorne APENAS um JSON neste formato (sem markdown):
            {
                "reply": "Sua pergunta ou confirmação aqui...",
                "extractedData": {
                    "docType": "TRABALHO_ESCOLAR" | "CURRICULO" | "CARTA" | "GENERICO",
                    "topic": "Tema ou Assunto Principal",
                    "school": "...", 
                    "student": "...", 
                    "teacher": "...", 
                    "grade": "...", 
                    "location": "Ex: Lichinga",
                    "year": "2025",
                    "cvData": { "name": "...", "experience": "..." },
                    "letterData": { "to": "...", "from": "...", "subject": "..." }
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
      
      // Definição de estilos CSS embutidos para garantir formatação exata A4 e bordas
      const styleBlock = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');
            body { 
                font-family: 'Times New Roman', serif; 
                line-height: 1.5; 
                color: black; 
                margin: 0;
                padding: 0;
            }
            .page {
                width: 21cm;
                height: 29.7cm;
                padding: 3cm 2.5cm 2.5cm 3cm; /* Margens ABNT/Padrão: Sup 3, Dir 2.5, Inf 2.5, Esq 3 */
                background: white;
                box-sizing: border-box;
                overflow: hidden;
                position: relative;
                page-break-after: always;
                font-size: 12pt;
                text-align: justify;
            }
            /* Capa com Esquadria Dupla */
            .page-cover {
                padding: 1cm !important; /* Margem menor para dar espaço à borda */
                display: flex;
                flex-direction: column;
            }
            .cover-border-outer {
                border: 3px solid black;
                height: 100%;
                width: 100%;
                padding: 4px; /* Espaço entre borda grossa e fina */
                box-sizing: border-box;
            }
            .cover-border-inner {
                border: 1px solid black;
                height: 100%;
                width: 100%;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: center;
                padding: 2cm 1cm;
                box-sizing: border-box;
                text-align: center;
            }
            
            /* Títulos e Textos */
            h1 { font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 0.5cm; text-align: center; }
            h2 { font-size: 12pt; font-weight: bold; text-transform: uppercase; margin-top: 1cm; margin-bottom: 0.5cm; text-align: left; }
            h3 { font-size: 12pt; font-weight: bold; margin-top: 0.5cm; text-align: left; }
            p { margin-bottom: 0.5cm; }
            
            /* Caixa de texto da Folha de Rosto */
            .folha-rosto-container {
                height: 100%;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: center;
            }
            .natureza-trabalho-box {
                width: 55%;
                margin-left: 45%; /* Joga para a direita */
                font-size: 10pt;
                line-height: 1.2;
                margin-top: 2cm;
                margin-bottom: 2cm;
                text-align: justify;
                border: 1px solid black; /* Borda fina para destacar no exemplo, opcional */
                padding: 10px;
            }
            
            /* Elementos Centrados */
            .centered { text-align: center; }
            .uppercase { text-transform: uppercase; }
            .bold { font-weight: bold; }
            
            /* Rodapé de Data */
            .footer-date { margin-top: auto; text-align: center; font-weight: bold; }
            
            /* Índice */
            .toc-item { display: flex; justify-content: space-between; border-bottom: 1px dotted #ccc; margin-bottom: 5px; }
            .toc-page { font-weight: bold; }
        </style>
      `;
      
      let promptContext = "";
      
      if (docType === 'TRABALHO_ESCOLAR') {
          promptContext = `
            TIPO: RELATÓRIO DE INVESTIGAÇÃO / TRABALHO ACADÉMICO FORMAL (Moçambique).
            
            DADOS PARA PREENCHER:
            - Instituição: ${data.school || "INSTITUTO DE FORMAÇÃO"}
            - Autor: ${data.student || "Nome do Aluno"}
            - Título/Tema: ${data.topic || data.theme || "TEMA DO TRABALHO"}
            - Local/Data: ${data.location || "Moçambique"}, ${data.year || "2025"}
            - Texto da Folha de Rosto: "Trabalho de campo/investigação a ser apresentado na instituição ${data.school || ""}, na disciplina de ${data.subject || "Investigação"}, como requisito de avaliação sob supervisão do docente: ${data.teacher || "Nome do Docente"}."
            
            ESTRUTURA OBRIGATÓRIA (Crie cada página dentro de uma <div class="page">):
            
            PÁGINA 1: CAPA (Use classes .page-cover, .cover-border-outer, .cover-border-inner)
            - Topo: Nome da Instituição (Maiúsculas, Negrito).
            - Centro Superior: Nome do Autor.
            - Centro Meio: TÍTULO DO TRABALHO (Maiúsculas, Negrito, Grande).
            - Base: Local e Data.
            
            PÁGINA 2: FOLHA DE ROSTO (Sem borda dupla, layout padrão)
            - Topo: Nome do Autor.
            - Centro: Título do Trabalho.
            - Meio-Direita (Classe .natureza-trabalho-box): O texto explicativo sobre a natureza do trabalho (requisito parcial, nome do docente, etc).
            - Base: Local e Data.
            
            PÁGINA 3: ÍNDICE
            - Título "ÍNDICE".
            - Lista simulada de tópicos (Introdução... pág 4, etc).
            
            PÁGINA 4: INTRODUÇÃO
            - Título "1. INTRODUÇÃO".
            - Texto introdutório bem desenvolvido sobre "${data.topic}".
            - Incluir subseção "1.1 Problema".
            - Incluir subseção "1.2 Objetivos" (Geral e Específicos).
            - Incluir subseção "1.3 Justificativa".
            
            PÁGINA 5: DESENVOLVIMENTO / FUNDAMENTAÇÃO TEÓRICA
            - Título "2. FUNDAMENTAÇÃO TEÓRICA".
            - Desenvolva o tema com base em autores fictícios ou reais (ex: Piaget, Vygotsky se for educação, ou relevantes à área).
            - Cite pelo menos 2 definições ou conceitos.
            
            PÁGINA 6: CONCLUSÃO E BIBLIOGRAFIA
            - Título "3. CONCLUSÃO".
            - Breve fecho.
            - Título "4. BIBLIOGRAFIA".
            - Lista de 3 referências bibliográficas formatadas (APA).
          `;
      } else if (docType === 'CURRICULO') {
          promptContext = `
            TIPO: CURRICULUM VITAE (CV).
            ESTRUTURA: Cabeçalho, Resumo, Experiência, Educação.
            Use <div class="page">. Formatação limpa e profissional.
          `;
      } else {
          promptContext = `
            TIPO: DOCUMENTO GERAL.
            TEMA: ${data.topic}.
            Use <div class="page">. Título e parágrafos.
          `;
      }

      const promptText = `
        Gere um DOCUMENTO HTML COMPLETO.
        
        INSTRUÇÕES TÉCNICAS:
        1. Inclua o bloco de estilo CSS fornecido abaixo exatemente como está.
        2. Use APENAS HTML. Não use Markdown (nada de \`\`\`).
        3. O conteúdo deve estar dentro de tags <div class="page"> para garantir a quebra de página.
        
        ${styleBlock}
        
        CONTEÚDO E ESTRUTURA DO DOCUMENTO:
        ${promptContext}
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
        Aja como um falante nativo de ${variant}. Reescreva o texto para torná-lo natural, fluido e humano.
        Mantenha a formatação HTML se houver.
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
