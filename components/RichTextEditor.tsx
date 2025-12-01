import React, { useRef, useEffect } from 'react';
import { 
  Bold, Italic, Underline, AlignCenter, AlignLeft, 
  AlignRight, Download, FileText, Copy, RotateCcw 
} from 'lucide-react';

interface RichTextEditorProps {
  initialContent: string;
  onChange: (content: string) => void;
  onHumanizeRequest: () => void;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ initialContent, onChange, onHumanizeRequest }) => {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && initialContent) {
      if (editorRef.current.innerHTML === "") {
        editorRef.current.innerHTML = initialContent;
      } else if (initialContent !== editorRef.current.innerHTML) {
         editorRef.current.innerHTML = initialContent;
      }
    }
  }, [initialContent]);

  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const downloadDoc = () => {
    if (!editorRef.current) return;
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Documento IV4 IA</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + editorRef.current.innerHTML + footer;
    
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = 'documento_iv4_ia.doc';
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  const downloadPDF = () => {
    const printContents = editorRef.current?.innerHTML || "";
    const printWindow = window.open('', '', 'height=600,width=800');
    if(printWindow) {
        printWindow.document.write('<html><head><title>IV4 IA Documento</title>');
        printWindow.document.write('<style>body{font-family: sans-serif; padding: 40px;}</style>'); 
        printWindow.document.write('</head><body >');
        printWindow.document.write(printContents);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    }
  };

  const copyToClipboard = () => {
    if (editorRef.current) {
        navigator.clipboard.writeText(editorRef.current.innerText);
        alert("Texto copiado!");
    }
  }

  const ToolbarBtn = ({ onClick, icon: Icon, title, active }: any) => (
    <button 
        onClick={onClick} 
        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 transition-colors"
        title={title}
    >
        <Icon size={18} />
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
            <ToolbarBtn onClick={() => execCommand('bold')} icon={Bold} title="Negrito" />
            <ToolbarBtn onClick={() => execCommand('italic')} icon={Italic} title="Itálico" />
            <ToolbarBtn onClick={() => execCommand('underline')} icon={Underline} title="Sublinhado" />
        </div>
        
        <div className="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
            <ToolbarBtn onClick={() => execCommand('justifyLeft')} icon={AlignLeft} />
            <ToolbarBtn onClick={() => execCommand('justifyCenter')} icon={AlignCenter} />
            <ToolbarBtn onClick={() => execCommand('justifyRight')} icon={AlignRight} />
        </div>

        <div className="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-2">
            <button onClick={() => execCommand('formatBlock', 'H1')} className="px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-sm font-bold text-gray-700 dark:text-gray-300">H1</button>
            <button onClick={() => execCommand('formatBlock', 'H2')} className="px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-sm font-bold text-gray-700 dark:text-gray-300">H2</button>
            <button onClick={() => execCommand('formatBlock', 'P')} className="px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-sm text-gray-700 dark:text-gray-300">P</button>
        </div>

        <div className="flex-grow"></div>

        <button onClick={onHumanizeRequest} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded hover:bg-indigo-200 dark:hover:bg-indigo-900/50 text-sm font-medium transition-colors">
            <RotateCcw size={16} /> Humanizar
        </button>

        <ToolbarBtn onClick={copyToClipboard} icon={Copy} title="Copiar" />
        <ToolbarBtn onClick={downloadDoc} icon={FileText} title="Baixar Word" />
        <ToolbarBtn onClick={downloadPDF} icon={Download} title="Imprimir/PDF" />
      </div>

      {/* Editor Area - ALWAYS WHITE BACKGROUND WITH BLACK TEXT (Like Paper) */}
      <div className="flex-grow bg-gray-100 dark:bg-gray-950 p-4 md:p-8 overflow-y-auto">
        <div 
            ref={editorRef}
            className="bg-white text-black max-w-[210mm] mx-auto p-[20mm] min-h-[297mm] shadow-lg focus:outline-none prose max-w-none"
            contentEditable
            onInput={handleInput}
            style={{ 
                color: 'black' // Explicitly force black text
            }}
        >
        </div>
      </div>
    </div>
  );
};