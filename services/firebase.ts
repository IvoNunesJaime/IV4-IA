import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// IMPORTANTE: Em um ambiente de produção real, você deve obter esses valores
// do painel do Firebase Console (Configurações do Projeto).
// Como estamos em um ambiente simulado, você pode precisar substituir as strings abaixo
// pelas suas credenciais reais se as variáveis de ambiente não estiverem definidas.

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "SUA_API_KEY_AQUI",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "iv4-ia.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "iv4-ia",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;