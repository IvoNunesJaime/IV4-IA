import React, { useState } from 'react';
import { User } from '../types';
import { Mail, Lock, User as UserIcon, Chrome, X, Sparkles } from 'lucide-react';

interface AuthProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: User) => void;
}

export const Auth: React.FC<AuthProps> = ({ isOpen, onClose, onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fakeUser: User = {
      id: Date.now().toString(),
      email: email,
      name: name || email.split('@')[0],
    };
    
    localStorage.setItem('iv4_user', JSON.stringify(fakeUser));
    onLogin(fakeUser);
  };

  const handleGoogleLogin = () => {
      const fakeGoogleUser: User = {
          id: 'google-123',
          email: 'user@gmail.com',
          name: 'Utilizador Google'
      };
      localStorage.setItem('iv4_user', JSON.stringify(fakeGoogleUser));
      onLogin(fakeGoogleUser);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-800 relative overflow-hidden transition-colors">
        {/* Decorative background element */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
            <X size={20} />
        </button>

        <div className="text-center mb-8 pt-2">
            <div className="flex justify-center mb-4">
                <div className="bg-indigo-600 text-white p-3 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none">
                    <Sparkles size={24} />
                </div>
            </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {isLogin ? 'Bem-vindo de volta' : 'Crie a sua conta'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {isLogin ? 'Faça login para continuar sem limites' : 'Desbloqueie todo o potencial do IV4 IA'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1 ml-1">Nome</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <UserIcon size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-black dark:text-white"
                  placeholder="Seu nome"
                />
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1 ml-1">E-mail</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Mail size={18} />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-black dark:text-white"
                placeholder="nome@exemplo.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1 ml-1">Palavra-passe</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-black dark:text-white"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white font-medium py-3 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none mt-2"
          >
            {isLogin ? 'Entrar na Plataforma' : 'Criar Conta Grátis'}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-900 text-gray-500">Ou continue com</span>
            </div>
          </div>

          <button onClick={handleGoogleLogin} className="mt-4 w-full flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium">
            <Chrome size={20} className="text-gray-600 dark:text-gray-400" />
            Conta Google
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          {isLogin ? 'Ainda não tem conta?' : 'Já tem uma conta?'}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="ml-1 font-semibold text-indigo-600 hover:text-indigo-800 dark:hover:text-indigo-400 focus:outline-none hover:underline"
          >
            {isLogin ? 'Inscrever-se' : 'Entrar'}
          </button>
        </p>
      </div>
    </div>
  );
};