import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { User } from '../contexts/AuthContext';
import { auth, googleProvider } from '../lib/firebase';

interface LoginPageProps {
  onBack: () => void;
  onLoginSuccess?: () => void;
}

export function LoginPage({ onBack, onLoginSuccess }: LoginPageProps) {
  const { login } = useAuth();
  const { language } = useLanguage();
  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setGoogleError(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      const idToken = await firebaseUser.getIdToken();

      const userData: User = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email || 'Google User',
        email: firebaseUser.email || '',
        avatar: firebaseUser.photoURL || '',
        idToken,
      };

      login(userData);
      onLoginSuccess?.();
    } catch {
      setGoogleError(
        language === 'vi'
          ? 'Khong the dang nhap bang Google qua Firebase.'
          : 'Could not sign in with Google via Firebase.',
      );
    }
  };

  const handleGuestLogin = () => {
    const mockUser = {
      id: 'user_' + Date.now(),
      name: language === 'vi' ? 'Nguoi dung demo' : 'Demo User',
      email: 'demo@tiendat.com',
      avatar: 'https://ui-avatars.com/api/?name=Demo+User&background=8B0000&color=fff',
      idToken: null,
    };

    login(mockUser);
    onLoginSuccess?.();
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-none border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ArrowLeft size={16} />
            <span>{language === 'vi' ? 'Quay lai' : 'Back'}</span>
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md rounded-none bg-white p-8 shadow-2xl">
            <div className="mb-8 text-center">
              <div className="mb-4" style={{ fontSize: '1.5rem', color: '#B8860B' }}>
                Tien Dat
              </div>
              <h1 className="mb-2 text-2xl font-semibold text-gray-900">
                {language === 'vi' ? 'Dang nhap' : 'Login'}
              </h1>
              <p className="text-gray-500">
                {language === 'vi'
                  ? 'Dang nhap de luu thiet ke va theo doi don hang'
                  : 'Login to save designs and track orders'}
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={handleGoogleLogin}
                className="w-full rounded-none border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
              >
                {language === 'vi'
                  ? 'Dang nhap voi Google'
                  : 'Continue with Google'}
              </button>
              {googleError ? (
                <p className="text-center text-sm text-red-600">{googleError}</p>
              ) : null}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-4 text-gray-400">
                    {language === 'vi' ? 'hoac' : 'or'}
                  </span>
                </div>
              </div>

              <button
                onClick={handleGuestLogin}
                className="w-full rounded-none px-4 py-3 text-white transition-all"
                style={{ backgroundColor: '#8B0000' }}
              >
                {language === 'vi' ? 'Tiep tuc voi tu cach khach' : 'Continue as guest'}
              </button>
              <p className="text-center text-xs text-gray-400">
                {language === 'vi'
                  ? 'Tai khoan khach khong the luu thiet ke len cloud.'
                  : 'Guest mode cannot save designs to the cloud.'}
              </p>
            </div>

            <p className="mt-6 text-center text-xs text-gray-400">
              {language === 'vi'
                ? 'Bang cach dang nhap, ban dong y voi Dieu khoan dich vu va Chinh sach bao mat'
                : 'By logging in, you agree to our Terms of Service and Privacy Policy'}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
