import React, { useState, useEffect, useRef } from 'react';
import { Auth } from './components/Auth';
import { Chat } from './components/Chat';
import { DocumentStudio } from './components/DocumentStudio';
import { HumanizerView } from './components/HumanizerView';
import { User, AppView, ChatSession, Message } from './types';
import { MessageSquare, FileText, LogOut, Menu, LogIn, Plus, Sparkles, Moon, Sun, RotateCcw, Search, PanelLeftClose, PanelLeft, Trash2, MoreHorizontal, Book, Zap, Code, X } from 'lucide-react';

const FREE_USAGE_LIMIT = 6;

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.CHAT);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authReason, setAuthReason] = useState<'user_action' | 'limit_reached'>('user_action');
  const [usageCount, setUsageCount] = useState(0);
  const [humanizerInitialText, setHumanizerInitialText] = useState<string>('');
  
  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Session Management
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Ref to track current session ID inside async callbacks (prevents duplication during streaming)
  const currentSessionIdRef = useRef<string | null>(currentSessionId);

  // Handle Dark Mode Class (Separated to avoid re-triggering initialization)
  useEffect(() => {
    if (isDarkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Initialization & Data Loading (Runs once on mount)
  useEffect(() => {
    // Restore User from LocalStorage
    const savedUser = localStorage.getItem('iv4_user');
    if (savedUser) {
        try {
            setUser(JSON.parse(savedUser));
        } catch (e) {
            console.error("Failed to parse user from local storage");
        }
    }
    
    // Check usage from local storage
    const savedUsage = localStorage.getItem('iv4_usage_count');
    if (savedUsage) setUsageCount(parseInt(savedUsage));

    // Load Sessions
    const savedSessions = localStorage.getItem('iv4_chat_sessions');
    if (savedSessions) {
        try {
            const parsed = JSON.parse(savedSessions);
            setSessions(parsed);
            // ALTERAÇÃO SOLICITADA:
            // Mesmo que existam sessões, iniciamos com currentSessionId = null.
            // Isso força a tela de "Nova Conversa" (Empty State), 
            // obrigando o usuário a clicar no histórico se quiser ver conversas antigas.
            setCurrentSessionId(null);
        } catch (e) {
            startNewChat();
        }
    } else {
        startNewChat();
    }
  }, []); // Empty dependency array ensures this only runs once on load

  // Sync Ref with State
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // Save sessions whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
        localStorage.setItem('iv4_chat_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  // Handle window resize for responsive sidebar
  useEffect(() => {
      const handleResize = () => {
          if (window.innerWidth > 768) {
              setIsSidebarOpen(true);
          } else {
              setIsSidebarOpen(false);
          }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startNewChat = () => {
      // Just clear the current ID to show empty state. 
      // The session will be created in memory only when the first message is sent.
      setCurrentSessionId(null);
      setCurrentView(AppView.CHAT);
      // Close mobile menu if open
      if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const updated = sessions.filter(s => s.id !== id);
      setSessions(updated);
      
      // If we deleted the active session, switch to new chat state
      if (currentSessionId === id) {
          if (updated.length > 0) setCurrentSessionId(null); // Force new chat logic here too
          else startNewChat();
      }
      localStorage.setItem('iv4_chat_sessions', JSON.stringify(updated));
  };

  const handleSessionUpdate = (messages: Message[]) => {
      const activeId = currentSessionIdRef.current;

      if (activeId) {
          // Update existing session
          setSessions(prev => prev.map(s => {
              if (s.id === activeId) {
                  // Generate title from first user message if it's "New Chat"
                  let newTitle = s.title;
                  if ((s.title === 'Nova Conversa' || !s.title) && messages.length > 0) {
                      const firstUserMsg = messages.find(m => m.role === 'user');
                      if (firstUserMsg) {
                          newTitle = firstUserMsg.text.slice(0, 30) + (firstUserMsg.text.length > 30 ? '...' : '');
                      }
                  }
                  return { ...s, messages, title: newTitle, lastMessageAt: Date.now() };
              }
              return s;
          }).sort((a, b) => b.lastMessageAt - a.lastMessageAt)); // Keep most recent at top
      } else {
          // Create NEW session (first message sent in empty state)
          const newId = Date.now().toString();
          
          // IMPORTANT: Update Ref immediately so subsequent updates (streaming) use this ID
          currentSessionIdRef.current = newId; 
          
          let newTitle = 'Nova Conversa';
          if (messages.length > 0) {
               const firstUserMsg = messages.find(m => m.role === 'user');
               if (firstUserMsg) {
                    newTitle = firstUserMsg.text.slice(0, 30) + (firstUserMsg.text.length > 30 ? '...' : '');
               }
          }

          const newSession: ChatSession = {
              id: newId,
              title: newTitle,
              messages: messages,
              createdAt: Date.now(),
              lastMessageAt: Date.now()
          };

          setSessions(prev => [newSession, ...prev]);
          setCurrentSessionId(newId);
      }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('iv4_user');
    setCurrentView(AppView.CHAT);
  };

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('iv4_user', JSON.stringify(loggedInUser));
    setIsAuthModalOpen(false);
    setAuthReason('user_action');
  };

  const checkUsageLimit = (): boolean => {
    if (user) return true;

    // Se o contador for 6 ou mais, bloqueia.
    if (usageCount >= FREE_USAGE_LIMIT) {
      setAuthReason('limit_reached');
      setIsAuthModalOpen(true);
      return false;
    }

    const newCount = usageCount + 1;
    setUsageCount(newCount);
    localStorage.setItem('iv4_usage_count', newCount.toString());
    return true;
  };

  const handleHumanizeRequest = (text: string) => {
    setHumanizerInitialText(text);
    setCurrentView(AppView.HUMANIZER);
  };

  const getCurrentSession = () => sessions.find(s => s.id === currentSessionId);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#030712] text-gray-900 dark:text-gray-100 font-sans overflow-hidden transition-colors duration-300">
      
      <Auth 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onLogin={handleLoginSuccess}
        triggerReason={authReason}
      />

      {/* Sidebar - Old Interface Layout */}
      {/* Mobile Overlay Background */}
      {isSidebarOpen && window.innerWidth < 768 && (
          <div 
            className="fixed inset-0 bg-black/50 z-20"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
      )}

      <aside 
        className={`fixed md:relative top-0 left-0 h-full bg-white dark:bg-[#020617] border-r border-gray-200 dark:border-white/5 transition-all duration-300 ease-in-out z-30 w-[280px] flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:w-0 md:translate-x-0 md:hidden'}`}
      >
        <div className="p-4 flex flex-col h-full relative">
            
            {/* Mobile Close Button */}
            <button 
                onClick={() => setIsSidebarOpen(false)}
                className="md:hidden absolute top-4 right-4 text-gray-400"
            >
                <X size={20} />
            </button>

            {/* Logo */}
            <div className="flex items-center gap-3 mb-6 px-2">
                <div className="p-1.5 bg-[#4f46e5] rounded-lg shadow-lg shadow-indigo-500/20">
                    <Sparkles className="text-white" size={18} />
                </div>
                <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-white">IV4 IA</span>
            </div>

            {/* New Chat Button */}
            <button 
                onClick={startNewChat}
                className="w-full bg-gray-100 dark:bg-[#1f2937] hover:bg-gray-200 dark:hover:bg-[#374151] text-gray-800 dark:text-white py-3 px-4 rounded-xl flex items-center gap-3 font-medium transition-colors mb-8 border border-gray-200 dark:border-white/5 shadow-sm group"
            >
                <Plus size={20} className="text-gray-500 dark:text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
                Nova Conversa
            </button>

            {/* Tools Section */}
            <div className="mb-8 flex-shrink-0">
                <h3 className="text-[11px] font-bold text-gray-500 mb-2 px-3 uppercase tracking-wider">FERRAMENTAS</h3>
                <nav className="space-y-1">
                    <button 
                        onClick={() => { 
                            setCurrentView(AppView.CHAT); 
                            // When clicking Chat, ensure we clear the session to show empty state (ChatGPT style)
                            setCurrentSessionId(null);
                            if(window.innerWidth < 768) setIsSidebarOpen(false); 
                        }} 
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            currentView === AppView.CHAT 
                            ? 'bg-[#4f46e5]/10 text-[#6366f1]' 
                            : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                        }`}
                    >
                        <MessageSquare size={18} />
                        Chat
                    </button>
                    <button 
                        onClick={() => { setCurrentView(AppView.HUMANIZER); if(window.innerWidth < 768) setIsSidebarOpen(false); }} 
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            currentView === AppView.HUMANIZER 
                            ? 'bg-[#4f46e5]/10 text-[#6366f1]' 
                            : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                        }`}
                    >
                        <RotateCcw size={18} />
                        Humanizador
                    </button>
                    <button 
                        onClick={() => { setCurrentView(AppView.STUDIO); if(window.innerWidth < 768) setIsSidebarOpen(false); }} 
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            currentView === AppView.STUDIO 
                            ? 'bg-[#4f46e5]/10 text-[#6366f1]' 
                            : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                        }`}
                    >
                        <FileText size={18} />
                        Estúdio
                    </button>
                </nav>
            </div>

            {/* History Section */}
            <div className="flex-grow overflow-y-auto custom-scrollbar pr-1 mb-4">
                 <h3 className="text-[11px] font-bold text-gray-500 mb-2 px-3 uppercase tracking-wider">HISTÓRICO</h3>
                 <div className="space-y-0.5">
                    {sessions.map(s => (
                        <SessionItem 
                            key={s.id} 
                            session={s} 
                            isActive={s.id === currentSessionId && currentView === AppView.CHAT} 
                            onClick={() => { 
                                setCurrentSessionId(s.id); 
                                setCurrentView(AppView.CHAT);
                                if(window.innerWidth < 768) setIsSidebarOpen(false);
                            }}
                            onDelete={(e) => deleteSession(e, s.id)}
                        />
                    ))}
                    {sessions.length === 0 && (
                        <p className="px-3 text-xs text-gray-500 italic">Sem histórico recente.</p>
                    )}
                 </div>
            </div>

            {/* Footer Actions */}
            <div className="flex-shrink-0 space-y-2 mt-auto">
                 {/* Light Mode Toggle */}
                 <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                 >
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                    {isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
                 </button>

                 <div className="pt-2 border-t border-gray-200 dark:border-white/5">
                    {user ? (
                        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer group transition-colors">
                            <div className="w-8 h-8 rounded-full bg-[#4f46e5] text-white flex items-center justify-center font-bold text-xs">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-grow min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                            </div>
                            <button onClick={handleLogout} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1">
                                <LogOut size={16} />
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => { setAuthReason('user_action'); setIsAuthModalOpen(true); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        >
                            <LogIn size={18} />
                            Entrar / Inscrever-se
                        </button>
                    )}
                 </div>
            </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col h-full relative bg-gray-50 dark:bg-[#030712] w-full transition-colors duration-300">
        
        {/* Mobile Header / Sidebar Toggle */}
        {!isSidebarOpen && (
             <div className="absolute top-4 left-4 z-20">
                <button 
                    onClick={() => setIsSidebarOpen(true)} 
                    className="p-2 bg-white dark:bg-[#1f2937] rounded-lg text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#374151] shadow-sm"
                >
                    <PanelLeft size={20} />
                </button>
            </div>
        )}

        <div className="flex-grow h-full overflow-hidden">
            {currentView === AppView.CHAT && (
                <Chat 
                    user={user}
                    checkUsageLimit={checkUsageLimit}
                    onHumanizeRequest={handleHumanizeRequest}
                    currentSession={getCurrentSession()}
                    onUpdateSession={handleSessionUpdate}
                />
            )}
            {currentView === AppView.HUMANIZER && (
                <HumanizerView 
                    initialText={humanizerInitialText}
                    checkUsageLimit={checkUsageLimit}
                />
            )}
            {currentView === AppView.STUDIO && (
                <div className="h-full p-4 md:p-8 max-w-6xl mx-auto flex flex-col">
                        <DocumentStudio 
                            checkUsageLimit={checkUsageLimit}
                        />
                </div>
            )}
        </div>
      </main>
    </div>
  );
};

const SessionItem: React.FC<{ session: ChatSession, isActive: boolean, onClick: () => void, onDelete: (e: React.MouseEvent) => void }> = ({ session, isActive, onClick, onDelete }) => (
    <div 
        onClick={onClick}
        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors ${
            isActive 
            ? 'bg-gray-200 dark:bg-[#1f2937] text-gray-900 dark:text-white' 
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200'
        }`}
    >
        <span className="truncate pr-6 flex-grow">{session.title}</span>
        
        {/* Options (Delete) */}
        <div className={`absolute right-2 top-1/2 -translate-y-1/2 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity bg-gray-200 dark:bg-[#1f2937] pl-2`}>
             <button onClick={onDelete} className="p-1 hover:text-red-500 text-gray-500 transition-colors">
                <Trash2 size={14} />
             </button>
        </div>
    </div>
);

export default App;