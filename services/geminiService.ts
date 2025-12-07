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

            LÓGICA DE DETECÇÃO DE GRUPO VS INDIVIDUAL:
            - A deteção será refinada na geração, mas tente identificar nomes aqui.
            - Se o usuário fornecer vários nomes separados por vírgula ou "e", assuma que é um trabalho de GRUPO.

            LÓGICA DE EXTRAÇÃO:
            
            1. IDENTIFIQUE O TIPO DE DOCUMENTO ('docType'):
               - 'TRABALHO_ESCOLAR': Se pedir trabalho, pesquisa, relatório, TPC, projeto.
               - 'CURRICULO': Se pedir CV, curriculum vitae.
               - 'CARTA': Se pedir carta, requerimento, declaração.
               - 'GENERICO': Outros.

            2. PEÇA DETALHES BASEADO NO TIPO:
               
               A) Se for TRABALHO_ESCOLAR / RELATÓRIO:
                  - Precisa de: 
                    1. Nome da Escola (ex: Escola Secundária Paulo Samuel Kankhomba).
                    2. Nome do(s) Aluno(s). Peça todos os nomes.
                    3. Nome do Docente.
                    4. Disciplina e Tema.
                    5. Classe e TURMA (ex: 10ª Classe, Turma B).
                    6. Local (Cidade).
               
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
                    "workMode": "INDIVIDUAL" | "GRUPO",
                    "topic": "Tema ou Assunto Principal",
                    "school": "...", 
                    "student": "...", 
                    "teacher": "...", 
                    "grade": "...", 
                    "class": "Ex: B",
                    "subject": "...",
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

  async editDocumentFragment(currentHTML: string, userInstruction: string): Promise<string> {
    try {
        const prompt = `
            Você é um assistente de edição de texto inteligente para o 'IV4 Studio'.
            O usuário quer modificar o documento HTML atual.
            
            HTML ATUAL:
            ${currentHTML}
            
            INSTRUÇÃO DO USUÁRIO:
            "${userInstruction}"
            
            AÇÃO:
            1. Analise o que o usuário quer mudar.
            2. Se ele pedir para expandir, escreva muito mais conteúdo.
            3. Se ele pedir para corrigir, corrija.
            4. Mantenha a estrutura de <div class="page"> intacta.
            5. Retorne O HTML COMPLETO ATUALIZADO.
            6. NÃO use Markdown (\`\`\`). Retorne HTML puro.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });

        let text = response.text || currentHTML;
        text = text.replace(/```html/g, '').replace(/```/g, '');
        return text;
    } catch (error) {
        console.error("Edit Error:", error);
        throw error;
    }
  },

  async generateDocument(data: any, addBorder: boolean = true): Promise<string> {
    try {
      const docType = data.docType || 'GENERICO';
      const currentMonth = new Date().toLocaleString('pt-PT', { month: 'long' });
      const currentYear = new Date().getFullYear();
      
      // Lógica de Detecção Inteligente de Grupo vs Individual
      // Se tiver vírgula (,) ou " e " no nome do aluno, assume-se grupo.
      let isGroup = false;
      const studentName = data.student || "";
      
      if (studentName.includes(',') || studentName.toLowerCase().includes(' e ')) {
          isGroup = true;
      }
      
      // Forçar modo grupo se o usuário já tinha especificado na negociação, mas verificar nomes também
      if (data.workMode === 'GRUPO') isGroup = true;

      // Estilo CSS Robusto para evitar "Folhas Brancas" e garantir impressão correta
      const styleBlock = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');
            
            /* Garante que o texto seja preto e visível */
            .iv4-document-container {
                font-family: 'Times New Roman', serif; 
                line-height: 1.5; 
                color: black !important;
                background-color: transparent;
            }
            
            /* Configuração da Página A4 */
            .page {
                width: 21cm;
                min-height: 29.7cm;
                padding: 3cm 2.5cm 2.5cm 3cm; /* Margens ABNT */
                background: white !important;
                color: black !important;
                box-sizing: border-box;
                margin: 0 auto 20px auto;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                position: relative;
                overflow: visible;
                page-break-after: always;
                break-after: page;
            }

            /* Estilos de Impressão (PDF) */
            @media print {
                body * {
                    visibility: hidden;
                }
                #printable-content, #printable-content * {
                    visibility: visible;
                }
                #printable-content {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                }
                .page {
                    margin: 0 !important;
                    box-shadow: none !important;
                    height: 29.7cm !important;
                    overflow: hidden !important;
                    page-break-after: always;
                    break-after: page;
                }
                /* Esconde UI do editor na impressão */
                .drag-handle, .iv4-ui-element { display: none !important; }
            }

            /* Capa - Borda e Layout */
            .page-cover {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                text-align: center;
                border: none;
            }
            .cover-border-outer {
                border: 3px solid black;
                height: 100%;
                width: 100%;
                padding: 4px;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
            }
            .cover-border-inner {
                border: 1px solid black;
                flex-grow: 1;
                width: 100%;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: center;
                padding: 1cm;
                box-sizing: border-box;
            }
            
            /* Contra Capa */
            .page-back-cover {
                display: flex;
                flex-direction: column;
                text-align: center;
            }
            .assignment-block {
                width: 60%;
                margin-left: 40%;
                text-align: justify;
                font-size: 11pt;
                margin-top: 4cm;
                margin-bottom: 4cm;
            }

            /* Texto */
            h1 { font-size: 16pt; font-weight: bold; text-transform: uppercase; margin-bottom: 1cm; text-align: center; color: black; }
            h2 { font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-top: 1cm; margin-bottom: 0.5cm; text-align: left; color: black; }
            h3 { font-size: 12pt; font-weight: bold; margin-top: 0.5cm; text-align: left; color: black; }
            p { margin-bottom: 0.5cm; text-indent: 1.25cm; text-align: justify; color: black; }
            
            /* Índice */
            .toc-item { display: flex; justify-content: space-between; border-bottom: 1px dotted #000; margin-bottom: 10px; }
            .toc-text { background: white; padding-right: 5px; font-weight: bold; }
            .toc-page { background: white; padding-left: 5px; }

            /* Listas */
            .student-list { list-style: none; padding: 0; font-weight: bold; margin: 1cm 0; font-size: 12pt; }
        </style>
      `;
      
      let promptContext = "";
      
      if (docType === 'TRABALHO_ESCOLAR') {
          promptContext = `
            Você é um assistente especializado em gerar trabalhos escolares académicos para Moçambique.
            
            REGRAS CRÍTICAS:
            1. NÃO RESUMA NADA. O usuário quer um trabalho COMPLETO, EXTENSO e DETALHADO. Traga muitas informações.
            2. Se o texto for longo, divida em várias páginas usando <div class="page">.
            3. Detecte Grupo vs Individual AUTOMATICAMENTE: 
               - Nomes fornecidos: "${studentName}".
               - Se houver múltiplos nomes: Trate como TRABALHO EM GRUPO (Discentes, Nós, O grupo).
               - Se houver apenas um nome: Trate como TRABALHO INDIVIDUAL (Discente, Eu, O aluno).

            ESTRUTURA OBRIGATÓRIA (Use HTML puro):

            --- PÁGINA 1: CAPA ---
            <div class="page page-cover">
                <div class="cover-border-outer">
                    <div class="cover-border-inner">
                        <div>
                            <p style="font-weight:bold; font-size:14pt; margin:0;">${data.school ? data.school.toUpperCase() : "NOME DA ESCOLA"}</p>
                        </div>
                        
                        <div style="margin: auto 0;">
                            <h1 style="margin-bottom: 0.5cm;">${data.topic ? data.topic.toUpperCase() : "TEMA DO TRABALHO"}</h1>
                            <p style="font-weight:bold; font-size:12pt;">${data.subject || "Disciplina"}</p>
                        </div>
                        
                        <div style="width: 100%;">
                            <p style="font-weight:bold;">${isGroup ? "Discentes / Elementos do Grupo:" : "Discente / Aluno:"}</p>
                            <ul class="student-list">
                                ${studentName.split(/,| e /).map((n: string) => `<li>${n.trim()}</li>`).join('')}
                            </ul>
                            <p style="margin-top: 1cm;">Docente: ${data.teacher || "Nome do Docente"}</p>
                        </div>

                        <div>
                            <p style="margin:0;">${data.location || "Cidade"}, ${data.month || currentMonth} de ${data.year || currentYear}</p>
                        </div>
                    </div>
                </div>
            </div>

            --- PÁGINA 2: CONTRA CAPA (Folha de Rosto) ---
            <div class="page page-back-cover">
                <div style="margin-top: 2cm;">
                    <p style="font-weight:bold; font-size:12pt;">${studentName}</p>
                </div>

                <div style="margin-top: 5cm;">
                     <h1 style="font-size:16pt;">${data.topic ? data.topic.toUpperCase() : "TEMA"}</h1>
                </div>

                <div class="assignment-block">
                    <p style="text-indent: 0;">Trabalho de aplicação de carácter avaliativo da disciplina de ${data.subject || "Disciplina"}, leccionado pelo(a) docente: ${data.teacher || "Nome do Docente"} para efeitos de avaliação na ${data.grade || "X"} Classe, Turma ${data.class || "X"}.</p>
                </div>

                <div style="margin-top: auto;">
                    <p>${data.location || "Local"}, ${data.year || currentYear}</p>
                </div>
            </div>

            --- PÁGINA 3: ÍNDICE ---
            <div class="page">
                <h2 style="text-align:center;">ÍNDICE</h2>
                <div class="toc-item"><span class="toc-text">1. Introdução</span><span class="toc-page">4</span></div>
                <div class="toc-item"><span class="toc-text">2. Desenvolvimento</span><span class="toc-page">5</span></div>
                <div class="toc-item"><span class="toc-text">3. Conclusão</span><span class="toc-page">X</span></div>
                <div class="toc-item"><span class="toc-text">4. Bibliografia</span><span class="toc-page">Y</span></div>
            </div>

            --- PÁGINA 4: INTRODUÇÃO ---
            <div class="page">
                <h2>1. INTRODUÇÃO</h2>
                <p>Escreva uma introdução longa, de pelo menos 4 a 6 parágrafos, contextualizando o tema ${data.topic}. Fale sobre a importância, objetivos gerais e específicos e metodologia usada.</p>
            </div>

            --- PÁGINAS 5+: DESENVOLVIMENTO (EXTENSO) ---
            <div class="page">
                <h2>2. DESENVOLVIMENTO</h2>
                <p>Desenvolva o tema profundamente. Use subtítulos (2.1, 2.2, etc.). Traga definições, características, exemplos, histórico. NÃO RESUMA. O texto deve ocupar toda a folha e se necessário crie mais páginas &lt;div class="page"&gt;.</p>
                <p>Informação detalhada é essencial.</p>
            </div>

             --- PÁGINA SEPARADA: CONCLUSÃO ---
            <div class="page">
                <h2>3. CONCLUSÃO</h2>
                <p>Conclusão detalhada retomando os objetivos. Mínimo 3 parágrafos.</p>
            </div>

             --- PÁGINA SEPARADA: BIBLIOGRAFIA ---
            <div class="page">
                <h2>4. REFERÊNCIAS BIBLIOGRÁFICAS</h2>
                <p>Liste referências bibliográficas fictícias mas plausíveis (livros, artigos) formatadas normas APA 6ª ou 7ª edição.</p>
            </div>
          `;
      } else {
          promptContext = `
            TIPO: DOCUMENTO GERAL (${docType}).
            TEMA: ${data.topic}.
            Gere um documento profissional com capa e conteúdo extenso.
            Use <div class="page"> para separar páginas.
            NÃO RESUMA.
          `;
      }

      const promptText = `
        Gere um DOCUMENTO HTML COMPLETO para impressão.
        
        INSTRUÇÕES:
        1. Inclua o bloco de estilo CSS fornecido EXATAMENTE no início.
        2. Retorne APENAS HTML válido.
        3. Use a estrutura de <div class="page"> rigorosamente.
        4. O conteúdo deve ser rico, académico e extenso (NÃO RESUMIDO).
        
        ${styleBlock}
        
        CONTEÚDO:
        ${promptContext}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptText
      });
      
      let text = response.text || "";
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