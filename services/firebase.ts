import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Configuração do Firebase fornecida
const firebaseConfig = {
  apiKey: "AIzaSyCnP4ybVgLtu7jHiSAZc2OGIga9IR5cPmM",
  authDomain: "iv4-ia.firebaseapp.com",
  projectId: "iv4-ia",
  storageBucket: "iv4-ia.firebasestorage.app",
  messagingSenderId: "812979853222",
  appId: "1:812979853222:web:2bce8b33e2655d7edb2167"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;