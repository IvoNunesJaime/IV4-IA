import React, { useState, useEffect } from 'react';
import { Auth } from './components/Auth';
import { Chat } from './components/Chat';
import { DocumentStudio } from './components/DocumentStudio';
import { HumanizerView } from './components/HumanizerView';
import { User, AppView } from './types';
import { MessageSquare, FileText, LogOut, Menu, LogIn, Plus, Sparkles, Moon, Sun, RotateCcw } from 'lucide-react';

const FREE_USAGE_LIMIT = 5;

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.CHAT);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [humanizerInitialText, setHumanizerInitialText] = useState<string>('');

  useEffect(() => {
    const savedUser = localStorage.getItem('iv4_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    
    const savedUsage = localStorage.getItem('iv4_usage_count');
    if (savedUsage) setUsageCount(parseInt(savedUsage));

    // Check system preference or saved theme
    const savedTheme = localStorage.getItem('iv4_theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('iv4_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('iv4_theme', 'light');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('iv4_user');
    setUser(null);
    setCurrentView(AppView.CHAT);
  };

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    setIsAuthModalOpen(false);
  };

  const checkUsageLimit = (): boolean => {
    if (user) return true;

    if (usageCount >= FREE_USAGE_LIMIT) {
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

  const NavItem = ({ view, icon: Icon, label }: { view: AppView; icon: any; label: string }) => (
    <button
      onClick={() => {
        setCurrentView(view);
        setIsMobileMenuOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
        currentView === view
          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900 overflow-hidden font-sans transition-colors duration-200">
      <Auth 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onLogin={handleLoginSuccess} 
      />

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-200 ease-in-out w-64 bg-gray-50/50 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col z-30`}>
        <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
                    <Sparkles size={16} fill="white" />
                </div>
                <span className="font-bold text-lg text-gray-800 dark:text-white tracking-tight">IV4 IA</span>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-gray-500 dark:text-gray-400">
                <Menu size={20} />
            </button>
        </div>

        <div className="px-3 mb-4">
            <button 
                onClick={() => {
                    localStorage.removeItem('iv4_chat_history'); // Force clear before event
                    setCurrentView(AppView.CHAT);
                    window.dispatchEvent(new Event('iv4-new-chat')); 
                }}
                className="w-full flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-600 text-gray-700 dark:text-gray-200 px-4 py-2.5 rounded-lg shadow-sm transition-all group"
            >
                <Plus size={16} className="text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">Nova Conversa</span>
            </button>
        </div>
        
        <nav className="flex-grow px-3 space-y-1">
          <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 mt-4">Ferramentas</p>
          <NavItem view={AppView.CHAT} icon={MessageSquare} label="Chat" />
          <NavItem view={AppView.HUMANIZER} icon={RotateCcw} label="Humanizador" />
          <NavItem view={AppView.STUDIO} icon={FileText} label="Estúdio" />
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          
          <div className="flex items-center justify-between mb-4">
             <button onClick={toggleTheme} className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                {isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
             </button>
          </div>

          {user ? (
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[100px]">{user.name}</p>
                    </div>
                </div>
                <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 transition-colors" title="Sair">
                    <LogOut size={18} />
                </button>
            </div>
          ) : (
            <div>
                 <div className="mb-3 px-2">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-1">
                        <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min((usageCount / FREE_USAGE_LIMIT) * 100, 100)}%` }}></div>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 text-right">{FREE_USAGE_LIMIT - usageCount} ações restantes</p>
                </div>
                <button 
                    onClick={() => setIsAuthModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-black text-sm font-medium rounded-lg hover:bg-black dark:hover:bg-gray-200 transition-colors"
                >
                    <LogIn size={16} /> Entrar
                </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow flex flex-col h-full relative bg-white dark:bg-gray-900 transition-colors">
        {/* Mobile Header Toggle */}
        <div className="md:hidden absolute top-4 left-4 z-20">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                <Menu size={24} />
            </button>
        </div>

        {/* View Content */}
        <div className="flex-grow h-full overflow-hidden">
            {currentView === AppView.CHAT && (
                <Chat 
                    user={user}
                    checkUsageLimit={checkUsageLimit}
                    onHumanizeRequest={handleHumanizeRequest}
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
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 hidden md:block">Estúdio Académico</h1>
                        <div className="flex-grow min-h-0">
                        <DocumentStudio 
                            checkUsageLimit={checkUsageLimit}
                        />
                        </div>
                </div>
            )}
        </div>
      </main>
    </div>
  );
};

export default App;