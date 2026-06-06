import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAA4eu4ndyFnBypdXPQ2oiyVTIjiHQTEyc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'official-tiendat.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'official-tiendat',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'official-tiendat.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '429219555473',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:429219555473:web:4aaad786c5ea2e33a5b730',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export function signOutFirebase() {
  return signOut(auth);
}
