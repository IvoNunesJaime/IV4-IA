import React, { useState } from 'react';
import { User } from '../types';
import { Mail, Lock, User as UserIcon, Chrome, X, Sparkles, Eye, EyeOff, ArrowRight, BookOpen, FileText, Zap } from 'lucide-react';

interface AuthProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: User) => void;
  triggerReason?: 'user_action' | 'limit_reached';
}

export const Auth: React.FC<AuthProps> = ({ isOpen, onClose, onLogin, triggerReason = 'user_action' }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulação de delay de banco de dados
    await new Promise(resolve => setTimeout(resolve, 1500));

    // AQUI: Em um app real, você faria uma chamada fetch para seu backend (ex: Supabase, Firebase)
    // const response = await fetch('/api/login', { method: 'POST', body: ... })
    
    const fakeUser: User = {
      id: Date.now().toString(),
      email: email,
      name: name || email.split('@')[0],
    };
    
    localStorage.setItem('iv4_user', JSON.stringify(fakeUser));
    onLogin(fakeUser);
    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
      setIsLoading(true);
      // Simulação de Auth Google
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const fakeGoogleUser: User = {
          id: 'google-123',
          email: 'user@gmail.com', // In a real app this would come from the provider
          name: 'Utilizador Google'
      };
      localStorage.setItem('iv4_user', JSON.stringify(fakeGoogleUser));
      onLogin(fakeGoogleUser);
      setIsLoading(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-2xl w-full max-w-[450px] border border-gray-100 dark:border-gray-800 relative overflow-hidden transition-colors flex flex-col max-h-[90vh]">
        
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors z-10"
        >
            <X size={20} />
        </button>

        <div className="overflow-y-auto custom-scrollbar">
            <div className="text-center mb-6 mt-2">
                {triggerReason === 'limit_reached' ? (
                    <div className="mb-6">
                         <div className="inline-flex justify-center mb-4">
                            <div className="bg-gradient-to-tr from-indigo-500 to-purple-600 text-white p-4 rounded-full shadow-lg shadow-indigo-500/30 animate-pulse">
                                <Sparkles size={32} />
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            Limite Gratuito Atingido
                        </h2>
                        <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 leading-relaxed">
                            Você utilizou suas 6 mensagens gratuitas. Para continuar e desbloquear o poder total do IV4 IA, faça login agora.
                        </p>

                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-left border border-gray-100 dark:border-gray-700/50">
                            <h3 className="text-xs font-bold text-gray-50 dark:text-gray-400 uppercase tracking-wider mb-3">Funcionalidades que vai desbloquear:</h3>
                            <ul className="space-y-2.5">
                                <li className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200">
                                    <div className="bg-indigo-100 dark:bg-indigo-900/30 p-1 rounded text-indigo-600 dark:text-indigo-400"><FileText size={14}/></div>
                                    Gerador de Trabalhos Escolares (Capa, Índice...)
                                </li>
                                <li className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200">
                                    <div className="bg-purple-100 dark:bg-purple-900/30 p-1 rounded text-purple-600 dark:text-purple-400"><Zap size={14}/></div>
                                    Humanizador de Texto Avançado
                                </li>
                                <li className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200">
                                    <div className="bg-green-100 dark:bg-green-900/30 p-1 rounded text-green-600 dark:text-green-400"><BookOpen size={14}/></div>
                                    Acesso ilimitado ao Estúdio de Documentos
                                </li>
                            </ul>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-center mb-6">
                            <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none rotate-3 hover:rotate-6 transition-transform">
                                <Sparkles size={28} />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            {isLogin ? 'Bem-vindo de volta' : 'Criar conta'}
                        </h1>
                    </>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
                <div>
                <div className="relative">
                    <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-transparent border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-black dark:text-white placeholder-gray-500"
                    placeholder="Nome completo"
                    />
                </div>
                </div>
            )}
            
            <div>
                <div className="relative">
                <input
                    type="email"
                    required
                    pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                    title="Por favor insira um endereço de email válido"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-transparent border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-black dark:text-white placeholder-gray-500"
                    placeholder="Endereço de e-mail (Ex: nome@email.com)"
                    />
                </div>
            </div>

            <div>
                <div className="relative">
                <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-transparent border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-black dark:text-white placeholder-gray-500 pr-10"
                    placeholder="Palavra-passe"
                />
                <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white font-medium py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none mt-2 flex items-center justify-center gap-2 disabled:opacity-70"
            >
                {isLoading ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                    isLogin ? 'Entrar / Continuar' : 'Criar Conta'
                )}
            </button>
            </form>

            <div className="my-6 flex items-center gap-3">
                <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
                <span className="text-xs text-gray-400 font-medium">OU</span>
                <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
            </div>

            <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium">
                <Chrome size={20} className="text-gray-900 dark:text-white" />
                Continuar com Google
            </button>
            
            <p className="text-xs text-center text-gray-500 dark:text-gray-500 mt-2">
                Recomendamos usar sua conta Google principal para melhor experiência.
            </p>

            <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
            <button
                onClick={() => setIsLogin(!isLogin)}
                className="ml-1 font-semibold text-indigo-600 hover:text-indigo-800 dark:hover:text-indigo-400 focus:outline-none hover:underline"
            >
                {isLogin ? 'Inscrever-se' : 'Entrar'}
            </button>
            </p>
        </div>
      </div>
    </div>
  );
};