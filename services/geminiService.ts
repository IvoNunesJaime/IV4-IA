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

            LÓGICA DE DETECÇÃO DE TIPO:
            - Se o usuário falar "Relatório", "Relatório de Estágio", "Investigação", classifique como 'RELATORIO'.
            - Se o usuário falar "Trabalho", "Trabalho de...", "Pesquisa", classifique como 'TRABALHO_ESCOLAR'.

            LÓGICA DE DETECÇÃO DE GRUPO VS INDIVIDUAL:
            - Tente identificar nomes aqui.
            - Se houver múltiplos nomes: workMode = 'GRUPO'.
            - Se houver um nome: workMode = 'INDIVIDUAL'.

            LÓGICA DE EXTRAÇÃO:
            
            1. IDENTIFIQUE O TIPO DE DOCUMENTO ('docType'):
               - 'TRABALHO_ESCOLAR'
               - 'RELATORIO'
               - 'CURRICULO'
               - 'CARTA'
               - 'GENERICO'

            2. PEÇA DETALHES BASEADO NO TIPO:
               
               A) Se for TRABALHO_ESCOLAR ou RELATORIO:
                  - Precisa de: 
                    1. Nome da Escola / Instituto (ex: IFP, UP, Escola Secundária...).
                    2. Nome do(s) Aluno(s) / Autor(es).
                    3. Nome do Docente / Supervisor.
                    4. Disciplina / Cadeira e Tema.
                    5. Classe/Ano e Turma.
                    6. Local (Cidade).
               
               B) Se for CURRICULO (CV):
                  - Precisa de: Nome Completo, Contactos, Resumo Profissional, Habilidades, Histórico.
               
               C) Se for CARTA / REQUERIMENTO:
                  - Precisa de: Quem envia (Remetente), Quem recebe (Destinatário), Assunto, Objetivo.

            3. REGRAS DE RETORNO:
               - Se faltam dados críticos para aquele tipo, sua 'reply' deve pedir esses dados educadamente.
               - Se o usuário mandou informações, armazene em 'extractedData'. Mantenha os dados anteriores se não mudaram.
               - Se tiver dados suficientes OU o usuário disser "pode gerar", defina "isReady": true.

            Retorne APENAS um JSON neste formato (sem markdown):
            {
                "reply": "Sua pergunta ou confirmação aqui...",
                "extractedData": {
                    "docType": "TRABALHO_ESCOLAR" | "RELATORIO" | "CURRICULO" | "CARTA" | "GENERICO",
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
      let isGroup = false;
      const studentName = data.student || "";
      
      // Verifica se há vírgula, " e ", ou quebras de linha para inferir grupo
      if (studentName.includes(',') || studentName.toLowerCase().includes(' e ') || studentName.includes('\n')) {
          isGroup = true;
      }
      if (data.workMode === 'GRUPO') isGroup = true;
      if (data.workMode === 'INDIVIDUAL') isGroup = false;

      const studentLabel = isGroup ? "Discentes:" : "Discente:";
      
      // Label dinâmico para "Trabalho em grupo/individual"
      const subjectText = data.subject ? `de ${data.subject}` : "";
      const workTypeLabel = isGroup 
          ? `Trabalho em grupo ${subjectText}` 
          : `Trabalho individual ${subjectText}`;

      // Detalhes da classe/turma
      const classInfo = `${data.grade || "10ª"} Classe, Turma '${data.class || "A"}'`;


      // Estilo CSS Robusto com Responsividade Mobile e Índice Estruturado
      const styleBlock = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');
            
            .iv4-document-container {
                font-family: 'Times New Roman', serif; 
                line-height: 1.5; 
                color: black !important;
                background-color: transparent;
                width: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            
            /* General Page Settings (Desktop/Print default) */
            .page {
                width: 21cm;
                min-height: 29.7cm; /* Default A4 height */
                padding: 2.5cm;
                background: white !important;
                color: black !important;
                box-sizing: border-box;
                margin: 0 auto 20px auto;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                position: relative;
                overflow: hidden;
                page-break-after: always;
                break-after: page;
                display: flex;
                flex-direction: column;
            }

            /* Responsive Design for Mobile Screens (Phones) */
            @media screen and (max-width: 768px) {
                .page {
                    width: 95% !important; /* Fit screen width with margin */
                    max-width: 21cm;
                    min-height: 0 !important; /* Let content dictate height */
                    height: auto !important;
                    padding: 1.5cm !important; /* Smaller padding */
                    margin-bottom: 15px !important;
                }
                
                .page.cover-page {
                    height: auto !important; /* Allow cover to flex */
                    min-height: 80vh !important; /* Ensure it looks substantial */
                }

                .page-border {
                    padding: 0.5cm !important; /* Smaller border padding */
                    min-height: 75vh !important;
                }

                .header-school, .theme-area {
                    font-size: 14pt !important; /* Slightly smaller header text */
                }
                
                .sub-header-center, .student-label, .student-list {
                    font-size: 11pt !important;
                }

                .footer-info {
                    position: relative;
                    margin-top: 2cm !important;
                }
            }

            /* CAPA E CONTRA CAPA: Altura Fixa para layout perfeito em Desktop/Print */
            .page.cover-page {
                height: 29.7cm; 
                padding: 1.5cm; /* Reduced padding to allow border to fit */
            }

            /* MODO DE IMPRESSÃO - Força A4 Padrão */
            @media print {
                body * { visibility: hidden; }
                #printable-content, #printable-content * { visibility: visible; }
                #printable-content { position: absolute; left: 0; top: 0; width: 100%; }
                
                .page {
                    width: 21cm !important;
                    height: 29.7cm !important;
                    margin: 0 !important;
                    box-shadow: none !important;
                    border: none !important;
                    overflow: visible !important;
                    page-break-after: always;
                    break-after: page;
                    padding: 2.5cm !important;
                }
                .page.cover-page {
                    padding: 1.5cm !important;
                    height: 29.7cm !important;
                }
            }

            /* Borda da Página (Esquadria Académica) - SÓ NA CAPA */
            .page-border {
                border: 4px double black; /* Borda dupla grossa */
                height: 100%;
                width: 100%;
                padding: 1cm;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: center;
            }

            /* Container para Contra Capa (Sem Borda, mas mesmo layout) */
            .page-content-wrapper {
                height: 100%;
                width: 100%;
                padding: 1cm;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                justify-content: space-between; /* Garante que o footer vá para baixo */
                align-items: center;
                border: none;
            }

            /* Layout Interno Comum */
            .header-school {
                text-align: center;
                font-size: 16pt;
                font-weight: bold;
                text-transform: uppercase;
                margin-top: 1cm;
                width: 100%;
            }

            .sub-header-center {
                text-align: center;
                font-size: 12pt;
                margin-top: 2cm;
                width: 100%;
            }

            .theme-area {
                margin-top: 2cm;
                text-align: center;
                font-size: 16pt;
                font-weight: bold;
                width: 100%;
            }

            /* SEÇÃO DE ALUNOS - ALINHADA À ESQUERDA */
            .student-section {
                margin-top: 2cm;
                width: 100%;
                text-align: left; /* Garante alinhamento à esquerda */
                padding-left: 1cm; /* Ligeiro recuo */
            }

            .student-label {
                font-weight: bold;
                font-size: 12pt;
                margin-bottom: 10px;
                display: block;
            }

            .student-list {
                list-style: none;
                padding: 0;
                margin: 0;
                font-size: 12pt;
            }
            .student-list li {
                margin-bottom: 5px;
            }

            /* Box de Avaliação (Contra Capa) - ALINHADA À DIREITA */
            .evaluation-container {
                width: 100%;
                display: flex;
                justify-content: flex-end; /* Joga para a direita */
                margin-top: 1cm;
                margin-bottom: auto; /* Empurra para cima, deixando footer em baixo */
            }
            
            .evaluation-box {
                width: 60%;
                border: 1px solid black;
                padding: 15px;
                font-size: 11pt;
                text-align: justify;
                background: white;
            }

            /* Footer Info (Cidade e Data) - Sempre no fundo */
            .footer-info {
                margin-top: auto; /* Empurra para o fundo absoluto do container */
                text-align: center;
                font-weight: bold;
                font-size: 12pt;
                width: 100%;
                padding-bottom: 0.5cm;
            }
            
            /* ESTILIZAÇÃO PROFISSIONAL DO ÍNDICE */
            .index-title {
                text-align: center;
                font-weight: bold;
                font-size: 14pt;
                margin-bottom: 1.5cm;
                text-transform: uppercase;
            }
            .index-list {
                list-style: none;
                padding: 0;
                width: 100%;
            }
            .index-item {
                display: flex;
                align-items: flex-end; /* Alinha a linha pontilhada com a base do texto */
                margin-bottom: 8px;
                font-size: 12pt;
            }
            .index-label {
                font-weight: normal;
                white-space: nowrap;
            }
            .index-dots {
                flex-grow: 1;
                border-bottom: 2px dotted black; /* Efeito de pontos */
                margin: 0 5px 5px 5px; /* Margem para alinhar */
                min-width: 20px;
            }
            .index-page {
                font-weight: normal;
                white-space: nowrap;
            }
            .index-sub-item .index-label {
                padding-left: 20px; /* Indentação para subtópicos */
            }

            h1, h2, h3, p { color: black; }
        </style>
      `;
      
      let promptContext = "";
      
      if (docType === 'TRABALHO_ESCOLAR' || docType === 'RELATORIO') {
          promptContext = `
            Você é um assistente acadêmico rigoroso (Padrão Moçambique).
            
            INSTRUÇÃO MESTRA: 
            1. A CAPA (Página 1) DEVE ter a Esquadria (Borda Dupla) e o rodapé com Cidade/Data.
            2. A CONTRA CAPA (Página 2) NÃO DEVE ter Esquadria, mas DEVE ter o rodapé com Cidade/Data.
            3. O ÍNDICE (Página 3) DEVE ser bem estruturado com pontinhos ligando ao número da página.
            4. TODAS AS OUTRAS PÁGINAS (Introdução, Desenvolvimento, etc.) NÃO DEVEM TER Cidade nem Data no rodapé. Devem ser limpas.

            DADOS:
            - Escola: ${data.school || "Escola Secundária..."}
            - Tipo: ${workTypeLabel}
            - Turma Info: ${classInfo}
            - Tema: ${data.topic || "Tema do Trabalho"}
            - Alunos: ${studentName}
            - Label Aluno: ${studentLabel}
            - Docente: ${data.teacher || "Nome do Docente"}
            - Cidade: ${data.location || "Lichinga"}
            - Data: ${currentMonth} de ${currentYear}

            --- PÁGINA 1: CAPA (COM ESQUADRIA) ---
            Estrutura HTML Obrigatória:
            <div class="page cover-page"><div class="page-border">
                <div class="header-school">${data.school || "ESCOLA SECUNDÁRIA..."}</div>
                <div class="sub-header-center">
                    ${workTypeLabel}<br/>
                    ${classInfo}
                </div>
                <div class="theme-area">Tema: ${data.topic || "..."}</div>
                <div class="student-section">
                    <span class="student-label">${studentLabel}</span>
                    <ul class="student-list">
                        ${studentName.split(/\n|,/).map((s: string) => `<li>${s.trim()}</li>`).join('')}
                    </ul>
                </div>
                <div class="footer-info">${data.location || "Lichinga"}, ${currentMonth} de ${currentYear}</div>
            </div></div>

            --- PÁGINA 2: CONTRA CAPA (SEM ESQUADRIA) ---
            Estrutura HTML Obrigatória:
            <div class="page cover-page"><div class="page-content-wrapper">
                <div class="header-school">${data.school || "ESCOLA SECUNDÁRIA..."}</div>
                <div class="sub-header-center">
                    ${workTypeLabel}<br/>
                    ${classInfo}
                </div>
                <div class="theme-area">Tema: ${data.topic || "..."}</div>
                <div class="student-section">
                    <span class="student-label">${studentLabel}</span>
                    <ul class="student-list">
                         ${studentName.split(/\n|,/).map((s: string) => `<li>${s.trim()}</li>`).join('')}
                    </ul>
                </div>
                <div class="evaluation-container">
                    <div class="evaluation-box">
                        Trabalho de aplicação de carácter avaliativo de disciplina de <strong>${data.subject || '...'}</strong> leccionado pelo professor:<br/><br/>
                        <strong>${data.teacher || '...'}</strong>
                    </div>
                </div>
                <div class="footer-info">${data.location || "Lichinga"}, ${currentMonth} de ${currentYear}</div>
            </div></div>

            --- PÁGINA 3: ÍNDICE BEM ESTRUTURADO ---
            Use a estrutura de lista com pontos:
            <div class="page">
                <div class="index-title">Índice</div>
                <ul class="index-list">
                    <li class="index-item"><span class="index-label">1. Introdução</span><span class="index-dots"></span><span class="index-page">4</span></li>
                    <li class="index-item"><span class="index-label">2. Desenvolvimento</span><span class="index-dots"></span><span class="index-page">5</span></li>
                    <!-- Adicione subtópicos do desenvolvimento aqui ex: 2.1 Conceito -->
                    <li class="index-item index-sub-item"><span class="index-label">2.1 Conceitos Fundamentais</span><span class="index-dots"></span><span class="index-page">5</span></li>
                    <li class="index-item"><span class="index-label">3. Conclusão</span><span class="index-dots"></span><span class="index-page">8</span></li>
                    <li class="index-item"><span class="index-label">4. Bibliografia</span><span class="index-dots"></span><span class="index-page">9</span></li>
                </ul>
            </div>

            --- PÁGINAS SEGUINTES (Conteúdo Extenso) ---
            IMPORTANTE: NÃO COLOQUE CIDADE NEM DATA NO RODAPÉ DESTAS PÁGINAS.
            
            - Introdução (Página Separada)
            - Desenvolvimento (Texto longo e detalhado, SEM RESUMIR. Use h2, h3 e parágrafos bem escritos. Crie subtópicos relevantes para o tema ${data.topic}.)
            - Conclusão (Página Separada)
            - Bibliografia (Página Separada)
          `;
      } else {
          promptContext = `Gere um documento formatado sobre ${data.topic}.`;
      }

      const promptText = `
        Gere um DOCUMENTO HTML COMPLETO.
        INSTRUÇÕES:
        1. Inclua o bloco <style> fornecido.
        2. Retorne APENAS HTML válido.
        3. Siga RIGOROSAMENTE a estrutura de Capa (Com Borda e Footer) e Contra Capa (Sem Borda e Com Footer).
        4. O Índice deve usar as classes CSS .index-item e .index-dots para ficar alinhado.
        5. NÃO COLOQUE FOOTER (Cidade/Data) nas páginas de conteúdo interno.
        
        ${styleBlock}
        
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